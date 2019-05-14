'use strict';

const test = require('ava').default;

test.before(require('../checkNodeVersion'));

require('../../lib/settings').settings = {
	aliases: {},
	remotes: {
		'default': 'test',
		'test': 'http://example.com/test',
		'test2': 'http://example.com/test2',
	},
};

const NodeVersion = require('../../lib/version');

test('Format version', t => {
	t.is(NodeVersion.parse('test').toString(), 'test');
	t.is(NodeVersion.parse('test/5').toString(), 'test/5');
	t.is(NodeVersion.parse('test/5.6').toString(), 'test/5.6');
	t.is(NodeVersion.parse('test/5.6.7').toString(), 'test/5.6.7');
	t.is(NodeVersion.parse('test/5.6.7/x86').toString(), 'test/5.6.7/x86');
	t.is(NodeVersion.parse('test/latest').toString(), 'test/latest');
	t.is(NodeVersion.parse('test/latest/x86').toString(), 'test/latest/x86');
	t.is(NodeVersion.parse('5').toString(), 'test/5');
	t.is(NodeVersion.parse('5.6').toString(), 'test/5.6');
	t.is(NodeVersion.parse('5.6.7').toString(), 'test/5.6.7');
	t.is(NodeVersion.parse('5.6.7/x86').toString(), 'test/5.6.7/x86');
	t.is(NodeVersion.parse('latest').toString(), 'test/latest');
	t.is(NodeVersion.parse('latest/x86').toString(), 'test/latest/x86');
});

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

test('Parse support v8-canary version', t => {
	let v = NodeVersion.parse('test2/9.0.0-v8-canary20170612bda40dd6fd/x64');
	t.truthy(v);
	t.is(v.semanticVersion, '9.0.0-v8-canary20170612bda40dd6fd');
	t.is(v.remoteName, 'test2');
	t.is(v.arch, 'x64');
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
	const os = require('os');
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
	if (os.endianness() === 'LE') {
		t.is(v.arch, 'ppc64le');
	} else {
		t.is(v.arch, 'ppc64');
	}
	v = NodeVersion.parse('test/latest/s390x');
	t.is(v.arch, 's390x');
});

test('Compare', t => {
	let vA = new NodeVersion('test1', '5.6.7', 'x64');
	let vB = new NodeVersion('test1', '5.6.7', 'x86');
	let vC = new NodeVersion('test1', '5.5.6', 'x64');
	let vD = new NodeVersion('test1', '5.5.6', 'x86');
	let vE = new NodeVersion('test2', '6.7.8', 'x64');
	let vF = new NodeVersion('test2', '6.7.8', 'x86');
	let vG = new NodeVersion('test2', '6.6.7', 'x64');
	let vH = new NodeVersion('test2', '6.6.7', 'x86');
	let vI = new NodeVersion('test2', '5.0.0', 'x64');
	let vJ = new NodeVersion('test2', '5.0.0-B', 'x64');
	let vK = new NodeVersion('test2', '5.0.0-A', 'x64');

	let unsorted = [vE, vG, vK, vB, vA, vI, vD, vJ, vH, vF, vC];
	let sorted = unsorted.sort(NodeVersion.compare);
	t.deepEqual(sorted, [vA, vB, vC, vD, vE, vF, vG, vH, vI, vJ, vK]);
});

test('GetBinaryNameFromVersion', t => {
	t.is(NodeVersion.getBinaryNameFromVersion('0.12'), 'node');
	t.is(NodeVersion.getBinaryNameFromVersion('1.8'), 'iojs');
	t.is(NodeVersion.getBinaryNameFromVersion('2.0'), 'iojs');
	t.is(NodeVersion.getBinaryNameFromVersion('3.2'), 'iojs');
	t.is(NodeVersion.getBinaryNameFromVersion('4.3'), 'node');
	t.is(NodeVersion.getBinaryNameFromVersion('5.6'), 'node');
	t.is(NodeVersion.getBinaryNameFromVersion('6.8'), 'node');
	t.is(NodeVersion.getBinaryNameFromVersion('7.8'), 'node');
});

test('LTS versions', t => {
	t.is(NodeVersion.parse('lts').toString(), 'test/lts');
	t.is(NodeVersion.parse('lts/*').toString(), 'test/lts');
	t.is(NodeVersion.parse('lts/boron').toString(), 'test/boron');
	t.throws(
		() => NodeVersion.parse('lts/6.7.8'),
		{ message: /Remote name not found/ });
});

test.todo('Match');
