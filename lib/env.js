const fs = require('fs');
const path = require('path');

var isWindows = process.platform === "win32";
var isMac = process.platform === "darwin";

var homeDir = function () {
    var homeDir = process.env['NVS_HOME'];
    if (!homeDir) {
        if (isWindows) {
            homeDir = path.join(process.env['APPDATA'], 'nvs');
        } else {
            homeDir = path.join(process.env['HOME'], '.nvs');
        }
        if (!fs.existsSync(homeDir)) {
            fs.mkdirSync(homeDir);
        }
    }
    return homeDir;
}();

function useAsync(version) {
    // TODO: Update the environment path to include the specified version.
    return Promise.reject(new Error('Not implemented.'));
}

function runAsync(version, args) {
    // TODO: Run the version of node.exe with the args.
    return Promise.reject(new Error('Not implemented.'));
}

function setDefaultAsync(version) {
    // TODO: create/update a linked directory to the specified version,
    // or the current environment version if no vesion was specified.
    // Also update the user path (not environment path) to include that version.
    return Promise.reject(new Error('Not implemented.'));
}

function getVersionDir(version) {
    if (!version.semanticVersion) {
        throw new Error('Specify a semantic version.');
    }

    return path.join(
        homeDir,
        version.feedName,
        version.semanticVersion,
        version.arch);
}

function getPathAsync(version) {
    if (!version) {
        // TODO: Get the path to the current version if the version arg is not specified.
        return Promise.reject(new Error('Not implemented.'));
    } else if (version.namedVersion && !version.semanticVersion) {
        // A named version (latest or lts) was specified.
        // Download the index to resolve it to a semantic version.
        return require('./available').downloadIndexAsync(version.feedName).then(feedIndex => {
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
                return getPathAsync(version);
            }
        });
    } else {
        // A specific version was specified.
        // Resolve it to a path and check if the binary exists.
        return new Promise((resolve, reject) => {
            var nodeBinPath = path.join(
                getVersionDir(version), 'node' + (isWindows ? '.exe' : ''));
            fs.access(nodeBinPath, fs.constants.X_OK, e => {
                var versionString = version.feedName + '/' +
                    (version.namedVersion || version.semanticVersion) + '/' + version.arch;
                if (!e) {
                    resolve(nodeBinPath);
                } else {
                    resolve(null);
                }
            });
        });
    }
}

module.exports = {
    isWindows,
    isMac,
    homeDir,
    useAsync,
    runAsync,
    setDefaultAsync,
    getPathAsync,
    getVersionDir,
};
