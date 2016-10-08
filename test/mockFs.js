const fs = require('fs');

const mockFs = {
    trace: false,

    dirMap: {},
    linkMap: {},
    statMap: {},
    unlinkPaths: [],

    reset() {
        this.trace = false;
        this.dirMap = {};
        this.linkMap = {};
        this.statMap = {};
        this.unlinkPaths = [];
    },

    readdirSync(path) {
        if (this.trace) console.log('readdirSync(' + path + ')');
        let result = this.dirMap[path];
        if (result) return result;
        if (this.trace) console.log('  => not found in dir map: ' + JSON.stringify(this.dirMap));
        let e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    readlinkSync(path) {
        if (this.trace) console.log('readlinkSync(' + path + ')');
        let result = this.linkMap[path];
        if (result) return result;
        if (this.trace) console.log('  => not found in link map: ' + JSON.stringify(this.linkMap));
        let e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    accessSync(path, mode) {
        if (this.trace) console.log('accessSync(' + path + ', ' + mode + ')');
        this.statSync(path);
    },

    statSync(path) {
        if (this.trace) console.log('statSync(' + path + ')');
        let result = this.statMap[path];
        if (result) return result;
        if (this.trace) console.log('  => not found in stat map: ' + JSON.stringify(this.statMap));
        let e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    lstatSync(path) {
        return this.statSync(path);
    },

    symlinkSync(target, path) {
        if (this.trace) console.log('symlinkSync(' + target + ', ' + path + ')');
        this.linkMap[path] = target;
        this.statMap[path] = {};
    },

    unlinkSync(path) {
        if (this.trace) console.log('unlinkSync(' + path + ')');
        this.statSync(path);
        delete this.linkMap[path];
        delete this.statMap[path];
        this.unlinkPaths.push(path);
    },

    mkdirSync(path) {
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
        if (this.trace) console.log('renameSync(' + oldPath, newPath + ')');

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
        return {
            mockFs,
            filePath,
            end() {},
        };
    },

    constants: fs.constants,
};

module.exports = mockFs;
