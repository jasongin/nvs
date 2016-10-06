/* global settings */
var childProcess = require('child_process');
var fs = require('fs');
var http = require('http');
var https = require('https');
var os = require('os');
var path = require('path');

var nvsAvailable = require('./available');
var nvsEnv = require('./env');
var nvsVersion = require('./version');

/**
 * Lists all versions of node installed by NVS.
 * @param feedName Optional feed name filter for the listing.
 * @param semanticVersion Optional semantic version filter for the listing.
 * @param arch Optional processor architecture filter for the listing.
 */
function list(feedName, semanticVersion, arch) {
    var readdirIfExists = dir => {
        try {
            return fs.readdirSync(dir);
        } catch (e) {
            if (e.code !== 'ENOENT') {
                throw new Error('Cannot access directory: ' + dir + '. ' + e.message);
            }
            return [];
        }
    };

    var output = '';
    if (!feedName) {
        // Scan all directories under the home directory, which might be feed names.
        let childNames = readdirIfExists(settings.home).sort();
        childNames.forEach(childName => {
            var childPath = path.join(settings.home, childName);
            var stats = fs.lstatSync(childPath);
            if (stats.isDirectory()) {
                output += list(childName, semanticVersion, arch);
            }
        });
    } else if (!semanticVersion) {
        // Scan all directories under the feed directory, which might be semantic versions.
        let childNames = readdirIfExists(path.join(settings.home, feedName)).sort();
        childNames.forEach(childName => {
            var childPath = path.join(settings.home, feedName, childName);
            var stats = fs.lstatSync(childPath);
            if (stats.isDirectory()) {
                output += list(feedName, childName, arch);
            }
        });
    } else if (!arch) {
        // Scan all directories under the semantic version directory, which might be architectures.
        let childNames = readdirIfExists(path.join(settings.home, feedName, semanticVersion)).sort();
        childNames.forEach(childName => {
            var childPath = path.join(settings.home, feedName, semanticVersion, childName);
            var stats = fs.lstatSync(childPath);
            if (stats.isDirectory()) {
                output += list(feedName, semanticVersion, childName);
            }
        });
    } else {
        // Check if a valid full version directory was found.
        var versionString = feedName + '/' + semanticVersion + '/' + arch;
        if (nvsVersion.versionRegex.test(versionString)) {
            var version = { feedName, semanticVersion, arch };
            var binPath = nvsEnv.getVersionBinary(version);
            if (binPath) {
                var currentVersion = nvsEnv.getCurrentVersion();
                var linkedVersion = nvsEnv.getLinkedVersion();
                var isCurrent = currentVersion && nvsVersion.equal(currentVersion, version);
                var isLinked = linkedVersion && nvsVersion.equal(linkedVersion, version);
                output =
                    (isCurrent && isLinked ? '>#' : isCurrent ? ' >' : isLinked ? ' #' : '  ') +
                    versionString + os.EOL;
            }
        }
    }
    return output;
}

/**
 * Resolves a labeled version (lts or latest) to a semantic version,
 * according to the indications in the downloaded feed index.
 */
function resolveSemanticVersionAsync(version) {
    if (version.semanticVersion) {
        // A semantic version is already present, so there's nothing to resolve.
        return Promise.resolve(version);
    }

    // Download the index and use that to resolve a semantic version.
    return nvsAvailable.downloadIndexAsync(version.feedName).then(feedIndex => {
        var selectedBuild = null;
        if (Array.isArray(feedIndex)) {
            var latest = null;
            var lts = null;
            if (feedIndex.some(item => item.lts)) {
                latest = feedIndex[0];
                lts = feedIndex.find(item => item.lts);
            }

            if (!version.semanticVersion && version.label === 'latest' && latest) {
                selectedBuild = latest;
            } else if (!version.semanticVersion && version.label === 'lts' && lts) {
                selectedBuild = lts;
            } else if (version.semanticVersion) {
                selectedBuild = feedIndex.find(item =>
                    item.version === 'v' + version.semanticVersion);
            }
        }

        if (!selectedBuild) {
            throw new Error('Version ' +
                (version.semanticVersion || version.label) +
                ' not found in feed: ' + version.feedName);
        } else {
            version.semanticVersion = selectedBuild.version.substr(1);
            return version;
        }
    });
}

/**
 * Downloads and installs a version of node.
 */
function installAsync(version) {
    return resolveSemanticVersionAsync(version).then(version => {
        var versionString =
            version.feedName + '/' + version.semanticVersion + '/' + version.arch;
        var binPath = nvsEnv.getVersionBinary(version);
        if (binPath) {
            return 'Already installed at: ' + nvsEnv.homePath(binPath) + os.EOL +
                'To use this version now: nvs use ' + versionString + os.EOL;
        } else {
            var feedUri = settings.feeds[version.feedName];
            return downloadAsync(version, feedUri).then(() => {
                console.log('');
                binPath = nvsEnv.getVersionBinary(version);
                return 'Installed at: ' + nvsEnv.homePath(binPath) + os.EOL +
                    'To use this version now: nvs use ' + versionString + os.EOL;
            });
        }
    });
}

