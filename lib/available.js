/* global settings */
let http = require('http');  // Non-const enables test mocking
let https = require('https');  // Non-const enables test mocking
const Error = require('./error');

const remoteNames = Object.keys(settings.remotes)
    .filter(d => d !== 'default' && settings.remotes[d]);

/**
 * Lists node versions available to download, according to downloaded remote index file(s).
 * @param remoteName Optional name of one of the remotes configured in settings.json;
 *     If not specified then all configured remotes will be queried.
 */
function listAsync(remoteName) {
    let listRemoteIndexAsync = (i, foundName, result) => {
        if (remoteNames[i]) {
            // List this remote if no name was specified or if it matches the specified.
            if (!remoteName || remoteNames[i] === remoteName) {
                foundName = remoteName;
                if (result.length > 0) {
                    // Separate multiple remote listings by blank lines.
                    result.push('');
                }
                return downloadIndexAsync(remoteNames[i]).then(remoteIndex => {
                    result = result.concat(formatRemoteIndex(remoteNames[i], remoteIndex));
                    return listRemoteIndexAsync(i + 1, foundName, result);
                }, e => {
                    result.push(remoteName + ':');
                    result.push('  Error: Failed to download index. ' + e.message);
                    return listRemoteIndexAsync(i + 1, foundName, result);
                });
            } else {
                // Move on without listing this remote.
                return listRemoteIndexAsync(i + 1, foundName, result);
            }
        } else {
            if (remoteName && !foundName) {
                result.push(remoteName + ':');
                result.push('  Error: Name not found in settings.json.');
            }
            return Promise.resolve(result);
        }
    };
    return listRemoteIndexAsync(0, null, []);
}

/**
 * Formats a remote index in columns, marking the latest and lts versions if indicated.
 */
function formatRemoteIndex(remoteName, remoteIndex) {
    let result = [remoteName + ':'];
    if (Array.isArray(remoteIndex)) {
        let latest = null;
        let lts = null;
        if (remoteIndex.some(item => item.lts)) {
            latest = remoteIndex[0].version;
            lts = remoteIndex.find(item => item.lts).version;
        }

        let lines = formatAsColumns(remoteIndex.filter(item => {
            return item.version.startsWith('v') && !item.version.startsWith('v0');
        }).map(item => {
            return ((item.version === latest) ? '^' : (item.version === lts)
                ? '*' : ' ') + item.version.substr(1);
        }), process.stdout.columns || 80);
        result = result.concat(lines);
    } else {
        result.push('  Error: remote index.json is not an array.');
    }

    return result;
}

/**
 * Formats an array of strings into columns with a specified line length.
 */
function formatAsColumns(data, lineLength) {
    let columnWidth =
        data.map(item => item.length).reduce((a, b) => a > b ? a : b, 0) + 2;
    let lines = [];
    let line = '';
    for (let i = 0; i < data.length; i++) {
        line += ' ' + data[i] + ' '.repeat(columnWidth - 2 - data[i].length);
        if (line.length + columnWidth > lineLength) {
            lines.push(line);
            line = '';
        }
    }
    if (line) {
        lines.push(line);
    }
    return lines;
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

module.exports = {
    remoteNames,
    listAsync,
    downloadIndexAsync,
};
