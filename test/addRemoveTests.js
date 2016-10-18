const path = require('path');
const test = require('ava').test;
const rewire = require('rewire');

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
    skipPostScript: true,
    linkToSystem: false,
};

const linkPath = testHome + 'default';

const mockFs = require('./mockFs');
const mockChildProc = require('./mockChildProc');
const mockHttp = require('./mockHttp');

const nvsVersion = require('../lib/version');
const nvsUse = rewire('../lib/use');
const nvsLink = rewire('../lib/link');
const nvsAddRemove = rewire('../lib/addRemove');
const nvsDownload = rewire('../lib/download');
const nvsExtract = rewire('../lib/extract');

nvsUse.__set__('fs', mockFs);
nvsLink.__set__('fs', mockFs);
nvsLink.__set__('nvsUse', nvsUse);
nvsUse.__set__('nvsLink', nvsLink);
nvsAddRemove.__set__('nvsUse', nvsUse);
nvsAddRemove.__set__('nvsLink', nvsLink);
nvsAddRemove.__set__('nvsDownload', nvsDownload);
nvsAddRemove.__set__('nvsExtract', nvsExtract);
nvsAddRemove.__set__('fs', mockFs);
nvsDownload.__set__('http', mockHttp);
nvsDownload.__set__('https', mockHttp);
nvsDownload.__set__('fs', mockFs);
nvsExtract.__set__('childProcess', mockChildProc);

let mockWindowsEnv = {
    getEnvironmentVariable() {
        return '';
    },
    setEnvironmentVariable() {
    }
};
nvsLink.__set__('nvsWindowsEnv', mockWindowsEnv);

