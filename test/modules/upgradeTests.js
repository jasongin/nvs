'use strict';

const test = require('ava').default;
const rewire = require('rewire');
const Error = require('../../lib/error');

test.before(require('../checkNodeVersion'));

const mockFs = require('../mocks/fs');
const testHome = mockFs.fixSep('/home/test/nvs/');

require('../../lib/settings').settings = {
	home: testHome,
	aliases: {},
	remotes: {
		'default': 'test',
		'test': 'http://example.com/test',
	},
	quiet: true,
};

const NodeVersion = require('../../lib/version');
const nvsUpgrade = rewire('../../lib/upgrade');
const nvsList = rewire('../../lib/list');
const nvsUse = rewire('../../lib/use');
const exe = (nvsUse.isWindows ? 'node.exe' : 'node');

let mockNvsList = {
	localVersions: [],
	remoteVersions: [],
	getVersions() {
		return this.localVersions;
	},
	find(version, versions) {
		return nvsList.find(version, versions || this.getVersions());
	},
	getRemoteVersionsAsync() {
		return Promise.resolve(this.remoteVersions.map(v => {
			v.packages = {
				find() { return true; },
			};
			return v;
		}));
	},
};
nvsUpgrade.__set__('nvsList', mockNvsList);

let mockNvsAddRemove = {
	addCalls: [],
	removeCalls: [],
	addAsync(version) {
		this.addCalls.push(version);
		return Promise.resolve([ 'Mock added: ' + version.toString() ]);
	},
	remove(version) {
		this.removeCalls.push(version);
		return [ 'Mock removed: ' + version.toString() ];
	},
};
nvsUpgrade.__set__('nvsAddRemove', mockNvsAddRemove);

let mockNvsUse = {
	currentVersion: null,
	useCalls: [],
	getCurrentVersion() {
		return this.currentVersion;
	},
	getVersionBinary(version) {
		return mockNvsList.localVersions.indexOf(version) >= 0 ? exe : null;
	},
	use(version) {
		this.useCalls.push(version);
		return [ 'Mock used: ' + version.toString() ];
	},
};
nvsUpgrade.__set__('nvsUse', mockNvsUse);

let mockNvsLink = {
	linkedVersion: null,
	linkCalls: [],
	getLinkedVersion() {
		return this.linkedVersion;
	},
	link(version) {
		this.linkedVersion = version;
		this.linkCalls.push(version);
		return [ 'Mock linked: ' + version.toString() ];
	},
};
nvsUpgrade.__set__('nvsLink', mockNvsLink);

let mockNvsMigrate = {
	migrateCalls: [],
	migrateGlobalModules(from, to) {
		this.migrateCalls.push([from, to]);
	},
};
nvsUpgrade.__set__('nvsMigrate', mockNvsMigrate);

test.beforeEach(t => {
	mockFs.reset();
	mockNvsList.localVersions = [];
	mockNvsList.remoteVersions = [];
	mockNvsUse.currentVersion = null;
	mockNvsUse.useCalls = [];
	mockNvsAddRemove.addCalls = [];
	mockNvsAddRemove.removeCalls = [];
	mockNvsLink.linkedVersion = null;
	mockNvsLink.linkCalls = [];
	mockNvsMigrate.migrateCalls = [];
});

test.serial('Upgrade to existing version', t => {
	const v1 = NodeVersion.parse('3.4.5');
	const v2 = NodeVersion.parse('3.5.0');
	mockNvsList.localVersions = [ v2, v1 ];
	mockNvsList.remoteVersions = mockNvsList.localVersions;
	return nvsUpgrade.upgradeAsync(v1).then(message => {
		t.regex(message[0], /^Mock removed/);
		t.is(mockNvsUse.useCalls.length, 0);
		t.is(mockNvsLink.linkCalls.length, 0);
		t.is(mockNvsAddRemove.addCalls.length, 0);
		t.is(mockNvsAddRemove.removeCalls.length, 1);
		t.is(mockNvsAddRemove.removeCalls[0].semanticVersion, v1.semanticVersion);
		t.is(mockNvsMigrate.migrateCalls.length, 1);
		t.is(mockNvsMigrate.migrateCalls[0][0].semanticVersion, v1.semanticVersion);
		t.is(mockNvsMigrate.migrateCalls[0][1].semanticVersion, v2.semanticVersion);
	});
});

