const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');

var feedMap = loadfeedMap();
var feedNames = Object.keys(feedMap).filter(d => d !== 'default' && feedMap[d]);

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
                    feedName + ':' + os.EOL + '  Error: Name not found in feeds.json.' +
                    os.EOL + os.EOL;
            }
            return Promise.resolve(output);
        }
    };
    return listfeedIndexAsync(0, null, '');
}

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
            return item.version.substr(1) +
                ((item.version === latest) ? '^' : (item.version === lts) ? '*' : '');
        }), process.stdout.columns || 80);
        lines.forEach(line => {
            output += line + os.EOL;
        });
    } else {
        output += '  Error: Feed index.json is not an array.' + os.EOL;
    }

    return output;
}

function formatAsColumns(data, lineLength) {
    var columnWidth =
        data.map(item => item.length).reduce((a, b) => a > b ? a : b, 0) + 2;
    var lines = [];
    var line = '';
    for (var i = 0; i < data.length; i++) {
        line += '  ' + data[i] + ' '.repeat(columnWidth - 2 - data[i].length);
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

function loadfeedMap() {
    var feedMap = null;
    var feedMapFile = path.join(require('./env').homeDir, 'feeds.json');
    try {
        feedMap = JSON.parse(fs.readFileSync(feedMapFile));
    } catch (e) {
        if (e.code === "ENOENT") {
            feedMap = require('../default-feeds.json');
            fs.writeFileSync(feedMapFile, JSON.stringify(feedMap, null, 2));
        } else {
            throw new Error('Failed to read file: ' + feedMapFile + '. ' + e.message);
        }
    }
    return feedMap;
}

function downloadIndexAsync(feedName) {
    if (!feedName || feedName === 'default') {
        feedName = feedMap['default'] || 'node';
    }

    var feedUri = feedMap[feedName];
    if (!feedUri) {
        return Promise.reject(new Error('No URI found in feeds.json for feed: ' + feedName));
    }

    var feedIndexUri = feedUri + (feedUri.endsWith('/') ? '' : '/') + 'index.json';

    var client = feedIndexUri.startsWith('https:') ? https : http;
    return new Promise((resolve, reject) => {
        client.get(feedIndexUri, (res) => {
            var responseBody = '';
            res.on('data', (data) => {
                responseBody += data;
            });
            res.on('end', function() {
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
    feedMap,
    feedNames,
    listAsync,
    downloadIndexAsync,
};
