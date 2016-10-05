// Adds simple promise wrappers around fs async APIs.
const fs = require('fs');

fs.accessAsync = function (path, mode) {
    return new Promise((resolve, reject) => {
        fs.access(path, mode, e => {
            if (e) reject(e);
            else resolve();
        });
    });
};

fs.readdirAsync = function (path, options) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, options, (e, files) => {
            if (e) reject(e);
            else resolve(files);
        });
    });
};

fs.lstatAsync = function (path) {
    return new Promise((resolve, reject) => {
        fs.lstat(path, (e, stats) => {
            if (e) reject(e);
            else resolve(stats);
        });
    });
};

fs.unlinkAsync = function (path) {
    return new Promise((resolve, reject) => {
        fs.unlink(path, e => {
            if (e) reject(e);
            else resolve();
        });
    });
};

fs.renameAsync = function (oldPath, newPath) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, e => {
            if (e) reject(e);
            else resolve();
        });
    });
};

fs.mkdirAsync = function (path, mode) {
    return new Promise((resolve, reject) => {
        fs.mkdir(path, mode, e => {
            if (e) reject(e);
            else resolve();
        });
    });
};

fs.rmdirAsync = function (path) {
    return new Promise((resolve, reject) => {
        fs.rmdir(path, e => {
            if (e) reject(e);
            else resolve();
        });
    });
};

module.exports = fs;
