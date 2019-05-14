'use strict';

const path = require('path');
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
		'test': 'http://example.com/test',
		'test2': 'http://example.com/test2',
	},
	skipUpdateShellEnv: true,
};

const NodeVersion = require('../../lib/version');

const linkPath = testHome + 'default';

const nvsUse = rewire('../../lib/use');
nvsUse.__set__('fs', mockFs);

const bin = (nvsUse.isWindows ? '' : '/bin');
const exe = (nvsUse.isWindows ? 'node.exe' : 'node');

const mockChildProc = require('../mocks/child_process');
nvsUse.__set__('childProcess', mockChildProc);

let mockNvsList = {
	findVersion: null,
	find(version, versions) {
		return this.findVersion;
	},
};
nvsUse.__set__('nvsList', mockNvsList);

let mockNvsLink = {
	linkedVersion: null,
	getLinkedVersion() {
		return this.linkedVersion;
	},
};
nvsUse.__set__('nvsLink', mockNvsLink);

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
	mockNvsList.findVersion = null;
	mockNvsLink.linkedVersion = null;

	mockFs.mockDir(testHome, ['test', 'test2']);
	mockFs.mockDir(path.join(testHome, 'test'), ['5.6.7']);
	mockFs.mockDir(path.join(testHome, 'test', '5.6.7'), ['x86', 'x64']);
	mockFs.mockDir(path.join(testHome, 'test', '5.6.7', 'x86'), []);
	mockFs.mockDir(path.join(testHome, 'test', '5.6.7', 'x64'), []);
	mockFs.mockDir(path.join(testHome, 'test2'), ['5.6.7']);
	mockFs.mockDir(path.join(testHome, 'test2', '5.6.7'), ['x86', 'x64']);
	mockFs.mockDir(path.join(testHome, 'test2', '5.6.7', 'x86'), []);
	mockFs.mockDir(path.join(testHome, 'test2', '5.6.7', 'x64'), []);
});

test('Get current version', t => {
	setPath([
		testHome + 'test/5.6.7/x64' + bin,
		'/bin',
	]);

	let v = nvsUse.getCurrentVersion();
	t.truthy(v);
	t.is(v.remoteName, 'test');
	t.is(v.semanticVersion, '5.6.7');
	t.is(v.arch, 'x64');

	setPath([
		testHome + 'test/5.6.7/x64' + bin + '/',
		'/bin',
	]);

	v = nvsUse.getCurrentVersion();
	t.truthy(v);
	t.is(v.remoteName, 'test');
	t.is(v.semanticVersion, '5.6.7');
	t.is(v.arch, 'x64');
});

test('Get current version - linked', t => {
	setPath([
		linkPath + bin,
		'/bin',
	]);

	mockNvsLink.linkedVersion = new NodeVersion('test2', '6.7.8', 'x86');
	let v = nvsUse.getCurrentVersion();
	t.truthy(v);
	t.is(v.remoteName, 'test2');
	t.is(v.semanticVersion, '6.7.8');
	t.is(v.arch, 'x86');
});

test('Use - full version', t => {
	let binDir = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin);
	mockFs.mockFile(binDir + '/' + exe);
	setPath([
		'/bin',
	]);
	mockNvsList.findVersion = new NodeVersion('test', '5.6.7', 'x64');
	nvsUse.use(new NodeVersion('test', '5.6.7', 'x64'));
	let newPath = getPath();
	t.deepEqual(newPath, [binDir, mockFs.fixSep('/bin')]);
});

test('Use - no arch', t => {
	let binDir = mockFs.fixSep(testHome + 'test/5.6.7/' + NodeVersion.defaultArch + bin);
	mockFs.mockFile(binDir + '/' + exe);
	setPath([
		'/bin',
	]);
	mockNvsList.findVersion = new NodeVersion('test', '5.6.7', NodeVersion.defaultArch);
	nvsUse.use(new NodeVersion('test', '5.6.7'));
	let newPath = getPath();
	t.deepEqual(newPath, [binDir, mockFs.fixSep('/bin')]);
});

test('Use - partial version', t => {
	let binDir = mockFs.fixSep(testHome + 'test/5.6.7/' + NodeVersion.defaultArch + bin);
	mockFs.mockFile(binDir + '/' + exe);
	setPath([
		'/bin',
	]);
	mockNvsList.findVersion = new NodeVersion('test', '5.6.7', NodeVersion.defaultArch);
	nvsUse.use(new NodeVersion('test', '5'));
	let newPath = getPath();
	t.deepEqual(newPath, [binDir, mockFs.fixSep('/bin')]);
});

