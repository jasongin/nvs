const fs = require('fs');
const path = require('path');
const os = require('os');

const nvsVersion = require('./version');

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
const pathSeparator = (isWindows ? ';' : ':');

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

    if (!homeDir.endsWith(path.sep)) {
        homeDir += path.sep;
    }

    return homeDir;
}();

function getCurrentVersion() {
    var envPath = process.env['PATH'];
    if (!envPath) {
        throw new Error('Missing PATH environment variable.');
    }

    var pathEntries = envPath.split(pathSeparator);
    for (var i = 0; i < pathEntries.length; i++) {
        var pathEntry = pathEntries[i];
        if (pathEntry.toLowerCase().startsWith(homeDir.toLowerCase())) {
            if (pathEntry.endsWith(path.sep)) {
                pathEntry = pathEntry.substr(0, pathEntry.length - 1);
            }

            var versionString = pathEntry.substr(homeDir.length);
            if (path.sep === '\\') {
                versionString = versionString.replace(/\\/g, '/');
            }
            try {
                var version = nvsVersion.parse(versionString, true);
                return version;
            } catch (e) {
            }
        }
    }

    return null;
}

function useAsync(version, skipInstalledCheck) {
    var envPath = process.env['PATH'];
    if (!envPath) {
        throw new Error('Missing PATH environment variable.');
    }

    if (version && !skipInstalledCheck) {
        // Ensure a semantic version was specified.
        getVersionDir(version);

        // Check if the specified version is installed.
        return require('./install').getPathAsync(version).then(installedPath => {
            if (installedPath) {
                return useAsync(version, true);
            } else {
                var versionString =
                    version.feedName + '/' + version.semanticVersion + '/' + version.arch;
                throw new Error('Specified version is not installed.' + os.EOL +
                    'To install this version now: nvs install ' + versionString);
            }
        });
    }

    var pathEntries = envPath.split(pathSeparator);
    var saveChanges = false;

    // Remove any other versions from the environment PATH.
    for (var i = 0; i < pathEntries.length; i++) {
        var pathEntry = pathEntries[i];
        if (pathEntry.toLowerCase().startsWith(homeDir.toLowerCase())) {
            if (pathEntry.endsWith(path.sep)) {
                pathEntry = pathEntry.substr(0, pathEntry.length - 1);
            }

            var versionString = pathEntry.substr(homeDir.length);
            if (path.sep === '\\') {
                versionString = versionString.replace(/\\/g, '/');
            }
            var previousVersion = null;
            try {
                previousVersion = nvsVersion.parse(versionString, true);
            } catch (e) {
            }

            if (previousVersion) {
                if (i == 0 && version && nvsVersion.equal(version, previousVersion)) {
                    // Found the requested version already at the front of the PATH.
                    version = null;
                } else {
                    pathEntries.splice(i--, 1);
                    saveChanges = true;
                }
            }
        }
    }

    if (version) {
        // Insert the requested version at the front of the PATH.
        pathEntries.splice(0, 0, getVersionDir(version));
        saveChanges = true;
    }

    if (saveChanges) {
        require('./postScript').generate({ 'PATH': pathEntries.join(pathSeparator) });
    }

    return Promise.resolve();
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
        version.arch) + path.sep;
}

module.exports = {
    isWindows,
    isMac,
    homeDir,
    useAsync,
    runAsync,
    setDefaultAsync,
    getCurrentVersion,
    getVersionDir,
};
