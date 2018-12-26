// @ts-check
'use strict';

let fs = require('fs');  // Non-const enables test mocking
const path = require('path');

const settings = require('./settings').settings;
const Error = require('./error');

let nvsList = require('./list');  // Non-const enables test mocking
let nvsUse = require('./use');  // Non-const enables test mocking
let nvsLink = require('./link');  // Non-const enables test mocking
const NodeVersion = require('./version');

let nvsDownload = null;  // Delay-load
let nvsExtract = null;  // Delay-load

const isWindows = process.platform === 'win32';

/**
 * Downloads and extracts a version of node.
 *
 * @param {NodeVersion} version The version to add.
 * @param {boolean} [useNow=false] True to use the added version now.
 */
function addAsync(version, useNow) {
	return nvsList.getRemoteVersionsAsync(version.remoteName).then(versions => {
		let resolvedVersion = nvsList.find(version, versions);
		if (!resolvedVersion) {
			throw new Error('Version ' +
				(version.semanticVersion || version.label) +
				' not found in remote: ' + version.remoteName, Error.ENOENT);
		}

		version = resolvedVersion;
		let binPath = nvsUse.getVersionBinary(version);
		if (binPath) {
			if (useNow) {
				return nvsUse.use(version);
			} else {
				return ['Already added at: ' + nvsUse.homePath(binPath),
					'To use this version now: nvs use ' + version];
			}
		} else {
			let versionPackages = (version.packages || []).filter(
				p => p.os === NodeVersion.defaultOs && p.arch === version.arch);

			let versionPackage;
			if (NodeVersion.defaultOs === 'win') {
				versionPackage = versionPackages.find(p => p.ext === '.7z') ||
					versionPackages.find(p => p.ext === '.zip') ||
					versionPackages.find(p => p.ext === '.msi');
			} else if (process.env['NVS_USE_XZ'] === '1') {
				versionPackage = versionPackages.find(p => p.ext === '.tar.xz') ||
					versionPackages.find(p => p.ext === '.tar.gz');
			} else {
				versionPackage = versionPackages.find(p => p.ext === '.tar.gz');
			}

			if (!versionPackage) {
				throw new Error('Platform package not available for version: ' + version);
			}

			let label = version.label;
			version = versionPackage;

			// Clean up the directory first, in case there is a failed partial extraction.
			let versionDir = nvsUse.getVersionDir(version);
			removeDirectoryRecursive(versionDir);

			return downloadAndExtractAsync(version).then(() => {
				if (label) {
					fs.writeFileSync(path.join(nvsUse.getVersionDir(version), '.nvs'),
						JSON.stringify({ label }, null, '\t'));
				}

				binPath = nvsUse.getVersionBinary(version);
				if (binPath) {
					if (useNow) {
						return nvsUse.use(version);
					} else {
						return ['Added at: ' + nvsUse.homePath(binPath),
							'To use this version now: nvs use ' + version];
					}
				} else {
					throw new Error('Add failed - executable file not found.');
				}
			});
		}
	});
}

/**
 * Downloads and extracts a version of node.
 * @param {NodeVersion} version The version to download.
 */
