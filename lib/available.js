const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const homeDir = require('./env').homeDir;

var feedMap = loadfeedMap();
var feedNames = Object.keys(feedMap).filter(d => d !== 'default' && feedMap[d]);

function list(feedName) {
    var found = false;
    var listfeedIndex = function(i) {
        if (feedNames[i]) {
            if (!feedName || feedNames[i] == feedName) {
                found = true;
                downloadIndexAsync(feedNames[i]).then(feedIndex => {
                    formatFeed(feedNames[i], feedIndex);
                    listfeedIndex(i + 1);
                }).catch(e => {
                    console.warn(
                        'Failed to download index for feed: ' +
                        feedName + '. ' + e.message);
                    listfeedIndex(i + 1);
                });
            } else {
                listfeedIndex(i + 1);
            }
        } else if (!found && feedName) {
            console.warn('No feed found with name: ' + feedName);
        }
    };
    listfeedIndex(0);
}

function formatFeed(feedName, feedIndex) {
    console.log('');
    console.log(feedName);
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
            console.log(line);
        });
    } else {
        console.warn('  Feed index.json is not an array: ' + feedName);
    }
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
    var feedMapFile = path.join(homeDir, 'feeds.json');
    if (fs.existsSync(feedMapFile)) {
        try {
            feedMap = JSON.parse(fs.readFileSync(feedMapFile));
        } catch (e) {
            return Promise.reject('Failed to read file: ' + feedMapFile, e);
        }
    } else {
        feedMap = require('../feeds.json');
        fs.writeFileSync(feedMapFile, JSON.stringify(feedMap, null, 2));
    }
    return feedMap;
}

function downloadIndexAsync(feedName) {
    if (!feedName || feedName === 'default') {
        feedName = feedMap['default'] || 'node';
    }

    var feedUri = feedMap[feedName];
    if (!feedUri) {
        return Promise.reject('No URI found for feed: ' + feedName);
    }

    var feedIndexUri = feedUri + (feedUri.endsWith('/') ? '' : '/') + 'index.json';

    var client = feedIndexUri.startsWith('https:') ? https : http;
    return new Promise((resolve, reject) => {
        https.get(feedIndexUri, (res) => {
            var responseBody = '';
            res.on('data', (data) => {
                responseBody += data;
            });
            res.on('end', function() {
                var feedIndex;
                try {
                    feedIndex = JSON.parse(responseBody);
                } catch (e) {
                    reject(e);
                    return;
                }
                resolve(feedIndex);
            });

        }).on('error', (e) => {
            reject(e);
        });
    });
}

module.exports = {
    list,
    feedMap,
    feedNames,
    downloadIndexAsync,
};
