/* global settings */
let fs = require('fs');  // Non-const enables test mocking
const os = require('os');
const path = require('path');
const Error = require('./error');

const nvsVersion = require('./version');
let nvsUse = require('./use');  // Non-const enables test mocking
let nvsAddRemove = require('./addRemove');  // Non-const enables test mocking

/**
 * Searches for the nearest `.node-version` file in the current directory or parent directories.
 * If found, the version specified in the file is then added (if necessary) and used. If no
 * `.node-version` file is found, then the default (linked) version, if any, is used.
 */
function autoSwitchAsync(cwd) {
    let version = null;
    let dir = cwd || process.cwd();
    while (dir) {
        let versionFile = path.join(dir, '.node-version');
        let versionString;
        try {
            versionString = fs.readFileSync(versionFile, 'utf8').trim();
        } catch (e) {
            Error.throwIfNot(Error.ENOENT, e, 'Failed to read file: ' + versionFile);
        }
        if (versionString) {
            try {
                version = nvsVersion.parse(versionString);
                break;
            } catch (e) {
                throw new Error('Failed to parse version in file: ' + versionFile, e);
            }
        }

        let parentDir = path.dirname(dir);
        dir = (parentDir !== dir ? parentDir : null);
    }

    if (version) {
        let binPath = nvsUse.getVersionBinary(version);
        if (!binPath) {
            let versionString =
                version.remoteName + '/' + version.semanticVersion + '/' + version.arch;
            if (!settings.quiet) {
                console.log('Adding: ' + versionString);
            }

            return nvsAddRemove.addAsync(version).then(() => {
                return nvsUse.use(version);
            });
        }
    }

    return Promise.resolve(nvsUse.use(version || 'default'));
}

/**
 * Enables or disables automatic version switching based on the presence of a
 * .node-version file in the current shell directory or a parent directory.
 * (This functionality requires support from the bootstrap shell script.)
 *
 * @param {any} enable
 */
function enableAutoSwitch(enable) {
    if (/\.cmd/i.test(process.env['NVS_POSTSCRIPT'])) {
        throw new Error('Automatic switching is not supported from a Windows Command Prompt.' +
            os.EOL + 'Use PowerShell instead.');
    }

    let psScriptFile = path.join(path.resolve(__dirname, '..'), 'nvs.ps1');
    // let shScriptFile = path.join(path.resolve(__dirname, '..'), 'nvs.sh');

    require('./postScript').generate(null, {
        '.PS1': [
            // Patch the function that is invoked every time PowerShell shows a prompt.
            // Export the function from the script using a dynamic module; this
            // does NOT require the script to be sourced.
            'if (-not $env:NVS_ORIGINAL_PROMPT) { ',
            '    $env:NVS_ORIGINAL_PROMPT = $(Get-Content function:\\prompt)',
            '}',
            'New-Module -Script {',
            enable
                ? 'function prompt { . "' + psScriptFile + '" "prompt" }'
                : 'function prompt { Invoke-Expression $env:NVS_ORIGINAL_PROMPT }',
            'Export-ModuleMember -Function prompt',
            '} > $null',
        ],
        '.SH': null, // TODO: define cd(), pushd(), popd() functions
    });
}

module.exports = {
    autoSwitchAsync,
    enableAutoSwitch,
};
