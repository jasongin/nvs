// @ts-check
'use strict';

let childProcess = require('child_process');  // Non-const enables test mocking
let fs = require('fs');  // Non-const enables test mocking
const os = require('os');
const path = require('path');

const settings = require('./settings').settings;
const Error = require('./error');

const NodeVersion = require('./version');
let nvsList = null;  // Lazy load
let nvsLink = null;  // Lazy load

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

	let version = null;
	let pathEntries = envPath.split(path.delimiter);
	for (let i = 0; i < pathEntries.length && !version; i++) {
		let pathEntry = pathEntries[i];
		if (pathEntry.endsWith(path.sep)) {
			pathEntry = pathEntry.substr(0, pathEntry.length - 1);
		}

		if (pathEntry.toLowerCase().startsWith(settings.home.toLowerCase())) {
			if (!isWindows) {
				if (pathEntry.endsWith(path.sep + 'bin')) {
					pathEntry = pathEntry.substr(0, pathEntry.length - 4);
				} else if (pathEntry !== getLinkPath()) {
					continue;
				}
			}

			let versionString = pathEntry.substr(settings.home.length);
			if (versionString === linkName) {
				nvsLink = nvsLink || require('./link');
				version = nvsLink.getLinkedVersion();
				if (version) {
					version.default = true;
				}
				break;
			}

			if (path.sep === '\\') {
				versionString = versionString.replace(/\\/g, '/');
			}
			version = NodeVersion.tryParse(versionString);
		} else if (isWindows && pathEntry.toLowerCase() === getSystemLinkPath().toLowerCase()) {
			nvsLink = nvsLink || require('./link');
			version = nvsLink.getLinkedVersion(getSystemLinkPath());
			if (version) {
				version.default = true;
			}
		} else {
			Object.keys(settings.aliases).forEach(name => {
				let value = settings.aliases[name];
				if (path.isAbsolute(value) && value.toLowerCase() === pathEntry.toLowerCase()) {
					version = new NodeVersion();
					version.label = name;
					version.path = value;
				}
			});
		}
	}

	return version;
}

/**
 * Updates the calling shell's PATH so that a desired version of node will be used.
 *
 * @param {NodeVersion | string} [version=null] The version of node to add to the PATH, or
 * 	'default' to use the default (linked) version if any, or null to remove any NVS-managed
 * 	versions from the PATH.
 * @param {boolean} [skipUpdateShellEnv=false] If true, PATH changes are not written out to the
 * 	post-execution script that is used to update the calling shell's environment.
 */
function use(version, skipUpdateShellEnv) {
	if (process.env['NVS_EXECUTE']) {
		throw new Error(
			'The \'use\' command is not available when ' +
			'invoking this script as an' + os.EOL +
			'executable. To enable PATH updates, source ' +
			'nvs.sh from your shell instead.');
	}

	let envPath = process.env['PATH'];
	if (!envPath) {
		throw new Error('Missing PATH environment variable.');
	}

	if (version instanceof NodeVersion) {
		nvsList = nvsList || require('./list');
		let resolvedVersion = nvsList.find(version);
		if (!resolvedVersion) {
			throw new Error('Specified version not found.' + os.EOL +
				'To add this version now: nvs add ' + version, Error.ENOENT);
		}
		delete resolvedVersion.os;
		version = resolvedVersion;
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
				if (pathEntry.endsWith(path.sep + 'bin')) {
					pathEntry = pathEntry.substr(0, pathEntry.length - 4);
				} else if (pathEntry !== getLinkPath()) {
					continue;
				}
			}

			let versionString = pathEntry.substr(settings.home.length);
			if (versionString === linkName) {
				previousVersion = linkName;
			} else {
				if (path.sep === '\\') {
					versionString = versionString.replace(/\\/g, '/');
				}
				previousVersion = NodeVersion.tryParse(versionString);
			}
		} else if (isWindows && pathEntry.toLowerCase() === getSystemLinkPath().toLowerCase()) {
			previousVersion = linkName;
		} else {
			Object.keys(settings.aliases).forEach(name => {
				let value = settings.aliases[name];
				if (path.isAbsolute(value) && value.toLowerCase() === pathEntry.toLowerCase()) {
					previousVersion = new NodeVersion();
					previousVersion.label = name;
					previousVersion.path = value;
				}
			});
		}

		if (previousVersion) {
			if (i === 0 && version &&
				(version === previousVersion || NodeVersion.equal(version, previousVersion))
			) {
				// Found the requested version already at the front of the PATH.
				version = null;
			} else {
				pathEntries.splice(i--, 1);
				if (!isWindows &&
					!(previousVersion instanceof NodeVersion && previousVersion.path)
				) {
					pathEntry = path.join(pathEntry, 'bin');
				}
				result.push('PATH -= ' + homePath(pathEntry));
				saveChanges = true;
			}
		}
	}

	let versionBinDir = null;
	if (version === linkName) {
		// Insert the default version (if any) at the front of the path.
		nvsLink = nvsLink || require('./link');
		let version = nvsLink.getLinkedVersion();
		if (version) {
			versionBinDir = getLinkPath();
			if (!isWindows && !version.path) {
				versionBinDir = path.join(versionBinDir, 'bin');
			}
		} else {
			throw new Error('No default node version. ' +
				'Specify a version to use, or use `nvs link` to set a default.');
		}
	} else if (version) {
		// Insert the requested version at the front of the PATH.
		versionBinDir = getVersionBinDir(version);
	}

	if (versionBinDir) {
		if (versionBinDir.endsWith(path.sep)) {
			versionBinDir = versionBinDir.substr(0, versionBinDir.length - 1);
		}

		pathEntries.splice(0, 0, versionBinDir);
		result.push('PATH += ' + homePath(versionBinDir));
		saveChanges = true;
	}

	if (saveChanges) {
		envPath = pathEntries.join(path.delimiter);
		process.env['PATH'] = envPath;
		delete process.env['NPM_CONFIG_PREFIX'];

		if (!skipUpdateShellEnv && !settings.skipUpdateShellEnv) {
			require('./postScript').generate({ 'PATH': envPath, 'NPM_CONFIG_PREFIX': null });
		}
	}

	return result;
}

