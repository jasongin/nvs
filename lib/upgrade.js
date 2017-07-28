// @ts-check
'use strict';

const settings = require('./settings').settings;
const Error = require('./error');

const NodeVersion = require('./version');
let nvsUse = require('./use');  // Non-const enables test mocking
let nvsList = require('./list');  // Non-const enables test mocking
let nvsAddRemove = null;  // Lazy load
let nvsLink = null;  // Lazy load
let nvsMigrate = null;

function upgradeAsync(version) {
	if (!version) {
		version = nvsUse.getCurrentVersion();
		if (!version) {
			throw new Error('Specify a version to upgrade.');
		}
	} else {
		nvsList = nvsList || require('./list');
		let resolvedVersion = nvsList.find(version);
		if (!resolvedVersion) {
			throw new Error('Specified version not found.', Error.ENOENT);
		}
		version = resolvedVersion;
	}

	version.os = NodeVersion.defaultOs;

	let majorVersion = version.semanticVersion.replace(/(\.|-).*$/, '');
	return nvsList.getRemoteVersionsAsync(version.remoteName).then(availableVersions => {
		let filter = new NodeVersion(version.remoteName, majorVersion, version.arch);
		availableVersions = availableVersions.filter(v => filter.match(v) &&
			v.packages.find(p => p.os === version.os && p.arch === filter.arch));

		let newVersion = availableVersions[0];
		if (!newVersion || NodeVersion.compare(version, newVersion) <= 0) {
			return ['No new version found. ' +
				`${version.semanticVersion} is the latest ` +
				`${version.remoteName}/${majorVersion} version available.`];
		}

		if (!settings.quiet) {
			console.log(`Upgrading ${version} to ${newVersion.semanticVersion}...`);
		}

		newVersion.arch = version.arch;
		let newBinPath = nvsUse.getVersionBinary(newVersion);
		if (newBinPath) {
			return upgradeToVersion(version, newVersion);
		} else {
			nvsAddRemove = nvsAddRemove || require('./addRemove');
			return nvsAddRemove.addAsync(newVersion).then(() => {
				if (!settings.quiet) {
					console.log(`Added at: ${nvsUse.homePath(nvsUse.getVersionBinary(newVersion))}`);
				}
				return upgradeToVersion(version, newVersion);
			});
		}
	});
}

function upgradeToVersion(oldVersion, newVersion) {
	let result = [];

	nvsMigrate = nvsMigrate || require('./migrate');
	nvsMigrate.migrateGlobalModules(oldVersion, newVersion);

	nvsLink = nvsLink || require('./link');
	let linkedVersion = nvsLink.getLinkedVersion();
	if (linkedVersion) {
		linkedVersion.os = NodeVersion.defaultOs;
		if (NodeVersion.equal(oldVersion, linkedVersion)) {
			result = result.concat(nvsLink.link(newVersion));
		}
	}

	// TODO: Migrate aliases from the old to new version.

	let currentVersion = nvsUse.getCurrentVersion();
	if (currentVersion) {
		currentVersion.os = NodeVersion.defaultOs;
		if (NodeVersion.equal(oldVersion, currentVersion)) {
			result = result.concat(nvsUse.use(newVersion));
		}
	}

	nvsAddRemove = nvsAddRemove || require('./addRemove');
	result = result.concat(nvsAddRemove.remove(oldVersion));

	return result;
}

module.exports = {
	upgradeAsync,
};
