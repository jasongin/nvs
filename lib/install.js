const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const available = require('./available');
const homeDir = require('./env').homeDir;

function listAsync() {
    // TODO: List installed versions
    return Promise.reject(new Error('Not implemented.'));
}

function installAsync(version) {
    return available.downloadIndexAsync(version.feedName).then(feedIndex => {
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
            throw new Error('Version ' + version.semanticVersion +
                ' not found in feed: ' + version.feedName);
        } else {
            version.semanticVersion = selectedBuild.version.substr(1);

            var feedUri = available.feedMap[version.feedName];
            return downloadAsync(feedUri, version).then(() => {
                return installDownloadedAsync(version);
            }).then(() => {
                return Promise.resolve('Installed: ' + version.feedName + '/' +
                    version.semanticVersion + '/' + version.arch);
            });
        }
    });
}

function downloadAsync(feedUri, version) {
    // TODO: Download the version from the base URI.
    return Promise.reject(new Error('Not implemented.'));
}

function installDownloadedAsync(version) {
    // TODO: Extract/install the downloaded version.
    return Promise.reject(new Error('Not implemented.'));
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
