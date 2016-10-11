/* global settings */
let childProcess = require('child_process');  // Non-const enables test mocking
let fs = require('fs');  // Non-const enables test mocking
let http = require('http');  // Non-const enables test mocking
let https = require('https');  // Non-const enables test mocking
const path = require('path');
const Error = require('./error');

const nvsAvailable = require('./available');
let nvsUse = require('./use');  // Non-const enables test mocking
let nvsLink = require('./link');  // Non-const enables test mocking
const nvsVersion = require('./version');

/**
 * Lists all versions of node added by NVS.
 * @param remoteName Optional remote name filter for the listing.
 * @param semanticVersion Optional semantic version filter for the listing.
 * @param arch Optional processor architecture filter for the listing.
 */
function list(remoteName, semanticVersion, arch) {
    let readdirIfExists = dir => {
        try {
            return fs.readdirSync(dir);
        } catch (e) {
            if (e.code !== 'ENOENT') {
                throw new Error('Cannot access directory: ' + dir, e);
            }
            return [];
        }
    };

    let result = [];
    if (!remoteName) {
        // Scan all directories under the home directory, which might be remote names.
        let childNames = readdirIfExists(settings.home).sort();
        childNames.forEach(childName => {
            let childPath = path.join(settings.home, childName);
            let stats = fs.lstatSync(childPath);
            if (stats.isDirectory() && childName !== 'node_modules') {
                result = result.concat(list(childName, semanticVersion, arch));
            }
        });
    } else if (!semanticVersion) {
        // Scan all directories under the remote directory, which might be semantic versions.
        let childNames = readdirIfExists(path.join(settings.home, remoteName)).sort();
        childNames.forEach(childName => {
            let childPath = path.join(settings.home, remoteName, childName);
            let stats = fs.lstatSync(childPath);
            if (stats.isDirectory()) {
                result = result.concat(list(remoteName, childName, arch));
            }
        });
    } else if (!arch) {
        // Scan all directories under the semantic version directory, which might be architectures.
        let childNames = readdirIfExists(path.join(settings.home, remoteName, semanticVersion)).sort();
        childNames.forEach(childName => {
            let childPath = path.join(settings.home, remoteName, semanticVersion, childName);
            let stats = fs.lstatSync(childPath);
            if (stats.isDirectory()) {
                result = result.concat(list(remoteName, semanticVersion, childName));
            }
        });
    } else {
        // Check if a valid full version directory was found.
        let versionString = remoteName + '/' + semanticVersion + '/' + arch;
        if (nvsVersion.versionRegex.test(versionString)) {
            let version = { remoteName, semanticVersion, arch };
            let binPath = nvsUse.getVersionBinary(version);
            if (binPath) {
                let currentVersion = nvsUse.getCurrentVersion();
                let linkedVersion = nvsLink.getLinkedVersion();
                let isCurrent = currentVersion && nvsVersion.equal(currentVersion, version);
                let isLinked = linkedVersion && nvsVersion.equal(linkedVersion, version);
                result.push((isCurrent && isLinked ? '>#'
                    : isCurrent ? ' >' : isLinked ? ' #' : '  ') + versionString);
            }
        }
    }
    return result;
}

/**
 * Resolves a labeled version (lts or latest) to a semantic version,
 * according to the indications in the downloaded remote index.
 */
function resolveSemanticVersionAsync(version) {
    if (version.semanticVersion) {
        // A semantic version is already present, so there's nothing to resolve.
        return Promise.resolve(version);
    }

    // Download the index and use that to resolve a semantic version.
    return nvsAvailable.downloadIndexAsync(version.remoteName).then(remoteIndex => {
        let selectedBuild = null;
        if (Array.isArray(remoteIndex)) {
            let latest = null;
            let lts = null;
            if (remoteIndex.some(item => item.lts)) {
                latest = remoteIndex[0];
                lts = remoteIndex.find(item => item.lts);
            }

            if (!version.semanticVersion && version.label === 'latest' && latest) {
                selectedBuild = latest;
            } else if (!version.semanticVersion && version.label === 'lts' && lts) {
                selectedBuild = lts;
            } else if (version.semanticVersion) {
                selectedBuild = remoteIndex.find(item =>
                    item.version === 'v' + version.semanticVersion);
            }
        }

        if (!selectedBuild) {
            throw new Error('Version ' +
                (version.semanticVersion || version.label) +
                ' not found in remote: ' + version.remoteName);
        } else {
            version.semanticVersion = selectedBuild.version.substr(1);
            return version;
        }
    });
}

