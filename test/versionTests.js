const test = require('ava').test;

test.before(require('./checkNodeVersion'));

global.settings = {
    aliases: {},
    remotes: {
        'default': 'test',
        'test': 'http://example.com/test',
        'test2': 'http://example.com/test2',
    },
};

const NodeVersion = require('../lib/version');

test('Parse semantic version', t => {
    let v = NodeVersion.parse('5.6.7');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.remoteName, 'test');
    t.is(v.arch, undefined);
});

test('Parse semantic version with label', t => {
    let v = NodeVersion.parse('5.6.7-nightly201610057b5ffa46fe');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7-nightly201610057b5ffa46fe');
    t.is(v.remoteName, 'test');
    t.is(v.arch, undefined);
});

test('Parse remote and semantic version', t => {
    let v = NodeVersion.parse('test2/5.6.7');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.remoteName, 'test2');
    t.is(v.arch, undefined);
});

test('Parse remote, semantic version, and arch', t => {
    let v = NodeVersion.parse('test2/5.6.7/x86');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.remoteName, 'test2');
    t.is(v.arch, 'x86');
});

test('Parse semantic version and arch', t => {
    let v = NodeVersion.parse('5.6.7/x86');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.remoteName, 'test');
    t.is(v.arch, 'x86');
});

test('Parse version label', t => {
    let v = NodeVersion.parse('lts');
    t.truthy(v);
    t.is(v.semanticVersion, null);
    t.is(v.label, 'lts');
    t.is(v.remoteName, 'test');
    t.is(v.arch, undefined);
});

test('Parse remote and version label', t => {
    let v = NodeVersion.parse('test2/lts');
    t.truthy(v);
    t.is(v.semanticVersion, null);
    t.is(v.label, 'lts');
    t.is(v.remoteName, 'test2');
    t.is(v.arch, undefined);
});

test('Parse version label and arch', t => {
    let v = NodeVersion.parse('lts/x86');
    t.truthy(v);
    t.is(v.semanticVersion, null);
    t.is(v.label, 'lts');
    t.is(v.remoteName, 'test');
    t.is(v.arch, 'x86');
});

test('Parse remote, version label and arch', t => {
    let v = NodeVersion.parse('test2/lts/x86');
    t.truthy(v);
    t.is(v.semanticVersion, null);
    t.is(v.label, 'lts');
    t.is(v.remoteName, 'test2');
    t.is(v.arch, 'x86');
});

test('Parse other architectures', t => {
    let v = NodeVersion.parse('test/latest/x64');
    t.is(v.arch, 'x64');
    v = NodeVersion.parse('test/latest/32');
    t.is(v.arch, 'x86');
    v = NodeVersion.parse('test/latest/64');
    t.is(v.arch, 'x64');
    v = NodeVersion.parse('test/latest/arm');
    t.is(v.arch, 'arm');
    v = NodeVersion.parse('test/latest/arm64');
    t.is(v.arch, 'arm64');
    v = NodeVersion.parse('test/latest/ppc64');
    t.is(v.arch, 'ppc64');
});

test.todo('Compare');
test.todo('Match');
