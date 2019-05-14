'use strict';

const path = require('path');
const test = require('ava').default;
const rewire = require('rewire');

test.before(require('../checkNodeVersion'));

const mockFs = require('../mocks/fs');
const testHome = mockFs.fixSep('/home/test/nvs/');

const settings = require('../../lib/settings').settings = {
	home: testHome,
	aliases: {},
	remotes: {
		'test': 'http://example.com/test',
	},
	skipUpdateShellEnv: true,
	linkToSystem: false,
};

const linkPath = testHome + 'default';

const NodeVersion = require('../../lib/version');
const nvsLink = rewire('../../lib/link');
nvsLink.__set__('fs', mockFs);

let mockNvsList = {
	find(version, versions) {
		return version;
	},
};
nvsLink.__set__('nvsList', mockNvsList);

let mockNvsInstall = {
	mockSystemInstall: false,
	isInSystemDirectory() {
		return this.mockSystemInstall;
	},
};
nvsLink.__set__('nvsInstall', mockNvsInstall);

let mockNvsUse = {
	isWindows: require('../../lib/use').isWindows,
	getLinkPath: require('../../lib/use').getLinkPath,
	getSystemLinkPath() {
		return require('../../lib/use').getSystemLinkPath() || '/Program Files/nodejs';
	},
	homePath: require('../../lib/use').homePath,
	currentVersion: null,
	getCurrentVersion() {
		return this.currentVersion;
	},
	getVersionDir: require('../../lib/use').getVersionDir,
};
nvsLink.__set__('nvsUse', mockNvsUse);

let mockWindowsEnv = {
	envMap: {},
	systemEnvMap: {},
	getEnvironmentVariable(name, isSystem) {
		return (isSystem ? this.systemEnvMap[name] : this.envMap[name]) || '';
	},
	setEnvironmentVariable(name, value, isSystem) {
		if (isSystem) {
			this.systemEnvMap[name] = value;
		} else {
			this.envMap[name] = value;
		}
	},
};
nvsLink.__set__('nvsWindowsEnv', mockWindowsEnv);

const bin = (mockNvsUse.isWindows ? '' : '/bin');
const exe = (mockNvsUse.isWindows ? 'node.exe' : 'node');

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
	settings.home = testHome;
	mockNvsUse.isWindows = require('../../lib/use').isWindows;
	mockNvsUse.currentVersion = null;
	mockNvsInstall.mockSystemInstall = false;
	mockWindowsEnv.envMap = {};
	mockWindowsEnv.systemEnvMap = {};

	mockFs.reset();

	mockFs.mockDir(testHome, ['test', 'test2']);
	mockFs.mockDir(path.join(testHome, 'test'), ['5.6.7']);
	mockFs.mockDir(path.join(testHome, 'test', '5.6.7'), ['x86', 'x64']);
	mockFs.mockDir(path.join(testHome, 'test', '5.6.7', 'x86'), []);
	mockFs.mockDir(path.join(testHome, 'test', '5.6.7', 'x64'), []);
	mockFs.mockDir(path.join(testHome, 'test2'), ['5.6.7']);
	mockFs.mockDir(path.join(testHome, 'test2', '5.6.7'), ['x86', 'x64']);
	mockFs.mockDir(path.join(testHome, 'test2', '5.6.7', 'x86'), []);
	mockFs.mockDir(path.join(testHome, 'test2', '5.6.7', 'x64'), []);
	mockFs.mockFile(path.join(testHome, 'test1', '5.6.7', 'x86', bin, exe));
	mockFs.mockFile(path.join(testHome, 'test1', '5.6.7', 'x64', bin, exe));
	mockFs.mockFile(path.join(testHome, 'test2', '6.7.8', 'x64', bin, exe));
});

test('Get linked version', t => {
	if (mockNvsUse.isWindows) {
		mockFs.mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
	} else {
		mockFs.mockLink(linkPath, 'test/5.6.7/x64');
	}

	let v = nvsLink.getLinkedVersion();
	t.truthy(v);
	t.is(v.remoteName, 'test');
	t.is(v.semanticVersion, '5.6.7');
	t.is(v.arch, 'x64');
});

test('Get linked version - directory', t => {
	settings.aliases['test1'] = mockFs.fixSep('/test/test1');
	mockFs.mockLink(linkPath, '/test/test1');

	let v = nvsLink.getLinkedVersion();
	t.truthy(v);
	t.falsy(v.remoteName);
	t.falsy(v.semanticVersion);
	t.falsy(v.arch);
	t.is(v.label, 'test1');
	t.is(v.path, mockFs.fixSep('/test/test1'));
});

