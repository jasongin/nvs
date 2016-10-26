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
    skipPostScript: true,
};

const linkPath = testHome + 'default';

const nvsUse = rewire('../lib/use');
const bin = (nvsUse.isWindows ? '' : '/bin');
const exe = (nvsUse.isWindows ? 'node.exe' : 'node');
const sepRegex = (path.sep === '\\' ? /\\/g : /\//g);

const mockChildProc = require('./mockChildProc');
nvsUse.__set__('childProcess', mockChildProc);

const mockFs = require('./mockFs');
nvsUse.__set__('fs', mockFs);

function mockFile(filePath) {
    mockFs.statMap[filePath.replace(/\//g, path.sep)] = {
        isDirectory() { return false; },
        isFile() { return true; },
        isSymbolicLink() { return false; },
    };
}

function setPath(pathEntries) {
    process.env['PATH'] = pathEntries
        .map(entry => Array.isArray(entry) ? path.join(...entry) : entry)
        .join(nvsUse.pathSeparator).replace(/\//g, path.sep);
}

function getPath() {
    return process.env['PATH']
        .replace(sepRegex, '/').split(nvsUse.pathSeparator);
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
    let binDir = (testHome + 'test/5.6.7/x64' + bin).replace(sepRegex, '/');
    mockFile(binDir + '/' + exe);
    setPath([
        '/bin',
    ]);
    nvsUse.use({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
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
    nvsUse.use({ remoteName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });
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
    nvsUse.use(null);
    let newPath = getPath();
    t.is(newPath.length, 2);
    t.is(newPath[0], binDir.replace('test', 'test2'));
    t.is(newPath[1], '/bin');
});

test('Use - not found', t => {
    t.throws(() => {
        nvsUse.use({ remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
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

    let result = nvsUse.getVersionBinary();
    t.is(result, binPath.replace(/\//g, path.sep));
});

test('Get bin path - specified version', t => {
    let binPath = (testHome + 'test/5.6.7/x64' + bin + '/' + exe).replace(sepRegex, '/');
    mockFile(binPath);

    let result = nvsUse.getVersionBinary(
        { remoteName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
    t.is(result, binPath.replace(/\//g, path.sep));
});

test('Get bin path - not found', t => {
    let binPath = (testHome + 'test/5.6.7/x64' + bin + '/' + exe).replace(sepRegex, '/');
    mockFile(binPath);

    let result = nvsUse.getVersionBinary(
        { remoteName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });
    t.is(result, null);
});

test('Run', t => {
    let binPath = (testHome + 'test/5.6.7/x64' + bin + '/' + exe).replace(sepRegex, '/');
    mockFile(binPath);

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

