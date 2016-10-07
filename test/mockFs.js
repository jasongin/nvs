var fs = require('fs');

var mockFs = {
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
        var result = this.dirMap[path];
        if (result) return result;
        var e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    readlinkSync: function (path) {
        var result = this.linkMap[path];
        if (result) return result;
        var e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    accessSync: function (path, mode) {
        this.statSync(path);
    },

    statSync: function (path) {
        var result = this.statMap[path];
        if (result) return result;
        var e = new Error('Path not found: ' + path);
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
