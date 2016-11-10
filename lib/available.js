/* global settings */
const fs = require('fs');
const path = require('path');
let http = require('http');  // Non-const enables test mocking
let https = require('https');  // Non-const enables test mocking
const Error = require('./error');

const remoteNames = Object.keys(settings.remotes)
    .filter(d => d !== 'default' && settings.remotes[d]);

/**
 * Lists node versions available to download, according to downloaded remote index file(s).
 * @param remoteName Optional name of one of the remotes configured in settings.json;
 *     If not specified then all configured remotes will be queried.
 * @param versionFilter Version or part of a version to use to filter the results.
 */
function listAsync(remoteName, versionFilter) {
    if (!versionFilter && /[0-9]+(\.[0-9]+(\.[0-9]+)?)?/.test(remoteName)) {
        versionFilter = remoteName;
        remoteName = null;
    }
    if (versionFilter && versionFilter.startsWith('v')) {
        versionFilter = versionFilter.substr(1);
    }

    let listRemoteIndexAsync = (i, foundName, result) => {
        if (remoteNames[i]) {
            // List this remote if no name was specified or if it matches the specified.
            if (!remoteName || remoteNames[i] === remoteName) {
                foundName = remoteName;
                if (result.length > 0) {
                    // Separate multiple remote listings by blank lines.
                    result.push('');
                }
                if (!remoteName) {
                    result.push(remoteNames[i] + ':');
                }
                return downloadIndexAsync(remoteNames[i]).then(remoteIndex => {
                    result = result.concat(formatRemoteIndex(
                        remoteNames[i], versionFilter, remoteIndex));
                    return listRemoteIndexAsync(i + 1, foundName, result);
                }, e => {
                    if (remoteName) {
                        throw new Error('Failed to download index.', e);
                    }
                    result.push('  Error: Failed to download index. ' + e.message);
                    return listRemoteIndexAsync(i + 1, foundName, result);
                });
            } else {
                // Move on without listing this remote.
                return listRemoteIndexAsync(i + 1, foundName, result);
            }
        } else {
            if (remoteName && !foundName) {
                throw new Error('settings.json does not include remote name: ' + remoteName);
            }
            return Promise.resolve(result);
        }
    };
    return listRemoteIndexAsync(0, null, []);
}

/**
 * Formats a remote index in columns, marking the latest and lts versions if indicated.
 */
function formatRemoteIndex(remoteName, versionFilter, remoteIndex) {
    let result = [];
    if (Array.isArray(remoteIndex)) {
        let lines = remoteIndex.filter(item => {
            let v = item.version;
            if (!v.startsWith('v') || (v.startsWith('v0') && !/^v0.1[0-9]/.test(v))) {
                // Filter out very old versions (< v0.10) that are not supported by NVS.
                return false;
            }
            v = v.substr(1);
            return !versionFilter || v === versionFilter ||
                v.startsWith(versionFilter + '.') ||
                v.startsWith(versionFilter + '-');
        }).map(item => {
            return '  ' + item.version.substr(1) +
                (item.lts ? ' (' + item.lts + ')' : '');
        });
        result = result.concat(lines);
    } else {
        result.push('  Error: remote index.json is not an array.');
    }

    return result;
}

/**
 * Downloads the index.json file for a remote.
 */
function downloadIndexAsync(remoteName) {
    if (!remoteName || remoteName === 'default') {
        remoteName = settings.remotes['default'] || 'node';
    }

    let remoteUri = settings.remotes[remoteName];
    if (!remoteUri) {
        return Promise.reject(new Error('No URI found in settings.json for remote: ' + remoteName));
    }

    if (path.isAbsolute(remoteUri)) {
        return indexLocalPathAsync(remoteName, remoteUri);
    }

    let remoteIndexUri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') + 'index.json';

    let client = remoteIndexUri.startsWith('https:') ? https : http;
    return new Promise((resolve, reject) => {
        client.get(remoteIndexUri, (res) => {
            let responseBody = '';
            res.on('data', (data) => {
                responseBody += data;
            });
            res.on('end', () => {
                let remoteIndex;
                try {
                    remoteIndex = JSON.parse(responseBody);
                } catch (e) {
                    reject(new Error('Failed to parse index: ' + remoteIndexUri, e));
                    return;
                }
                resolve(remoteIndex);
            });
        }).on('error', (e) => {
            reject(new Error('Failed to download index: ' + remoteIndexUri, e));
        });
    });
}

/**
 * Scan a local directory or network share for available versions.
 */
function indexLocalPathAsync(remoteName, pathPattern) {
    pathPattern = pathPattern.replace(/\/|\\/g, path.sep);

    const versionToken = '{version}';
    const archToken = '{arch}';
    const osToken = '{os}';
    let versionTokenIndex = pathPattern.indexOf(versionToken);
    let archTokenIndex = pathPattern.indexOf(archToken);
    if (versionTokenIndex < 0 || archTokenIndex < 0) {
        return Promise.reject(new Error('Invalid network path for remote: ' + remoteName +
            '; ' + versionToken + ' and ' + archToken + ' tokens are required.'));
    }

    let baseDir = pathPattern.substr(0, versionTokenIndex);
    if (!baseDir.endsWith(path.sep)) {
        // The version token starts in the middle of a directory name, so
        // exclude that whole directory name from the base directory path.
        baseDir = path.dirname(baseDir);
    }

    return new Promise((resolve, reject) => {
        fs.readdir(baseDir, (e, childNames) => {
            if (e) {
                reject(new Error('Failed to access base directory for remote: ' + remoteName), e);
            }

            let remoteIndex = [];
            let addVersionToIndex = i => {
                let version = childNames[i];
                if (!version) {
                    resolve(remoteIndex);
                    return;
                }

                let versionDir = pathPattern
                    .substr(0, versionTokenIndex + versionToken.length)
                    .replace(versionToken, version);
                fs.stat(versionDir, (e, stats) => {
                    if (!e && stats.isDirectory()) {
                        let x86ArchivePath = pathPattern
                            .replace(versionToken, version)
                            .replace(osToken, process.platform.replace('win32', 'win'))
                            .replace(archToken, 'x86');
                        fs.access(x86ArchivePath, e => {
                            if (!e) {
                                remoteIndex.push({ version: 'v' + version });
                                addVersionToIndex(i + 1);
                            } else {
                                let x64ArchivePath = pathPattern
                                    .replace(versionToken, version)
                                    .replace(osToken, process.platform.replace('win32', 'win'))
                                    .replace(archToken, 'x64');
                                fs.access(x64ArchivePath, e => {
                                    if (!e) {
                                        remoteIndex.push({ version: 'v' + version });
                                    }
                                    addVersionToIndex(i + 1);
                                });
                            }
                        });
                    } else {
                        addVersionToIndex(i + 1);
                    }
                });
            };
            addVersionToIndex(0);
        });
    });
}

module.exports = {
    remoteNames,
    listAsync,
    downloadIndexAsync,
};