const bin = (nvsUse.isWindows ? '' : 'bin');
const exe = (nvsUse.isWindows ? 'node.exe' : 'node');
const plat = (nvsUse.isWindows ? 'win' : process.platform);
const sepRegex = (path.sep === '\\' ? /\\/g : /\//g);

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

function mockDir(dirPath, childNames) {
    mockFs.statMap[dirPath.replace(/\//g, path.sep)] = {
        isFile() { return false; },
        isDirectory() { return true; },
        isSymbolicLink() { return false; },
    };
    mockFs.dirMap[dirPath.replace(/\//g, path.sep)] = childNames;
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
    mockHttp.reset();

    mockDir(testHome, ['test1', 'test2']);
    mockDir(path.join(testHome, 'test1'), ['5.6.7']);
    mockDir(path.join(testHome, 'test1', '5.6.7'), ['x86', 'x64']);
    mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), []);
    mockDir(path.join(testHome, 'test1', '5.6.7', 'x64'), []);
    mockDir(path.join(testHome, 'test2'), ['6.7.8']);
    mockDir(path.join(testHome, 'test2', '6.7.8'), ['x64']);
    mockDir(path.join(testHome, 'test2', '6.7.8', 'x64'), []);
    mockFile(path.join(testHome, 'test1', '5.6.7', 'x86', bin, exe));
    mockFile(path.join(testHome, 'test1', '5.6.7', 'x64', bin, exe));
    mockFile(path.join(testHome, 'test2', '6.7.8', 'x64', bin, exe));
    mockHttp.resourceMap['http://example.com/test1/v7.8.9/node-v7.8.9-win-x64.zip'] = 'test';
    mockHttp.resourceMap['http://example.com/test1/v7.8.9/node-v7.8.9-' +
        plat + '-x64.tar.gz'] = 'test';
    mockHttp.resourceMap['http://example.com/test1/v7.8.9/SHASUMS256.txt'] =
        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 ' +
        'node-v7.8.9-' + plat + '-x64.tar.gz';
});

test('List - all', t => {
    let result = nvsAddRemove.list();
    t.truthy(result);
    let resultLines = result.map(line => line.trim());
    t.is(resultLines.length, 3);
    t.true(resultLines.indexOf('test1/5.6.7/x86') >= 0);
    t.true(resultLines.indexOf('test1/5.6.7/x64') >= 0);
    t.true(resultLines.indexOf('test2/6.7.8/x64') >= 0);
});

test('List - filter', t => {
    let result = nvsAddRemove.list('test2');
    t.truthy(result);
    let resultLines = result.map(line => line.trim());
    t.is(resultLines.length, 1);
    t.is(resultLines[0], 'test2/6.7.8/x64');
});

test('List - marks', t => {
    setPath([
        [testHome, 'test1/5.6.7/x64', bin],
        '/bin',
    ]);
    if (nvsUse.isWindows) {
        mockLink(linkPath, path.join(testHome, 'test2/6.7.8/x64'));
    } else {
        mockLink(linkPath, 'test2/6.7.8/x64');
    }

    let result = nvsAddRemove.list();
    t.truthy(result);
    let resultLines = result.map(line => line.trim());
    t.is(resultLines.length, 3);
    t.true(resultLines.indexOf('test1/5.6.7/x86') >= 0);
    t.true(resultLines.indexOf('>test1/5.6.7/x64') >= 0);
    t.true(resultLines.indexOf('#test2/6.7.8/x64') >= 0);
});

test('Add - download binary', t => {
    let version = nvsVersion.parse('test1/7.8.9/x64');

    mockChildProc.mockActions.push({ cb: () => {
        if (nvsUse.isWindows) {
            mockDir(path.join(testHome, 'test1', '7.8.9', 'x64',
                'node-v7.8.9-' + plat + '-x64'), [exe]);
            mockFile(path.join(testHome, 'test1', '7.8.9', 'x64',
                'node-v7.8.9-' + plat + '-x64', exe));
        } else {
            mockDir(path.join(testHome, 'test1', '7.8.9', 'x64',
                'node-v7.8.9-' + plat + '-x64'), [bin]);
            mockDir(path.join(testHome, 'test1', '7.8.9', 'x64',
                'node-v7.8.9-' + plat + '-x64', bin), [exe]);
            mockFile(path.join(testHome, 'test1', '7.8.9', 'x64',
                'node-v7.8.9-' + plat + '-x64', bin, exe));
        }
    }});

    return nvsAddRemove.addAsync(version).then(message => {
        t.regex(message, /^Added at/);
        t.truthy(nvsUse.getVersionBinary(version));
    });
});

test('Add - not found', t => {
    let version = nvsVersion.parse('test1/9.9.9/x86');

    return nvsAddRemove.addAsync(version).then(() => {
        throw new Error('Download should have failed!');
    }, e => {
        t.truthy(e.cause);
        t.regex(e.cause.message, /404/);
        t.falsy(mockFs.dirMap[path.join(testHome, 'test1', '9.9.9')]);
    });
});

test('Add - already there', t => {
    let version = nvsVersion.parse('test1/5.6.7/x64');

    return nvsAddRemove.addAsync(version).then(message => {
        t.regex(message, /Already added at/);
    });
});

test('Remove - non-current', t => {
    setPath([
        [testHome, 'test1/5.6.7/x64', bin],
        '/bin',
    ]);

    if (nvsUse.isWindows) {
        mockLink(linkPath, path.join(testHome, 'test1/5.6.7/x64'));
        mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), [exe]);
    } else {
        mockLink(linkPath, 'test1/5.6.7/x64');
        mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), [bin]);
        mockDir(path.join(testHome, 'test1', '5.6.7', 'x86', bin), [exe]);
    }

    let version = nvsVersion.parse('test1/5.6.7/x86');
    nvsAddRemove.remove(version);
    t.falsy(mockFs.statMap[path.join(testHome, 'test1', '5.6.7', 'x86', bin, exe)]);
    t.falsy(mockFs.dirMap[path.join(testHome, 'test1', '5.6.7', 'x86')]);
    t.truthy(mockFs.dirMap[path.join(testHome, 'test1', '5.6.7')]);
    t.truthy(mockFs.dirMap[path.join(testHome, 'test1')]);

    let newPath = getPath();
    t.is(newPath.length, 2);
    t.truthy(mockFs.linkMap[linkPath]);
});

test('Remove - current', t => {
    setPath([
        [testHome, 'test1/5.6.7/x86', bin],
        '/bin',
    ]);

    if (nvsUse.isWindows) {
        mockLink(linkPath, path.join(testHome, 'test1/5.6.7/x86'));
        mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), [exe]);
    } else {
        mockLink(linkPath, 'test1/5.6.7/x86');
        mockDir(path.join(testHome, 'test1', '5.6.7', 'x86'), [bin]);
        mockDir(path.join(testHome, 'test1', '5.6.7', 'x86', bin), [exe]);
    }

    let version = nvsVersion.parse('test1/5.6.7/x86');
    nvsAddRemove.remove(version);
    t.falsy(mockFs.statMap[path.join(testHome, 'test1', '5.6.7', 'x86', bin, exe)]);
    t.falsy(mockFs.dirMap[path.join(testHome, 'test1', '5.6.7', 'x86')]);
    t.truthy(mockFs.dirMap[path.join(testHome, 'test1', '5.6.7')]);
    t.truthy(mockFs.dirMap[path.join(testHome, 'test1')]);

    let newPath = getPath();
    t.is(newPath.length, 1);
    t.is(newPath[0], '/bin');

    t.true(mockFs.unlinkPaths.indexOf(linkPath) >= 0);
    t.falsy(mockFs.linkMap[linkPath]);
});

test('Remove - not found', t => {
    let version = nvsVersion.parse('test1/9.9.9/x86');
    nvsAddRemove.remove(version);
    t.truthy(mockFs.dirMap[path.join(testHome, 'test1')]);
});
