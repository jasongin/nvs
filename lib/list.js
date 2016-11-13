/* global settings */
const path = require('path');
let fs = require('fs');   // Non-const enables test mocking
let http = require('http');  // Non-const enables test mocking
let https = require('https');  // Non-const enables test mocking
const Error = require('./error');

const NodeVersion = require('./version');
let nvsUse = null;  // Lazy load
let nvsLink = null;  // Lazy load

const remoteNames = Object.keys(settings.remotes)
    .filter(d => d !== 'default' && settings.remotes[d]);

/**
 * Finds the most recent version matching a filter in locally-available versions, or in a
 * specified (sorted) list of versions.
 *
 * @returns The fully-resolved version, or null if not found.
 */
function find(filter, versions) {
    if (!versions) {
        versions = getVersions();
    }
    let resolvedVersion = filter.label === 'latest' ? versions[0]
        : filter.label === 'lts' ? versions.find(v => v.label)
        : filter.label === 'current' ? versions.find(v => v.current)
        : filter.label === 'default' ? versions.find(v => v.default)
        : versions.find(v => filter.match(v));
    if (resolvedVersion) {
        resolvedVersion.arch = filter.arch || NodeVersion.defaultArch;
        resolvedVersion.os = NodeVersion.defaultOs;
    }
    return resolvedVersion;
}

/**
 * Lists all versions of node added by NVS.
 *
 * @param filter Optional partial NodeVersion structure used to filter the results.
 * @returns An array of lines appropriate for console output.
 */
function list(filter) {
    let versions = getVersions();
    if (filter) {
        versions = versions.filter(v => filter.match(v));
    }
    return versions.map(v => v.toString({ marks: true, label: true }));
}

/**
 * Gets all versions of node added by NVS.
 *
 * @param remoteName Optional remote name to scope the listing.
 * @param semanticVersion Optional specific semantic version to scope the listing.
 * @param arch Optional processor architecture filter for the listing.
 * @returns An array of version objects.
 */
function getVersions(remoteName, semanticVersion, arch) {
    nvsUse = nvsUse || require('./use');
    nvsLink = nvsLink || require('./link');

    let versions = getVersionsInternal(remoteName, semanticVersion, arch);

    let currentVersion = nvsUse.getCurrentVersion();
    let defaultVersion = nvsLink.getLinkedVersion();

    versions.forEach(v => {
        v.current = currentVersion && NodeVersion.equal(currentVersion, v);
        v.default = defaultVersion && NodeVersion.equal(defaultVersion, v);
    });
    return versions.sort(NodeVersion.compare);
}

function getVersionsInternal(remoteName, semanticVersion, arch) {
    let readdirIfExists = dir => {
        try {
            return fs.readdirSync(dir);
        } catch (e) {
            Error.throwIfNot(Error.ENOENT, e, 'Cannot access directory: ' + dir);
            return [];
        }
    };

    let result = [];
    if (!remoteName) {
        // Scan all directories under the home directory, which might be remote names.
        let childNames = readdirIfExists(settings.home);
        childNames.forEach(childName => {
            let childPath = path.join(settings.home, childName);
            let stats = fs.lstatSync(childPath);
            if (stats.isDirectory() && childName !== 'node_modules') {
                result = result.concat(getVersionsInternal(childName, semanticVersion, arch));
            }
        });
    } else if (!semanticVersion) {
        // Scan all directories under the remote directory, which might be semantic versions.
        let childNames = readdirIfExists(path.join(settings.home, remoteName));
        childNames.forEach(childName => {
            let childPath = path.join(settings.home, remoteName, childName);
            let stats = fs.lstatSync(childPath);
            if (stats.isDirectory()) {
                result = result.concat(getVersionsInternal(remoteName, childName, arch));
            }
        });
    } else if (!arch) {
        // Scan all directories under the semantic version directory, which might be architectures.
        let childNames = readdirIfExists(path.join(
            settings.home, remoteName, semanticVersion));
        childNames.forEach(childName => {
            let childPath = path.join(settings.home, remoteName, semanticVersion, childName);
            let stats = fs.lstatSync(childPath);
            if (stats.isDirectory()) {
                result = result.concat(getVersionsInternal(remoteName, semanticVersion, childName));
            }
        });
    } else {
        // Check if a valid full version directory was found.
        let version = NodeVersion.tryParse(remoteName + '/' + semanticVersion + '/' + arch, true);
        if (version) {
            try {
                let versionProperties = JSON.parse(fs.readFileSync(
                    path.join(nvsUse.getVersionDir(version), '.nvs'), 'utf8'));
                if (versionProperties) {
                    version.label = versionProperties.label;
                }
            } catch (e) {
                Error.throwIfNot(Error.ENOENT, e);
            }

            let binPath = nvsUse.getVersionBinary(version);
            if (binPath) {
                result.push(version);
            }
        }
    }
    return result;
}

