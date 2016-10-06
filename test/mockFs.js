var mockFs = {
    dirMap: {},
    linkMap: {},
    statMap: {},
    unlinkPaths: [],

    reset: function () {
        this.dirMap = {};
        this.statMap = {};
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

    statSync: function (path) {
        var result = this.statMap[path];
        if (result) return result;
        var e = new Error('Path not found: ' + path);
        e.code = 'ENOENT';
        throw e;
    },

    symlinkSync: function(path, target) {
        linkMap[path] = target;
    },

    unlinkSync: function(path) {
        delete linkMap[path];
        this.unlinkPaths.push(path);
    },
};

module.exports = mockFs;
