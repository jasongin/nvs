// @ts-check
'use strict';

let childProcess = require('child_process');  // Non-const enables test mocking
const path = require('path');
const ProgressBar = require('../deps/node_modules/progress/index');

const settings = require('./settings').settings;
const Error = require('./error');

function extractAsync(archiveFile, targetDir) {
	if (process.platform === 'win32') {
		if (path.extname(archiveFile).toLowerCase() === '.msi') {
			return extractMsiPackageAsync(archiveFile, targetDir);
		} else {
			return extractZipArchiveAsync(archiveFile, targetDir);
		}
	} else {
		return extractTarArchiveAsync(archiveFile, targetDir);
	}
}

function extractZipArchiveAsync(archiveFile, targetDir) {
	const sevenZip = path.join(__dirname, '..', 'tools', '7-Zip', '7zr.exe');
	let totalFiles;

	if (!settings.quiet) {
		let child = childProcess.spawnSync(
			sevenZip,
			[ 'l', archiveFile ]);
		if (child.error) {
			throw new Error('Failed to read archive: ' + archiveFile,
				child.error);
		} else if (child.status) {
			throw new Error('Failed to read archive: ' + archiveFile,
				new Error('Tar exited with code: ' + child.status));
		}

		// The 7z list mode outputs one file per line, among other non-file lines.
		let output = child.stdout.toString();
		let fileRegex = / +[.A-Z]{5} +[0-9]+ +([0-9]+ +)?[^\n]+\n/g;
		for (totalFiles = 0; fileRegex.test(output); totalFiles++);
	}

	return new Promise((resolve, reject) => {
		let progressFormat = '\x1b[1GExtracting  [:bar] :percent-4 :eta-3s ';
		let progressBar = null;
		let nextData = '';
		if (!settings.quiet && totalFiles > 10) {
			progressBar = new ProgressBar(progressFormat, {
				complete: '#',
				total: totalFiles,
			});
		}

		let child = childProcess.spawn(
			sevenZip,
			[ 'x', '-bb1', '-o' + targetDir, '-y', archiveFile ]);
		child.on('error', e => {
			reject(new Error('Failed to extract archive: ' + archiveFile, e));
		});
		child.on('close', code => {
			if (code) {
				reject(new Error('Failed to extract archive: ' + archiveFile,
					new Error('Tar exited with code: ' + code)));
			} else {
				resolve();
			}
		});
		child.stdout.on('data', data => {
			if (progressBar) {
				let lines = (nextData + data).split(/\r?\n/g);
				nextData = lines.pop();

				let fileCount = 0;
				for (let i = 0; i < lines.length; i++) {
					if (lines[i].startsWith('- ')) {
						fileCount++;
					}
				}

				if (progressBar.curr + fileCount >= totalFiles) {
					let finalFormat = progressFormat.replace(/:eta-3s/, '    ');
					progressBar.fmt = finalFormat;
				}
				progressBar.tick(fileCount);
			}
		});
	});
}

function extractMsiPackageAsync(msiFile, targetDir) {
	return new Promise((resolve, reject) => {
		if (!settings.quiet) {
			// Unfortunately there's not a good way to get MSI extract progress via the command-line.
			console.log('Extracting...');
		}

		let child = childProcess.spawn(
			'msiexec',
			[ '/qn', '/a', msiFile, 'TARGETDIR=' + targetDir ]);
		child.on('error', e => {
			reject(new Error('Failed to extract MSI package: ' + msiFile, e));
		});
		child.on('close', code => {
			if (code) {
				reject(new Error('Failed to MSI package: ' + msiFile,
					new Error('Msiexec exited with code: ' + code)));
			} else {
				resolve();
			}
		});
	});
}

function extractTarArchiveAsync(archiveFile, targetDir) {
	let decompressFlag = archiveFile.endsWith('.xz') ? 'J' : 'z';
	let totalFiles;

	if (!settings.quiet) {
		let child = childProcess.spawnSync(
			'tar',
			[ '-' + decompressFlag + 'tf', archiveFile ]);
		if (child.error) {
			throw new Error('Failed to read archive: ' + archiveFile,
				child.error);
		} else if (child.status) {
			throw new Error('Failed to read archive: ' + archiveFile,
				new Error('Tar exited with code: ' + child.status));
		}

		// The tar -t mode produces one line of output for each file in the archive.
		totalFiles = countChars(child.stdout.toString(), '\n');
	}

	return new Promise((resolve, reject) => {
		let progressFormat = 'Extracting  [:bar] :percent-4 :eta-3s ';
		let progressBar = null;
		if (!settings.quiet && totalFiles > 10) {
			progressBar = new ProgressBar(progressFormat, {
				complete: '#',
				total: totalFiles,
			});
		}

		let child = childProcess.spawn(
			'tar',
			[ '-' + decompressFlag + 'xvf', archiveFile, '-C', targetDir ]);
		child.on('error', e => {
			reject(new Error('Failed to extract archive: ' + archiveFile, e));
		});
		child.on('close', code => {
			if (code) {
				reject(new Error('Failed to extract archive: ' + archiveFile,
					new Error('Tar exited with code: ' + code)));
			} else {
				resolve();
			}
		});
		let processOutput = data => {
			if (progressBar) {
				let fileCount = countChars(data.toString(), '\n');
				if (progressBar.curr + fileCount >= totalFiles) {
					let finalFormat = progressFormat.replace(/:eta-3s/, '    ');
					progressBar.fmt = finalFormat;
				}
				progressBar.tick(fileCount);
			}
		};
		child.stdout.on('data', processOutput);
		child.stderr.on('data', processOutput);
	});
}

function countChars(str, c) {
	let count = 0;
	for (let i = 0; i < str.length; i++) {
		if (str[i] === c) {
			count++;
		}
	}
	return count;
}

module.exports = {
	extractAsync,
};