/**
 * Runs the specified version of node with the args.
 *
 * @param version The version of node to run with, or null to use the current version,
 * 	or 'default' to use the default (linked) version if any.
 */
function run(version, args) {
	if (!version) {
		version = getCurrentVersion() || 'default';
	}

	if (version === 'default') {
		nvsLink = nvsLink || require('./link');
		version = nvsLink.getLinkedVersion();
		if (version == null) {
			throw new Error('No default node version. ' +
				'Specify a version to run, or use `nvs link` to set a default.');
		}
	}

	nvsList = nvsList || require('./list');
	let resolvedVersion = nvsList.find(version);
	if (!resolvedVersion) {
		throw new Error('Specified version not found.' + os.EOL +
			'To add this version now: nvs add ' + version, Error.ENOENT);
	}
	version = resolvedVersion;

	let child = childProcess.spawnSync(
		getVersionBinary(version),
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
	if (version.path) {
		return version.path;
	} else if (!version.semanticVersion) {
		throw new Error('Specify a semantic version.');
	} else if (!version.remoteName) {
		throw new Error('Specify a remote name.');
	} else if (!version.arch) {
		throw new Error('Specify a processor architecture.');
	}

	return path.join(
		settings.home,
		version.remoteName,
		version.semanticVersion,
		version.arch);
}

/**
 * Gets the directory that should contain the executable for a version of node.
 * (Does not check if the directory actually exists.)
 */
function getVersionBinDir(version) {
	let versionDir = getVersionDir(version);
	if (!isWindows && !version.path) {
		versionDir = path.join(versionDir, 'bin');
	}
	return versionDir;
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
	let binaryName = NodeVersion.getBinaryNameFromVersion(version.semanticVersion);
	let nodeBinPath = path.join(getVersionBinDir(version), isWindows ? binaryName + '.exe' : binaryName);
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
		if (userAppdataDir && fullPath.toLowerCase().startsWith(userAppdataDir.toLowerCase())) {
			let postScriptFile = process.env['NVS_POSTSCRIPT'];
			let inPowerShell = (postScriptFile &&
				path.extname(postScriptFile).toUpperCase() === '.PS1');
			return (inPowerShell ? '$env:LOCALAPPDATA' : '%LOCALAPPDATA%') +
				fullPath.substr(userAppdataDir.length);
		}
	} else {
		let userHomeDir = process.env['HOME'];
		if (userHomeDir && fullPath.toLowerCase().startsWith(userHomeDir.toLowerCase())) {
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
	getVersionBinDir,
	getVersionBinary,
	homePath,
	getLinkPath,
	getSystemLinkPath,
};