function downloadAndExtractAsync(version) {
	let archiveFileName = version.remoteName + '-v' + version.semanticVersion +
		'-' + version.os + '-' + version.arch + version.ext;

	let shasumFileName;
	if (version.shasumUri) {
		shasumFileName = version.remoteName + '-v' +
			version.semanticVersion + '-SHASUMS256.txt';
	}

	let targetDir = mkdirs(
		settings.home,
		version.remoteName,
		version.semanticVersion,
		version.arch);

	nvsDownload = nvsDownload || require('./download');
	return nvsDownload.ensureFileCachedAsync(
		archiveFileName,
		version.uri,
		shasumFileName,
		version.shasumUri
	).then(zipFilePath => {
		nvsExtract = nvsExtract || require('./extract');
		return nvsExtract.extractAsync(zipFilePath, targetDir);
	}).then(() => {
		// Guess the name of the top-level extracted directory.
		// There should be only one, and usually it starts with "node".
		let extractedDirs = fs.readdirSync(targetDir).filter(childName => {
			return fs.statSync(path.join(targetDir, childName)).isDirectory();
		});
		let extractedDirName = null;
		if (extractedDirs.length === 1) {
			extractedDirName = extractedDirs[0];
		} else {
			extractedDirName = extractedDirs.find(dirName => dirName.startsWith('node'));
			if (!extractedDirName) {
				throw new Error('Archive did not contain expected layout: ' + archiveFileName);
			}
		}

		let extractedDirPath = path.join(targetDir, extractedDirName);

		// Move the extracted files up one directory.
		let childNames = fs.readdirSync(extractedDirPath);
		childNames.forEach(childName => {
			let oldPath = path.join(extractedDirPath, childName);
			let newPath = path.join(targetDir, childName);
			renameWithRetry(oldPath, newPath);
		});

		// Remove the now-empty directory.
		fs.rmdirSync(extractedDirPath);

		// Older versions for Windows include an npmrc that sets prefix=${APPDATA}\npm.
		// Delete that file, so that the prefix defaults to the version directory.
		let npmrcFile = path.join(targetDir, 'node_modules', 'npm', 'npmrc');
		try {
			fs.unlinkSync(npmrcFile);
		} catch (e) {
			Error.throwIfNot(Error.ENOENT, e, 'Failed to delete file: ' + npmrcFile);
		}

		if (path.extname(archiveFileName).toLowerCase() === '.msi') {
			fs.readdirSync(targetDir).forEach(childName => {
				if (path.extname(childName).toLowerCase() === '.msi') {
					// Remove the copy of the MSI package created by the extraction.
					fs.unlinkSync(path.join(targetDir, childName));
				}
			});
		}

		return fixNpmCmdShimsAsync(targetDir);
	}).catch(e => {
		removeDirectoryIfEmpty(targetDir);
		removeDirectoryIfEmpty(path.dirname(targetDir));
		removeDirectoryIfEmpty(path.dirname(path.dirname(targetDir)));
		throw e;
	});
}

/**
 * Removes a version of node.
 */
function remove(version) {
	let result = [];

	let resolvedVersion = nvsList.find(version);
	if (resolvedVersion) {
		delete resolvedVersion.os;
		version = resolvedVersion;
	} else if (!version.arch) {
		// Allow the remove to (attempt to) proceed even if the version was not resolved.
		// This can enable cleaning up a partially-added or partially-deleted version.
		version.arch = NodeVersion.defaultArch;
	}

	// Unlink this version if it is linked.
	result = result.concat(nvsLink.unlink(version));

	let currentVersion = nvsUse.getCurrentVersion();

	if (currentVersion && NodeVersion.equal(currentVersion, version)) {
		// The specified version is currently in use. Remove it from the PATH.
		result = result.concat(nvsUse.use(nvsLink.getLinkedVersion() ? 'default' : null));
	}

	// Remove all contents of the version directory,
	// along with parent directories if they are empty.
	let versionDir = nvsUse.getVersionDir(version);
	let removed = removeDirectoryRecursive(versionDir);
	removeDirectoryIfEmpty(path.dirname(versionDir));
	removeDirectoryIfEmpty(path.dirname(path.dirname(versionDir)));

	if (removed) {
		result.push('- ' + versionDir);
	}

	return result;
}

/**
 * Synchronously renames a file or directory, retrying to handle
 * occasional 'EPERM' or 'EACCS' errors.
 */
function renameWithRetry(from, to) {
	// Drived/simplified from https://github.com/isaacs/node-graceful-fs/pull/119
	let backoff = 0;
	const backoffUntil = Date.now() + 5000;
	function tryRename() {
		try {
			fs.renameSync(from, to);
		} catch (e) {
			if (!isWindows) {
				// The retry with backoff is only applicable to Windows.
				throw e;
			} else if ((e.code === 'EACCS' || e.code === 'EPERM') && Date.now() < backoffUntil) {
				if (backoff < 100) {
					backoff += 10;
				}
				const waitUntil = Date.now() + backoff;
				while (Date.now() < waitUntil) {}
				tryRename();
			} else if (backoff > 0 && e.code === 'ENOENT') {
				// The source no longer exists; assume it was renamed.
			} else {
				throw e;
			}
		}
	}
	tryRename();
}

