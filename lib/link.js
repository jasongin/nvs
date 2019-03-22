// @ts-check
'use strict';

let fs = require('fs');  // Non-const enables test mocking
const os = require('os');
const path = require('path');

const settings = require('./settings').settings;
const Error = require('./error');

const NodeVersion = require('./version');
let nvsUse = require('./use');  // Non-const enables test mocking
let nvsList = null; // Lazy load
let nvsInstall = null; // Lazy load
let nvsWindowsEnv = null; // Lazy load

/**
 * Creates a symbolic directory link at $NVS_HOME/default that points
 * to the specified version directory. When NVS is installed to a system
 * directory (not a per-user directory), then it also links into
 * /usr/local or ProgramFiles. And on Windows the (system or user)
 * profile PATH is updated so that the linked version is used
 * automatically in any new shell environment.
 *
 * @param version A node version to link, or null to use the
 * 	current version from the PATH.
 */
function link(version) {
	if (!version) {
		version = nvsUse.getCurrentVersion();
		if (!version) {
			throw new Error('Specify a version to link.');
		}
	} else {
		nvsList = nvsList || require('./list');
		let resolvedVersion = nvsList.find(version);
		if (!resolvedVersion) {
			throw new Error('Specified version not found.' + os.EOL +
				'To add this version now: nvs add ' + version, Error.ENOENT);
		}
		version = resolvedVersion;
	}

	let linkPath = nvsUse.getLinkPath();

	let linkTarget = nvsUse.getVersionDir(version);
	if (linkTarget.endsWith(path.sep)) {
		linkTarget = linkTarget.substr(0, linkTarget.length - 1);
	}

	let result = [];

	nvsInstall = nvsInstall || require('./install');
	if (nvsInstall.isInSystemDirectory()) {
		if (nvsUse.isWindows) {
			result = result.concat(linkToProgramFiles(linkTarget));
			result = result.concat(linkToWindowsProfilePath(false, linkPath, false));
		} else {
			result = result.concat(linkToUsrLocal(linkTarget));
		}
	} else if (nvsUse.isWindows) {
		result = result.concat(linkToWindowsProfilePath(true, linkPath, false));
	}

	let relativeTarget = nvsUse.isWindows ? linkTarget
		: path.relative(path.dirname(linkPath), linkTarget);

	let previousLinkTarget = null;
	try {
		previousLinkTarget = fs.readlinkSync(linkPath);
		if (previousLinkTarget.endsWith(path.sep)) {
			previousLinkTarget = previousLinkTarget.substr(0, previousLinkTarget.length - 1);
		}
	} catch (e) {
		Error.throwIfNot(Error.ENOENT, e, 'Failed to read link: ' + linkPath);
	}

	if (previousLinkTarget !== relativeTarget) {
		result.splice(0, 0, nvsUse.homePath(linkPath) + ' -> ' + nvsUse.homePath(linkTarget));
		try {
			if (previousLinkTarget != null) {
				fs.unlinkSync(linkPath);
			}
			fs.symlinkSync(relativeTarget, linkPath, 'junction');
		} catch (e) {
			throw new Error('Failed to create symbolic link: ' + linkPath, e);
		}
	}

	return result;
}

/**
 * Removes a symbolic directory link at $NVS_HOME/default.
 * When NVS is installed to a system directory (not a per-user directory),
 * then it also removes a link from a system directory. And on Windows
 * the link path is removed from the (user or system) profile PATH.
 *
 * @param {NodeVersion} [version] An optional version to unlink, or null to unlink
 * 	any linked version.
 */
