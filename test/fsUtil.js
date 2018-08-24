'use strict';

const fs = require('fs');

function createDirectoryIfNotFound(dir) {
	try {
		fs.mkdirSync(dir);
	} catch (e) {
		if (e.code !== 'EEXIST') {
			throw e;
		}
	}
}

function removeDirectoryIfEmpty(dir) {
	try {
		fs.rmdirSync(dir);
	} catch (e) {
		if (e.code !== 'ENOTEMPTY' && e.code !== 'ENOENT' && e.code !== 'EBUSY') {
			throw e;
		}
	}
}

module.exports = {
	createDirectoryIfNotFound,
	removeDirectoryIfEmpty,
};
