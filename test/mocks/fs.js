'use strict';

const fs = require('fs');
const path = require('path');
const stream = require('stream');

const mockFs = {
	trace: false,

	dirMap: {},
	linkMap: {},
	statMap: {},
	dataMap: {},
	unlinkPaths: [],
	nextRenameError: null,

	reset() {
		this.trace = false;
		this.dirMap = {};
		this.linkMap = {};
		this.statMap = {};
		this.dataMap = {};
		this.unlinkPaths = [];
	},

	fixSep(p) {
		return p && p.replace(/\\|\//g, path.sep);
	},

	mockFile(filePath, data) {
		filePath = this.fixSep(filePath);
		this.statMap[filePath] = {
			isDirectory() { return false; },
			isFile() { return true; },
			isSymbolicLink() { return false; },
		};
		if (data !== undefined) {
			this.dataMap[filePath] = data;
		}
	},

	mockLink(linkPath, linkTarget) {
		linkPath = this.fixSep(linkPath);
		linkTarget = this.fixSep(linkTarget);
		this.statMap[linkPath] = {
			isDirectory() { return false; },
			isFile() { return false; },
			isSymbolicLink() { return true; },
		};
		this.linkMap[linkPath] = linkTarget;
	},

	mockDir(dirPath, childNames) {
		dirPath = this.fixSep(dirPath);
		this.statMap[dirPath] = {
			isFile() { return false; },
			isDirectory() { return true; },
			isSymbolicLink() { return false; },
		};
		this.dirMap[dirPath] = childNames;
	},

	resolveLink(linkPath) {
		let linkTarget = this.linkMap[linkPath];
		if (!linkTarget) return linkPath;
		return path.isAbsolute(linkTarget) ? linkTarget : path.join(linkPath, linkTarget);
	},

	readdirSync(path) {
		path = this.fixSep(path);
		if (this.trace) console.log('readdirSync(' + path + ')');
		path = this.resolveLink(path);
		let result = this.dirMap[path];
		if (result) return result;
		if (this.trace) console.log('  => not found in dir map: ' + JSON.stringify(this.dirMap));
		let e = new Error('Path not found: ' + path);
		e.code = 'ENOENT';
		throw e;
	},

	readdir(path, cb) {
		try { cb(null, this.readdirSync(path)); }		catch (e) { cb(e); }
	},

	readlinkSync(path) {
		path = this.fixSep(path);
		if (this.trace) console.log('readlinkSync(' + path + ')');
		let result = this.linkMap[path];
		if (result) return result;
		if (this.trace) console.log('  => not found in link map: ' + JSON.stringify(this.linkMap));
		let e = new Error('Path not found: ' + path);
		e.code = 'ENOENT';
		throw e;
	},

	accessSync(path, mode) {
		path = this.fixSep(path);
		if (this.trace) console.log('accessSync(' + path + ', ' + mode + ')');
		this.statSync(path);
	},

	access(path, mode, cb) {
		if (typeof mode === 'function') {
			cb = mode;
			mode = undefined;
		}

		try { cb(null, this.accessSync(path, mode)); }		catch (e) { cb(e); }
	},

	statSync(path) {
		path = this.fixSep(path);
		if (this.trace) console.log('statSync(' + path + ')');
		path = this.resolveLink(path);
		let result = this.statMap[path];
		if (result) return result;
		else if (this.linkMap[path]) return { isSymbolicLink() { return true; } };
		if (this.trace) console.log('  => not found in stat map: ' + JSON.stringify(this.statMap));
		let e = new Error('Path not found: ' + path);
		e.code = 'ENOENT';
		throw e;
	},

	stat(path, cb) {
		try { cb(null, this.statSync(path)); }		catch (e) { cb(e); }
	},

	lstatSync(path) {
		path = this.fixSep(path);
		if (this.trace) console.log('statSync(' + path + ')');
		let result = this.statMap[path];
		if (result) return result;
		else if (this.linkMap[path]) return { isSymbolicLink() { return true; } };
		if (this.trace) console.log('  => not found in stat map: ' + JSON.stringify(this.statMap));
		let e = new Error('Path not found: ' + path);
		e.code = 'ENOENT';
		throw e;
	},

	symlinkSync(target, path) {
		path = this.fixSep(path);
		if (this.trace) console.log('symlinkSync(' + target + ', ' + path + ')');
		this.linkMap[path] = target;
		this.statMap[path] = { isDirectory() { return false; }, isSymbolicLink() { return true; } };
	},

	unlinkSync(path) {
		path = this.fixSep(path);
		if (this.trace) console.log('unlinkSync(' + path + ')');
		this.lstatSync(path);
		delete this.linkMap[path];
		delete this.statMap[path];
		this.unlinkPaths.push(path);
	},

	mkdirSync(path) {
		path = this.fixSep(path);
		if (this.trace) console.log('mkdirSync(' + path + ')');
		if (!this.dirMap[path]) {
			this.dirMap[path] = [];
		} else {
			if (this.trace) console.log('  => already in dir map: ' + JSON.stringify(this.dirMap));
			let e = new Error('Directory already exists: ' + path);
			e.code = 'EEXIST';
			throw e;
		}
	},

	rmdirSync(path) {
		path = this.fixSep(path);
		if (this.trace) console.log('rmdirSync(' + path + ')');
		if (this.dirMap[path]) {
			delete this.dirMap[path];
		} else {
			if (this.trace) console.log('  => not found in dir map: ' + JSON.stringify(this.dirMap));
			let e = new Error('Path not found: ' + path);
			e.code = 'ENOENT';
			throw e;
		}
	},

	renameSync(oldPath, newPath) {
		oldPath = this.fixSep(oldPath);
		newPath = this.fixSep(newPath);
		if (this.trace) console.log('renameSync(' + oldPath, newPath + ')');

		if (this.nextRenameError) {
			const e = this.nextRenameError;
			this.nextRenameError = null;
			throw e;
		}

		if (this.dirMap[oldPath]) {
			// Support for renaming directories is limited to a single level.
			// Subdirectory paths currently do not get updated.
			this.dirMap[newPath] = this.dirMap[oldPath];
			delete this.dirMap[oldPath];
			this.dirMap[newPath].forEach(childName => {
				let oldChildPath = require('path').join(oldPath, childName);
				let newChildPath = require('path').join(newPath, childName);
				if (this.statMap[oldChildPath]) {
					this.statMap[newChildPath] = this.statMap[oldChildPath];
					delete this.statMap[oldChildPath];
				}
			});
		}

		if (!this.statMap[oldPath]) {
			if (this.trace) console.log('  => not found in stat map: ' + JSON.stringify(this.statMap));
			let e = new Error('Path not found: ' + path);
			e.code = 'ENOENT';
			throw e;
		} else if (this.statMap[newPath]) {
			if (this.trace) console.log('  => already in stat map: ' + JSON.stringify(this.statMap));
			let e = new Error('Target already exists: ' + path);
			e.code = 'EEXIST';
			throw e;
		} else {
			this.statMap[newPath] = this.statMap[oldPath];
			delete this.statMap[oldPath];
		}
	},

	createWriteStream(filePath) {
		filePath = this.fixSep(filePath);
		if (this.trace) console.log('createWriteStream(' + filePath + ')');

		return {
			mockFs,
			filePath,
			end() {},
		};
	},

	createReadStream(filePath) {
		filePath = this.fixSep(filePath);
		if (this.trace) console.log('createReadStream(' + filePath + ')');

		let data = this.dataMap[filePath];
		if (data) {
			if (this.trace) console.log('  => [' + data.length + ']');
			let s = new stream.Readable();
			s.push(data);
			s.push(null);
			return s;
		}

		if (this.trace)			{ console.log('  => not found in data map: ' + JSON.stringify(Object.keys(this.dataMap))); }
		let e = new Error('Mock file data not found: ' + filePath);
		e.code = 'ENOENT';
		throw e;
	},

	readFileSync(filePath) {
		filePath = this.fixSep(filePath);
		if (this.trace) console.log('readFileSync(' + filePath + ')');

		let data = this.dataMap[filePath];
		if (data) {
			if (this.trace) console.log('  => [' + data.length + ']');
			return data;
		}

		if (this.trace)			{ console.log('  => not found in data map: ' + JSON.stringify(Object.keys(this.dataMap))); }
		let e = new Error('Mock file data not found: ' + filePath);
		e.code = 'ENOENT';
		throw e;
	},

	constants: fs.constants,
};

module.exports = mockFs;