function unlink(version) {
	if (version) {
		if (!version.semanticVersion) {
			throw new Error('Specify a semantic version.');
		}

		// Only unlink if the link points to the specified version.
		let linkVersion = getLinkedVersion();
		if (!linkVersion || !NodeVersion.equal(version, linkVersion)) {
			return [];
		}
	}

	let result = [];
	let linkPath = nvsUse.getLinkPath();
	let currentVersion = nvsUse.getCurrentVersion();

	nvsInstall = nvsInstall || require('./install');
	if (nvsInstall.isInSystemDirectory()) {
		if (nvsUse.isWindows) {
			result = result.concat(linkToWindowsProfilePath(false, linkPath, false));
			result = result.concat(linkToProgramFiles(null));
		} else {
			result = result.concat(linkToUsrLocal(null));
		}
	} else if (nvsUse.isWindows) {
		result = result.concat(linkToWindowsProfilePath(false, linkPath, false));
	}

	try {
		fs.unlinkSync(linkPath);
		result.push('- ' + nvsUse.homePath(linkPath));
	} catch (e) {
		Error.throwIfNot(Error.ENOENT, e, 'Failed to remove symbolic link: ' + linkPath);
	}

	if (currentVersion && currentVersion.default) {
		result = result.concat(nvsUse.use(null));
	}

	return result;
}

/**
 * Creates a symbolic directory link at %ProgramFiles%\nodejs that points
 * to the specified target directory.
 */
function linkToProgramFiles(linkTarget) {
	let result = [];
	let linkPath = nvsUse.getSystemLinkPath();

	let linkStat = null;
	try {
		linkStat = fs.lstatSync(linkPath);
	} catch (e) {
		Error.throwIfNot(Error.ENOENT, e, 'Failed to access path: ' + linkPath);
	}

	if (!linkTarget) {
		result = result.concat(linkToWindowsProfilePath(false, linkPath, true));
	}

	if (linkStat) {
		if (linkStat.isSymbolicLink()) {
			let previousLinkTarget = null;
			try {
				previousLinkTarget = fs.readlinkSync(linkPath);
				if (previousLinkTarget.endsWith(path.sep)) {
					previousLinkTarget = previousLinkTarget.substr(0, previousLinkTarget.length - 1);
				}
			} catch (e) {
				Error.throwIfNot(Error.ENOENT, e, 'Failed to read link: ' + linkPath);
			}

			if (previousLinkTarget !== linkTarget) {
				try {
					fs.unlinkSync(linkPath);
				} catch (e) {
					Error.throwIfNot(Error.ENOENT, e,
						'Failed to remove symbolic link: ' + linkPath);
				}

				if (!linkTarget) {
					result.push('- ' + nvsUse.homePath(linkPath));
				}
				linkStat = null;
			}
		} else {
			result.push('Not touching existing Node.js directory: ' + nvsUse.homePath(linkPath));
			return result;
		}
	}

	if (linkTarget) {
		if (!linkStat) {
			result.push((linkPath) + ' -> ' + (linkTarget));
			try {
				fs.symlinkSync(linkTarget, linkPath, 'junction');
			} catch (e) {
				throw new Error('Failed to create symbolic link: ' + linkPath, e);
			}
		}
		result = result.concat(linkToWindowsProfilePath(true, linkPath, true));
	}

	return result;
}

/**
 * Creates (or cleans) links under /usr/local that point to a target node
 * directory.
 */
