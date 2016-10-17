const http = require('http');
const https = require('https');
const EventEmitter = require('events');

const mockHttp = {
    resourceMap: {},
    requests: [],

    reset() {
        this.resourceMap = {};
        this.requests = [];
    },

    get(uri, cb) {
        let mockRequest = new EventEmitter();
        let mockResponse = new EventEmitter();
        let responseContent = this.resourceMap[uri];
        if (responseContent) {
            mockResponse.statusCode = 200;
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
            cb(mockResponse);
        });

        return mockRequest;
    },
};

module.exports = mockHttp;
