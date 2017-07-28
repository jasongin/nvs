'use strict';

function checkNodeVersion() {
	if (!require('semver').satisfies(process.version, '>=6.5.0')) {
		throw new Error('NVS tests require Node.js v6.5 or later. ' +
			'Current Node.js is ' + process.version + '.');
	}
}

module.exports = checkNodeVersion;
