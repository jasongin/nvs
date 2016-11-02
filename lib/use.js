/* global settings */
let childProcess = require('child_process');  // Non-const enables test mocking
let fs = require('fs');  // Non-const enables test mocking
const os = require('os');
const path = require('path');
const Error = require('./error');

const nvsVersion = require('./version');
let nvsLink = null; // Lazy load

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const linkName = 'default';

/**
 * Gets the current version of NVS-managed node that is in the PATH.
 * Returns null if no NVS-managed node was found in the PATH.
 */
function getCurrentVersion() {
    let envPath = process.env['PATH'];
    if (!envPath) {
        throw new Error('Missing PATH environment variable.');
    }

    let pathEntries = envPath.split(path.delimiter);
    for (let i = 0; i < pathEntries.length; i++) {
        let pathEntry = pathEntries[i];
        if (pathEntry.endsWith(path.sep)) {
            pathEntry = pathEntry.substr(0, pathEntry.length - 1);
        }

        if (pathEntry.toLowerCase().startsWith(settings.home.toLowerCase())) {
            if (!isWindows) {
                if (!pathEntry.endsWith(path.sep + 'bin')) {
                    continue;
                }
                pathEntry = pathEntry.substr(0, pathEntry.length - 4);
            }

            let versionString = pathEntry.substr(settings.home.length);
            if (versionString === linkName) {
                nvsLink = nvsLink || require('./link');
                return nvsLink.getLinkedVersion();
            }

            if (path.sep === '\\') {
                versionString = versionString.replace(/\\/g, '/');
            }
            try {
                let version = nvsVersion.parse(versionString, true);
                return version;
            } catch (e) {
            }
        } else if (isWindows && pathEntry.toLowerCase() === getSystemLinkPath().toLowerCase()) {
            nvsLink = nvsLink || require('./link');
            return nvsLink.getLinkedVersion(getSystemLinkPath());
        }
    }

    return null;
}

/**
 * Updates the calling shell's PATH so that a desired version of node will be used.
 *
 * @param version The version of node to add to the PATH, or null to remove all
 *     NVS node versions from the PATH.
 * @param skipUpdateShellEnv If true, PATH changes are not written out to the
 *     post-execution script that is used to update the calling shell's environment.
 */
