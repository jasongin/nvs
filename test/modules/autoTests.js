'use strict';

const path = require('path');
const test = require('ava').default;
const rewire = require('rewire');

test.before(require('../checkNodeVersion'));

const mockFs = require('../mocks/fs');
const testHome = mockFs.fixSep('/home/test/nvs/');

require('../../lib/settings').settings = {
	home: testHome,
	cache: path.join(testHome, 'cache'),
	aliases: {},
	remotes: {
		default: 'test1',
		test1: 'http://example.com/test1',
		test2: 'http://example.com/test2',
	},
	quiet: true,
};

const nvsAuto = rewire('../../lib/auto');

const mockNvsUse = {
	usedVersions: [],
	use(version) {
		this.usedVersions.push(version);
	},
	getVersionBinary(version) {
		return version && version.semanticVersion === '1.2.3'
			? path.join(testHome, version.remoteName, version.semanticVersion, version.arch, 'node')
			: null;
	},
};

const mockNvsAddRemove = {
	addedVersions: [],
	addAsync(version) {
		this.addedVersions.push(version);
		return Promise.resolve();
	},
};

const mockNvsList = {
	find(version) {
		return version.semanticVersion === '1.2.3' ? version : null;
	},
};

const mockNvsLink = {
	getLinkedVersion() {
		return true;
	},
};

nvsAuto.__set__('fs', mockFs);
nvsAuto.__set__('nvsUse', mockNvsUse);
nvsAuto.__set__('nvsAddRemove', mockNvsAddRemove);
nvsAuto.__set__('nvsList', mockNvsList);
nvsAuto.__set__('nvsLink', mockNvsLink);

test.beforeEach(t => {
	mockFs.reset();
	mockNvsUse.usedVersions = [];
	mockNvsAddRemove.addedVersions = [];
});

test.serial('Auto switch to default', t => {
	return nvsAuto.autoSwitchAsync('/testA/testB').then(() => {
		t.is(mockNvsUse.usedVersions.length, 1);
		t.is(mockNvsUse.usedVersions[0], 'default');
		t.deepEqual(mockNvsAddRemove.addedVersions, []);
	});
});

test.serial('Auto switch based on current dir', t => {
	mockFs.mockFile('/testA/testB/.node-version', '1.2.3');
	return nvsAuto.autoSwitchAsync('/testA/testB').then(() => {
		t.is(mockNvsUse.usedVersions.length, 1);
		t.is(mockNvsUse.usedVersions[0].semanticVersion, '1.2.3');
		t.deepEqual(mockNvsAddRemove.addedVersions, []);
	});
});

test.serial('Auto switch based on current dir using nvmrc', t => {
	mockFs.mockFile('/testA/testB/.nvmrc', '1.2.3');
	return nvsAuto.autoSwitchAsync('/testA/testB').then(() => {
		t.is(mockNvsUse.usedVersions.length, 1);
		t.is(mockNvsUse.usedVersions[0].semanticVersion, '1.2.3');
		t.deepEqual(mockNvsAddRemove.addedVersions, []);
	});
});

test.serial('Auto switch based on parent dir', t => {
	mockFs.mockFile('/testA/.node-version', '1.2.3');
	return nvsAuto.autoSwitchAsync('/testA/testB').then(() => {
		t.is(mockNvsUse.usedVersions.length, 1);
		t.is(mockNvsUse.usedVersions[0].semanticVersion, '1.2.3');
		t.deepEqual(mockNvsAddRemove.addedVersions, []);
	});
});

test.serial('Auto download and switch based on parent dir', t => {
	mockFs.mockFile('/testA/.node-version', '2.3.4');
	return nvsAuto.autoSwitchAsync('/testA/testB').then(() => {
		t.is(mockNvsAddRemove.addedVersions.length, 1);
		t.is(mockNvsAddRemove.addedVersions[0].semanticVersion, '2.3.4');
		t.is(mockNvsUse.usedVersions.length, 1);
		t.is(mockNvsUse.usedVersions[0].semanticVersion, '2.3.4');
	});
});

test.serial('Auto download and switch based on parent dir using nvmrc', t => {
	mockFs.mockFile('/testA/.nvmrc', '2.3.4');
	return nvsAuto.autoSwitchAsync('/testA/testB').then(() => {
		t.is(mockNvsAddRemove.addedVersions.length, 1);
		t.is(mockNvsAddRemove.addedVersions[0].semanticVersion, '2.3.4');
		t.is(mockNvsUse.usedVersions.length, 1);
		t.is(mockNvsUse.usedVersions[0].semanticVersion, '2.3.4');
	});
});