/**
 * Downloads a version of node.
 */
function downloadAsync(version, feedUri) {
    var zipFileExt = (nvsEnv.isWindows ? '.zip' : '.tar.gz');
    var zipFileUri = feedUri + (feedUri.endsWith('/') ? '' : '/') +
        'v' + version.semanticVersion + '/' +
        'node-v' + version.semanticVersion + '-' +
        version.os + '-' + version.arch + zipFileExt;

    var targetDir = mkdirs(
        settings.home,
        version.feedName,
        version.semanticVersion,
        version.arch);
    var zipFilePath = path.join(targetDir, 'node' + zipFileExt);
    var exists = false;
    try {
        fs.accessSync(zipFilePath);
        exists = true;
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Cannot access file: ' + zipFilePath + '. ' + e.message);
        }
        exists = false;
    }

    if (exists) {
        // TODO: Verify hash of downloaded file?
        extract(version, zipFilePath);
        return Promise.resolve();
    }

    console.log('Downloading ' + version.feedName +
        '/' + version.semanticVersion + '/' + version.arch + '...');
    console.log('  ' + nvsEnv.homePath(zipFileUri) + ' -> ' +
        nvsEnv.homePath(zipFilePath));
    return new Promise((resolve, reject) => {
        try {
            var stream = fs.createWriteStream(zipFilePath);

            var client = zipFileUri.startsWith('https:') ? https : http;
            client.get(zipFileUri, (res) => {
                res.pipe(stream).on('finish', () => {
                    // TODO: Verify hash of downloaded file?
                    extract(version, zipFilePath);
                    resolve();
                });
            }).on('error', (e) => {
                reject(new Error(
                    'Failed to download ' + zipFileUri + '. ' + e.message));
                stream.end();
                fs.unlinkSync(zipFilePath);
            });
        } catch (e) {
            reject(new Error('Failed to download ' + zipFileUri + '. ' + e.message));
        }
    });
}

/**
 * Extracts a downloaded node archive into the same directory as the archive.
 */
function extract(version, zipFilePath) {
    var targetDir = path.dirname(zipFilePath);
    console.log('Extracting...');
    console.log('  ' + nvsEnv.homePath(zipFilePath) + ' -> ' +
        nvsEnv.homePath(targetDir));

    var child;
    if (nvsEnv.isWindows) {
        var unzipScript = path.join(__dirname, 'unzip.js');
        child = childProcess.spawnSync(
            'cscript.exe',
            [ '//B', unzipScript, zipFilePath, targetDir ],
            { stdio: 'inherit' });
        if (child.error) {
            throw new Error('Failed to expand .zip archive. ' + child.error.message);
        } else if (child.status) {
            throw new Error('Unzip script exited with code: ' + child.status);
        }
    } else {
        child = childProcess.spawnSync(
            'tar',
            [ '-zxf', zipFilePath, '-C', targetDir ],
            { stdio: 'inherit' });
        if (child.error) {
            throw new Error('Failed to expand .tar.gz archive. ' + child.error.message);
        } else if (child.status) {
            throw new Error('Tar exited with code: ' + child.status);
        }
    }

    fs.unlinkSync(zipFilePath);

    var extractedDirName =
        'node-v' + version.semanticVersion + '-' + version.os + '-' + version.arch;
    var extractedDirPath = path.join(targetDir, extractedDirName);

    // Move the extracted files up one directory.
    var childNames = fs.readdirSync(extractedDirPath);
    childNames.forEach(childName => {
        var oldPath = path.join(extractedDirPath, childName);
        var newPath = path.join(targetDir, childName);
        fs.renameSync(oldPath, newPath);
    });

    // Remove the now-empty directory.
    fs.rmdirSync(extractedDirPath);
}

/**
 * Uninstalls a version of node.
 */
function uninstall(version) {
    var currentVersion = nvsEnv.getCurrentVersion();
    if (currentVersion && nvsVersion.equal(currentVersion, version)) {
        // The specified version is currently in use. Remove it from the PATH.
        nvsEnv.use(null);
    }

    // Unlink this version if it is currently linked.
    nvsEnv.unlink(version);

    // Remove all contents of the version directory,
    // along with parent directories if they are empty.
    var versionDir = nvsEnv.getVersionDir(version);
    removeDirectoryRecursive(versionDir);
    removeDirectoryIfEmpty(path.dirname(versionDir));
    removeDirectoryIfEmpty(path.dirname(path.dirname(versionDir)));
}

/**
 * Creates a hierarchy of directories as necessary.
 */
function mkdirs(/* arguments */) {
    var pathParts = Array.from(arguments);
    for (var i = 0; i < pathParts.length; i++) {
        var subPath = path.join(...pathParts.slice(0, i + 1));
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
    var childNames;
    try {
        childNames = fs.readdirSync(dir);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Cannot access directory: ' + dir + '. ' + e);
        }
        return;
    }

    childNames.forEach(childName => {
        var childPath = path.join(dir, childName);
        var stats = fs.statSync(childPath);
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
    var childNames;
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
    installAsync,
    uninstall,
};
