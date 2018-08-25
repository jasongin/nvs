'use strict';

const EventEmitter = require('events').EventEmitter;

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
		if (this.mockActions.length === 0) {
			throw new Error('Spawn of \'' + exe + '\' not allowed by mock.');
		}

		let mockAction = this.mockActions.pop();
		if (mockAction.cb) {
			let status = 0;
			let error = null;
			try {
				status = mockAction.cb(exe, args);
			} catch (e) {
				error = e;
			}
			mockAction = { status, error };
		}

		return mockAction;
	},

	spawn(exe, args) {
		this.spawns.push({ exe, args });
		if (this.mockActions.length === 0) {
			throw new Error('Spawn of \'' + exe + '\' not allowed by mock.');
		}

		let mockAction = this.mockActions.pop();
		if (mockAction.cb) {
			let status = 0;
			let error = null;
			try {
				status = mockAction.cb(exe, args);
			} catch (e) {
				error = e;
			}
			mockAction = { status, error };
		}

		let mockChild = new EventEmitter();
		mockChild.stdout = new EventEmitter();
		mockChild.stderr = new EventEmitter();
		setImmediate(() => {
			if (mockAction.error) {
				mockChild.emit('error', mockAction.error);
			} else {
				mockChild.emit('close', mockAction.status);
			}
		});
		return mockChild;
	},
};

module.exports = mockChildProc;
