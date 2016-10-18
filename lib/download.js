/* global settings */
const crypto = require('crypto');
const path = require('path');
const stream = require('stream');
const ProgressBar = require('progress');

let fs = require('fs');  // Non-const enables test mocking
let http = require('http');  // Non-const enables test mocking
let https = require('https');  // Non-const enables test mocking

const Error = require('./error');

function downloadFileAsync(filePath, fileUri, skipHeader) {
    let stream = null;
    return new Promise((resolve, reject) => {
        try {
            stream = fs.createWriteStream(filePath);

            let client = fileUri.startsWith('https:') ? https : http;
            client.get(fileUri, (res) => {
                if (res.statusCode === 200) {
                    let totalBytes = parseInt(res.headers['content-length'], 10);
                    let progressFormat = 'Downloading [:bar] :percent :etas ';
                    if (!settings.quiet && totalBytes > 100000) {
                        res.pipe(streamProgress(progressFormat, {
                            complete: '#',
                            total: totalBytes,
                        })).pipe(stream).on('finish', () => {
                            resolve();
                        });
                    } else {
                        res.pipe(stream).on('finish', () => {
                            resolve();
                        });
                    }
                } else if (res.statusCode === 404) {
                    reject(new Error('File not available: ' + fileUri,
                        new Error('HTTP response status: ' + res.statusCode)));
                } else {
                    reject(new Error('Failed to download file: ' + fileUri,
                        new Error('HTTP response status: ' + res.statusCode)));
                }
            }).on('error', (e) => {
                reject(new Error('Failed to download file: ' + fileUri, e));
            });
        } catch (e) {
            reject(new Error('Failed to download file: ' + fileUri, e));
        }
    }).catch(e => {
        try {
            if (stream) stream.end();
            fs.unlinkSync(filePath);
        } catch (e2) {}
        throw e;
    });
}

function ensureFileCachedAsync(fileName, fileUri, shasumName, shasumUri) {
    let cachedFilePath = path.join(settings.cache, fileName);

    let fileExists;
    try {
        fs.accessSync(cachedFilePath);
        fileExists = true;
    } catch (e) {
        if (e.code !== 'ENOENT') {
            throw new Error('Cannot access cached file: ' + fileName, e);
        }
        fileExists = false;
    }

    if (shasumName && shasumUri) {
        let shasumPath = path.join(settings.cache, shasumName);

        return downloadFileAsync(shasumPath, shasumUri).then(() => {
            if (!fileExists) {
                return downloadFileAsync(cachedFilePath, fileUri, true);
            }
        }).then(() => {
            return verifyCachedFileAsync(cachedFilePath, shasumPath,
                path.posix.basename(fileUri));
        }).then(() => {
            return cachedFilePath;
        });
    } else if (!fileExists) {
        return downloadFileAsync(cachedFilePath, fileUri).then(() => {
            return cachedFilePath;
        });
    } else {
        return Promise.resolve(cachedFilePath);
    }
}

function verifyCachedFileAsync(filePath, shasumPath, fileName) {
    fileName = (fileName || path.basename(filePath)).toLowerCase();
    let fileShashum = null;
    let shasumLines = fs.readFileSync(shasumPath, 'utf8').split(/\s*\n\s*/g);
    shasumLines.forEach(line => {
        let lineParts = line.split(/ +/g);
        if (lineParts.length === 2 && lineParts[1].toLowerCase() === fileName) {
            fileShashum = lineParts[0];
            return true;
        }
    });

    if (!fileShashum) {
        throw new Error('SHASUM256 value not found for file: ' +
            path.basename(filePath));
    }

    return new Promise((resolve, reject) => {
        let fileStream = fs.createReadStream(filePath);
        let hash = crypto.createHash('sha256');
        fileStream.pipe(hash).on('finish', () => {
            let hashData = hash.read();
            if (hashData) {
                let hashResult = hashData.toString('hex');
                if (hashResult === fileShashum) {
                    resolve();
                } else {
                    fs.unlinkSync(filePath);
                    reject(new Error('SHASUM256 does not match for cached file: ' +
                        path.basename(filePath)));
                }
            } else {
                reject('Failed to caclulate hash for file: ' +
                    path.basename(filePath));
            }
        });
    });
}

function streamProgress(progressFormat, options) {
    let passThrough = new stream.PassThrough();

    if (process.platform === 'win32') {
        // Work around for https://github.com/visionmedia/node-progress/issues/87
        progressFormat = '\x1b[1G' + progressFormat;
    }

    passThrough.on('pipe', stream => {
        let progressBar = new ProgressBar(progressFormat, options);
        passThrough.on('data', chunk => {
            if (progressBar.curr + chunk.length >= progressBar.total) {
                let finalFormat = progressFormat.replace(/:etas/, '    ');
                progressBar.fmt = finalFormat;
            }
            progressBar.tick(chunk.length);
        });
    });

    return passThrough;
}

module.exports = {
    downloadFileAsync,
    ensureFileCachedAsync,
};
