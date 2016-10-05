const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const nvsVersion = require('./version');

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const pathSeparator = (isWindows ? ';' : ':');

var homeDir = (function () {
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
})();

/**
 * Gets the current version of NVS-installed node that is in the PATH.
 * Returns null if no NVS-installed node was found in the PATH.
 */
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

            if (!isWindows) {
                if (!pathEntry.endsWith(path.sep + 'bin')) {
                    continue;
                }
                pathEntry = pathEntry.substr(0, pathEntry.length - 4);
            }

            var versionString = pathEntry.substr(homeDir.length);
            if (versionString === 'current') {
                return getLinkedVersion();
            }

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

/**
 * Updates the calling shell's PATH so that a desired version of node will be used.
 * @param version The version of node to add to the PATH, or null to remove all
 *     NVS node versions from the PATH.
 */
function use(version) {
    var envPath = process.env['PATH'];
    if (!envPath) {
        throw new Error('Missing PATH environment variable.');
    }

    if (version) {
        // Check if the specified version is installed.
        var binPath = getVersionBinary(version);
        if (!binPath) {
            var versionString =
                version.feedName + '/' + version.semanticVersion + '/' + version.arch;
            throw new Error('Specified version is not installed.' + os.EOL +
                'To install this version now: nvs install ' + versionString);
        }
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

            if (!isWindows) {
                if (!pathEntry.endsWith(path.sep + 'bin')) {
                    continue;
                }
                pathEntry = pathEntry.substr(0, pathEntry.length - 4);
            }

            var versionString = pathEntry.substr(homeDir.length);
            if (versionString === 'current') {
                previousVersion = getLinkedVersion();
            } else {
                if (path.sep === '\\') {
                    versionString = versionString.replace(/\\/g, '/');
                }
                var previousVersion = null;
                try {
                    previousVersion = nvsVersion.parse(versionString, true);
                } catch (e) {
                }
            }

            if (previousVersion) {
                if (i === 0 && version && nvsVersion.equal(version, previousVersion)) {
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
        var versionDir = getVersionDir(version);
        if (!isWindows) {
            versionDir = path.join(versionDir, 'bin');
        }

        pathEntries.splice(0, 0, versionDir);
        saveChanges = true;
    }

    if (saveChanges) {
        require('./postScript').generate({ 'PATH': pathEntries.join(pathSeparator) });
    }
}

/**
 * Runs the specified (installed) version of node with the args.
 */
function run(version, args) {
    // Check if the specified version is installed.
    var binPath = getVersionBinary(version);
    if (!binPath) {
        var versionString =
            version.feedName + '/' + version.semanticVersion + '/' + version.arch;
        throw new Error('Specified version is not installed.' + os.EOL +
            'To install this version now: nvs install ' + versionString);
    }

    var child = childProcess.spawnSync(
        binPath,
        args,
        { stdio: 'inherit' });
    if (child.error) {
        throw new Error('Failed to launch node child process. ' + child.error.message);
    } else {
        process.exitCode = child.status;
    }
}

/**
 * Creates a symbolic directory link at $NVS_HOME/current, that points
 * to the specified version directory.
 * @param version An installed version to link, or null to use the
 *     current version from the PATH.
 */
function link(version) {
    if (!version) {
        version = getCurrentVersion();
        if (!version) {
            throw new Error('Specify a version to link.');
        }
    }

    var binPath = getVersionBinary(version);
    if (!binPath) {
        var versionString =
            version.feedName + '/' + version.semanticVersion + '/' + version.arch;
        throw new Error('Specified version is not installed.' + os.EOL +
            'To install this version now: nvs install ' + versionString);
    }

    unlink();

    var linkPath = path.join(homeDir, 'current');
    var linkTarget = getVersionDir(version);
    console.log(linkPath + ' -> ' + linkTarget);

    try {
    fs.symlinkSync(linkTarget, linkPath, 'junction');
    } catch (e) {
        throw new Error('Failed to create symbolic link. ' + e.message);
    }
}

/**
 * Removes a symbolic directory link at $NVS_HOME/current.
 * @param version An optional version to unlink, or null to unlink
 *     any currently linked version.
 */
function unlink(version) {
    var linkPath = path.join(homeDir, 'current');

    if (version) {
        if (!version.semanticVersion) {
            throw new Error('Specify a semantic version.');
        }

        // Only unlink if the current link points to the specified version.
        var linkVersion = getLinkedVersion();
        if (!nvsVersion.equal(version, linkVersion)) {
            return;
        }
    }

    try {
        fs.unlinkSync(linkPath);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Failed to remove symbolic link: ' + e.message);
        }
    }
}

/**
 * Gets the version that is currently linked, or null if there is no current link.
 */
function getLinkedVersion() {
    var linkPath = path.join(homeDir, 'current');
    var linkTarget;
    try {
        linkTarget = fs.readlinkSync(linkPath);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Failed to read symbolic link: ' + e.message);
        }
        return null;
    }

    var linkVersion = null;
    if (linkTarget.toLowerCase().startsWith(homeDir.toLowerCase())) {
        var linkVersionString = linkTarget.substr(homeDir.length);

        if (linkVersionString.endsWith(path.sep)) {
            linkVersionString = linkVersionString.substr(0, linkVersionString.length - 1);
        }
        if (path.sep === '\\') {
            linkVersionString = linkVersionString.replace(/\\/g, '/');
        }

        linkVersion = nvsVersion.parse(linkVersionString);
    }

    if (!linkVersion) {
        // The current link points somewhere else??
        // Remove it to avoid further confusion.
        try {
            fs.unlinkSync(linkPath);
        } catch (e) {
            throw new Error('Failed to remove invalid symbolic link: ' + e.message);
        }
    }

    return linkVersion;
}

/**
 * Gets the directory corresponding to a version installation.
 * (Does not check if the directory actually exists.)
 */
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

/**
 * Gets the path to the node binary executable for a version.
 * Returns null if the version is not installed or the executable is not found.
 */
function getVersionBinary(version) {
    if (!version) {
        version = getCurrentVersion();
        if (!version) {
            return null;
        }
    }

    // Resolve the version to a path and check if the binary exists.
    var nodeBinPath = path.join(
        getVersionDir(version), (isWindows ? 'node.exe' : 'bin/node'));
    try {
        fs.accessSync(nodeBinPath, fs.constants.X_OK);
        return nodeBinPath;
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Cannot access binary: ' + nodeBinPath + '. ' + e.message);
        }
        return null;
    };
}

module.exports = {
    isWindows,
    isMac,
    homeDir,
    use,
    run,
    link,
    unlink,
    getCurrentVersion,
    getLinkedVersion,
    getVersionDir,
    getVersionBinary,
};
