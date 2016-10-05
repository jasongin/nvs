const childProcess = require('child_process');
const fs = require('./afs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

const nvsAvailable = require('./available');
const nvsEnv = require('./env');
const nvsVersion = require('./version');

function listAsync(feedName, semanticVersion, arch) {
    if (!feedName) {
        // Scan all directories under the home directory, which might be feed names.
        return fs.readdirAsync(nvsEnv.homeDir).then(files => {
            files.sort();
            var scanChildAsync = (files, i) => {
                if (files[i]) {
                    var childPath = path.join(nvsEnv.homeDir, files[i]);
                    return fs.lstatAsync(childPath).then(stats => {
                        if (stats.isDirectory()) {
                            return listAsync(files[i]).then(output => {
                                return scanChildAsync(files, i + 1).then(output2 => {
                                    return output + output2;
                                });
                            });
                        } else {
                            return scanChildAsync(files, i + 1);
                        }
                    });
                } else {
                    return Promise.resolve('');
                }
            };
            return scanChildAsync(files, 0);
        });
    } else if (!semanticVersion) {
        // Scan all directories under the feed directory, which might be semantic versions.
        return fs.readdirAsync(path.join(nvsEnv.homeDir, feedName)).then(files => {
            files.sort();
            var scanChildAsync = (files, i) => {
                if (files[i]) {
                    var childPath = path.join(nvsEnv.homeDir, feedName, files[i]);
                    return fs.lstatAsync(childPath).then(stats => {
                        if (stats.isDirectory()) {
                            return listAsync(feedName, files[i]).then(output => {
                                return scanChildAsync(files, i + 1).then(output2 => {
                                    return output + output2;
                                });
                            });
                        } else {
                            return scanChildAsync(files, i + 1);
                        }
                    });
                } else {
                    return Promise.resolve('');
                }
            };
            return scanChildAsync(files, 0);
        });
    } else if (!arch) {
        // Scan all directories under the semantic version directory, which might be architectures.
        return fs.readdirAsync(path.join(nvsEnv.homeDir, feedName, semanticVersion)).then(files => {
            files.sort();
            var scanChildAsync = (files, i) => {
                if (files[i]) {
                    var childPath = path.join(nvsEnv.homeDir, feedName, semanticVersion, files[i]);
                    return fs.lstatAsync(childPath).then(stats => {
                        if (stats.isDirectory()) {
                            return listAsync(feedName, semanticVersion, files[i]).then(output => {
                                return scanChildAsync(files, i + 1).then(output2 => {
                                    return output + output2;
                                });
                            });
                        } else {
                            return scanChildAsync(files, i + 1);
                        }
                    });
                } else {
                    return Promise.resolve('');
                }
            };
            return scanChildAsync(files, 0);
        });
    } else {
        // Check if a valid version directory was found.
        var versionString = feedName + '/' + semanticVersion + '/' + arch;
        if (nvsVersion.versionRegex.test(versionString)) {
            var version = { feedName, semanticVersion, arch };
            return getPathAsync(version).then(installedPath => {
                if (installedPath) {
                    var currentVersion = nvsEnv.getCurrentVersion();
                    var isCurrent = currentVersion && nvsVersion.equal(currentVersion, version);
                    return (isCurrent ? '>' : ' ') + versionString + os.EOL;
                } else {
                    return '';
                }
            });
        } else {
            return Promise.resolve('');
        }
    }
}

function getPathAsync(version) {
    if (!version) {
        version = nvsEnv.getCurrentVersion();
        if (!version) {
            return null;
        }
    }

    if (version.namedVersion && !version.semanticVersion) {
        // A named version (latest or lts) was specified.
        // Download the index to resolve it to a semantic version.
        return nvsAvailable.downloadIndexAsync(version.feedName).then(feedIndex => {
            var selectedBuild = null;
            if (Array.isArray(feedIndex)) {
                var latest = null;
                var lts = null;
                if (feedIndex.some(item => item.lts)) {
                    latest = feedIndex[0];
                    lts = feedIndex.find(item => item.lts);
                }

                if (!version.semanticVersion && version.namedVersion === 'latest' && latest) {
                    selectedBuild = latest;
                } else if (!version.semanticVersion && version.namedVersion === 'lts' && lts) {
                    selectedBuild = lts;
                } else if (version.semanticVersion) {
                    selectedBuild = feedIndex.find(item =>
                        item.version === 'v' + version.semanticVersion);
                }
            }

            if (!selectedBuild) {
                throw new Error('Version ' +
                    (version.semanticVersion || version.namedVersion) +
                    ' not found in feed: ' + version.feedName);
            } else {
                version.semanticVersion = selectedBuild.version.substr(1);
                return getPathAsync(version);
            }
        });
    } else {
        // A specific version was specified.
        // Resolve it to a path and check if the binary exists.
        var nodeBinPath = path.join(
            nvsEnv.getVersionDir(version), (nvsEnv.isWindows ? 'node.exe' : 'bin/node'));
        return fs.accessAsync(nodeBinPath, fs.constants.X_OK).then(() => {
            return nodeBinPath;
        }, e => {
            if (e.code !== 'ENOENT') {
                return Promise.reject(e);
            }
            return null;
        });
    }
}

function installAsync(version) {
    return getPathAsync(version).then(installedPath => {
        var versionString =
            version.feedName + '/' + version.semanticVersion + '/' + version.arch;

        if (installedPath) {
            return 'Already installed at: ' + installedPath + os.EOL +
                'To use this version now: nvs use ' + versionString + os.EOL;
        } else {
            var feedUri = nvsAvailable.feedMap[version.feedName];
            return downloadAsync(version, feedUri).then(() => {
                console.log('');
                return getPathAsync(version).then(installedPath => {
                    return 'Installed at: ' + installedPath + os.EOL +
                        'To use this version now: nvs use ' + versionString + os.EOL;
                });
            });
        }
    });
}

function downloadAsync(version, feedUri) {
    var zipFileExt = (nvsEnv.isWindows ? '.zip' : '.tar.gz');
    var zipFileUri = feedUri + (feedUri.endsWith('/') ? '' : '/') +
        'v' + version.semanticVersion + '/' +
        'node-v' + version.semanticVersion + '-' +
        version.os + '-' + version.arch + zipFileExt;

    return mkdirsAsync(
        nvsEnv.homeDir,
        version.feedName,
        version.semanticVersion,
        version.arch).then(dirPath => {
            var zipFilePath = path.join(dirPath, 'node' + zipFileExt);

            return fs.accessAsync(zipFilePath).then(() => {
                // TODO: Verify hash of downloaded file?
                return extractAsync(version, zipFilePath);
            }, e => {
                if (e.code !== 'ENOENT') {
                    return Promise.reject(e);
                }

                console.log('Downloading ' + version.feedName +
                    '/' + version.semanticVersion + '/' + version.arch + '...');
                console.log('  ' + zipFileUri + ' -> ' + zipFilePath);
                return new Promise((resolve, reject) => {
                    try {
                        var stream = fs.createWriteStream(zipFilePath);

                        var client = zipFileUri.startsWith('https:') ? https : http;
                        client.get(zipFileUri, (res) => {
                            res.pipe(stream).on('finish', () => {
                                // TODO: Verify hash of downloaded file?
                                resolve(extractAsync(version, zipFilePath));
                            });
                        }).on('error', (e) => {
                            reject(new Error(
                                'Failed to download ' + zipFileUri + '. ' + e.message));
                            stream.end();
                            fs.unlink(zipFilePath);
                        });
                    } catch (e) {
                        throw new Error('Failed to download ' + zipFileUri + '. ' + e.message);
                    }
                });
            });
        });
}

function mkdirsAsync(/* arguments */) {
    var mkdirAsync = (pathParts, i) => {
        if (pathParts[i]) {
            var subPath = path.join(...pathParts.slice(0, i + 1));
            return fs.accessAsync(subPath).then(() => {
                return mkdirAsync(pathParts, i + 1);
            }, e => {
                if (e.code !== 'ENOENT') {
                    return Promise.reject(e);
                }
                return fs.mkdirAsync(subPath).then(() => {
                    return mkdirAsync(pathParts, i + 1);
                });
            });
        } else {
            return Promise.resolve(path.join(...pathParts));
        }
    };
    return mkdirAsync(Array.from(arguments), 0);
}

function extractAsync(version, zipFilePath) {
    var targetDir = path.dirname(zipFilePath);
    console.log('Extracting...');
    console.log('  ' + zipFilePath + ' -> ' + targetDir);

    return new Promise((resolve, reject) => {
        var child;
        if (nvsEnv.isWindows) {
            var unzipScript = path.join(__dirname, 'unzip.js');
            child = childProcess.spawn(
                'cscript.exe',
                [ '//B', unzipScript, zipFilePath, targetDir ],
                { stdio: 'inherit' });
            child.on('close', code => {
                if (code) {
                    reject(new Error('Unzip script exited with code: ' + code));
                } else {
                    resolve();
                }
            });
            child.on('error', e => {
                reject(new Error('Failed to expand .zip archive. ' + e.message));
            });
        } else {
            child = childProcess.spawn(
                'tar',
                [ '-zxf', zipFilePath, '-C', targetDir ],
                { stdio: 'inherit' });
            child.on('close', code => {
                if (code) {
                    reject(new Error('Tar exited with code: ' + code));
                } else {
                    resolve();
                }
            });
            child.on('error', e => {
                reject(new Error('Failed expand .tar.gz archive. ' + e.message));
            });
        }
    }).then(() => {
        return fs.unlinkAsync(zipFilePath);
    }).then(() => {
        return finishInstallAsync(version, targetDir);
    });
}

function finishInstallAsync(version, targetDir) {
    // Move the extracted files up one directory.
    var extractedDirName =
        'node-v' + version.semanticVersion + '-' + version.os + '-' + version.arch;
    var extractedDirPath = path.join(targetDir, extractedDirName);
    return fs.readdirAsync(extractedDirPath).then(files => {
        var moveUpAsync = (files, i) => {
            if (files[i]) {
                var oldPath = path.join(extractedDirPath, files[i]);
                var newPath = path.join(targetDir, files[i]);
                return fs.renameAsync(oldPath, newPath).then(() => {
                    return moveUpAsync(files, i + 1);
                });
            } else {
                // Remove the now-empty directory.
                fs.rmdirAsync(extractedDirPath);
            }
        };
        return moveUpAsync(files, 0);
    });
}

function uninstallAsync(version, skipInUseCheck) {
    if (!skipInUseCheck) {
        var currentVersion = nvsEnv.getCurrentVersion();
        if (currentVersion && nvsVersion.equal(currentVersion, version)) {
            // The specified version is currently in use. Remove it from the PATH.
            return nvsEnv.useAsync().then(() => {
                return uninstallAsync(version, true);
            });
        }
    }

    var versionDir = nvsEnv.getVersionDir(version);
    return fs.accessAsync(versionDir, fs.constants.X_OK).then(() => {
        // Remove all contents of the version directory,
        // along with parent directories if they are empty.
        return removeDirectoryRecursiveAsync(versionDir).then(() => {
            return removeDirectoryIfEmptyAsync(path.dirname(versionDir));
        }).then(() => {
            return removeDirectoryIfEmptyAsync(
                path.dirname(path.dirname(versionDir)));
        });
    }, e => {
        if (e.code !== 'ENOENT') {
            return Promise.reject(e);
        }

        return removeDirectoryIfEmptyAsync(path.dirname(versionDir)).then(() => {
            return removeDirectoryIfEmptyAsync(
                path.dirname(path.dirname(versionDir)));
        });
    });
}

function removeDirectoryRecursiveAsync(dir) {
    return fs.readdirAsync(dir).then(files => {
        var removeChildAsync = (files, i) => {
            if (files[i]) {
                var childPath = path.join(dir, files[i]);
                return fs.lstatAsync(childPath).then(stats => {
                    if (stats.isDirectory()) {
                        return removeDirectoryRecursiveAsync(childPath).then(() => {
                            return removeChildAsync(files, i + 1);
                        });
                    } else {
                        return fs.unlinkAsync(childPath).then(() => {
                            return removeChildAsync(files, i + 1);
                        });
                    }
                });
            } else {
                return fs.rmdirAsync(dir);
            }
        };
        return removeChildAsync(files, 0);
    }, e => {
        if (e.code !== 'ENOENT') {
            return Promise.reject(e);
        }
    });
}

function removeDirectoryIfEmptyAsync(dir) {
    return fs.readdirAsync(dir).then(files => {
        if (!files || files.length === 0) {
            return fs.rmdir(dir);
        }
    });
}

module.exports = {
    listAsync,
    getPathAsync,
    installAsync,
    uninstallAsync,
};
