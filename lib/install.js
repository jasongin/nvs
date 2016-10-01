const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const available = require('./available');
const homeDir = require('./env').homeDir;

function list() {
    // TODO: List installed versions
}

function install(version) {
    available.downloadIndexAsync(version.feedName).then(feedIndex => {
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
            console.error('Version ' + version.semanticVersion +
                ' not found in feed: ' + version.feedName);
        } else {
            version.semanticVersion = selectedBuild.version.substr(1);

            var feedUri = available.feedMap[version.feedName];
            downloadAsync(feedUri, version).then(() => {
                installAsync(version).then(() => {
                    console.log('Installed: ' + version.feedName + '/' +
                        version.semanticVersion + '/' + version.arch);
                }).catch (e => {
                    console.error('Install failed. ' + e.message);
                });
            }).catch (e => {
                console.error('Download failed. ' + e.message);
            });
        }
    }).catch(e => {
        console.error(
            'Failed to download index for feed: ' +
            version.feedName + '. ' + e.message);
    });
}

function downloadAsync(feedUri, version) {
    // TODO: Download the version from the base URI.
}

function installAsync(version) {
    // TODO: Extract/install the downloaded version.
}

function uninstall(version) {
    // TODO: Uninstall the specified version.
}

module.exports = {
    list,
    install,
    uninstall,
}
