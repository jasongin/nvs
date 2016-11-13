const path = require('path');
const test = require('ava').test;
const rewire = require('rewire');

test.before(require('./checkNodeVersion'));

const testHome = '/home/test/nvs/'.replace(/\//g, path.sep);
global.settings = {
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

const mockFs = require('./mockFs');
const mockChildProc = require('./mockChildProc');

const NodeVersion = require('../lib/version');
const nvsUse = rewire('../lib/use');
const nvsLink = rewire('../lib/link');
const nvsList = rewire('../lib/list');

nvsUse.__set__('fs', mockFs);
nvsLink.__set__('fs', mockFs);
nvsLink.__set__('nvsUse', nvsUse);
nvsUse.__set__('nvsLink', nvsLink);
nvsList.__set__('fs', mockFs);
nvsList.__set__('nvsUse', nvsUse);
nvsList.__set__('nvsLink', nvsLink);

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
});

test('List - all', t => {
    let result = nvsList.list();
    t.truthy(result);
    let resultLines = result.map(line => line.trim());
    t.deepEqual(resultLines, [
        'test1/5.6.7/x64',
        'test1/5.6.7/x86',
        'test2/6.7.8/x64',
    ]);
});

test('List - filter', t => {
    let result = nvsList.list(NodeVersion.parse('test2'));
    t.truthy(result);
    let resultLines = result.map(line => line.trim());
    t.deepEqual(resultLines, ['test2/6.7.8/x64']);

    result = nvsList.list(NodeVersion.parse('test1/5.6'));
    t.truthy(result);
    resultLines = result.map(line => line.trim());
    t.deepEqual(resultLines, ['test1/5.6.7/x64', 'test1/5.6.7/x86']);
});

test('List - marks', t => {
    setPath([
        [testHome, 'test1/5.6.7/x64', bin],
        '/bin',
    ]);
    if (nvsUse.isWindows) {
        mockFs.mockLink(linkPath, path.join(testHome, 'test2/6.7.8/x64'));
    } else {
        mockFs.mockLink(linkPath, 'test2/6.7.8/x64');
    }

    let result = nvsList.list();
    t.truthy(result);
    let resultLines = result.map(line => line.trim());
    t.is(resultLines.length, 3);
    t.true(resultLines.indexOf('test1/5.6.7/x86') >= 0);
    t.true(resultLines.indexOf('>test1/5.6.7/x64') >= 0);
    t.true(resultLines.indexOf('#test2/6.7.8/x64') >= 0);
});

test.todo('List remote - single remote');
test.todo('List remote - all remotes');
test.todo('List remote - index not found');