test('Use - overwrite', t => {
	let binDir = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin);
	mockFs.mockFile(binDir + '/' + exe);
	let binDir2 = mockFs.fixSep(testHome + 'test2/5.6.7/x64' + bin);
	mockFs.mockFile(binDir2 + '/' + exe);
	setPath([
		binDir,
		'/bin',
	]);
	mockNvsList.findVersion = new NodeVersion('test2', '5.6.7', 'x64');
	nvsUse.use(new NodeVersion('test2', '5.6.7', 'x64'));
	let newPath = getPath();
	t.deepEqual(newPath, [binDir2, mockFs.fixSep('/bin')]);
});

test('Use - none', t => {
	let binDir = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin);
	let binDir2 = mockFs.fixSep(testHome + 'test2/5.6.7/x64' + bin);
	setPath([
		linkPath + bin,
		binDir,
		binDir2,
		'/bin',
	]);
	nvsUse.use(null);
	let newPath = getPath();
	t.deepEqual(newPath, [mockFs.fixSep('/bin')]);
});

test('Use - use default version', t => {
	let binDir2 = mockFs.fixSep(testHome + 'test/6.7.8/x64' + bin);
	mockFs.mockFile(binDir2 + '/' + exe);

	setPath([
		binDir2,
		mockFs.fixSep('/bin'),
	]);

	mockNvsLink.linkedVersion = new NodeVersion('test', '6.7.8', 'x64');
	nvsUse.use('default');

	let newPath = getPath();
	t.deepEqual(newPath, [linkPath + bin, mockFs.fixSep('/bin')]);
});

test('Use - re-use current version', t => {
	let binDir = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin);
	mockFs.mockFile(binDir + '/' + exe);

	if (nvsUse.isWindows) {
		mockFs.mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
	} else {
		mockFs.mockLink(linkPath, 'test/5.6.7/x64');
	}

	setPath([
		binDir,
		'/bin',
	]);

	mockNvsList.findVersion = new NodeVersion('test', '5.6.7', 'x64');
	let result = nvsUse.use(new NodeVersion('test', '5.6.7', 'x64'));
	t.deepEqual(result, []);

	let newPath = getPath();
	t.deepEqual(newPath, [binDir, mockFs.fixSep('/bin')]);
});

test('Use - re-use default version', t => {
	let binDir = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin);
	mockFs.mockFile(binDir + '/' + exe);
	let binDir2 = mockFs.fixSep(testHome + 'test/6.7.8/x64' + bin);
	mockFs.mockFile(binDir2 + '/' + exe);

	if (nvsUse.isWindows) {
		mockFs.mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
	} else {
		mockFs.mockLink(linkPath, 'test/5.6.7/x64');
	}

	setPath([
		linkPath + bin,
		'/bin',
	]);

	nvsUse.use('default');

	let newPath = getPath();
	t.deepEqual(newPath, [linkPath + bin, mockFs.fixSep('/bin')]);

	mockNvsList.findVersion = new NodeVersion('test', '5.6.7', 'x64');
	nvsUse.use(new NodeVersion('test', '5.6.7', 'x64'));

	newPath = getPath();
	t.deepEqual(newPath, [binDir, mockFs.fixSep('/bin')]);
});

test('Use - not found', t => {
	t.throws(
		() => nvsUse.use(new NodeVersion('test', '5.6.7', 'x64')),
		{ code: Error.ENOENT });
});

test('Get bin path - current version', t => {
	let binPath = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin + '/' + exe);
	mockFs.mockFile(binPath);
	setPath([
		path.dirname(binPath),
		'/bin',
	]);

	let result = nvsUse.getVersionBinary();
	t.is(result, binPath.replace(/\//g, path.sep));
});

test('Get bin path - specified version', t => {
	let binPath = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin + '/' + exe);
	mockFs.mockFile(binPath);

	let result = nvsUse.getVersionBinary(
		{ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
	t.is(result, binPath.replace(/\//g, path.sep));
});

test('Get bin path - not found', t => {
	let binPath = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin + '/' + exe);
	mockFs.mockFile(binPath);

	let result = nvsUse.getVersionBinary(
		{ remoteName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });
	t.is(result, null);
});

test('Run', t => {
	let binPath = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin + '/' + exe);
	mockFs.mockFile(binPath);

	mockChildProc.mockActions.push({ status: 99, error: null });

	mockNvsList.findVersion = new NodeVersion('test', '5.6.7', 'x64');
	nvsUse.run(
		new NodeVersion('test', '5.6.7', 'x64'),
		['test.js', '1', '2']);
	let exitCode = process.exitCode;
	process.exitCode = 0;

	t.is(mockChildProc.spawns.length, 1);
	t.is(mockChildProc.spawns[0].exe, binPath.replace(/\//g, path.sep));
	t.deepEqual(mockChildProc.spawns[0].args, ['test.js', '1', '2']);
	t.is(exitCode, 99);
});

test('Run - not found', t => {
	t.throws(
		() => nvsUse.run(
			new NodeVersion('test', '5.6.7', 'x64'),
			['test.js', '1', '2']),
		{ code: Error.ENOENT });
});

test.todo('Exec');
test.todo('Exec - not found');
