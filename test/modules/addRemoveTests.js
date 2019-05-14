'use strict';

const path = require('path');
const test = require('ava').default;
const rewire = require('rewire');
const Error = require('../../lib/error');

const isWindows = process.platform === 'win32';

test.before(require('../checkNodeVersion'));

const testHome = '/home/test/nvs/'.replace(/\//g, path.sep);
require('../../lib/settings').settings = {
	home: testHome,
	cache: path.join(testHome, 'cache'),
	aliases: {},
	remotes: {
		'test1': 'http://example.com/test1',
		'test2': 'http://example.com/test2',
	},
	quiet: true,
	skipUpdateShellEnv: true,
	linkToSystem: false,
};

const linkPath = testHome + 'default';

const mockFs = require('../mocks/fs');
const mockChildProc = require('../mocks/child_process');
const mockHttp = require('../mocks/http');

const NodeVersion = require('../../lib/version');
const nvsUse = rewire('../../lib/use');
const nvsLink = rewire('../../lib/link');
const nvsAddRemove = rewire('../../lib/addRemove');
const nvsDownload = rewire('../../lib/download');
const nvsExtract = rewire('../../lib/extract');

const plat = (nvsUse.isWindows ? 'win' : process.platform);

nvsUse.__set__('fs', mockFs);
nvsLink.__set__('fs', mockFs);
nvsLink.__set__('nvsUse', nvsUse);
nvsUse.__set__('nvsLink', nvsLink);
nvsAddRemove.__set__('nvsUse', nvsUse);
nvsAddRemove.__set__('nvsLink', nvsLink);
nvsAddRemove.__set__('nvsDownload', nvsDownload);
nvsAddRemove.__set__('nvsExtract', nvsExtract);
nvsAddRemove.__set__('fs', mockFs);
nvsDownload.__set__('http', mockHttp);
nvsDownload.__set__('https', mockHttp);
nvsDownload.__set__('fs', mockFs);
nvsExtract.__set__('childProcess', mockChildProc);

let mockWindowsEnv = {
	getEnvironmentVariable() {
		return '';
	},
	setEnvironmentVariable() {
	},
};
nvsLink.__set__('nvsWindowsEnv', mockWindowsEnv);

let mockNvsList = {
	mockReleasePackage(remoteUri, version, os, arch) {
		let p = new NodeVersion('test1', version, arch);
		p.os = os;
		p.uri = remoteUri + 'v' + version +
			'/node-v' + version + '-' + plat + '-' + arch + '.tar.gz';
		p.ext = (NodeVersion.defaultOs === 'win' ? '.zip' : '.tar.gz');
		p.shasumUri = remoteUri + 'v' + version + '/SHASUMS256.txt';
		return p;
	},

	mockRelease(remoteUri, version) {
		let v = new NodeVersion('test1', version);
		v.packages = [
			mockNvsList.mockReleasePackage(remoteUri, version, NodeVersion.defaultOs, 'x86'),
			mockNvsList.mockReleasePackage(remoteUri, version, NodeVersion.defaultOs, 'x64'),
		];
		return v;
	},

	getRemoteVersionsAsync() {
		return Promise.resolve([
			mockNvsList.mockRelease('http://example.com/test1/', '7.8.9'),
			mockNvsList.mockRelease('http://example.com/test1/', '5.6.7'),
		]);
	},

	find: require('../../lib/list').find,
};
nvsAddRemove.__set__('nvsList', mockNvsList);

const bin = (nvsUse.isWindows ? '' : 'bin');
const exe = (nvsUse.isWindows ? 'node.exe' : 'node');

function setPath(pathEntries) {
	process.env['PATH'] = pathEntries
		.map(entry => Array.isArray(entry) ? path.join(...entry) : entry)
		.map(mockFs.fixSep)
		.join(path.delimiter);
}

function getPath() {
	return process.env['PATH'].split(path.delimiter);
}

test.beforeEach(t => {
	mockFs.reset();
	mockChildProc.reset();
	mockHttp.reset();

	mockFs.mockDir(testHome, ['test1', 'test2']);
	mockFs.mockDir(path.join(testHome, 'test1'), ['5.6.7']);
	mockFs.mockDir(path.join(testHome, 'test1', '5.6.7'), ['x86', 'x64']);
	mockFs.mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), []);
	mockFs.mockDir(path.join(testHome, 'test1', '5.6.7', 'x64'), []);
	mockFs.mockDir(path.join(testHome, 'test2'), ['6.7.8']);
	mockFs.mockDir(path.join(testHome, 'test2', '6.7.8'), ['x64']);
	mockFs.mockDir(path.join(testHome, 'test2', '6.7.8', 'x64'), []);
	mockFs.mockFile(path.join(testHome, 'test1', '5.6.7', 'x86', bin, exe));
	mockFs.mockFile(path.join(testHome, 'test1', '5.6.7', 'x64', bin, exe));
	mockFs.mockFile(path.join(testHome, 'test2', '6.7.8', 'x64', bin, exe));
	mockHttp.resourceMap['http://example.com/test1/v7.8.9/node-v7.8.9-win-x64.7z'] = 'test';
	mockHttp.resourceMap['http://example.com/test1/v7.8.9/node-v7.8.9-' + plat + '-x64.tar.gz'] =
		'test';
	mockHttp.resourceMap['http://example.com/test1/v7.8.9/node-v7.8.9-' + plat + '-x64.tar.xz'] =
		'test';
	mockHttp.resourceMap['http://example.com/test1/v7.8.9/SHASUMS256.txt'] =
		'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 ' +
		'node-v7.8.9-' + plat + '-x64.7z\n' +
		'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 ' +
		'node-v7.8.9-' + plat + '-x64.tar.gz\n' +
		'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 ' +
		'node-v7.8.9-' + plat + '-x64.tar.xz\n';
});