test('Link - specified version', t => {
	mockFs.mockFile(testHome + 'test/5.6.7/x64' + bin + '/' + exe);

	nvsLink.link(new NodeVersion('test', '5.6.7', 'x64'));

	if (mockNvsUse.isWindows) {
		t.is(mockFs.linkMap[linkPath],
			path.join(testHome, mockFs.fixSep('test\\5.6.7\\x64')));
	} else {
		t.is(mockFs.linkMap[linkPath], mockFs.fixSep('test/5.6.7/x64'));
	}
});

test('Link - current version from PATH', t => {
	mockNvsUse.currentVersion = new NodeVersion('test', '5.6.7', 'x64');
	nvsLink.link();

	if (mockNvsUse.isWindows) {
		t.is(mockFs.linkMap[linkPath],
			path.join(testHome, mockFs.fixSep('test/5.6.7/x64')));
	} else {
		t.is(mockFs.linkMap[linkPath], mockFs.fixSep('test/5.6.7/x64'));
	}
});

test('Unlink - specified version', t => {
	mockFs.mockFile(testHome + 'test/5.6.7/x64' + bin + '/' + exe);

	if (mockNvsUse.isWindows) {
		mockFs.mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
	} else {
		mockFs.mockLink(linkPath, 'test/5.6.7/x64');
	}

	setPath([
		linkPath + bin,
		'/bin',
	]);

	mockNvsUse.use = version => {
		t.is(version, null);
		setPath(['/bin']);
	};
	mockNvsUse.currentVersion = new NodeVersion('test', '5.6.7', 'x64');
	mockNvsUse.currentVersion.default = true;

	nvsLink.unlink(new NodeVersion('test', '5.6.7', 'x64'));

	t.is(mockFs.unlinkPaths.length, 1);
	t.is(mockFs.unlinkPaths[0], linkPath);
	t.falsy(mockFs.linkMap[linkPath]);

	let newPath = getPath();
	t.deepEqual(newPath, [mockFs.fixSep('/bin')]);
});

test('Unlink - different version', t => {
	if (mockNvsUse.isWindows) {
		mockFs.mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
	} else {
		mockFs.mockLink(linkPath, 'test/5.6.7/x64');
	}

	setPath([
		linkPath + bin,
		'/bin',
	]);

	mockNvsUse.use = version => {
		t.fail();
	};
	mockNvsUse.currentVersion = new NodeVersion('test', '5.6.7', 'x64');
	mockNvsUse.currentVersion.default = true;
	nvsLink.unlink(new NodeVersion('test2', '5.6.7', 'x64'));

	t.is(mockFs.unlinkPaths.length, 0);
	t.truthy(mockFs.linkMap[linkPath]);

	let newPath = getPath();
	t.is(newPath.length, 2);
});

test('Unlink - any version', t => {
	if (mockNvsUse.isWindows) {
		mockFs.mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
	} else {
		mockFs.mockLink(linkPath, 'test/5.6.7/x64');
	}

	setPath([
		linkPath + bin,
		'/bin',
	]);

	mockNvsUse.use = version => {
		t.is(version, null);
		setPath(['/bin']);
	};
	mockNvsUse.currentVersion = new NodeVersion('test', '5.6.7', 'x64');
	mockNvsUse.currentVersion.default = true;

	nvsLink.unlink();

	t.is(mockFs.unlinkPaths.length, 1);
	t.is(mockFs.unlinkPaths[0], linkPath);
	t.falsy(mockFs.linkMap[linkPath]);

	let newPath = getPath();
	t.deepEqual(newPath, [mockFs.fixSep('/bin')]);
});

test('Unlink - no link', t => {
	setPath([
		'/bin',
	]);

	nvsLink.unlink();
	t.is(mockFs.unlinkPaths.length, 0);

	let newPath = getPath();
	t.deepEqual(newPath, [mockFs.fixSep('/bin')]);
});

