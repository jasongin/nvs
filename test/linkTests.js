const path = require('path');
const test = require('ava').test;
const rewire = require('rewire');

test.before(require('./checkNodeVersion'));

const testHome = '/home/test/nvs/'.replace(/\//g, path.sep);
global.settings = {
    home: testHome,
    aliases: {},
    remotes: {
        'test': 'http://example.com/test',
    },
    skipUpdateShellEnv: true,
    linkToSystem: false,
};

const linkPath = testHome + 'default';

const nvsLink = rewire('../lib/link');
const nvsUse = rewire('../lib/use');
nvsLink.__set__('nvsUse', nvsUse);
nvsUse.__set__('nvsLink', nvsLink);

const bin = (nvsUse.isWindows ? '' : '/bin');
const exe = (nvsUse.isWindows ? 'node.exe' : 'node');

const sepRegex = (path.sep === '\\' ? /\\/g : /\//g);

const mockFs = require('./mockFs');
nvsUse.__set__('fs', mockFs);
nvsLink.__set__('fs', mockFs);

let mockWindowsEnv = {
    getEnvironmentVariable() {
        return '';
    },
    setEnvironmentVariable() {
    }
};
nvsLink.__set__('nvsWindowsEnv', mockWindowsEnv);

function mockFile(filePath) {
    mockFs.statMap[filePath.replace(/\//g, path.sep)] = {
        isDirectory() { return false; },
        isFile() { return true; },
        isSymbolicLink() { return false; },
    };
}

function mockLink(linkPath, linkTarget) {
    mockFs.statMap[linkPath.replace(/\//g, path.sep)] = {
        isDirectory() { return false; },
        isFile() { return false; },
        isSymbolicLink() { return true; },
    };
    mockFs.linkMap[linkPath.replace(/\//g, path.sep)] = linkTarget.replace(/\//g, path.sep);
}

function setPath(pathEntries) {
    process.env['PATH'] = pathEntries
        .map(entry => Array.isArray(entry) ? path.join(...entry) : entry)
        .join(path.delimiter).replace(/\//g, path.sep);
}

test.beforeEach(t => {
    mockFs.reset();
});

test('Get linked version', t => {
    if (nvsUse.isWindows) {
        mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
    } else {
        mockLink(linkPath, 'test/5.6.7/x64');
    }

    let v = nvsLink.getLinkedVersion();
    t.truthy(v);
    t.is(v.remoteName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');
});

test('Get version from PATH - linked', t => {
    if (nvsUse.isWindows) {
        mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
    } else {
        mockLink(linkPath, 'test/5.6.7/x64');
    }

    setPath([
        linkPath + bin,
        '/bin',
    ]);

    let v = nvsUse.getCurrentVersion();
    t.truthy(v);
    t.is(v.remoteName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');
});

test('Link - specified version', t => {
    mockFile(testHome + 'test/5.6.7/x64' + bin + '/' + exe);

    nvsLink.link({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });

    if (nvsUse.isWindows) {
        t.is(mockFs.linkMap[linkPath],
            path.join(testHome, 'test\\5.6.7\\x64'));
    } else {
        t.is(mockFs.linkMap[linkPath], 'test/5.6.7/x64');
    }
});

test('Link - current version from PATH', t => {
    mockFile(testHome + 'test/5.6.7/x64' + bin + '/' + exe);
    setPath([
        testHome + 'test/5.6.7/x64' + bin + '/',
        '/bin',
    ]);

    nvsLink.link();

    if (nvsUse.isWindows) {
        t.is(mockFs.linkMap[linkPath],
            path.join(testHome, 'test\\5.6.7\\x64'));
    } else {
        t.is(mockFs.linkMap[linkPath], 'test/5.6.7/x64');
    }
});

test('Unlink - specified version', t => {
    if (nvsUse.isWindows) {
        mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
    } else {
        mockLink(linkPath, 'test/5.6.7/x64');
    }

    nvsLink.unlink({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });

    t.is(mockFs.unlinkPaths.length, 1);
    t.is(mockFs.unlinkPaths[0], linkPath);
    t.falsy(mockFs.linkMap[linkPath]);
});

test('Unlink - different version', t => {
    if (nvsUse.isWindows) {
        mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
    } else {
        mockLink(linkPath, 'test/5.6.7/x64');
    }

    nvsLink.unlink({ remoteName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });

    t.is(mockFs.unlinkPaths.length, 0);
    t.truthy(mockFs.linkMap[linkPath]);
});

test('Unlink - any version', t => {
    if (nvsUse.isWindows) {
        mockLink(linkPath, path.join(testHome, 'test/5.6.7/x64'));
    } else {
        mockLink(linkPath, 'test/5.6.7/x64');
    }

    nvsLink.unlink();

    t.is(mockFs.unlinkPaths.length, 1);
    t.is(mockFs.unlinkPaths[0], linkPath);
    t.falsy(mockFs.linkMap[linkPath]);
});

test('Unlink - no link', t => {
    nvsLink.unlink();
    t.is(mockFs.unlinkPaths.length, 0);
});

test.todo('Link - link to system');
test.todo('Link - when system node is present');
test.todo('Unlink - unlink from system');
test.todo('Unlink - when system node is present');
test.todo('Get version from PATH - system linked');