test('Add - download', t => {
	let version = NodeVersion.parse('test1/7.8.9/x64');

	mockChildProc.mockActions.push({
		cb: () => {
			mockFs.mockDir(path.join(testHome, 'test1', '7.8.9', 'x64'),
				['node-v7.8.9-' + plat + '-x64']);
			if (nvsUse.isWindows) {
				mockFs.mockDir(path.join(testHome, 'test1', '7.8.9', 'x64',
					'node-v7.8.9-' + plat + '-x64'), [exe]);
				mockFs.mockFile(path.join(testHome, 'test1', '7.8.9', 'x64',
					'node-v7.8.9-' + plat + '-x64', exe));
			} else {
				mockFs.mockDir(path.join(testHome, 'test1', '7.8.9', 'x64',
					'node-v7.8.9-' + plat + '-x64'), [bin]);
				mockFs.mockDir(path.join(testHome, 'test1', '7.8.9', 'x64',
					'node-v7.8.9-' + plat + '-x64', bin), [exe]);
				mockFs.mockFile(path.join(testHome, 'test1', '7.8.9', 'x64',
					'node-v7.8.9-' + plat + '-x64', bin, exe));
			}
		},
	});

	if (isWindows) {
		// Simulate occasional EPERM during rename, which should be handled by a retry.
		mockFs.nextRenameError = new Error('Test rename error', 'EPERM');
	}

	return nvsAddRemove.addAsync(version).then(message => {
		t.regex(message[0], /^Added at/);
		t.truthy(nvsUse.getVersionBinary(version));
	});
});

test('Add - not found', t => {
	let version = NodeVersion.parse('test1/9.9.9/x86');

	return nvsAddRemove.addAsync(version).then(() => {
		throw new Error('Download should have failed!');
	}, e => {
		t.is(e.code, Error.ENOENT);
		t.falsy(mockFs.dirMap[path.join(testHome, 'test1', '9.9.9')]);
	});
});

test('Add - already there', t => {
	let version = NodeVersion.parse('test1/5.6.7/x64');

	return nvsAddRemove.addAsync(version).then(message => {
		t.regex(message[0], /Already added at/);
	});
});

test('Remove - non-current', t => {
	setPath([
		[testHome, 'test1/5.6.7/x64', bin],
		'/bin',
	]);

	if (nvsUse.isWindows) {
		mockFs.mockLink(linkPath, path.join(testHome, 'test1/5.6.7/x64'));
		mockFs.mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), [exe]);
	} else {
		mockFs.mockLink(linkPath, 'test1/5.6.7/x64');
		mockFs.mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), [bin]);
		mockFs.mockDir(path.join(testHome, 'test1', '5.6.7', 'x86', bin), [exe]);
	}

	let version = NodeVersion.parse('test1/5.6.7/x86');
	nvsAddRemove.remove(version);
	t.falsy(mockFs.statMap[path.join(testHome, 'test1', '5.6.7', 'x86', bin, exe)]);
	t.falsy(mockFs.dirMap[path.join(testHome, 'test1', '5.6.7', 'x86')]);
	t.truthy(mockFs.dirMap[path.join(testHome, 'test1', '5.6.7')]);
	t.truthy(mockFs.dirMap[path.join(testHome, 'test1')]);

	let newPath = getPath();
	t.is(newPath.length, 2);
	t.truthy(mockFs.linkMap[linkPath]);
});

test('Remove - current', t => {
	setPath([
		[testHome, 'test1/5.6.7/x86', bin],
		'/bin',
	]);

	if (nvsUse.isWindows) {
		mockFs.mockLink(linkPath, path.join(testHome, 'test1/5.6.7/x86'));
		mockFs.mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), [exe]);
	} else {
		mockFs.mockLink(linkPath, 'test1/5.6.7/x86');
		mockFs.mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), [bin]);
		mockFs.mockDir(path.join(testHome, 'test1', '5.6.7', 'x86', bin), [exe]);
	}

	let version = NodeVersion.parse('test1/5.6.7/x86');
	nvsAddRemove.remove(version);
	t.falsy(mockFs.statMap[path.join(testHome, 'test1', '5.6.7', 'x86', bin, exe)]);
	t.falsy(mockFs.dirMap[path.join(testHome, 'test1', '5.6.7', 'x86')]);
	t.truthy(mockFs.dirMap[path.join(testHome, 'test1', '5.6.7')]);
	t.truthy(mockFs.dirMap[path.join(testHome, 'test1')]);

	let newPath = getPath();
	t.deepEqual(newPath, [mockFs.fixSep('/bin')]);

	t.true(mockFs.unlinkPaths.indexOf(linkPath) >= 0);
	t.falsy(mockFs.linkMap[linkPath]);
});

test('Remove - not found', t => {
	let version = NodeVersion.parse('test1/9.9.9/x86');
	nvsAddRemove.remove(version);
	t.truthy(mockFs.dirMap[path.join(testHome, 'test1')]);
});