function linkToUsrLocal(linkTarget) {
	// A normal system Node.js installation uses the following paths:
	// /usr/local/bin/node
	// /usr/local/lib/node_modules/
	// /usr/local/bin/npm -> ../lib/node_modules/npm/bin/npm-cli.js
	// /usr/local/bin/<exe> -> ../lib/node_modules/<mod>/bin/<exe>

	let result = [];

	let systemBinPath = '/usr/local/bin';
	let systemLibPath = '/usr/local/lib';
	let nodeBinPath = path.join(systemBinPath, 'node');
	let nodeBinStats = null;
	try {
		nodeBinStats = fs.lstatSync(nodeBinPath);
	} catch (e) {
		Error.throwIfNot(Error.ENOENT, e);
	}

	let nodeModulesPath = path.join(systemLibPath, 'node_modules');
	let nodeModulesStats = null;
	try {
		nodeModulesStats = fs.lstatSync(nodeModulesPath);
	} catch (e) {
		Error.throwIfNot(Error.ENOENT, e);
	}

	let systemLinkMap = readLinks(systemBinPath, target => {
		return isLinkTargetingNvs(systemBinPath, target);
	});

	if (linkTarget) {
		if (nodeBinStats && !nodeBinStats.isSymbolicLink()) {
			result.push('Not touching existing Node.js installation: ' + nodeBinPath);
			return result;
		} else if (nodeModulesStats && !nodeModulesStats.isSymbolicLink()) {
			result.push('Not touching existing Node.js installation: ' + nodeModulesPath);
			return result;
		}

		let binTarget = path.join(linkTarget, 'bin/node');
		if (nodeBinStats) {
			let currentBinTarget = fs.readlinkSync(nodeBinPath);
			currentBinTarget = path.resolve(systemBinPath, currentBinTarget);
			if (currentBinTarget.toLowerCase() !== binTarget.toLowerCase()) {
				fs.unlinkSync(nodeBinPath);
			}
		}

		let relativeBinTarget = path.relative(systemBinPath, binTarget);
		fs.symlinkSync(relativeBinTarget, nodeBinPath);
		result.push(nodeBinPath + ' -> ' + binTarget);

		let modulesTarget = path.join(linkTarget, 'lib/node_modules');
		if (nodeBinStats) {
			let currentModulesTarget = fs.readlinkSync(nodeModulesPath);
			currentModulesTarget = path.resolve(systemLibPath, currentModulesTarget);
			if (currentModulesTarget.toLowerCase() !== modulesTarget.toLowerCase()) {
				fs.unlinkSync(nodeModulesPath);
			}
		}

		let relativeModulesTarget = path.relative(systemBinPath, modulesTarget);
		fs.symlinkSync(relativeModulesTarget, nodeModulesPath);
		result.push(nodeModulesPath + ' -> ' + modulesTarget);

		let versionLinkMap = readLinks(path.join(linkTarget, 'bin'));
		Object.keys(versionLinkMap).sort().forEach(linkName => {
			let versionLinkTarget = versionLinkMap[linkName];
			versionLinkTarget = path.resolve(
				path.join(linkTarget, 'bin'), versionLinkTarget);
			let systemLinkPath = path.join(systemBinPath, linkName);
			let systemLinkTarget = systemLinkMap[linkName];
			if (systemLinkTarget) {
				systemLinkTarget = path.resolve(systemBinPath, systemLinkTarget);
				if (systemLinkTarget.toLowerCase() !== versionLinkTarget.toLowerCase()) {
					fs.unlinkSync(systemLinkPath);
					systemLinkTarget = null;
				}
			}
			if (!systemLinkTarget) {
				let relativeTarget = path.relative(systemBinPath, versionLinkTarget);
				fs.symlinkSync(relativeTarget, systemLinkPath);
				result.push(systemLinkPath + ' -> ' +
					path.join(linkTarget, 'bin', linkName));
			}
		});
		Object.keys(systemLinkMap).sort().forEach(linkName => {
			if (!versionLinkMap[linkName]) {
				let linkPath = path.join(systemBinPath, linkName);
				fs.unlinkSync(linkPath);
				result.push('- ' + linkPath);
			}
		});
	} else {
		Object.keys(systemLinkMap).forEach(linkName => {
			let linkPath = path.join(systemBinPath, linkName);
			fs.unlinkSync(linkPath);
			result.push('- ' + linkPath);
		});

		if (nodeModulesStats && nodeModulesStats.isSymbolicLink()) {
			let modulesTarget = fs.readlinkSync(nodeModulesPath);
			if (isLinkTargetingNvs(modulesTarget)) {
				fs.unlinkSync(nodeModulesPath);
				result.push('- ' + nodeModulesPath);
			}
		}
	}

	return result;
}

function isLinkTargetingNvs(linkDir, linkTarget) {
	let absoluteTarget = path.resolve(linkDir, linkTarget);
	return absoluteTarget.toLowerCase().startsWith(settings.home.toLowerCase());
}

/**
 * Reads all symbolic links in a directory and returns a map from link names to targets.
 */
function readLinks(dir, linkTargetFilter) {
	let linkMap = {};
	fs.readdirSync(dir).forEach(childName => {
		try {
			let childPath = path.join(dir, childName);
			let childStats = fs.lstatSync(childPath);
			if (childStats.isSymbolicLink()) {
				let linkTarget = fs.readlinkSync(childPath);
				if (!linkTargetFilter || linkTargetFilter(linkTarget)) {
					linkMap[childName] = linkTarget;
				}
			}
		} catch (e) {
			// Ignore any items that can't be accessed.
		}
	});
	return linkMap;
}

