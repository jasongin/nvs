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
		'default': 'test',
		'test': 'http://example.com/test',
	},
	quiet: true,
};

const NodeVersion = require('../../lib/version');
const nvsMigrate = rewire('../../lib/migrate');
const nvsUse = rewire('../../lib/use');
const bin = (nvsUse.isWindows ? '' : '/bin');
const lib = (nvsUse.isWindows ? '' : '/lib');
const exe = (nvsUse.isWindows ? 'node.exe' : 'node');

nvsMigrate.__set__('nvsUse', nvsUse);

const mockChildProc = require('../mocks/child_process');
nvsUse.__set__('childProcess', mockChildProc);
nvsMigrate.__set__('childProcess', mockChildProc);

nvsUse.__set__('fs', mockFs);
nvsMigrate.__set__('fs', mockFs);

let mockNvsList = {
	getVersions() {
		return [];
	},
	find(version, versions) {
		return version;
	},
};
nvsMigrate.__set__('nvsList', mockNvsList);

let installPackageCalls = [];
function mockInstallPackage(targetDir, packageName, version) {
	installPackageCalls.push({ targetDir, packageName, version });
}
nvsMigrate.__set__('installPackage', mockInstallPackage);

let linkPackageCalls = [];
function mockLinkPackage(targetDir, packageName, linkTarget, version) {
	linkPackageCalls.push({ targetDir, packageName, linkTarget, version });
}
nvsMigrate.__set__('linkPackage', mockLinkPackage);

test.beforeEach(t => {
	mockFs.reset();
	mockChildProc.reset();
	installPackageCalls = [];
	linkPackageCalls = [];
});

test('Migrate installed module, no version at target', t => {
	mockFs.mockFile(testHome + 'test/5.99.1/x64' + bin + '/' + exe);
	mockFs.mockFile(testHome + 'test/5.99.2/x64' + bin + '/' + exe);
	let modulesPath1 = testHome + 'test/5.99.1/x64' + lib + '/node_modules';
	let modulesPath2 = testHome + 'test/5.99.2/x64' + lib + '/node_modules';
	mockFs.mockDir(modulesPath1, ['test']);
	mockFs.mockDir(modulesPath2, []);
	mockFs.mockDir(path.join(modulesPath1, 'test'), ['package.json']);
	mockFs.mockFile(path.join(modulesPath1, 'test/package.json'),
		JSON.stringify({ version: '1.0.0' }));

	nvsMigrate.migrateGlobalModules(
		NodeVersion.parse('5.99.1/x64'), NodeVersion.parse('5.99.2/x64'));
	t.is(0, linkPackageCalls.length);
	t.is(1, installPackageCalls.length);
	t.is('test', installPackageCalls[0].packageName);
});

test('Migrate installed module, same version at target', t => {
	mockFs.mockFile(testHome + 'test/5.99.1/x64' + bin + '/' + exe);
	mockFs.mockFile(testHome + 'test/5.99.2/x64' + bin + '/' + exe);
	let modulesPath1 = testHome + 'test/5.99.1/x64' + lib + '/node_modules';
	let modulesPath2 = testHome + 'test/5.99.2/x64' + lib + '/node_modules';
	mockFs.mockDir(modulesPath1, ['test']);
	mockFs.mockDir(modulesPath2, []);
	mockFs.mockDir(path.join(modulesPath1, 'test'), ['package.json']);
	mockFs.mockFile(path.join(modulesPath1, 'test/package.json'),
		JSON.stringify({ version: '1.0.0' }));
	mockFs.mockDir(path.join(modulesPath2, 'test'), ['package.json']);
	mockFs.mockFile(path.join(modulesPath2, 'test/package.json'),
		JSON.stringify({ version: '1.0.0' }));

	nvsMigrate.migrateGlobalModules(
		NodeVersion.parse('5.99.1/x64'), NodeVersion.parse('5.99.2/x64'));
	t.is(0, linkPackageCalls.length);
	t.is(0, installPackageCalls.length);
});

test('Migrate installed module, different version at target', t => {
	mockFs.mockFile(testHome + 'test/5.99.1/x64' + bin + '/' + exe);
	mockFs.mockFile(testHome + 'test/5.99.2/x64' + bin + '/' + exe);
	let modulesPath1 = testHome + 'test/5.99.1/x64' + lib + '/node_modules';
	let modulesPath2 = testHome + 'test/5.99.2/x64' + lib + '/node_modules';
	mockFs.mockDir(modulesPath1, ['test']);
	mockFs.mockDir(modulesPath2, []);
	mockFs.mockDir(path.join(modulesPath1, 'test'), ['package.json']);
	mockFs.mockFile(path.join(modulesPath1, 'test/package.json'),
		JSON.stringify({ version: '1.0.0' }));
	mockFs.mockDir(path.join(modulesPath2, 'test'), ['package.json']);
	mockFs.mockFile(path.join(modulesPath2, 'test/package.json'),
		JSON.stringify({ version: '2.0.0' }));

	nvsMigrate.migrateGlobalModules(
		NodeVersion.parse('5.99.1/x64'), NodeVersion.parse('5.99.2/x64'));
	t.is(0, linkPackageCalls.length);
	t.is(0, installPackageCalls.length);
});

