const child_process = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

const nvsAvailable = require('./available');
const nvsEnv = require('./env');

function listAsync() {
    // TODO: List installed versions
    return Promise.reject(new Error('Not implemented.'));
}

function installAsync(version) {
    return nvsEnv.getPathAsync(version).then(installedPath => {
        var versionString =
            version.feedName + '/' + version.semanticVersion + '/' + version.arch;

        if (installedPath) {
            return 'Already installed at: ' + installedPath + os.EOL +
                'To use this version now: nvs use ' + versionString;
        } else {
            var feedUri = nvsAvailable.feedMap[version.feedName];
            return downloadAsync(version, feedUri).then(() => {
                console.log('');
                return Promise.resolve('Installed.' + os.EOL +
                    'To use this version now: nvs use ' + versionString);
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

        return new Promise((resolve, reject) => {
            fs.access(zipFilePath, e => {
                if (!e) {
                    // TODO: Verify hash of downloaded file?
                    resolve(extractAsync(version, zipFilePath));
                } else {
                    console.log('Downloading ' + version.feedName +
                        '/' + version.semanticVersion + '/' + version.arch + '...');
                    console.log('  ' + zipFileUri + ' -> ' + zipFilePath);
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
                        reject(new Error('Failed to download ' + zipFileUri + '. ' + e.message));
                    }
                }
            });
        });
    });
}

function mkdirsAsync(/*arguments*/) {
    var mkdirAsync = (pathParts, i) => {
        return new Promise((resolve, reject) => {
            if (pathParts[i]) {
                var subPath = path.join(...pathParts.slice(0, i + 1));
                fs.access(subPath, e => {
                    if (e) {
                        fs.mkdir(subPath, () => {
                            resolve(mkdirAsync(pathParts, i + 1));
                        }, e => {
                            reject(e);
                        });
                    } else {
                        resolve(mkdirAsync(pathParts, i + 1));
                    }
                });
            } else {
                resolve(path.join(...pathParts));
            }
        });
    };
    return mkdirAsync(Array.from(arguments), 0);
}

function extractAsync(version, zipFilePath) {
    var targetDir = path.dirname(zipFilePath);
    console.log('Extracting...');
    console.log('  ' + zipFilePath + ' -> ' + targetDir);
    return new Promise((resolve, reject) => {
        if (nvsEnv.isWindows) {
            var unzipScript = path.join(__dirname, "unzip.js");
            var child = child_process.spawn(
                'cscript.exe',
                [ '//B', unzipScript, zipFilePath, targetDir ]);
            child.on('close', code => {
                if (code) {
                    reject(new Error('Unzip script exited with code: ' + code));
                } else {
                    resolve();
                }
            });
            child.on('error', e => {
                reject(new Error('Failed to execute unzip script. ' + e.message));
            });
        } else {
            // TODO: tar -zxvf
            reject(new Error('Not implemented.'));
        }
    }).then(() => {
        return new Promise((resolve, reject) => {
            fs.unlink(zipFilePath, e => {
                if (e) {
                    reject(e);
                } else {
                    resolve();
                }
            });
        });
    }).then(() => {
        return finishInstallAsync(version, targetDir);
    });
}

function finishInstallAsync(version, targetDir) {
    // Move the extracted files up one directory.
    return new Promise((resolve, reject) => {
        var extractedDirName =
            'node-v' + version.semanticVersion + '-' + version.os + '-' + version.arch;
        var extractedDirPath = path.join(targetDir, extractedDirName);
        fs.readdir(extractedDirPath, (e, files) => {
            if (e) {
                reject(e);
            } else {
                var moveUpAsync = (files, i) => {
                    if (files[i]) {
                        fs.rename(path.join(extractedDirPath, files[i]),
                                path.join(targetDir, files[i]), e => {
                            if (e) {
                                reject(e);
                            } else {
                                moveUpAsync(files, i + 1);
                            }
                        })
                    } else {
                        // Remove the now-empty directory.
                        fs.rmdir(extractedDirPath, e => {
                            if (e) {
                                reject(e);
                            } else {
                                resolve();
                            }
                        });
                    }
                };
                moveUpAsync(files, 0);
            }
        });
    });
}

function uninstallAsync(version) {
    var versionDir = nvsEnv.getVersionDir(version);
    return new Promise((resolve, reject) => {
        fs.access(versionDir, fs.constants.X_OK, e => {
            if (e) {
                // The directory does not exist, so there's nothing to do.
                resolve();
            } else {
                // Remove all contents of the version directory,
                // along with parent directories if they are empty.
                resolve(removeDirectoryRecursiveAsync(versionDir).then(() => {
                    return removeDirectoryIfEmptyAsync(path.dirname(versionDir));
                }).then(() => {
                    return removeDirectoryIfEmptyAsync(
                        path.dirname(path.dirname(versionDir)));
                }));
            }
        });
    });
}

function removeDirectoryRecursiveAsync(dir) {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (e, files) => {
            if (e) {
                reject(e);
            } else {
                var removeChildAsync = (files, i) => {
                    if (files[i]) {
                        var childPath = path.join(dir, files[i]);
                        fs.lstat(childPath, (e, stats) => {
                            if (e) {
                                reject(e);
                            } else if (stats.isDirectory()) {
                                removeDirectoryRecursiveAsync(childPath).then(() => {
                                    removeChildAsync(files, i + 1);
                                }, e => {
                                    reject(e);
                                });
                            } else {
                                fs.unlink(childPath, e => {
                                    if (e) {
                                        reject(e);
                                    } else {
                                        removeChildAsync(files, i + 1);
                                    }
                                });
                            }
                        });
                    } else {
                        fs.rmdir(dir, e => {
                            if (e) {
                                reject(e);
                            } else {
                                resolve();
                            }
                        });
                    }
                };
                removeChildAsync(files, 0);
            }
        });
    });
}

function removeDirectoryIfEmptyAsync(dir) {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (e, files) => {
            if (e) {
                reject(e);
            } else if (files && files.length > 0) {
                resolve();
            } else {
                fs.rmdir(dir, e => {
                    if (e) {
                        reject(e);
                    } else {
                        resolve();
                    }
                });
            }
        });
    });
}

module.exports = {
    listAsync,
    installAsync,
    uninstallAsync,
}
