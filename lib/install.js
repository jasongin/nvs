const child_process = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const nvsAvailable = require('./available');
const nvsEnv = require('./env');

function listAsync() {
    // TODO: List installed versions
    return Promise.reject(new Error('Not implemented.'));
}

function installAsync(version) {
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

            // TODO: Check if already installed.

            var feedUri = nvsAvailable.feedMap[version.feedName];
            return downloadAsync(version, feedUri).then(() => {
                return Promise.resolve('Installed: ' + version.feedName + '/' +
                    version.semanticVersion + '/' + version.arch);
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
            fs.exists(zipFilePath, fileExists => {
                if (fileExists) {
                    // TODO: Verify hash of downloaded file?
                    resolve(extractAsync(version, zipFilePath));
                } else {
                    console.log('Downloading ' + version.feedName +
                        ' v' + version.semanticVersion + ' ' + version.arch + '...');
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
                            console.log("ReadableStream error: " + e.message);
                            reject(new Error(
                                'Failed to download ' + zipFileUri + '. ' + e.message));
                            stream.end();
                            fs.unlinkSync(zipFilePath);
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
    var mkdirAsync = function (pathParts, i) {
        return new Promise((resolve, reject) => {
            if (pathParts[i]) {
                var subPath = path.join(...pathParts.slice(0, i + 1));
                fs.exists(subPath, dirExists => {
                    if (!dirExists) {
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
    return new Promise((resolve, reject) => {
        if (nvsEnv.isWindows) {
            var extractedName =
                'node-v' + version.semanticVersion + '-win-' + version.arch;
            var cmd = "$ProgressPreference = 'SilentlyContinue'";
            cmd += "; Expand-Archive -Force -Path '" + path.basename(zipFilePath) + "' " +
                "-DestinationPath .";
            cmd += "; Move-Item -Force -Path '" + extractedName + "\\*' " +
                "-Destination .";
            cmd += "; Remove-Item -Force -Recurse -Path '" + extractedName + "'";

            var cp = child_process.spawn(
                'powershell.exe',
                [ '-Command', cmd ],
                { cwd: targetDir });
            cp.on('close', code => {
                if (code) {
                    reject(new Error(
                        'PowerShell Expand-Archive exited with code: ' + code));
                } else {
                    resolve();
                }
            });
            cp.on('error', e => {
                reject(e);
            });
        } else {
            // TODO: tar -zxvf
            // TODO: Move extracted files up one directory.
            reject(new Error('Not implemented.'));
        }
    });
}

function uninstallAsync(version) {
    // TODO: Uninstall the specified version.
    return Promise.reject(new Error('Not implemented.'));
}

module.exports = {
    listAsync,
    installAsync,
    uninstallAsync,
}
