/* global settings */
let fs = require('fs');  // Non-const enables test mocking
const path = require('path');
const Error = require('./error');

const nvsAvailable = require('./available');
let nvsUse = require('./use');  // Non-const enables test mocking
let nvsLink = require('./link');  // Non-const enables test mocking
let nvsDownload = require('./download');  // Non-const enables test mocking
let nvsExtract = require('./extract');  // Non-const enables test mocking
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
            } else if (!version.semanticVersion && version.label.startsWith('lts-')) {
                let ltsName = version.label.substr(4).toLowerCase();
                selectedBuild = remoteIndex.find(
                    item => item.lts && item.lts.toLowerCase() === ltsName);
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
            return downloadAndExtractAsync(version, remoteUri).then(() => {
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
 * Downloads and extracts a version of node.
 */
function downloadAndExtractAsync(version, remoteUri) {
    let archiveFileName, archiveFileUri;
    let useMsi = nvsUse.isWindows && useMsiPackage(version);
    if (useMsi) {
        // Special case for versions where there is no .7z or .zip package for Windows.
        // The MSI package will be extracted instead.
        archiveFileName = version.remoteName + '-v' + version.semanticVersion +
            '-' + version.arch + '.msi';
        archiveFileUri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') +
            'v' + version.semanticVersion + '/' + 'node-v' + version.semanticVersion +
            '-' + version.arch + '.msi';
    } else {
        let archiveFileExt = (nvsUse.isWindows ? '.7z'
            : process.env['NVS_USE_XZ'] === '1' ? '.tar.xz' : '.tar.gz');
        archiveFileName = version.remoteName + '-v' + version.semanticVersion +
            '-' + version.os + '-' + version.arch + archiveFileExt;
        archiveFileUri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') +
            'v' + version.semanticVersion + '/' + 'node-v' + version.semanticVersion +
            '-' + version.os + '-' + version.arch + archiveFileExt;
    }

    let shasumFileName = version.remoteName + '-v' +
        version.semanticVersion + '-SHASUMS256.txt';
    let shasumFileUri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') +
        'v' + version.semanticVersion + '/SHASUMS256.txt';

    let targetDir = mkdirs(
        settings.home,
        version.remoteName,
        version.semanticVersion,
        version.arch);

    return nvsDownload.ensureFileCachedAsync(
        archiveFileName,
        archiveFileUri,
        shasumFileName,
        shasumFileUri
    ).then(zipFilePath => {
        return nvsExtract.extractAsync(zipFilePath, targetDir);
    }).then(() => {
        let extractedDirName = useMsi ? 'nodejs'
            : 'node-v' + version.semanticVersion + '-' + version.os + '-' + version.arch;
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

        if (useMsi) {
            // Remove the copy of the MSI package created by the extraction.
            fs.unlinkSync(path.join(targetDir, archiveFileName));
        }
    }).catch(e => {
        removeDirectoryIfEmpty(targetDir);
        removeDirectoryIfEmpty(path.dirname(targetDir));
        removeDirectoryIfEmpty(path.dirname(path.dirname(targetDir)));
        throw e;
    });
}

function useMsiPackage(version) {
    // Official Node.js builds from before about July 2016 did not publish .7z or .zip
    // archives for Windows. For those versions, the MSI package is used instead.
    // It contains all the same files, but is a little bigger and slower to extract.
    // The MSI is not actually installed, though it is assumed that the contained
    // files are laid out in a consistent way.
    // (This condition assumes the remote name for offical Node.js builds is 'node'.)
    return settings.useMsi || (version.remoteName === 'node' && (
        /^4\.[0-4]\./.test(version.semanticVersion) ||
        /^5\./.test(version.semanticVersion) ||
        /^6\.[0-1]\./.test(version.semanticVersion) ||
        /^6\.2\.0/.test(version.semanticVersion)
    ));
}

/**
 * Removes a version of node.
 */
function remove(version) {
    let result = [];

    let currentVersion = nvsUse.getCurrentVersion();
    if (currentVersion && nvsVersion.equal(currentVersion, version)) {
        // The specified version is currently in use. Remove it from the PATH.
        result = result.concat(nvsUse.use(null));
    }

    // Unlink this version if it is linked.
    result = result.concat(nvsLink.unlink(version));

    // Remove all contents of the version directory,
    // along with parent directories if they are empty.
    let versionDir = nvsUse.getVersionDir(version);
    removeDirectoryRecursive(versionDir);
    removeDirectoryIfEmpty(path.dirname(versionDir));
    removeDirectoryIfEmpty(path.dirname(path.dirname(versionDir)));

    result.push('- ' + versionDir);

    return result;
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
                throw new Error('Could not create directory: ' + subPath + '.', e);
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
            throw new Error('Cannot access directory: ' + dir + '. ', e);
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
            throw new Error('Cannot access directory: ' + dir + '. ', e);
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
