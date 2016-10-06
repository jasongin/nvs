var test = require('ava').test;
var rewire = require('rewire');

global.settings = {
    feeds: {
        'default': 'test',
        'test': 'http://example.com/test',
        'test2': 'http://example.com/test2',
    },
};

var nvsVersion = rewire('../lib/version');

test('Parse semantic version', t => {
    let v = nvsVersion.parse('5.6.7');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.feedName, 'test');
    t.is(v.arch, process.arch);
});

test('Parse semantic version with label', t => {
    let v = nvsVersion.parse('5.6.7-nightly201610057b5ffa46fe');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7-nightly201610057b5ffa46fe');
    t.is(v.feedName, 'test');
    t.is(v.arch, process.arch);
});

test('Parse feed and semantic version', t => {
    let v = nvsVersion.parse('test2/5.6.7');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.feedName, 'test2');
    t.is(v.arch, process.arch);
});

test('Parse feed, semantic version, and arch', t => {
    let v = nvsVersion.parse('test2/5.6.7/x86');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.feedName, 'test2');
    t.is(v.arch, 'x86');
});

test('Parse semantic version and arch', t => {
    let v = nvsVersion.parse('5.6.7/x86');
    t.truthy(v);
    t.is(v.semanticVersion, '5.6.7');
    t.is(v.feedName, 'test');
    t.is(v.arch, 'x86');
});

test('Parse version label', t => {
    let v = nvsVersion.parse('lts');
    t.truthy(v);
    t.is(v.semanticVersion, null);
    t.is(v.label, 'lts');
    t.is(v.feedName, 'test');
    t.is(v.arch, process.arch);
});

test('Parse feed and version label', t => {
    let v = nvsVersion.parse('test2/lts');
    t.truthy(v);
    t.is(v.semanticVersion, null);
    t.is(v.label, 'lts');
    t.is(v.feedName, 'test2');
    t.is(v.arch, process.arch);
});

test('Parse version label and arch', t => {
    let v = nvsVersion.parse('lts/x86');
    t.truthy(v);
    t.is(v.semanticVersion, null);
    t.is(v.label, 'lts');
    t.is(v.feedName, 'test');
    t.is(v.arch, 'x86');
});

test('Parse feed, version label and arch', t => {
    let v = nvsVersion.parse('test2/lts/x86');
    t.truthy(v);
    t.is(v.semanticVersion, null);
    t.is(v.label, 'lts');
    t.is(v.feedName, 'test2');
    t.is(v.arch, 'x86');
});
