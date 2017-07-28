'use strict';

let childProcess = require('child_process');  // Non-const enables test mocking
let fs = require('fs');  // Non-const enables test mocking
const path = require('path');

const settings = require('./settings').settings;
const Error = require('./error');

let nvsList = require('./list');  // Non-const enables test mocking
let nvsUse = require('./use');  // Non-const enables test mocking
let NodeVersion = require('./version');

/**
 * Migrates globally-installed and globally-linked modules from a source version
 * to a target version. Note this ignores any configuration (NPM_CONFIG_PREFIX
 * environment variable or prefix setting in the user's npmrc) that might override
 * the global modules directory location, because that configuration would apply
 * apply to both versions and therefore no migration would be necessary or possible.
 */
function migrateGlobalModules(sourceVersion, targetVersion) {
	if (!sourceVersion) {
		throw new Error('Specify a version to migrate from.');
	}

	let versions = nvsList.getVersions();
	let resolvedVersion = nvsList.find(sourceVersion, versions);
	if (!resolvedVersion) {
		throw new Error('Source version not found: ' + sourceVersion, Error.ENOENT);
	}

	sourceVersion = resolvedVersion;

	if (!targetVersion) {
		targetVersion = nvsUse.getCurrentVersion();
		if (!targetVersion) {
			throw new Error('Specify a version to migrate to.');
		}
	} else {
		resolvedVersion = nvsList.find(targetVersion, versions);
		if (!resolvedVersion) {
			throw new Error('Target version not found: ' + sourceVersion, Error.ENOENT);
		}

		targetVersion = resolvedVersion;
	}

	if (NodeVersion.equal(sourceVersion, targetVersion)) {
		throw new Error('Source and target versions may not be the same.');
	}

	let sourceDir = getGlobalModulesDir(sourceVersion);
	let targetDir = getGlobalModulesDir(targetVersion);

	if (sourceDir.toLowerCase() === targetDir.toLowerCase()) {
		throw new Error('Both versions use the same global modules directory: ' + sourceDir);
	}

	fs.readdirSync(sourceDir).forEach(childName => {
		let childStats = fs.statSync(path.join(sourceDir, childName));
		if (childStats.isDirectory()) {
			if (!childName.startsWith('@')) {
				migratePackage(sourceDir, targetDir, childName, targetVersion);
			} else {
				// Go one level down for scoped packages.
				fs.readdirSync(path.join(sourceDir, childName)).forEach(childName2 => {
					let childStats2 = fs.statSync(path.join(sourceDir, childName, childName2));
					if (childStats2.isDirectory()) {
						migratePackage(sourceDir, targetDir, childName + '/' + childName2,
							targetVersion);
					}
				});
			}
		}
	});
}

function getGlobalModulesDir(version) {
	let binPath = nvsUse.getVersionBinary(version);
	if (!binPath) {
		throw new Error('Version not found: ' + version, Error.ENOENT);
	}

	let modulesDir = nvsUse.isWindows
		? path.join(path.dirname(binPath), 'node_modules')
		: path.join(path.dirname(path.dirname(binPath)), 'lib/node_modules');

	try {
		fs.accessSync(modulesDir);
	} catch (e) {
		throw new Error('Cannot access global modules directory: ' + modulesDir, e);
	}

	return modulesDir;
}

function migratePackage(sourceDir, targetDir, packageName, targetVersion) {
	let sourcePackageDir = path.join(sourceDir, packageName);
	let targetPackageDir = path.join(targetDir, packageName);
	let sourcePackageInfo = getPackageInfo(sourcePackageDir);
	let targetPackageInfo = getPackageInfo(targetPackageDir);

	if (!sourcePackageInfo) {
		return;
	}

	if (targetPackageInfo) {
		let same = (targetPackageInfo.version === sourcePackageInfo.version);
		if (!settings.quiet) {
			console.log('Skipping  : ' + packageName +
				' (source=' + (same ? '' : sourcePackageInfo.version + ', ') +
				'target=' + targetPackageInfo.version + ')');
		}
	} else {
		try {
			let sourceDirStats = fs.lstatSync(sourcePackageDir);
			if (sourceDirStats.isSymbolicLink()) {
				if (!settings.quiet) {
					console.log('Linking   : ' + packageName +
						' (' + sourcePackageInfo.version + ')');
				}
				let linkTarget = fs.readlinkSync(sourcePackageDir);
				linkPackage(targetDir, packageName, linkTarget, targetVersion);
			} else {
				if (!settings.quiet) {
					console.log('Installing: ' + packageName +
						' (' + sourcePackageInfo.version + ')');
				}
				installPackage(targetDir, packageName, targetVersion);
			}
		} catch (e) {
			console.warn('Failed to migrate package: ' + packageName + '; ' + e.message);
		}
	}
}

function getPackageInfo(packagePath) {
	try {
		return JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json')));
	} catch (e) {
		if (e instanceof SyntaxError || e.code === Error.ENOENT) {
			return null;
		}
		throw e;
	}
}

function installPackage(targetDir, packageName, version) {
	let binPath = nvsUse.getVersionBinary(version);
	let npmCliPath = path.join(targetDir, 'npm/bin/npm-cli.js');
	let child = childProcess.spawnSync(
		binPath,
		[npmCliPath, 'install', '-g', packageName],
		{ stdio: ['ignore', 'ignore', process.stderr] });
	if (child.error) {
		throw new Error('Failed to launch npm.', child.error);
	} else if (child.status !== 0) {
		throw new Error('Npm install failed for package: ' + packageName, child.error);
	}
}

function linkPackage(targetDir, packageName, linkTarget, version) {
	let binPath = nvsUse.getVersionBinary(version);
	let npmCliPath = path.join(targetDir, 'npm/bin/npm-cli.js');
	let child = childProcess.spawnSync(
		binPath,
		[npmCliPath, 'link'],
		{ stdio: ['ignore', 'ignore', process.stderr], cwd: linkTarget });
	if (child.error) {
		throw new Error('Failed to launch npm.', child.error);
	} else if (child.status !== 0) {
		throw new Error('Npm link failed for package: ' + packageName, child.error);
	}
}

module.exports = {
	migrateGlobalModules,
	getGlobalModulesDir,
};
