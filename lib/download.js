// @ts-check
'use strict';

const crypto = require('crypto');
const path = require('path');
const stream = require('stream');
const url = require('url');
const ProgressBar = require('../deps/node_modules/progress/index');
const { HttpProxyAgent } = require('../deps/node_modules/http-proxy-agent/dist/index');
const { HttpsProxyAgent } = require('../deps/node_modules/https-proxy-agent/dist/index');

let fs = require('fs');  // Non-const enables test mocking
let { http, https } = require('../deps/node_modules/follow-redirects/index');  // Non-const enables test mocking

const settings = require('./settings').settings;
const Error = require('./error');

function downloadFileAsync(filePath, fileUri) {
	let stream = null;
	return new Promise((resolve, reject) => {
		try {
			const progressFormat = 'Downloading [:bar] :percent-4 :eta-3s ';
			stream = fs.createWriteStream(filePath);

			if (path.isAbsolute(fileUri)) {
				// Copy from a local directory or network share.
				fs.stat(fileUri, (e, stats) => {
					if (e) {
						reject(e);
					} else {
						let totalBytes = stats.size;
						let readStream = fs.createReadStream(fileUri);
						if (!settings.quiet) {
							readStream.pipe(streamProgress(progressFormat, {
								complete: '#',
								total: totalBytes,
							})).pipe(stream).on('finish', resolve).on('error', reject);
						} else {
							readStream.pipe(stream).on('finish', resolve).on('error', reject);
						}
					}
				});
			} else {
				// Download from the web.
				const secure = fileUri.startsWith('https:');
				const httpGet = secure
					? https.get.bind(https) : http.get.bind(http);
				const proxy = secure
					? process.env.https_proxy || process.env.HTTPS_PROXY
					: process.env.http_proxy || process.env.HTTP_PROXY;
				const Agent = secure ? HttpsProxyAgent : HttpProxyAgent;
				/** @type {any} */
				let opt = url.parse(fileUri);
				if (proxy) opt.agent = new Agent(proxy);
				httpGet(opt, (res) => {
					if (res.statusCode === 200) {
						let totalBytes = parseInt(res.headers['content-length'], 10);
						let progressFormat = 'Downloading [:bar] :percent-4 :eta-3s ';
						if (!settings.quiet && totalBytes > 100000) {
							res.pipe(streamProgress(progressFormat, {
								complete: '#',
								total: totalBytes,
							})).pipe(stream).on('finish', resolve).on('error', reject);
						} else {
							res.pipe(stream).on('finish', resolve).on('error', reject);
						}
					} else if (res.statusCode === 404) {
						reject(new Error('File not found: ' + fileUri,
							new Error('HTTP response status: ' + res.statusCode)));
					} else {
						reject(new Error('Failed to download file: ' + fileUri,
							new Error('HTTP response status: ' + res.statusCode)));
					}
				}).on('error', (e) => {
					reject(new Error('Failed to download file: ' + fileUri, e));
				});
			}
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
		Error.throwIfNot(Error.ENOENT, e, 'Cannot access cached file: ' + fileName);
		fileExists = false;
	}

	if (shasumName && shasumUri) {
		let shasumPath = path.join(settings.cache, shasumName);

		return downloadFileAsync(shasumPath, shasumUri).then(() => {
			if (!fileExists) {
				return downloadFileAsync(cachedFilePath, fileUri);
			}
		}).then(() => {
			let fileName = path.posix.basename(fileUri);
			let shasumDirUri = path.posix.dirname(shasumUri) + '/';
			if (fileUri.toLowerCase().startsWith(shasumDirUri.toLowerCase())) {
				// The file is in a subdirectory relative to the shasum file,
				// so the shasum filename needs to include the subdirectory.
				fileName = fileUri.substr(shasumDirUri.length);
			}
			return verifyCachedFileAsync(cachedFilePath, shasumPath, fileName);
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
		throw new Error('SHASUM256 value not found for file: ' + fileName);
	}

	return new Promise((resolve, reject) => {
		let fileStream = fs.createReadStream(filePath);
		let hash = crypto.createHash('sha256');
		fileStream.pipe(hash).on('finish', () => {
			let hashData = hash.read();
			if (hashData instanceof Buffer) {
				let hashResult = hashData.toString('hex');
				if (hashResult === fileShashum) {
					resolve();
				} else {
					fs.unlinkSync(filePath);
					reject(new Error('SHASUM256 does not match for cached file: ' +
						path.basename(filePath)));
				}
			} else {
				reject(new Error('Failed to caclulate hash for file: ' +
					path.basename(filePath)));
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
				let finalFormat = progressFormat.replace(/:eta-3s/, '    ');
				progressBar.fmt = finalFormat;
			}
			progressBar.tick(chunk.length, undefined);
		});
	});

	return passThrough;
}

module.exports = {
	downloadFileAsync,
	ensureFileCachedAsync,
};
