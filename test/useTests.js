const path = require('path');
const test = require('ava').test;
const rewire = require('rewire');

test.before(require('./checkNodeVersion'));

const mockFs = require('./mockFs');
const testHome = mockFs.fixSep('/home/test/nvs/');

global.settings = {
    home: testHome,
    aliases: {},
    remotes: {
        'test': 'http://example.com/test',
        'test2': 'http://example.com/test2',
    },
    skipUpdateShellEnv: true,
};

const linkPath = testHome + 'default';

const nvsUse = rewire('../lib/use');
const nvsLink = rewire('../lib/link');
const bin = (nvsUse.isWindows ? '' : '/bin');
const exe = (nvsUse.isWindows ? 'node.exe' : 'node');

nvsUse.__set__('nvsLink', nvsLink);

const mockChildProc = require('./mockChildProc');
nvsUse.__set__('childProcess', mockChildProc);

nvsUse.__set__('fs', mockFs);
nvsLink.__set__('fs', mockFs);

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
});

test('Get version from PATH - current', t => {
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

test('Use - no overwrite', t => {
    let binDir = mockFs.fixSep(testHome + 'test/5.6.7/x64' + bin);
    mockFs.mockFile(binDir + '/' + exe);
    setPath([
        '/bin',
    ]);
    nvsUse.use({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
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
    nvsUse.use({ remoteName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });
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
        binDir2,
        mockFs.fixSep('/bin'),
    ]);

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

    let result = nvsUse.use({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
    t.is(result.length, 0);

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

    nvsUse.use({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });

    newPath = getPath();
    t.deepEqual(newPath, [binDir, mockFs.fixSep('/bin')]);
});

test('Use - not found', t => {
    t.throws(() => {
        nvsUse.use({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
    }, error => {
        return error.code === 'ENOENT';
    });
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

    nvsUse.run(
        { remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' },
        ['test.js', '1', '2']);
    let exitCode = process.exitCode;
    process.exitCode = 0;

    t.is(mockChildProc.spawns.length, 1);
    t.is(mockChildProc.spawns[0].exe, binPath.replace(/\//g, path.sep));
    t.deepEqual(mockChildProc.spawns[0].args, ['test.js', '1', '2']);
    t.is(exitCode, 99);
});

test('Run - not found', t => {
    t.throws(() => {
        nvsUse.run(
            { remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' },
            ['test.js', '1', '2']);
    }, error => {
        return error.code === 'ENOENT';
    });
});

