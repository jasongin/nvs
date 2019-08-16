// @ts-check
'use strict';

let fs = require('fs');  // Non-const enables test mocking
const os = require('os');
const path = require('path');

const settings = require('./settings').settings;
const Error = require('./error');

const NodeVersion = require('./version');
let nvsUse = require('./use');  // Non-const enables test mocking
let nvsAddRemove = require('./addRemove');  // Non-const enables test mocking
let nvsList = require('./list');  // Non-const enables test mocking
let nvsLink = null;  // Lazy load

/**
 * Searches for the nearest `.node-version` or `.nvmrc` file in the current directory or parent directories.
 * If found, the version specified in the file is then added (if necessary) and returned. If no
 * `.node-version` or `.nvmrc` file is found then 'default' is returned.
 */
function findAutoVersionAsync(cwd) {
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

		// If we don't have a version string, try checking for an .nvmrc file
		if (!versionString && !settings.disableNvmrc) {
			versionFile = path.join(dir, '.nvmrc');
			try {
				versionString = fs.readFileSync(versionFile, 'utf8').trim();
			} catch (e) {
				Error.throwIfNot(Error.ENOENT, e, 'Failed to read file: ' + versionFile);
			}
		}

		if (versionString) {
			try {
				version = NodeVersion.parse(versionString);
				version.arch = version.arch || NodeVersion.defaultArch;
				break;
			} catch (e) {
				throw new Error('Failed to parse version in file: ' + versionFile, e);
			}
		}

		let parentDir = path.dirname(dir);
		dir = (parentDir !== dir ? parentDir : null);
	}

	if (version) {
		let resolvedVersion = nvsList.find(version);
		if (resolvedVersion) {
			return Promise.resolve(resolvedVersion);
		} else {
			if (!settings.quiet) {
				console.log('Adding: ' + version);
			}

			return nvsAddRemove.addAsync(version).then(() => {
				return version;
			});
		}
	} else {
		nvsLink = nvsLink || require('./link');
		return Promise.resolve(nvsLink.getLinkedVersion() ? 'default' : null);
	}
}

/**
 * Searches for the nearest `.node-version` or `.nvmrc` file in the current directory or parent directories.
 * If found, the version specified in the file is then added (if necessary) and used. If no
 * `.node-version` or `.nvmrc` file is found, then the default (linked) version, if any, is used.
 */
function autoSwitchAsync(cwd) {
	if (process.env['NVS_EXECUTE']) {
		throw new Error(
			'The \'auto\' command is not available when ' +
			'invoking this script as an' + os.EOL +
			'executable. To enable PATH updates, source ' +
			'nvs.sh from your shell instead.');
	}

	return findAutoVersionAsync(cwd).then(version => {
		return nvsUse.use(version);
	});
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

	if (enable) {
		require('./postScript').generate(null, {
			'.PS1': [
				// Patch the function that is invoked every time PowerShell shows a prompt.
				// Export the function from the script using a dynamic module; this
				// does NOT require the script to be sourced.
				'if (-not $env:NVS_ORIGINAL_PROMPT) { ',
				'   $env:NVS_ORIGINAL_PROMPT = $(Get-Content function:\\prompt)',
				'}',
				'New-Module -Script {',
				'   function prompt { . "' + psScriptFile + '" "prompt" }',
				'   Export-ModuleMember -Function prompt',
				'} > $null',
			],
			'.SH': [
				'function cd () { builtin cd "$@" && nvs cd; }',
				'function pushd () { builtin pushd "$@" && nvs cd; }',
				'function popd () { builtin popd "$@" && nvs cd; }',
			],
		});
	} else {
		require('./postScript').generate(null, {
			'.PS1': [
				'if ($env:NVS_ORIGINAL_PROMPT) { ',
				'   New-Module -Script {',
				'      function prompt { Invoke-Expression $env:NVS_ORIGINAL_PROMPT }',
				'      Export-ModuleMember -Function prompt',
				'   } > $null',
				'}',
			],
			'.SH': [
				'function cd () { builtin cd "$@"; }',
				'function pushd () { builtin pushd "$@"; }',
				'function popd () { builtin popd "$@"; }',
			],
		});
	}
}

module.exports = {
	findAutoVersionAsync,
	autoSwitchAsync,
	enableAutoSwitch,
};