test('Link - link to Windows system', t => {
	// Note this test is designed to pass on non-Windows platforms also.
	mockNvsUse.isWindows = true;
	mockNvsInstall.mockSystemInstall = true;

	mockFs.mockFile(testHome + 'test/5.6.7/x64/node.exe');
	mockWindowsEnv.systemEnvMap['PATH'] = '\\bin';

	nvsLink.link(new NodeVersion('test', '5.6.7', 'x64'));

	t.is(mockFs.linkMap[linkPath],
		path.join(testHome, mockFs.fixSep('test/5.6.7/x64')));

	let systemLinkPath = mockNvsUse.getSystemLinkPath();
	t.is(mockFs.linkMap[systemLinkPath], path.join(testHome, mockFs.fixSep('test/5.6.7/x64')));
	t.is(mockWindowsEnv.systemEnvMap['PATH'], systemLinkPath + path.delimiter + '\\bin');
});

test('Link - link to non-Windows system', t => {
	// Note this test is designed to pass on Windows platforms also.
	const testSystemHome = mockFs.fixSep('/usr/local/nvs/');
	settings.home = testSystemHome;
	mockNvsInstall.mockSystemInstall = true;
	mockNvsUse.isWindows = false;

	mockFs.mockDir(testSystemHome + 'test/5.6.7/x64/bin', ['node']);
	mockFs.mockDir(testSystemHome + 'test/5.6.7/x64/lib/node_modules', []);
	mockFs.mockFile(testSystemHome + 'test/5.6.7/x64/bin/node');
	mockFs.mockDir('/usr/local/bin', []);

	nvsLink.link(new NodeVersion('test', '5.6.7', 'x64'));

	t.is(mockFs.linkMap[testSystemHome + 'default'], mockFs.fixSep('test/5.6.7/x64'));
	t.is(mockFs.linkMap[mockFs.fixSep('/usr/local/bin/node')],
		mockFs.fixSep('../nvs/test/5.6.7/x64/bin/node'));
	t.is(mockFs.linkMap[mockFs.fixSep('/usr/local/lib/node_modules')],
		mockFs.fixSep('../nvs/test/5.6.7/x64/lib/node_modules'));
});

test.todo('Link - when system node is present');

test('Unlink - unlink from Windows system', t => {
	// Note this test is designed to pass on non-Windows platforms also.
	mockNvsUse.isWindows = true;
	mockNvsInstall.mockSystemInstall = true;

	let systemLinkPath = mockNvsUse.getSystemLinkPath();
	mockWindowsEnv.systemEnvMap['PATH'] = systemLinkPath + path.delimiter + '\\bin';

	mockFs.mockFile(testHome + 'test/5.6.7/x64/node.exe');
	mockFs.mockLink(linkPath, path.join(testHome, mockFs.fixSep('test/5.6.7/x64')));
	mockFs.mockLink(systemLinkPath, path.join(testHome, mockFs.fixSep('test/5.6.7/x64')));

	nvsLink.unlink(null);

	t.falsy(mockFs.linkMap[linkPath]);
	t.falsy(mockFs.linkMap[systemLinkPath]);
	t.is(mockWindowsEnv.systemEnvMap['PATH'], '\\bin');
});

test('Unlink - unlink from non-Windows system', t => {
	// Note this test is designed to pass on Windows platforms also.
	const testSystemHome = mockFs.fixSep('/usr/local/nvs/');
	settings.home = testSystemHome;
	mockNvsInstall.mockSystemInstall = true;
	mockNvsUse.isWindows = false;

	nvsLink.__set__('isLinkTargetingNvs', (linkDir, linkTarget) => {
		// Bypass the logic that depends on path.resolve()
		// because it doesn't work on a mismatched platform.
		// The mock fs contains only links to nvs.
		return true;
	});

	mockFs.mockDir(testSystemHome + 'test/5.6.7/x64/bin', ['node']);
	mockFs.mockDir(testSystemHome + 'test/5.6.7/x64/lib/node_modules', []);
	mockFs.mockFile(testSystemHome + 'test/5.6.7/x64/bin/node');
	mockFs.mockDir('/usr/local/bin', ['node']);

	mockFs.mockLink(testSystemHome + 'default', 'test/5.6.7/x64');
	mockFs.mockLink('/usr/local/bin/node', '../nvs/test/5.6.7/x64/bin/node');
	mockFs.mockLink('/usr/local/lib/node_modules', '../nvs/test/5.6.7/x64/lib/node_modules');

	nvsLink.unlink(null);

	t.falsy(mockFs.linkMap[testSystemHome + 'default']);
	t.falsy(mockFs.linkMap[mockFs.fixSep('/usr/local/bin/node')]);
	t.falsy(mockFs.linkMap[mockFs.fixSep('/usr/local/lib/node_modules')]);
});

test.todo('Unlink - when system node is present');
test.todo('Get version from PATH - system linked');
