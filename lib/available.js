const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const homeDir = require('./env').homeDir;

var distMap = loadDistMap();
var distNames = Object.keys(distMap).filter(d => d !== 'default');

function list(distName) {
    var found = false;
    var listDistIndex = function(i) {
        if (distNames[i]) {
            if (!distName || distNames[i] == distName) {
                found = true;
                downloadIndexAsync(distMap, distNames[i]).then(distIndex => {
                    formatDistIndex(distNames[i], distIndex);
                    listDistIndex(i + 1);
                }).catch(function (e) {
                    console.warn(
                        'Failed to download index for distribution: ' +
                        distName + '. ' + e.message);
                    listDistIndex(i + 1);
                });
            } else {
                listDistIndex(i + 1);
            }
        } else if (!found && distName) {
            console.warn('No distribution found with name: ' + distName);
        }
    };
    listDistIndex(0);
}

function formatDistIndex(distName, distIndex) {
    console.log('');
    console.log(distName);
    if (Array.isArray(distIndex)) {
        var latest = null;
        var lts = null;
        if (distIndex.some(item => item.lts)) {
            latest = distIndex[0].version;
            lts = distIndex.find(item => item.lts).version;
        }

        var lines = formatAsColumns(distIndex.filter(item => {
            return item.version.startsWith('v') && !item.version.startsWith('v0');
        }).map(item => {
            return item.version.substr(1) +
                ((item.version === latest) ? '^' : (item.version === lts) ? '*' : '');
        }), process.stdout.columns || 80);
        lines.forEach(line => {
            console.log(line);
        });
    } else {
        console.warn('  index.json is not an array: ' + distName);
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

function loadDistMap() {
    var distMap = null;
    var distMapFile = path.join(homeDir, 'dist.json');
    if (fs.existsSync(distMapFile)) {
        try {
            distMap = JSON.parse(fs.readFileSync(distMapFile));
        } catch (e) {
            return Promise.reject('Failed to read file: ' + distMapFile, e);
        }
    } else {
        distMap = require('../dist.json');
        fs.writeFileSync(distMapFile, JSON.stringify(distMap, null, 2));
    }
    return distMap;
}

function downloadIndexAsync(distMap, distName) {
    if (!distName || distName === 'default') {
        distName = distMap['default'] || 'node';
    }

    var distUri = distMap[distName];
    if (!distUri) {
        return Promise.reject('No URI found for distribution: ' + distName);
    }

    var distIndexUri = distUri + (distUri.endsWith('/') ? '' : '/') + 'index.json';

    var client = distIndexUri.startsWith('https:') ? https : http;
    return new Promise((resolve, reject) => {
        https.get(distIndexUri, (res) => {
            var responseBody = '';
            res.on('data', (data) => {
                responseBody += data;
            });
            res.on('end', function() {
                var index;
                try {
                    index = JSON.parse(responseBody);
                } catch (e) {
                    reject(e);
                    return;
                }
                resolve(index);
            });

        }).on('error', (e) => {
            reject(e);
        });
    });
}

module.exports = {
    list,
    distMap,
    distNames,
};
