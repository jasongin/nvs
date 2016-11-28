const path = require('path');
const test = require('ava').test;
const rewire = require('rewire');
const Error = require('../lib/error');

test.before(require('./checkNodeVersion'));

const testHome = '/home/test/nvs/'.replace(/\//g, path.sep);
global.settings = {
    home: testHome,
    cache: path.join(testHome, 'cache'),
    aliases: {},
    remotes: {
        'default': 'test1',
        'test1': 'http://example.com/test1',
        'test2': 'http://example.com/test2',
    },
    quiet: true,
    skipUpdateShellEnv: true,
    linkToSystem: false,
};

const linkPath = testHome + 'default';

const mockFs = require('./mockFs');
const mockHttp = require('./mockHttp');

const NodeVersion = require('../lib/version');
const nvsList = rewire('../lib/list');
const getNodejsRemoteVersionsAsync = nvsList.getNodejsRemoteVersionsAsync;
const getGithubRemoteVersionsAsync = nvsList.getGithubRemoteVersionsAsync;
const getNetworkRemoteVersionsAsync = nvsList.getNetworkRemoteVersionsAsync;

nvsList.__set__('fs', mockFs);
nvsList.__set__('http', mockHttp);
nvsList.__set__('https', mockHttp);

const bin = (process.platform === 'win32' ? '' : 'bin');
const exe = (process.platform === 'win32' ? 'node.exe' : 'node');

let mockNvsUse = {
    currentVersion: null,
    getCurrentVersion() {
        return this.currentVersion;
    },
    getVersionDir: require('../lib/use').getVersionDir,
    getVersionBinary(version) {
        return path.join(this.getVersionDir(version), bin, exe);
    }
};
nvsList.__set__('nvsUse', mockNvsUse);

let mockNvsLink = {
    linkedVersion: null,
    getLinkedVersion() {
        return this.linkedVersion;
    }
};
nvsList.__set__('nvsLink', mockNvsLink);

nvsList.__set__('getNodejsRemoteVersionsAsync', remoteName => {
    let v5 = new NodeVersion('test1', '5.6.7');
    let v6 = new NodeVersion('test1', '6.7.8');
    let v710 = new NodeVersion('test1', '7.1.0');
    v710.label = 'Test';
    let v711 = new NodeVersion('test1', '7.1.1');
    v711.label = 'Test';
    let v72 = new NodeVersion('test1', '7.2.1');
    return Promise.resolve([
        v5,
        v6,
        v710,
        v711,
        v72,
    ]);
});

test.beforeEach(t => {
    mockFs.reset();

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

    mockNvsUse.currentVersion = null;
    mockNvsLink.linkedVersion = null;

    mockHttp.resourceMap['http://example.com/test1/index.json'] = JSON.stringify([
        { version: 'v7.8.9', files: ['osx-x86', 'osx-x64', 'win-x86', 'win-x64'] },
        { version: 'v5.6.7', files: ['osx-x86', 'osx-x64', 'win-x86', 'win-x64'] },
    ]);

    let downloadUrl = 'https://github.com/nodejs/node/releases/download/';
    mockHttp.resourceMap['https://api.github.com/repos/nodejs/node/releases'] = JSON.stringify([
        {
            tag_name: 'v7.8.9',
            assets: [
                { browser_download_url: downloadUrl + 'v7.8.9/node-v7.8.9-osx-x64.tar.xz' },
                { browser_download_url: downloadUrl + 'v7.8.9/node-v7.8.9-osx-x86.tar.xz' },
                { browser_download_url: downloadUrl + 'v7.8.9/node-v7.8.9-win-x64.7z' },
                { browser_download_url: downloadUrl + 'v7.8.9/node-v7.8.9-win-x86.7z' },
            ],
        },
        {
            tag_name: 'v5.6.7',
            assets: [
                { browser_download_url: downloadUrl + 'v5.6.7/node-v5.6.7-osx-x64.tar.xz' },
                { browser_download_url: downloadUrl + 'v5.6.7/node-v5.6.7-osx-x86.tar.xz' },
                { browser_download_url: downloadUrl + 'v5.6.7/node-v5.6.7-win-x64.7z' },
                { browser_download_url: downloadUrl + 'v5.6.7/node-v5.6.7-win-x86.7z' },
            ],
        },
    ]);
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
    mockNvsUse.currentVersion = new NodeVersion('test1', '5.6.7', 'x64');
    mockNvsLink.linkedVersion = new NodeVersion('test2', '6.7.8', 'x64');

    let result = nvsList.list();
    t.truthy(result);
    let resultLines = result.map(line => line.trim());
    t.deepEqual(resultLines, [
        '>test1/5.6.7/x64',
        'test1/5.6.7/x86',
        '#test2/6.7.8/x64',
    ]);
});

test('List - aliased directories', t => {
    const testAlias = 'test-alias';
    const testAliasDir = '/test/alias/dir';
    global.settings.aliases[testAlias] = testAliasDir;
    mockNvsUse.currentVersion = new NodeVersion();
    mockNvsUse.currentVersion.label = testAlias;
    mockNvsUse.currentVersion.path = testAliasDir;
    mockNvsLink.linkedVersion = mockNvsUse.currentVersion;

    let result = nvsList.list();
    t.truthy(result);
    let resultLines = result.map(line => line.trim());
    t.deepEqual(resultLines, [
        'test1/5.6.7/x64',
        'test1/5.6.7/x86',
        'test2/6.7.8/x64',
        '>#' + testAliasDir + ' (' + testAlias + ')',
    ]);
});

test('List remote - lts filter', t => {
    return nvsList.listRemoteAsync(NodeVersion.parse('lts')).then(result => {
        t.truthy(result);
        let resultLines = result.map(line => line.trim());
        t.deepEqual(resultLines, [
            'test1/7.1.1 (Test)',
            'test1/7.1.0 (Test)',
        ]);
    });
});

test('List remote - partial version filter', t => {
    return nvsList.listRemoteAsync(NodeVersion.parse('test1/5')).then(result => {
        t.truthy(result);
        let resultLines = result.map(line => line.trim());
        t.deepEqual(resultLines, [
            '*test1/5.6.7',
        ]);
    });
});

test('List remote - added mark', t => {
    return nvsList.listRemoteAsync().then(result => {
        t.truthy(result);
        let resultLines = result.map(line => line.trim());
        t.deepEqual(resultLines, [
            'test1/7.2.1',
            'test1/7.1.1 (Test)',
            'test1/7.1.0 (Test)',
            'test1/6.7.8',
            '*test1/5.6.7',
        ]);
    });
});

test('List remote - linked mark', t => {
    mockNvsLink.linkedVersion = new NodeVersion('test1', '5.6.7', 'x64');

    return nvsList.listRemoteAsync().then(result => {
        t.truthy(result);
        let resultLines = result.map(line => line.trim());
        t.deepEqual(resultLines, [
            'test1/7.2.1',
            'test1/7.1.1 (Test)',
            'test1/7.1.0 (Test)',
            'test1/6.7.8',
            '#test1/5.6.7',
        ]);
    });
});

test('Get remote versions - nodejs', t => {
    return getNodejsRemoteVersionsAsync('test1', 'http://example.com/test1/').then(result => {
        t.truthy(result);
        t.is(result.length, 2);
        t.is(result[0].semanticVersion, '7.8.9');
        t.is(result[1].semanticVersion, '5.6.7');
    });
});

test('Get remote versions - nodejs index not found', t => {
    delete mockHttp.resourceMap['http://example.com/test1/index.json'];
    return getNodejsRemoteVersionsAsync('test1', 'http://example.com/test1/').then(result => {
        t.fail();
    }).catch(e => {
        t.truthy(e);
        t.truthy(e.cause);
        t.true(e.cause.message.indexOf('404') >= 0);
    });
});

test('Get remote versions - github releases', t => {
    const testReleasesUri = 'https://github.com/nodejs/node/releases/';
    return getGithubRemoteVersionsAsync('test1', testReleasesUri).then(result => {
        t.truthy(result);
        t.is(result.length, 2);
        t.is(result[0].semanticVersion, '7.8.9');
        t.is(result[1].semanticVersion, '5.6.7');
    });
});

test('Get remote versions - github releases index not found', t => {
    delete mockHttp.resourceMap['https://api.github.com/repos/nodejs/node/releases'];
    const testReleasesUri = 'https://github.com/nodejs/node/releases/';
    return getGithubRemoteVersionsAsync('test1', testReleasesUri).then(result => {
        t.fail();
    }).catch(e => {
        t.truthy(e);
        t.truthy(e.cause);
        t.true(e.cause.message.indexOf('404') >= 0);
    });
});

test('Get remote versions - network path', t => {
    const testNetworkPath = '\\\\server\\share\\path\\';
    mockFs.mockDir(testNetworkPath, ['5.6.7','7.8.9']);
    mockFs.mockDir(testNetworkPath + '5.6.7', ['x86.msi', 'x64.msi']);
    mockFs.mockDir(testNetworkPath + '7.8.9', ['x64.msi']);
    mockFs.mockFile(testNetworkPath + '5.6.7\\x86.msi', '');
    mockFs.mockFile(testNetworkPath + '5.6.7\\x64.msi', '');
    mockFs.mockFile(testNetworkPath + '7.8.9\\x64.msi', '');

    return getNetworkRemoteVersionsAsync('test1',
        testNetworkPath + '{version}\\{arch}.msi').then(result => {
        t.truthy(result);
        t.is(result.length, 2);
        t.is(result[0].semanticVersion, '5.6.7');
        t.is(result[1].semanticVersion, '7.8.9');
    });
});

test('Get remote versions - network path not found', t => {
    const testNetworkPath = '\\\\server\\share\\path\\{version}\\{arch}.msi';
    return getNetworkRemoteVersionsAsync('test1', testNetworkPath).then(result => {
        t.fail();
    }).catch(e => {
        t.truthy(e);
        t.truthy(e.cause);
        t.is(e.cause.code, Error.ENOENT);
    });
});
