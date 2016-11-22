/* global settings */
let fs = require('fs');  // Non-const enables test mocking
const path = require('path');
const Error = require('./error');

let nvsList = require('./list');  // Non-const enables test mocking
let nvsUse = require('./use');  // Non-const enables test mocking
let nvsLink = require('./link');  // Non-const enables test mocking
const NodeVersion = require('./version');

let nvsDownload = null;  // Delay-load
let nvsExtract = null;  // Delay-load

/**
 * Downloads and extracts a version of node.
 *
 * @param {NodeVersion} version The version to add.
 * @param {boolean} useNow True to use the added version now.
 */
function addAsync(version, useNow) {
    return nvsList.getRemoteVersionsAsync(version.remoteName).then(versions => {
        let resolvedVersion = nvsList.find(version, versions);
        if (!resolvedVersion) {
            throw new Error('Version ' +
                (version.semanticVersion || version.label) +
                ' not found in remote: ' + version.remoteName, Error.ENOENT);
        }

        version = resolvedVersion;
        let binPath = nvsUse.getVersionBinary(version);
        if (binPath) {
            if (useNow) {
                return nvsUse.use(version);
            } else {
                return ['Already added at: ' + nvsUse.homePath(binPath),
                    'To use this version now: nvs use ' + version];
            }
        } else {
            let versionPackage = version.packages.find(f => {
                return f.os === NodeVersion.defaultOs && f.arch === version.arch;
            });
            if (!versionPackage) {
                throw new Error('Platform package not available for version: ' + version);
            }

            version = versionPackage;

            // Clean up the directory first, in case there is a failed partial extraction.
            let versionDir = nvsUse.getVersionDir(version);
            removeDirectoryRecursive(versionDir);

            let remoteUri = settings.remotes[version.remoteName];
            return downloadAndExtractAsync(version, remoteUri).then(() => {
                if (version.label) {
                    fs.writeFileSync(path.join(nvsUse.getVersionDir(version), '.nvs'),
                        JSON.stringify({ label: version.label }, null, 2));
                }

                binPath = nvsUse.getVersionBinary(version);
                if (binPath) {
                    if (useNow) {
                        return nvsUse.use(version);
                    } else {
                        return ['Added at: ' + nvsUse.homePath(binPath),
                            'To use this version now: nvs use ' + version];
                    }
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
    let ext = path.basename(remoteUri).split('.').splice(1).join('.');
    let archiveFileName = version.remoteName + '-v' + version.semanticVersion +
            '-' + version.os + '-' + version.arch + ext;

    let shasumFileName;
    if (version.shasumUri) {
        shasumFileName = version.remoteName + '-v' +
            version.semanticVersion + '-SHASUMS256.txt';
    }

    let targetDir = mkdirs(
        settings.home,
        version.remoteName,
        version.semanticVersion,
        version.arch);

    nvsDownload = nvsDownload || require('./download');
    return nvsDownload.ensureFileCachedAsync(
        archiveFileName,
        version.uri,
        shasumFileName,
        version.shasumUri
    ).then(zipFilePath => {
        nvsExtract = nvsExtract || require('./extract');
        return nvsExtract.extractAsync(zipFilePath, targetDir);
    }).then(() => {
        // Guess the name of the top-level extracted directory.
        // There should be only one, and usually it starts with "node".
        let extractedDirs = fs.readdirSync(targetDir).filter(childName => {
            return fs.statSync(path.join(targetDir, childName)).isDirectory();
        });
        let extractedDirName = null;
        if (extractedDirs.length === 1) {
            extractedDirName = extractedDirs[0];
        } else {
            extractedDirName = extractedDirs.find(dirName => dirName.startsWith('node'));
            if (!extractedDirName) {
                throw new Error('Archive did not contain expected layout: ' + archiveFileName);
            }
        }

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

        // Older versions for Windows include an npmrc that sets prefix=${APPDATA}\npm.
        // Delete that file, so that the prefix defaults to the version directory.
        let npmrcFile = path.join(targetDir, 'node_modules', 'npm', 'npmrc');
        try {
            fs.unlinkSync(npmrcFile);
        } catch (e) {
            Error.throwIfNot(Error.ENOENT, e, 'Failed to delete file: ' + npmrcFile);
        }

        if (path.extname(archiveFileName).toLowerCase() === '.msi') {
            fs.readdirSync(targetDir).forEach(childName => {
                if (path.extname(childName).toLowerCase() === '.msi') {
                    // Remove the copy of the MSI package created by the extraction.
                    fs.unlinkSync(path.join(targetDir, childName));
                }
            });
        }
    }).catch(e => {
        removeDirectoryIfEmpty(targetDir);
        removeDirectoryIfEmpty(path.dirname(targetDir));
        removeDirectoryIfEmpty(path.dirname(path.dirname(targetDir)));
        throw e;
    });
}

/**
 * Removes a version of node.
 */
function remove(version) {
    let result = [];

    version.arch = version.arch || NodeVersion.defaultArch;

    // Unlink this version if it is linked.
    result = result.concat(nvsLink.unlink(version));

    let currentVersion = nvsUse.getCurrentVersion();
    if (currentVersion && NodeVersion.equal(currentVersion, version)) {
        // The specified version is currently in use. Remove it from the PATH.
        result = result.concat(nvsUse.use('default'));
    }

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
            Error.throwIfNot(Error.EEXIST, e,
                'Could not create directory: ' + subPath);
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
        Error.throwIfNot(Error.ENOENT, e, 'Cannot access directory: ' + dir);
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
        Error.throwIfNot(Error.ENOENT, e, 'Cannot access directory: ' + dir);
        return;
    }

    if (!childNames || childNames.length === 0) {
        fs.rmdirSync(dir);
    }
}

module.exports = {
    addAsync,
    remove,
};
