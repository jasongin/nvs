const childProcess = require('child_process');

const mockCp = {
    spawns: [],
    exitCodes: [],
    errors: [],

    reset: function () {
        this.spawns = [];
        this.exitCodes = [];
        this.errors = [];
    },

    spawnSync: function (exe, args) {
        this.spawns.push({ exe, args });
        return {
            status: this.exitCodes.pop(),
            error: this.errors.pop(),
        };
    },
};

module.exports = mockCp;