/**
 * Lists node versions available to download, according to downloaded remote index file(s).
 *
 * @param filter Optional partial NodeVersion structure used to filter the results.
 * @returns An array of lines appropriate for console output.
 */
function listRemoteAsync(filter) {
    let listRemoteNames = (filter && filter.remoteName ? [filter.remoteName] : remoteNames);

    let getNextRemoteVersionsAsync = (i, remoteVersionsMap) => {
        if (listRemoteNames[i]) {
            return getRemoteVersionsAsync(listRemoteNames[i]).then(versions => {
                if (filter) {
                    if (filter.label === 'lts') {
                        versions = versions.filter(v => v.label);
                    } else {
                        versions = versions.filter(v => filter.match(v));
                    }
                }
                remoteVersionsMap[listRemoteNames[i]] = versions;
                return getNextRemoteVersionsAsync(i + 1, remoteVersionsMap);
            }, e => {
                remoteVersionsMap[listRemoteNames[i]] = e;
                return getNextRemoteVersionsAsync(i + 1, remoteVersionsMap);
            });
        } else {
            return Promise.resolve(remoteVersionsMap);
        }
    };

    return getNextRemoteVersionsAsync(0, {}).then(remoteVersionsMap => {
        let result = [];
        listRemoteNames.forEach(r => {
            if (listRemoteNames.length > 1) {
                if (result.length > 0) {
                    // Separate multiple remote listings by blank lines.
                    result.push('');
                }

                // Show remote name header when more then one is listed.
                result.push(r + ':');
            }

            if (Array.isArray(remoteVersionsMap[r])) {
                result = result.concat(remoteVersionsMap[r].map(
                    v => v.toString({ marks: true, label: true })));
            } else {
                if (listRemoteNames.length === 1) throw remoteVersionsMap[r];
                else result.push('  Error: ' + remoteVersionsMap[r].message);
            }
        });
        return result;
    });
}

/**
 * Gets node versions available to download, according to downloaded remote index file(s).
 *
 * @param remoteName Required name of one of the remotes configured in settings.json.
 * @returns An array of version objects.
 */
function getRemoteVersionsAsync(remoteName) {
    let localVersions = getVersions(remoteName);
    let currentVersion = localVersions.find(v => v.current);
    let defaultVersion = localVersions.find(v => v.default);

    // Ignore the processor architecture when comparing to current and default.
    if (currentVersion) delete currentVersion.arch;
    if (defaultVersion) delete defaultVersion.arch;

    return downloadIndexAsync(remoteName).then(remoteIndex => {
        if (Array.isArray(remoteIndex)) {
            return remoteIndex.filter(item => {
                let v = item.version;
                // Filter out very old versions (< v0.10) that are not supported by NVS.
                return v.startsWith('v') && (!v.startsWith('v0') || /^v0.1[0-9]/.test(v));
            }).map(item => {
                let version = new NodeVersion(remoteName, item.version.substr(1));
                version.label = item.lts;
                version.local = !!localVersions.find(v =>
                    v.remoteName === remoteName &&
                    v.semanticVersion === version.semanticVersion);
                version.current = currentVersion && NodeVersion.equal(currentVersion, version);
                version.default = defaultVersion && NodeVersion.equal(defaultVersion, version);
                return version;
            }).sort(NodeVersion.compare);
        } else {
            throw new Error('Remote index.json is not an array.');
        }
    });
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
            if (res.statusCode === 200) {
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
            } else if (res.statusCode === 404) {
                reject(new Error('Remote index file not found: ' + remoteIndexUri,
                    new Error('HTTP response status: ' + res.statusCode)));
            } else {
                reject(new Error('Failed to download index: ' + remoteIndexUri,
                    new Error('HTTP response status: ' + res.statusCode)));
            }
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
    find,
    list,
    getVersions,
    listRemoteAsync,
    getRemoteVersionsAsync,
};