/**
 * Downloads and extracts a version of node.
 */
function addAsync(version) {
    return resolveSemanticVersionAsync(version).then(version => {
        let versionString =
            version.remoteName + '/' + version.semanticVersion + '/' + version.arch;
        let binPath = nvsUse.getVersionBinary(version);
        if (binPath) {
            return ['Already added at: ' + nvsUse.homePath(binPath),
                'To use this version now: nvs use ' + versionString];
        } else {
            let remoteUri = settings.remotes[version.remoteName];
            return downloadAsync(version, remoteUri).then(() => {
                if (!settings.quiet) {
                    console.log('');
                }
                binPath = nvsUse.getVersionBinary(version);
                if (binPath) {
                    return ['Added at: ' + nvsUse.homePath(binPath),
                        'To use this version now: nvs use ' + versionString];
                } else {
                    throw new Error('Add failed - executable file not found.');
                }
            });
        }
    });
}

/**
 * Downloads a version of node.
 */
function downloadAsync(version, remoteUri) {
    let zipFileExt = (nvsUse.isWindows ? '.zip' : '.tar.gz');
    let zipFileUri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') +
        'v' + version.semanticVersion + '/' +
        'node-v' + version.semanticVersion + '-' +
        version.os + '-' + version.arch + zipFileExt;

    let targetDir = mkdirs(
        settings.home,
        version.remoteName,
        version.semanticVersion,
        version.arch);
    let zipFilePath = path.join(targetDir, 'node' + zipFileExt);
    let exists = false;
    try {
        fs.accessSync(zipFilePath);
        exists = true;
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Cannot access file: ' + zipFilePath, e);
        }
        exists = false;
    }

    if (exists) {
        // TODO: Verify hash of downloaded file?
        extract(version, zipFilePath);
        return Promise.resolve();
    }

    if (!settings.quiet) {
        console.log('Downloading ' + version.remoteName +
            '/' + version.semanticVersion + '/' + version.arch + '...');
        console.log('  ' + nvsUse.homePath(zipFileUri) + ' -> ' +
            nvsUse.homePath(zipFilePath));
    }

    let stream = null;
    return new Promise((resolve, reject) => {
        try {
            stream = fs.createWriteStream(zipFilePath);

            let client = zipFileUri.startsWith('https:') ? https : http;
            client.get(zipFileUri, (res) => {
                if (res.statusCode === 200) {
                    res.pipe(stream).on('finish', () => {
                        // TODO: Verify hash of downloaded file?
                        extract(version, zipFilePath);
                        resolve();
                    });
                } else if (res.statusCode === 404) {
                    reject(new Error('File not available: ' + zipFileUri,
                        new Error('HTTP response status: ' + res.statusCode)));
                } else {
                    reject(new Error('Failed to download file: ' + zipFileUri,
                        new Error('HTTP response status: ' + res.statusCode)));
                }
            }).on('error', (e) => {
                reject(new Error(
                    'Failed to download ' + zipFileUri, e));
            });
        } catch (e) {
            reject(new Error('Failed to download ' + zipFileUri, e));
        }
    }).catch(e => {
        try {
            if (stream) stream.end();
            fs.unlinkSync(zipFilePath);
        } catch (e2) {}
        removeDirectoryIfEmpty(targetDir);
        removeDirectoryIfEmpty(path.dirname(targetDir));
        removeDirectoryIfEmpty(path.dirname(path.dirname(targetDir)));
        throw e;
    });
}