function use(version, skipUpdateShellEnv) {
    let envPath = process.env['PATH'];
    if (!envPath) {
        throw new Error('Missing PATH environment variable.');
    }

    if (version) {
        // Check if the specified version is present.
        let binPath = getVersionBinary(version);
        if (!binPath) {
            let versionString =
                version.remoteName + '/' + version.semanticVersion + '/' + version.arch;
            throw new Error('Specified version not found.' + os.EOL +
                'To add this version now: nvs add ' + versionString, Error.ENOENT);
        }
    }

    let result = [];
    let pathEntries = envPath.split(path.delimiter);
    let saveChanges = false;

    // Remove any other versions from the environment PATH.
    for (let i = 0; i < pathEntries.length; i++) {
        let pathEntry = pathEntries[i];
        if (pathEntry.endsWith(path.sep)) {
            pathEntry = pathEntry.substr(0, pathEntry.length - 1);
        }

        let previousVersion = null;
        if (pathEntry.toLowerCase().startsWith(settings.home.toLowerCase())) {
            if (!isWindows) {
                if (!pathEntry.endsWith(path.sep + 'bin')) {
                    continue;
                }
                pathEntry = pathEntry.substr(0, pathEntry.length - 4);
            }

            let versionString = pathEntry.substr(settings.home.length);
            if (versionString === linkName) {
                nvsLink = nvsLink || require('./link');
                previousVersion = nvsLink.getLinkedVersion();
            } else {
                if (path.sep === '\\') {
                    versionString = versionString.replace(/\\/g, '/');
                }
                try {
                    previousVersion = nvsVersion.parse(versionString, true);
                } catch (e) {
                }
            }
        } else if (isWindows && pathEntry.toLowerCase() === getSystemLinkPath().toLowerCase()) {
            nvsLink = nvsLink || require('./link');
            previousVersion = nvsLink.getLinkedVersion(getSystemLinkPath());
        }

        if (previousVersion) {
            if (i === 0 && version && nvsVersion.equal(version, previousVersion)) {
                // Found the requested version already at the front of the PATH.
                version = null;
            } else {
                pathEntries.splice(i--, 1);
                result.push('PATH -= ' + homePath(pathEntry));
                saveChanges = true;
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
        result.push('PATH += ' + homePath(versionDir));
        saveChanges = true;
    }

    if (saveChanges) {
        envPath = pathEntries.join(path.delimiter);
        process.env['PATH'] = envPath;

        if (!skipUpdateShellEnv && !settings.skipUpdateShellEnv) {
            require('./postScript').generate({ 'PATH': envPath });
        }
    }

    return result;
}

/**
 * Runs the specified version of node with the args.
 */
function run(version, args) {
    // Check if the specified version is present.
    let binPath = getVersionBinary(version);
    if (!binPath) {
        let versionString =
            version.remoteName + '/' + version.semanticVersion + '/' + version.arch;
        throw new Error('Specified version not found.' + os.EOL +
            'To add this version now: nvs add ' + versionString, Error.ENOENT);
    }

    let child = childProcess.spawnSync(
        binPath,
        args,
        { stdio: 'inherit' });
    if (child.error) {
        throw new Error('Failed to launch node child process.', child.error);
    } else {
        process.exitCode = child.status;
    }
}

/**
 * Runs any executable with a versioned environment.
 */
function exec(version, exe, args) {
    if (!exe) {
        throw new Error('Specify an executable.');
    }

    // Update the current process PATH (but not caller PATH) to the specified version.
    let skipUpdateShellEnv = true;
    use(version, skipUpdateShellEnv);

    exe = findInPath(exe);

    let child = childProcess.spawnSync(
        exe,
        args,
        { stdio: 'inherit' });
    if (child.error) {
        throw new Error('Failed to launch process.', child.error);
    } else {
        process.exitCode = child.status;
    }
}

/**
 * Searches for an executable in the PATH.
 * On Windows, PATHEXT extensions are also appended as necessary.
 * Throws an error if the executable is not found.
 */
function findInPath(exe) {
    if (path.isAbsolute(exe)) {
        return exe;
    }

    if (path.dirname(exe) !== '.') {
        throw new Error('A relative executable path is not valid. ' +
            'Specify an executable name or absolute path.');
    }
    let pathExtensions = [''];
    if (isWindows && process.env['PATHEXT']) {
        pathExtensions = process.env['PATHEXT'].split(';').map(ext => ext.toUpperCase());
        if (pathExtensions.indexOf(path.extname(exe).toUpperCase()) >= 0) {
            pathExtensions = [''];
        }
    }

    let pathEntries = process.env['PATH'].split(path.delimiter);
    for (let i = 0; i < pathEntries.length; i++) {
        for (let j = 0; j < pathExtensions.length; j++) {
            let exePath = path.join(pathEntries[i], exe) + pathExtensions[j];
            try {
                fs.accessSync(exePath, fs.constants.X_OK);
                return exePath;
            } catch (e) {
            }
        }
    };

    throw new Error('Executable not found in PATH: ' + exe);
}

/**
 * Gets the directory corresponding to a version of node.
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
        version.arch);
}

/**
 * Gets the path to the node binary executable for a version.
 * Returns null if the version is not present or the executable is not found.
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
        Error.throwIfNot(Error.ENOENT, e, 'Cannot access binary: ' + nodeBinPath);
        return null;
    }
}

/**
 * Replaces the beginning of a path with ~ or %LOCALAPPDATA%,
 * for shorter easier-to-read display.
 */
function homePath(fullPath) {
    if (isWindows) {
        let userAppdataDir = process.env['LOCALAPPDATA'];
        if (fullPath.toLowerCase().startsWith(userAppdataDir.toLowerCase())) {
            let postScriptFile = process.env['NVS_POSTSCRIPT'];
            let inPowerShell = (postScriptFile &&
                path.extname(postScriptFile).toUpperCase() === '.PS1');
            return (inPowerShell ? '$env:LOCALAPPDATA' : '%LOCALAPPDATA%') +
                fullPath.substr(userAppdataDir.length);
        }
    } else {
        let userHomeDir = process.env['HOME'];
        if (fullPath.toLowerCase().startsWith(userHomeDir.toLowerCase())) {
            return '~' + fullPath.substr(userHomeDir.length);
        }
    }

    return fullPath;
}

function getLinkPath() {
    return path.join(settings.home, linkName);
}

function getSystemLinkPath() {
    if (isWindows) {
        return path.join(process.env['ProgramFiles'], 'nodejs');
    }
}

module.exports = {
    isWindows,
    isMac,
    use,
    run,
    exec,
    getCurrentVersion,
    getVersionDir,
    getVersionBinary,
    homePath,
    getLinkPath,
    getSystemLinkPath,
};
