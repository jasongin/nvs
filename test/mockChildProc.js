const childProcess = require('child_process');

const mockChildProc = {
    spawns: [],
    mockActions: [],

    reset() {
        this.spawns = [];
        this.exitCodes = [];
        this.errors = [];
    },

    spawnSync(exe, args) {
        this.spawns.push({ exe, args });
        if (this.mockActions.length == 0) {
            throw new Error('Spawn of \'' + exe + '\' not allowed by mock.');
        }

        let status = 0;
        let error = null;
        let mockAction = this.mockActions.pop();
        if (mockAction.cb) {
            try {
                status = mockAction.cb(exe, args);
            } catch (e) {
                error = e;
            }
            mockAction = { status, error };
        }

        return mockAction;
    },
};

module.exports = mockChildProc;