test.serial('Upgrade to added version', t => {
	const v1 = NodeVersion.parse('3.4.5');
	const v2 = NodeVersion.parse('3.5.0');
	mockNvsList.localVersions = [ v1 ];
	mockNvsList.remoteVersions = [ v2, v1 ];
	return nvsUpgrade.upgradeAsync(v1).then(message => {
		t.regex(message[0], /^Mock removed/);
		t.is(mockNvsUse.useCalls.length, 0);
		t.is(mockNvsLink.linkCalls.length, 0);
		t.is(mockNvsAddRemove.addCalls.length, 1);
		t.is(mockNvsAddRemove.addCalls[0], v2);
		t.is(mockNvsAddRemove.removeCalls.length, 1);
		t.is(mockNvsAddRemove.removeCalls[0].semanticVersion, v1.semanticVersion);
		t.is(mockNvsMigrate.migrateCalls.length, 1);
		t.is(mockNvsMigrate.migrateCalls[0][0].semanticVersion, v1.semanticVersion);
		t.is(mockNvsMigrate.migrateCalls[0][1].semanticVersion, v2.semanticVersion);
	});
});

test.serial('Upgrade current version', t => {
	const v1 = NodeVersion.parse('3.4.5');
	const v2 = NodeVersion.parse('3.5.0');
	mockNvsList.localVersions = [ v2, v1 ];
	mockNvsList.remoteVersions = mockNvsList.localVersions;
	mockNvsUse.currentVersion = v1;
	return nvsUpgrade.upgradeAsync().then(message => {
		t.regex(message[0], /^Mock used/);
		t.regex(message[1], /^Mock removed/);
		t.is(mockNvsUse.useCalls.length, 1);
		t.is(mockNvsUse.useCalls[0], v2);
		t.is(mockNvsLink.linkCalls.length, 0);
		t.is(mockNvsAddRemove.addCalls.length, 0);
		t.is(mockNvsAddRemove.removeCalls.length, 1);
		t.is(mockNvsAddRemove.removeCalls[0].semanticVersion, v1.semanticVersion);
		t.is(mockNvsMigrate.migrateCalls.length, 1);
		t.is(mockNvsMigrate.migrateCalls[0][0].semanticVersion, v1.semanticVersion);
		t.is(mockNvsMigrate.migrateCalls[0][1].semanticVersion, v2.semanticVersion);
	});
});

test.serial('Upgrade linked version', t => {
	const v1 = NodeVersion.parse('3.4.5');
	const v2 = NodeVersion.parse('3.5.0');
	mockNvsList.localVersions = [ v2, v1 ];
	mockNvsList.remoteVersions = mockNvsList.localVersions;
	v1.arch = NodeVersion.defaultArch;
	v1.os = NodeVersion.defaultOs;
	mockNvsLink.linkedVersion = v1;
	return nvsUpgrade.upgradeAsync(v1).then(message => {
		t.regex(message[0], /^Mock linked/);
		t.regex(message[1], /^Mock removed/);
		t.is(mockNvsUse.useCalls.length, 0);
		t.is(mockNvsLink.linkCalls.length, 1);
		t.is(mockNvsLink.linkCalls[0], v2);
		t.is(mockNvsAddRemove.addCalls.length, 0);
		t.is(mockNvsAddRemove.removeCalls.length, 1);
		t.is(mockNvsAddRemove.removeCalls[0].semanticVersion, v1.semanticVersion);
		t.is(mockNvsMigrate.migrateCalls.length, 1);
		t.is(mockNvsMigrate.migrateCalls[0][0].semanticVersion, v1.semanticVersion);
		t.is(mockNvsMigrate.migrateCalls[0][1].semanticVersion, v2.semanticVersion);
	});
});

test('Upgrade not available', t => {
	const v = NodeVersion.parse('3.4.5');
	mockNvsList.localVersions = [ v ];
	return nvsUpgrade.upgradeAsync(v).then(message => {
		t.regex(message[0], /is the latest/);
	});
});

test('Upgrade target not found', t => {
	t.throws(
		() => nvsUpgrade.upgradeAsync(NodeVersion.parse('3.4.5')),
		{ code: Error.ENOENT });
});

test('Upgrade no current version', t => {
	t.throws(
		() => nvsUpgrade.upgradeAsync(null),
		{ message: /Specify a version/ });
});
