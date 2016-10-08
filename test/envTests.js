const path = require('path');
const test = require('ava').test;
const rewire = require('rewire');

const testHome = '/home/test/nvs/'.replace(/\//g, path.sep);
global.settings = {
    home: testHome,
    aliases: {},
    remotes: {
        'test': 'http://example.com/test',
    },
};

const linkPath = testHome + 'current';

const nvsEnv = rewire('../lib/env');
const bin = (nvsEnv.isWindows ? '' : '/bin');
const exe = (nvsEnv.isWindows ? 'node.exe' : 'node');
const sepRegex = (path.sep === '\\' ? /\\/g : /\//g);

const mockFs = require('./mockFs');
nvsEnv.__set__('fs', mockFs);

const mockChildProc = require('./mockChildProc');
nvsEnv.__set__('childProcess', mockChildProc);

function mockFile(filePath) {
    mockFs.statMap[filePath.replace(/\//g, path.sep)] = {};
}

function setPath(pathEntries) {
    process.env['PATH'] = pathEntries
        .join(nvsEnv.pathSeparator).replace(/\//g, path.sep);
}

function getPath() {
    return process.env['PATH']
        .replace(sepRegex, '/').split(nvsEnv.pathSeparator);
}

test.beforeEach(t => {
    mockFs.reset();
    mockChildProc.reset();
});

test('Get current version from PATH', t => {
    setPath([
        testHome + 'test/5.6.7/x64' + bin,
        '/bin',
    ]);

    let v = nvsEnv.getCurrentVersion();
    t.truthy(v);
    t.is(v.remoteName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');

    setPath([
        testHome + 'test/5.6.7/x64' + bin + '/',
        '/bin',
    ]);

    v = nvsEnv.getCurrentVersion();
    t.truthy(v);
    t.is(v.remoteName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');
});

test('Get linked version', t => {
    if (nvsEnv.isWindows) {
        mockFs.linkMap[linkPath] =
            path.join(testHome, 'test\\5.6.7\\x64');
    } else {
        mockFs.linkMap[linkPath] = 'test/5.6.7/x64';
    }

    let v = nvsEnv.getLinkedVersion();
    t.truthy(v);
    t.is(v.remoteName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');
});

test('Get linked version from PATH', t => {
    if (nvsEnv.isWindows) {
        mockFs.linkMap[linkPath] =
            path.join(testHome, 'test\\5.6.7\\x64');
    } else {
        mockFs.linkMap[linkPath] = 'test/5.6.7/x64';
    }

    setPath([
        linkPath + bin,
        '/bin',
    ]);

    let v = nvsEnv.getCurrentVersion();
    t.truthy(v);
    t.is(v.remoteName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');
});

test('Link - specified version', t => {
    mockFile(testHome + 'test/5.6.7/x64' + bin + '/' + exe);

    nvsEnv.link({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });

    if (nvsEnv.isWindows) {
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

    nvsEnv.link();

    if (nvsEnv.isWindows) {
        t.is(mockFs.linkMap[linkPath],
            path.join(testHome, 'test\\5.6.7\\x64'));
    } else {
        t.is(mockFs.linkMap[linkPath], 'test/5.6.7/x64');
    }
});

test('Unlink - specified version', t => {
    mockFs.statMap[linkPath] = {};
    if (nvsEnv.isWindows) {
        mockFs.linkMap[linkPath] =
            path.join(testHome, 'test\\5.6.7\\x64');
    } else {
        mockFs.linkMap[linkPath] = 'test/5.6.7/x64';
    }

    nvsEnv.unlink({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });

    t.is(mockFs.unlinkPaths.length, 1);
    t.is(mockFs.unlinkPaths[0], linkPath);
    t.falsy(mockFs.linkMap[linkPath]);
});

test('Unlink - different version', t => {
    mockFs.statMap[linkPath] = {};
    if (nvsEnv.isWindows) {
        mockFs.linkMap[linkPath] =
            path.join(testHome, 'test\\5.6.7\\x64');
    } else {
        mockFs.linkMap[linkPath] = 'test/5.6.7/x64';
    }

    nvsEnv.unlink({ remoteName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });

    t.is(mockFs.unlinkPaths.length, 0);
    t.truthy(mockFs.linkMap[linkPath]);
});

test('Unlink - any version', t => {
    mockFs.statMap[linkPath] = {};
    if (nvsEnv.isWindows) {
        mockFs.linkMap[linkPath] =
            path.join(testHome, 'test\\5.6.7\\x64');
    } else {
        mockFs.linkMap[linkPath] = 'test/5.6.7/x64';
    }

    nvsEnv.unlink();

    t.is(mockFs.unlinkPaths.length, 1);
    t.is(mockFs.unlinkPaths[0], linkPath);
    t.falsy(mockFs.linkMap[linkPath]);
});

test('Unlink - no link', t => {
    nvsEnv.unlink();
    t.is(mockFs.unlinkPaths.length, 0);
});

test('Use - no overwrite', t => {
    let binDir = (testHome + 'test/5.6.7/x64' + bin).replace(sepRegex, '/');
    mockFile(binDir + '/' + exe);
    setPath([
        '/bin',
    ]);
    nvsEnv.use({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' }, true);
    let newPath = getPath();
    t.is(newPath.length, 2);
    t.is(newPath[0], binDir);
    t.is(newPath[1], '/bin');
});

test('Use - overwrite', t => {
    let binDir = (testHome + 'test/5.6.7/x64' + bin).replace(sepRegex, '/');
    mockFile(binDir + '/' + exe);
    mockFile(binDir.replace('test/5', 'test2/5') + '/' + exe);
    setPath([
        binDir,
        '/bin',
    ]);
    nvsEnv.use({ remoteName: 'test2', semanticVersion: '5.6.7', arch: 'x64' }, true);
    let newPath = getPath();
    t.is(newPath.length, 2);
    t.is(newPath[0], binDir.replace('test/5', 'test2/5'));
    t.is(newPath[1], '/bin');
});

test('Use - none', t => {
    let binDir = (testHome + 'test/5.6.7/x64' + bin).replace(sepRegex, '/');
    setPath([
        binDir,
        binDir.replace('test', 'test2'),
        '/bin',
    ]);
    nvsEnv.use(null, true);
    let newPath = getPath();
    t.is(newPath.length, 2);
    t.is(newPath[0], binDir.replace('test', 'test2'));
    t.is(newPath[1], '/bin');
});

test('Use - not installed', t => {
    t.throws(() => {
        nvsEnv.use({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' }, true);
    }, error => {
        return error.code === 'ENOENT';
    });
});

test('Get bin path - current version', t => {
    let binPath = (testHome + 'test/5.6.7/x64' + bin + '/' + exe).replace(sepRegex, '/');
    mockFile(binPath);
    setPath([
        path.dirname(binPath),
        '/bin',
    ]);

    let result = nvsEnv.getVersionBinary();
    t.is(result, binPath.replace(/\//g, path.sep));
});

test('Get bin path - specified version', t => {
    let binPath = (testHome + 'test/5.6.7/x64' + bin + '/' + exe).replace(sepRegex, '/');
    mockFile(binPath);

    let result = nvsEnv.getVersionBinary(
        { remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
    t.is(result, binPath.replace(/\//g, path.sep));
});

test('Get bin path - not installed', t => {
    let binPath = (testHome + 'test/5.6.7/x64' + bin + '/' + exe).replace(sepRegex, '/');
    mockFile(binPath);

    let result = nvsEnv.getVersionBinary(
        { remoteName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });
    t.is(result, null);
});

test('Run', t => {
    let binPath = (testHome + 'test/5.6.7/x64' + bin + '/' + exe).replace(sepRegex, '/');
    mockFile(binPath);

    mockChildProc.mockActions.push({ status: 99, error: null });

    nvsEnv.run(
        { remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' },
        ['test.js', '1', '2']);
    let exitCode = process.exitCode;
    process.exitCode = 0;

    t.is(mockChildProc.spawns.length, 1);
    t.is(mockChildProc.spawns[0].exe, binPath.replace(/\//g, path.sep));
    t.deepEqual(mockChildProc.spawns[0].args, ['test.js', '1', '2']);
    t.is(exitCode, 99);
});

test('Run - not installed', t => {
    t.throws(() => {
        nvsEnv.run(
            { remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' },
            ['test.js', '1', '2']);
    }, error => {
        return error.code === 'ENOENT';
    });
});