/**
 * Extracts a downloaded node archive into the same directory as the archive.
 */
function extract(version, zipFilePath) {
    let targetDir = path.dirname(zipFilePath);

    if (!settings.quiet) {
        console.log('Extracting...');
        console.log('  ' + nvsUse.homePath(zipFilePath) + ' -> ' +
            nvsUse.homePath(targetDir));
    }

    let child;
    if (nvsUse.isWindows) {
        let unzipScript = path.join(__dirname, 'unzip.js');
        child = childProcess.spawnSync(
            'cscript.exe',
            [ '//B', unzipScript, zipFilePath, targetDir ],
            { stdio: 'inherit' });
        if (child.error) {
            throw new Error('Failed to expand .zip archive.', child.error);
        } else if (child.status) {
            throw new Error('Unzip script exited with code: ' + child.status);
        }
    } else {
        child = childProcess.spawnSync(
            'tar',
            [ '-zxf', zipFilePath, '-C', targetDir ],
            { stdio: 'inherit' });
        if (child.error) {
            throw new Error('Failed to expand .tar.gz archive.', child.error);
        } else if (child.status) {
            throw new Error('Tar exited with code: ' + child.status);
        }
    }

    fs.unlinkSync(zipFilePath);

    let extractedDirName =
        'node-v' + version.semanticVersion + '-' + version.os + '-' + version.arch;
    let extractedDirPath = path.join(targetDir, extractedDirName);

    // Move the extracted files up one directory.
    let childNames = fs.readdirSync(extractedDirPath);
    childNames.forEach(childName => {
        let oldPath = path.join(extractedDirPath, childName);
        let newPath = path.join(targetDir, childName);
        fs.renameSync(oldPath, newPath);
    });

    // Remove the now-empty directory.
    fs.rmdirSync(extractedDirPath);
}

/**
 * Removes a version of node.
 */
function remove(version) {
    let currentVersion = nvsUse.getCurrentVersion();
    if (currentVersion && nvsVersion.equal(currentVersion, version)) {
        // The specified version is currently in use. Remove it from the PATH.
        nvsUse.use(null);
    }

    // Unlink this version if it is linked.
    nvsLink.unlink(version);

    // Remove all contents of the version directory,
    // along with parent directories if they are empty.
    let versionDir = nvsUse.getVersionDir(version);
    removeDirectoryRecursive(versionDir);
    removeDirectoryIfEmpty(path.dirname(versionDir));
    removeDirectoryIfEmpty(path.dirname(path.dirname(versionDir)));
}

/**
 * Creates a hierarchy of directories as necessary.
 */
function mkdirs(/* arguments */) {
    let pathParts = Array.from(arguments);
    for (let i = 0; i < pathParts.length; i++) {
        let subPath = path.join(...pathParts.slice(0, i + 1));
        try {
            fs.mkdirSync(subPath);
        } catch (e) {
            if (e.code !== 'EEXIST') {
                throw new Error('Could not create directory: ' + subPath + '. ' + e);
            }
        }
    }
    return path.join(...pathParts);
}

/**
 * Removes a directory and all files and directories under it.
 */
function removeDirectoryRecursive(dir) {
    let childNames;
    try {
        childNames = fs.readdirSync(dir);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Cannot access directory: ' + dir + '. ' + e);
        }
        return;
    }

    childNames.forEach(childName => {
        let childPath = path.join(dir, childName);
        let stats = fs.lstatSync(childPath);
        if (stats.isDirectory()) {
            removeDirectoryRecursive(childPath);
        } else {
            fs.unlinkSync(childPath);
        }
    });

    fs.rmdirSync(dir);
}

/**
 * Removes a directory only if it is empty.
 */
function removeDirectoryIfEmpty(dir) {
    let childNames;
    try {
        childNames = fs.readdirSync(dir);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Cannot access directory: ' + dir + '. ' + e);
        }
        return;
    }

    if (!childNames || childNames.length === 0) {
        fs.rmdirSync(dir);
    }
}

module.exports = {
    list,
    addAsync,
    remove,
};
