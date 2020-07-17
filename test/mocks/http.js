'use strict';

const EventEmitter = require('events');

const mockHttp = {
	trace: false,
	resourceMap: {},
	requests: [],

	reset() {
		this.resourceMap = {};
		this.requests = [];
	},

	get(uri, cb) {
		if (typeof uri === 'object' && uri.hostname) {
			uri = (uri.protocol || 'https:') + '//' + uri.hostname + (uri.path || '/');
		}

		if (this.trace) console.log('GET ' + uri);

		let mockRequest = new EventEmitter();
		let mockResponse = new EventEmitter();
		let responseContent = this.resourceMap[uri];
		if (responseContent) {
			mockResponse.statusCode = 200;
			mockResponse.headers = {
				'content-length': '' + responseContent.length,
			};
			mockResponse.pipe = stream => {
				setImmediate(() => {
					stream.mockFs.statMap[stream.filePath] = {
						isFile() { return true; },
						isDirectory() { return false; },
					};
					stream.mockFs.dataMap[stream.filePath] = responseContent;
					mockResponse.emit('finish');
				});
				return mockResponse;
			};
		} else {
			mockResponse.statusCode = 404;
		}

		setImmediate(() => {
			if (this.trace) console.log('  ' + mockResponse.statusCode);
			cb(mockResponse);

			if (responseContent) {
				setImmediate(() => {
					mockResponse.emit('data', responseContent);
					setImmediate(() => {
						mockResponse.emit('end');
					});
				});
			} else {
				setImmediate(() => {
					mockResponse.emit('end');
				});
			}
		});

		return mockRequest;
	},
};

module.exports = mockHttp;