test('Migrate linked module, no version at target', t => {
	mockFs.mockFile(testHome + 'test/5.99.1/x64' + bin + '/' + exe);
	mockFs.mockFile(testHome + 'test/5.99.2/x64' + bin + '/' + exe);
	let modulesPath1 = testHome + 'test/5.99.1/x64' + lib + '/node_modules';
	let modulesPath2 = testHome + 'test/5.99.2/x64' + lib + '/node_modules';
	mockFs.mockDir(modulesPath1, ['test']);
	mockFs.mockDir(modulesPath2, []);
	mockFs.mockLink(path.join(modulesPath1, 'test'), '/temp/test1');
	mockFs.mockDir('/temp/test1', ['package.json']);
	mockFs.mockFile(path.join(modulesPath1, 'test/package.json'),
		JSON.stringify({ version: '1.0.0' }));

	nvsMigrate.migrateGlobalModules(
		NodeVersion.parse('5.99.1/x64'), NodeVersion.parse('5.99.2/x64'));
	t.is(0, installPackageCalls.length);
	t.is(1, linkPackageCalls.length);
	t.is('test', linkPackageCalls[0].packageName);
});

test('Migrate linked module, same version at target', t => {
	mockFs.mockFile(testHome + 'test/5.99.1/x64' + bin + '/' + exe);
	mockFs.mockFile(testHome + 'test/5.99.2/x64' + bin + '/' + exe);
	let modulesPath1 = testHome + 'test/5.99.1/x64' + lib + '/node_modules';
	let modulesPath2 = testHome + 'test/5.99.2/x64' + lib + '/node_modules';
	mockFs.mockDir(modulesPath1, ['test']);
	mockFs.mockDir(modulesPath2, []);
	mockFs.mockLink(path.join(modulesPath1, 'test'), '/temp/test1');
	mockFs.mockDir('/temp/test1', ['package.json']);
	mockFs.mockFile(path.join(modulesPath1, 'test/package.json'),
		JSON.stringify({ version: '1.0.0' }));
	mockFs.mockLink(path.join(modulesPath2, 'test'), '/temp/test2');
	mockFs.mockDir('/temp/test2', ['package.json']);
	mockFs.mockFile(path.join(modulesPath2, 'test/package.json'),
		JSON.stringify({ version: '1.0.0' }));

	nvsMigrate.migrateGlobalModules(
		NodeVersion.parse('5.99.1/x64'), NodeVersion.parse('5.99.2/x64'));
	t.is(0, installPackageCalls.length);
	t.is(0, linkPackageCalls.length);
});

test('Migrate linked module, different version at target', t => {
	mockFs.mockFile(testHome + 'test/5.99.1/x64' + bin + '/' + exe);
	mockFs.mockFile(testHome + 'test/5.99.2/x64' + bin + '/' + exe);
	let modulesPath1 = testHome + 'test/5.99.1/x64' + lib + '/node_modules';
	let modulesPath2 = testHome + 'test/5.99.2/x64' + lib + '/node_modules';
	mockFs.mockDir(modulesPath1, ['test']);
	mockFs.mockDir(modulesPath2, []);
	mockFs.mockLink(path.join(modulesPath1, 'test'), '/temp/test1');
	mockFs.mockDir('/temp/test1', ['package.json']);
	mockFs.mockFile(path.join(modulesPath1, 'test/package.json'),
		JSON.stringify({ version: '1.0.0' }));
	mockFs.mockLink(path.join(modulesPath2, 'test'), '/temp/test2');
	mockFs.mockDir('/temp/test2', ['package.json']);
	mockFs.mockFile(path.join(modulesPath2, 'test/package.json'),
		JSON.stringify({ version: '2.0.0' }));

	nvsMigrate.migrateGlobalModules(
		NodeVersion.parse('5.99.1/x64'), NodeVersion.parse('5.99.2/x64'));
	t.is(0, installPackageCalls.length);
	t.is(0, linkPackageCalls.length);
});

test('Migrate source version not found', t => {
	mockFs.mockFile(testHome + 'test/5.99.2/x64' + bin + '/' + exe);
	let modulesPath2 = testHome + 'test/5.99.2/x64' + lib + '/node_modules';
	mockFs.mockDir(modulesPath2, []);

	t.throws(
		() => nvsMigrate.migrateGlobalModules(
			NodeVersion.parse('5.99.1/x64'), NodeVersion.parse('5.99.2/x64')),
		{ code: Error.ENOENT });
});

test('Migrate target version not found', t => {
	mockFs.mockFile(testHome + 'test/5.99.1/x64' + bin + '/' + exe);
	let modulesPath1 = testHome + 'test/5.99.1/x64' + lib + '/node_modules';
	mockFs.mockDir(modulesPath1, ['test']);

	t.throws(
		() => nvsMigrate.migrateGlobalModules(
			NodeVersion.parse('5.99.1/x64'), NodeVersion.parse('5.99.2/x64')),
		{ code: Error.ENOENT });
});
