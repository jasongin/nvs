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

var nvsEnv = rewire('../lib/env');
var bin = (nvsEnv.isWindows ? '' : '/bin');

var mockFs = require('./mockFs');
nvsEnv.__set__('fs', mockFs);

function setPath(pathEntries) {
    process.env['PATH'] = pathEntries
        .join(nvsEnv.pathSeparator).replace(/\//g, path.sep);
}

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
    mockFs.linkMap[testHome + 'current'] = 'test/5.6.7/x64';

    var v = nvsEnv.getLinkedVersion();
    t.truthy(v);
    t.is(v.feedName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');
});

test('Get linked version from PATH', t => {
    mockFs.linkMap[testHome + 'current'] = 'test/5.6.7/x64';

    setPath([
        testHome + 'current' + bin,
        '/bin',
    ]);

    var v = nvsEnv.getCurrentVersion();
    t.truthy(v);
    t.is(v.feedName, 'test');
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.arch, 'x64');
});

test.todo('Link - specified version');
test.todo('Link - current version from PATH');
test.todo('Unlink - specified version');
test.todo('Unlink - all versions');

test.todo('Use - no overwrite');
test.todo('Use - overwrite');
test.todo('Use - none');
test.todo('Use - not installed')
test.todo('Use - execute mode')

test.todo('Get bin path - current version');
test.todo('Get bin path - specified version');
test.todo('Get bin path - not installed');

test.todo('Run');
test.todo('Run - not installed');
