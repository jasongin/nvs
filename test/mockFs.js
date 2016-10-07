const fs = require('fs');

const mockFs = {
    dirMap: {},
    linkMap: {},
    statMap: {},
    unlinkPaths: [],

    reset: function () {
        this.dirMap = {};
        this.linkMap = {};
        this.statMap = {};
        this.unlinkPaths = [];
    },

    readdirSync: function (path) {
        let result = this.dirMap[path];
        if (result) return result;
        let e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    readlinkSync: function (path) {
        let result = this.linkMap[path];
        if (result) return result;
        let e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    accessSync: function (path, mode) {
        this.statSync(path);
    },

    statSync: function (path) {
        let result = this.statMap[path];
        if (result) return result;
        let e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    symlinkSync: function(target, path) {
        this.linkMap[path] = target;
        this.statMap[path] = {};
    },

    unlinkSync: function(path) {
        this.statSync(path);
        delete this.linkMap[path];
        this.unlinkPaths.push(path);
    },

    constants: fs.constants,
};

module.exports = mockFs;
