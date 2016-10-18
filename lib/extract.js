/* global settings */
let childProcess = require('child_process');  // Non-const enables test mocking
const ProgressBar = require('progress');

const Error = require('./error');

function extractAsync(archiveFile, targetDir) {
    if (process.platform === 'win32') {
        return extractZipArchiveAsync(archiveFile, targetDir);
    } else {
        return extractTarArchiveAsync(archiveFile, targetDir);
    }
}

function extractZipArchiveAsync(archiveFile, targetDir) {
    return Promise.reject(new Error('Not implemented.'));
}

function extractTarArchiveAsync(archiveFile, targetDir) {
    let decompressFlag = archiveFile.endsWith('.xz') ? 'J' : 'z';
    let totalFiles = undefined;

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
        let progressFormat = 'Extracting  [:bar] :percent :etas ';
        let progressBar = null;
        if (!settings.quiet && totalFiles > 10) {
            progressBar = new ProgressBar(progressFormat, {
                complete: '#',
                total: totalFiles,
            });
        }

        child = childProcess.spawn(
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
        if (progressBar) {
            child.stderr.on('data', data => {
                let fileCount = countChars(data.toString(), '\n');
                if (progressBar.curr + fileCount >= totalFiles) {
                    let finalFormat = progressFormat.replace(/:etas/, '    ');
                    progressBar.fmt = finalFormat;
                }
                progressBar.tick(fileCount);
            });
        }
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
