/* global settings */
let childProcess = require('child_process');  // Non-const enables test mocking
let fs = require('fs');  // Non-const enables test mocking
const path = require('path');
const os = require('os');

const nvsVersion = require('./version');

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const pathSeparator = (isWindows ? ';' : ':');

/**
 * Gets the current version of NVS-installed node that is in the PATH.
 * Returns null if no NVS-installed node was found in the PATH.
 */
function getCurrentVersion() {
    let envPath = process.env['PATH'];
    if (!envPath) {
        throw new Error('Missing PATH environment variable.');
    }

    let pathEntries = envPath.split(pathSeparator);
    for (let i = 0; i < pathEntries.length; i++) {
        let pathEntry = pathEntries[i];
        if (pathEntry.toLowerCase().startsWith(settings.home.toLowerCase())) {
            if (pathEntry.endsWith(path.sep)) {
                pathEntry = pathEntry.substr(0, pathEntry.length - 1);
            }

            if (!isWindows) {
                if (!pathEntry.endsWith(path.sep + 'bin')) {
                    continue;
                }
                pathEntry = pathEntry.substr(0, pathEntry.length - 4);
            }

            let versionString = pathEntry.substr(settings.home.length);
            if (versionString === 'current') {
                return getLinkedVersion();
            }

            if (path.sep === '\\') {
                versionString = versionString.replace(/\\/g, '/');
            }
            try {
                let version = nvsVersion.parse(versionString, true);
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
 * @param skipPostScript True to skip writing changes to a postscript (for testing)
 */
function use(version, skipPostScript) {
    let envPath = process.env['PATH'];
    if (!envPath) {
        throw new Error('Missing PATH environment variable.');
    }

    if (version) {
        // Check if the specified version is installed.
        let binPath = getVersionBinary(version);
        if (!binPath) {
            let versionString =
                version.remoteName + '/' + version.semanticVersion + '/' + version.arch;
            let e = new Error('Specified version is not installed.' + os.EOL +
                'To install this version now: nvs install ' + versionString);
            e.code = 'ENOENT';
            throw e;
        }
    }

    let pathEntries = envPath.split(pathSeparator);
    let saveChanges = false;

    // Remove any other versions from the environment PATH.
    for (let i = 0; i < pathEntries.length; i++) {
        let pathEntry = pathEntries[i];
        if (pathEntry.toLowerCase().startsWith(settings.home.toLowerCase())) {
            if (pathEntry.endsWith(path.sep)) {
                pathEntry = pathEntry.substr(0, pathEntry.length - 1);
            }

            if (!isWindows) {
                if (!pathEntry.endsWith(path.sep + 'bin')) {
                    continue;
                }
                pathEntry = pathEntry.substr(0, pathEntry.length - 4);
            }

            let previousVersion = null;
            let versionString = pathEntry.substr(settings.home.length);
            if (versionString === 'current') {
                previousVersion = getLinkedVersion();
            } else {
                if (path.sep === '\\') {
                    versionString = versionString.replace(/\\/g, '/');
                }
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
        let versionDir = getVersionDir(version);
        if (!isWindows) {
            versionDir = path.join(versionDir, 'bin');
        } else if (versionDir.endsWith(path.sep)) {
            versionDir = versionDir.substr(0, versionDir.length - 1);
        }

        pathEntries.splice(0, 0, versionDir);
        saveChanges = true;
    }

    if (saveChanges) {
        envPath = pathEntries.join(pathSeparator);
        process.env['PATH'] = envPath;

        if (!skipPostScript) {
            require('./postScript').generate({ 'PATH': envPath });
        }
    }
}

/**
 * Runs the specified (installed) version of node with the args.
 */
function run(version, args) {
    // Check if the specified version is installed.
    let binPath = getVersionBinary(version);
    if (!binPath) {
        let versionString =
            version.remoteName + '/' + version.semanticVersion + '/' + version.arch;
        let e = new Error('Specified version is not installed.' + os.EOL +
            'To install this version now: nvs install ' + versionString);
        e.code = 'ENOENT';
        throw e;
    }

    let child = childProcess.spawnSync(
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

    let binPath = getVersionBinary(version);
    if (!binPath) {
        let versionString =
            version.remoteName + '/' + version.semanticVersion + '/' + version.arch;
        let e = new Error('Specified version is not installed.' + os.EOL +
            'To install this version now: nvs install ' + versionString);
        e.code = 'ENOENT';
        throw e;
    }

    unlink();

    let linkPath = path.join(settings.home, 'current');
    let linkTarget = getVersionDir(version);
    if (linkTarget.endsWith(path.sep)) {
        linkTarget = linkTarget.substr(0, linkTarget.length - 1);
    }

    let result = homePath(linkPath) + ' -> ' + homePath(linkTarget);

    if (!isWindows) {
        linkTarget = path.relative(settings.home, linkTarget);
    }

    try {
        fs.symlinkSync(linkTarget, linkPath, 'junction');
    } catch (e) {
        throw new Error('Failed to create symbolic link. ' + e.message);
    }

    return result;
}

/**
 * Removes a symbolic directory link at $NVS_HOME/current.
 * @param version An optional version to unlink, or null to unlink
 *     any currently linked version.
 */
function unlink(version) {
    if (version) {
        if (!version.semanticVersion) {
            throw new Error('Specify a semantic version.');
        }

        // Only unlink if the current link points to the specified version.
        let linkVersion = getLinkedVersion();
        if (!linkVersion || !nvsVersion.equal(version, linkVersion)) {
            return;
        }
    }

    let linkPath = path.join(settings.home, 'current');
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
    let linkPath = path.join(settings.home, 'current');
    let linkTarget;
    try {
        linkTarget = fs.readlinkSync(linkPath);
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Failed to read symbolic link: ' + e.message);
        }
        return null;
    }

    if (!path.isAbsolute(linkTarget)) {
        linkTarget = path.join(settings.home, linkTarget);
    }

    let linkVersion = null;
    if (linkTarget.toLowerCase().startsWith(settings.home.toLowerCase())) {
        let linkVersionString = linkTarget.substr(settings.home.length);

        if (linkVersionString.endsWith(path.sep)) {
            linkVersionString = linkVersionString.substr(0, linkVersionString.length - 1);
        }
        if (path.sep === '\\') {
            linkVersionString = linkVersionString.replace(/\\/g, '/');
        }

        linkVersion = nvsVersion.parse(linkVersionString, true);
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
        settings.home,
        version.remoteName,
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
    let nodeBinPath = path.join(
        getVersionDir(version), (isWindows ? 'node.exe' : 'bin/node'));
    try {
        fs.accessSync(nodeBinPath, fs.constants.X_OK);
        return nodeBinPath;
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Cannot access binary: ' + nodeBinPath + '. ' + e.message);
        }
        return null;
    }
}

/**
 * Replaces the $HOME portion of a path with ~.
 */
function homePath(path) {
    if (!isWindows) {
        let userHome = process.env['HOME'];
        if (path.toLowerCase().startsWith(userHome.toLowerCase())) {
            path = '~' + path.substr(userHome.length);
        }
    }

    return path;
}

module.exports = {
    isWindows,
    isMac,
    pathSeparator,
    use,
    run,
    link,
    unlink,
    getCurrentVersion,
    getLinkedVersion,
    getVersionDir,
    getVersionBinary,
    homePath,
};