/**
 * Adds or removes a link path in the user or system profile PATH.
 *
 * @param link True to add the link, false to remove it
 * @param linkPath The link path to be added or removed
 * @param isSystem True to modify the system profile,
 * 	false to modify the user profile.
 */
function linkToWindowsProfilePath(link, linkPath, isSystem) {
	let result = [];

	nvsWindowsEnv = nvsWindowsEnv || require('./windowsEnv');
	let profilePath = nvsWindowsEnv.getEnvironmentVariable('PATH', isSystem);
	let pathParts = (profilePath ? profilePath.split(path.delimiter).filter(part => part) : []);
	let saveChanges = false;

	if (linkPath.endsWith(path.sep)) {
		linkPath = linkPath.substr(0, linkPath.length - 1);
	}

	let linkIndex = pathParts.findIndex(part => {
		if (part.endsWith(path.sep)) {
			part = part.substr(0, part.length - 1);
		}
		return part.toLowerCase() === linkPath.toLowerCase();
	});

	if (link && linkIndex < 0) {
		pathParts.splice(linkIndex, 0, linkPath);
		result.push((isSystem ? 'System' : 'User') +
			' profile PATH += ' + nvsUse.homePath(linkPath));
		saveChanges = true;
	} else if (!link && linkIndex >= 0) {
		pathParts.splice(linkIndex, 1);
		result.push((isSystem ? 'System' : 'User') +
			' profile PATH -= ' + nvsUse.homePath(linkPath));
		saveChanges = true;
	}

	let configPrefix = nvsWindowsEnv.getEnvironmentVariable('NPM_CONFIG_PREFIX', isSystem);
	if (configPrefix) {
		saveChanges = true;
	}

	if (saveChanges) {
		nvsWindowsEnv.setEnvironmentVariable(
			'PATH', pathParts.join(path.delimiter), isSystem);
		if (configPrefix) {
			nvsWindowsEnv.setEnvironmentVariable(
				'NPM_CONFIG_PREFIX', null, isSystem);
		}
	}

	return result;
}

/**
 * Gets the version that is linked, or null if there is no link.
 * @param {string} [linkPath]
 * @return {NodeVersion}
 */
function getLinkedVersion(linkPath) {
	if (!linkPath) {
		linkPath = nvsUse.getLinkPath();
	}

	let linkTarget;
	try {
		let linkStat = fs.lstatSync(linkPath);
		if (!linkStat.isSymbolicLink()) {
			return null;
		}

		linkTarget = fs.readlinkSync(linkPath);
	} catch (e) {
		if (e.code !== Error.ENOENT && e.code !== Error.EIO) {
			throw new Error('Failed to read symbolic link: ' + linkPath, e);
		}
		return null;
	}

	if (!path.isAbsolute(linkTarget)) {
		linkTarget = path.join(path.dirname(linkPath), linkTarget);
	}

	if (linkTarget.endsWith(path.sep)) {
		linkTarget = linkTarget.substr(0, linkTarget.length - 1);
	}

	let linkVersion = null;
	if (linkTarget.toLowerCase().startsWith(settings.home.toLowerCase())) {
		let linkVersionString = linkTarget.substr(settings.home.length);

		if (path.sep === '\\') {
			linkVersionString = linkVersionString.replace(/\\/g, '/');
		}

		linkVersion = NodeVersion.parse(linkVersionString, true);
	} else {
		Object.keys(settings.aliases).forEach(name => {
			let value = settings.aliases[name];
			if (path.isAbsolute(value) && value.toLowerCase() === linkTarget.toLowerCase()) {
				linkVersion = new NodeVersion();
				linkVersion.label = name;
				linkVersion.path = value;
			}
		});
	}

	return linkVersion;
}

module.exports = {
	link,
	unlink,
	getLinkedVersion,
	linkToWindowsProfilePath,
};
