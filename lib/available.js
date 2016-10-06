/* global settings */
var http = require('http');
var https = require('https');
var os = require('os');

var feedNames = Object.keys(settings.feeds)
    .filter(d => d !== 'default' && settings.feeds[d]);

/**
 * Lists node versions available to download, according to downloaded feed index file(s).
 * @param feedName Optional name of one of the feeds configured in settings.json;
 *     If not specified then all configured feeds will be queried.
 */
function listAsync(feedName) {
    var listfeedIndexAsync = (i, foundName, output) => {
        if (feedNames[i]) {
            // List this feed if no name was specified or if it matches the specified.
            if (!feedName || feedNames[i] === feedName) {
                foundName = feedName;
                if (output) {
                    // Separate multiple feed listings by blank lines.
                    output += os.EOL;
                }
                return downloadIndexAsync(feedNames[i]).then(feedIndex => {
                    output += formatFeed(feedNames[i], feedIndex);
                    return listfeedIndexAsync(i + 1, foundName, output);
                }, e => {
                    output +=
                        feedName + ':' + os.EOL + '  Error: Failed to download index. ' +
                        e.message + os.EOL + os.EOL;
                    return listfeedIndexAsync(i + 1, foundName, output);
                });
            } else {
                // Move on without listing this feed.
                return listfeedIndexAsync(i + 1, foundName, output);
            }
        } else {
            if (feedName && !foundName) {
                output +=
                    feedName + ':' + os.EOL + '  Error: Name not found in settings.json.' +
                    os.EOL + os.EOL;
            }
            if (output.length > os.EOL.length) {
                output = output.substr(0, output.length - os.EOL.length);
            }
            return Promise.resolve(output);
        }
    };
    return listfeedIndexAsync(0, null, '');
}

/**
 * Formats a feed index in columns, marking the latest and lts versions if indicated.
 */
function formatFeed(feedName, feedIndex) {
    var output = feedName + ':' + os.EOL;
    if (Array.isArray(feedIndex)) {
        var latest = null;
        var lts = null;
        if (feedIndex.some(item => item.lts)) {
            latest = feedIndex[0].version;
            lts = feedIndex.find(item => item.lts).version;
        }

        var lines = formatAsColumns(feedIndex.filter(item => {
            return item.version.startsWith('v') && !item.version.startsWith('v0');
        }).map(item => {
            return ((item.version === latest) ? '^' : (item.version === lts)
                ? '*' : ' ') + item.version.substr(1);
        }), process.stdout.columns || 80);
        lines.forEach(line => {
            output += line + os.EOL;
        });
    } else {
        output += '  Error: Feed index.json is not an array.' + os.EOL;
    }

    return output;
}

/**
 * Formats an array of strings into columns with a specified line length.
 */
function formatAsColumns(data, lineLength) {
    var columnWidth =
        data.map(item => item.length).reduce((a, b) => a > b ? a : b, 0) + 2;
    var lines = [];
    var line = '';
    for (var i = 0; i < data.length; i++) {
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
 * Downloads the index.json file for a feed.
 */
function downloadIndexAsync(feedName) {
    if (!feedName || feedName === 'default') {
        feedName = settings.feeds['default'] || 'node';
    }

    var feedUri = settings.feeds[feedName];
    if (!feedUri) {
        return Promise.reject(new Error('No URI found in settings.json for feed: ' + feedName));
    }

    var feedIndexUri = feedUri + (feedUri.endsWith('/') ? '' : '/') + 'index.json';

    var client = feedIndexUri.startsWith('https:') ? https : http;
    return new Promise((resolve, reject) => {
        client.get(feedIndexUri, (res) => {
            var responseBody = '';
            res.on('data', (data) => {
                responseBody += data;
            });
            res.on('end', () => {
                var feedIndex;
                try {
                    feedIndex = JSON.parse(responseBody);
                } catch (e) {
                    reject('Failed to parse ' + feedIndexUri + '. ' + e.message);
                    return;
                }
                resolve(feedIndex);
            });
        }).on('error', (e) => {
            reject(new Error('Failed to download ' + feedIndexUri + '. ' + e.message));
        });
    });
}

module.exports = {
    feedNames,
    listAsync,
    downloadIndexAsync,
};
