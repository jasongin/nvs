var path = require('path');
var test = require('ava').test;
var rewire = require('rewire');

var testHome = '/home/test/nvs/'.replace(/\//g, path.sep);
global.settings = {
    home: testHome,
    feeds: {
        'test': 'http://example.com/test',
    },
};

var linkPath = testHome + 'current';

var nvsEnv = rewire('../lib/env');
var bin = (nvsEnv.isWindows ? '' : '/bin');
var exe = (nvsEnv.isWindows ? 'node.exe' : 'node');

var mockFs = require('./mockFs');
nvsEnv.__set__('fs', mockFs);

var mockCp = require('./mockCp');
nvsEnv.__set__('childProcess', mockCp);

function setPath(pathEntries) {
    process.env['PATH'] = pathEntries
        .join(nvsEnv.pathSeparator).replace(/\//g, path.sep);
}
function getPath() {
    return process.env['PATH']
        .replace(new RegExp(path.sep, 'g'), '/').split(nvsEnv.pathSeparator);
}

test.beforeEach(t => {
    mockFs.reset();
    mockCp.reset();
});

test('Get current version from PATH', t => {
    setPath([
        testHome + 'test/5.6.7/x64' + bin,
        '/bin',
    ]);

    var v = nvsEnv.getCurrentVersion();
    t.truthy(v);
    t.is(v.feedName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');

    setPath([
        testHome + 'test/5.6.7/x64' + bin + '/',
        '/bin',
    ]);

    var v = nvsEnv.getCurrentVersion();
    t.truthy(v);
    t.is(v.feedName, 'test');
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

    var v = nvsEnv.getLinkedVersion();
    t.truthy(v);
    t.is(v.feedName, 'test');
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

    var v = nvsEnv.getCurrentVersion();
    t.truthy(v);
    t.is(v.feedName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');
});

test('Link - specified version', t => {
    mockFs.statMap[testHome + 'test/5.6.7/x64' + bin + '/' + exe] = {};

    nvsEnv.link({ feedName: 'test', semanticVersion: '5.6.7', arch: 'x64' });

    if (nvsEnv.isWindows) {
        t.is(mockFs.linkMap[linkPath],
            path.join(testHome, 'test\\5.6.7\\x64'));
    } else {
        t.is(mockFs.linkMap[linkPath], 'test/5.6.7/x64');
    }
});

test('Link - current version from PATH', t => {
    mockFs.statMap[testHome + 'test/5.6.7/x64' + bin + '/' + exe] = {};
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

    nvsEnv.unlink({ feedName: 'test', semanticVersion: '5.6.7', arch: 'x64' });

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

    nvsEnv.unlink({ feedName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });

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
    var binDir = testHome + 'test/5.6.7/x64' + bin;
    mockFs.statMap[binDir + '/' + exe] = {};
    setPath([
        '/bin',
    ]);
    nvsEnv.use({ feedName: 'test', semanticVersion: '5.6.7', arch: 'x64' }, true);
    var newPath = getPath();
    t.is(newPath.length, 2);
    t.is(newPath[0], binDir);
    t.is(newPath[1], '/bin');
});

test('Use - overwrite', t => {
    var binDir = testHome + 'test/5.6.7/x64' + bin;
    mockFs.statMap[binDir + '/' + exe] = {};
    mockFs.statMap[binDir.replace('test/5', 'test2/5') + '/' + exe] = {};
    setPath([
        binDir,
        '/bin',
    ]);
    nvsEnv.use({ feedName: 'test2', semanticVersion: '5.6.7', arch: 'x64' }, true);
    var newPath = getPath();
    t.is(newPath.length, 2);
    t.is(newPath[0], binDir.replace('test/5', 'test2/5'));
    t.is(newPath[1], '/bin');
});

test('Use - none', t => {
    var binDir = testHome + 'test/5.6.7/x64' + bin;
    setPath([
        binDir,
        binDir.replace('test', 'test2'),
        '/bin',
    ]);
    nvsEnv.use(null, true);
    var newPath = getPath();
    t.is(newPath.length, 2);
    t.is(newPath[0], binDir.replace('test', 'test2'));
    t.is(newPath[1], '/bin');
});

test('Use - not installed', t => {
    t.throws(() => {
        nvsEnv.use({ feedName: 'test', semanticVersion: '5.6.7', arch: 'x64' }, true);
    }, error => {
        return error.code === 'ENOENT';
    });
});

test('Get bin path - current version', t => {
    var binPath = testHome + 'test/5.6.7/x64' + bin + '/' + exe;
    mockFs.statMap[binPath] = {};
    setPath([
        path.dirname(binPath),
        '/bin',
    ]);

    var result = nvsEnv.getVersionBinary();
    t.is(result, binPath);
});

test('Get bin path - specified version', t => {
    var binPath = testHome + 'test/5.6.7/x64' + bin + '/' + exe;
    mockFs.statMap[binPath] = {};

    var result = nvsEnv.getVersionBinary(
        { feedName: 'test', semanticVersion: '5.6.7', arch: 'x64' });
    t.is(result, binPath);
});

test('Get bin path - not installed', t => {
    var binPath = testHome + 'test/5.6.7/x64' + bin + '/' + exe;
    mockFs.statMap[binPath] = {};

    var result = nvsEnv.getVersionBinary(
        { feedName: 'test2', semanticVersion: '5.6.7', arch: 'x64' });
    t.is(result, null);
});

test('Run', t => {
    var binPath = testHome + 'test/5.6.7/x64' + bin + '/' + exe;
    mockFs.statMap[binPath] = {};

    mockCp.exitCodes.push(99);
    mockCp.errors.push(null);

    nvsEnv.run(
        { feedName: 'test', semanticVersion: '5.6.7', arch: 'x64' },
        ['test.js', '1', '2']);
    var exitCode = process.exitCode;
    process.exitCode = 0;

    t.is(mockCp.spawns.length, 1);
    t.is(mockCp.spawns[0].exe, binPath);
    t.deepEqual(mockCp.spawns[0].args, ['test.js', '1', '2']);
    t.is(exitCode, 99);
});

test('Run - not installed', t => {
    t.throws(() => {
        nvsEnv.run(
            { feedName: 'test', semanticVersion: '5.6.7', arch: 'x64' },
            ['test.js', '1', '2']);
    }, error => {
        return error.code === 'ENOENT';
    });
});