/**
 * Creates a hierarchy of directories as necessary.
 */
function mkdirs(/* arguments */) {
	let pathParts = Array.from(arguments);
	for (let i = 0; i < pathParts.length; i++) {
		let subPath = path.join(...pathParts.slice(0, i + 1));
		try {
			fs.mkdirSync(subPath);
		} catch (e) {
			Error.throwIfNot(Error.EEXIST, e,
				'Could not create directory: ' + subPath);
		}
	}
	return path.join(...pathParts);
}

/**
 * Removes a directory and all files and directories under it.
 * @returns True if the directory was removed, false if it did not exist.
 */
function removeDirectoryRecursive(dir) {
	let childNames;
	try {
		childNames = fs.readdirSync(dir);
	} catch (e) {
		Error.throwIfNot(Error.ENOENT, e, 'Cannot access directory: ' + dir);
		return false;
	}

	childNames.forEach(childName => {
		let childPath = path.join(dir, childName);
		let stats = fs.lstatSync(childPath);
		if (stats.isDirectory()) {
			removeDirectoryRecursive(childPath);
		} else {
			fs.unlinkSync(childPath);
		}
	});

	fs.rmdirSync(dir);
	return true;
}

/**
 * Removes a directory only if it is empty.
 */
function removeDirectoryIfEmpty(dir) {
	let childNames;
	try {
		childNames = fs.readdirSync(dir);
	} catch (e) {
		Error.throwIfNot(Error.ENOENT, e, 'Cannot access directory: ' + dir);
		return;
	}

	if (!childNames || childNames.length === 0) {
		fs.rmdirSync(dir);
	}
}

/**
 * Fix Windows .cmd shims for npm executables, which are installed incorrectly
 * by Node.js and may block global npm package updates.
 *
 * @param {string} targetDir Directory where a node version was extracted.
 */
async function fixNpmCmdShimsAsync(targetDir) {
	if (!isWindows) return;

	try {
		const cmdShimPath = path.join(
			targetDir, 'node_modules', 'npm', 'node_modules', 'cmd-shim');
		fs.statSync(cmdShimPath);
		const cmdShim = require(cmdShimPath);

		// Enumerate .cmd files in the target directory and fix if they are shims.
		for (let childName of fs.readdirSync(targetDir)) {
			if (path.extname(childName).toLowerCase() !== '.cmd') {
				continue;
			}

			const cmdName = path.basename(childName, '.cmd');
			const shimPath = path.join(targetDir, cmdName);
			const jsCliPath = path.join(
				targetDir, 'node_modules', 'npm', 'bin', `${cmdName}-cli.js`);
			if (!fs.existsSync(jsCliPath)) {
				// A corresponding JS CLI file does not exist in the npm bin dir.
				// Probably this is some other .cmd file that isn't an npm shim.
				continue;
			}

			// Found an npm shim. Call the cmd-shim module to fix it.
			await new Promise((resolve, reject) => {
				cmdShim(jsCliPath, shimPath, (e) => {
					if (e) reject(e);
					else resolve();
				});
			});
		}
	} catch (e) {
		if (e.code === 'ENOENT') {
			// Currently all npm >= 3 include the cmd-shim module, but maybe
			// someday it won't? Also it does not exist with test mocking.
			return;
		}

		// Not a fatal error. Most things still work if the shims are not fixed.
		// The only problem may be that the global npm package cannot be upgraded.
		console.warn('Warning: Failed to fix npm cmd shims: ' + e.message);
	}
}

module.exports = {
	addAsync,
	remove,
	renameWithRetry,
};
