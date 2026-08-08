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
	/**
	 * Reads and parses the package.json to find devEngines or Volta object.
	 *
	 * @param  {string} directory      Current working path
	 * @param  {string} versionString  The Node version if already found
	 * @return {string}                Updated versionString
	 */
	function findDevEnginesOrVolta(directory, versionString) {
		/**
		 * Reads in the package.json and parse it to the JSON manifest.
		 *
		 * @param  {string} directory  Current working path to look for package.json in
		 * @return {object}            The parsed manifest
		 */
		function getManifest(directory) {
			let manifest;
			if (directory) {
				let manifestFile = path.join(directory, 'package.json');
				try {
					if (fs.existsSync(manifestFile)) {
						manifest = fs.readFileSync(manifestFile, 'utf8');
						manifest = JSON.parse(manifest);
					}
				} catch (error) {
					Error.throwIfNot(Error.ENOENT, error, 'Failed to read file: ' + manifestFile);
				}
			}
			return manifest;
		}

		if (directory && !versionString) {
			const manifest = getManifest(directory);
			if (manifest) {
				if (
					manifest.devEngines &&
					manifest.devEngines.runtime
				) {
					// Future proofing: Spec mentions runtime shorthand may be added later
					if (typeof(manifest.devEngines.runtime) === 'string') {
						versionString = manifest.devEngines.runtime;
					} else if (
						manifest.devEngines.runtime.name &&
						manifest.devEngines.runtime.name === 'node' &&
						manifest.devEngines.runtime.version
					) {
						versionString = manifest.devEngines.runtime.version;
					}
				}
				if (
					!versionString &&
					manifest.volta &&
					manifest.volta.node
				) {
					versionString = manifest.volta.node;
				}
			}
		}
		return versionString;
	}
	/**
	 * Get the Node version from files that only store it, like
	 * .nvmrc or .node-version.
	 *
	 * @param  {string} directory      Current working path
	 * @param  {string} versionString  The Node version if already found
	 * @param  {string} fileName       The file to open ('.nvmrc', '.node-version')
	 * @return {string}                Updated versionString
	 */
	function findVersionFile(directory, versionString, fileName) {
		if (directory && !versionString) {
			let versionFile = path.join(directory, fileName);
			try {
				if (fs.existsSync(versionFile)) {
					versionString = fs.readFileSync(versionFile, 'utf8').trim();
				}
			} catch (error) {
				Error.throwIfNot(Error.ENOENT, error, 'Failed to read file: ' + versionFile);
			}
		}
		return versionString;
	}
	/**
	 * Get the Node version from the .node-version file.
	 *
	 * @param  {string} directory      Current working path
	 * @param  {string} versionString  The Node version if already found
	 * @return {string}                Updated versionString
	 */
	function findDotNodeVersion(directory, versionString) {
		return findVersionFile(directory, versionString, '.node-version');
	}
	/**
	 * Get the Node version from the .nvmrc file.
	 *
	 * @param  {string} directory      Current working path
	 * @param  {string} versionString  The Node version if already found
	 * @return {string}                Updated versionString
	 */
	function findDotNvmrc(directory, versionString) {
		if (!settings.disableNvmrc) {
			return findVersionFile(directory, versionString, '.nvmrc');
		}
		return versionString;
	}
	/**
	 * Gets the Node version from the Mise or Proto TOML file.
	 *
	 * @param  {string}         directory      Current working path
	 * @param  {string}         versionString  The Node version if already found
	 * @param  {'mise'|'proto'} toolName       Which Tool is the TOML file associated with
	 * @return {string}                        Updated versionString
	 */
	function getNodeVersionFromTomlFile(directory, versionString, toolName) {
		if (!directory || versionString) {
			return versionString;
		}
		/**
		 * Converts CRLF and CR line endings to LF.
		 *
		 * @param  {string} contents  Any text
		 * @return {string}           The same text with normalized LF line-endings
		 */
		function normalizeLineEndings(contents) {
			// convert all line endings to LF
			return contents
			// CRLF => LF
				.split('\r\n').join('\n')
			// CR => LF
				.split('\r').join('\n');
		}
		/**
		 * Manually extracts the Node version number defined in the TOML file.
		 * @param  {string} contents  The contents of the TOML file
		 * @return {string}           The Node version number, '24.0.0'
		 */
		function findNodeVersionInToml(contents) {
			// Break up TOML file contents to lines
			const lines = contents.split('\n');
			// Find the first line with 'node = "24.0.0"'
			let nodeLine = lines.filter((line) => {
				return (
					line.includes('node=') ||
					line.includes('node =')
				);
			})[0] || '';
			// ' "24.0.0"'
			let nodeVersion = nodeLine.split('=')[1] || '';
			// ' "24.0.0"' => '24.0.0'
			nodeVersion = nodeVersion
				.split('"').join('')
				.split('\'').join('')
				.trim();
			// '24.0.0' || ''
			return nodeVersion;
		}
		/**
		 * Tries to read in the file contents for a TOML file and normalize it.
		 *
		 * @param  {string} directory  Current working path
		 * @param  {string} fileName   The name of the file to read in the directory
		 * @return {string}            The normalized file contents
		 */
		function readTheTomlContents(directory, fileName) {
			let contents = '';
			let versionFile = path.join(directory, fileName);
			try {
				if (fs.existsSync(versionFile)) {
					contents = fs.readFileSync(versionFile, 'utf8');
					contents = normalizeLineEndings(contents);
					contents = contents.toLowerCase();
					contents = contents.trim();
				}
			} catch (error) {
				Error.throwIfNot(Error.ENOENT, error, 'Failed to read file: ' + versionFile);
			}
			return contents;
		}
		/**
		 * Reads in the .prototools file contents and extracts the Node version from it.
		 *
		 * @param  {string} directory      Current working path
		 * @param  {string} versionString  The Node version if already found
		 * @return {string}                Updated versionString
		 */
		function findDotPrototools(directory, versionString) {
			let contents = readTheTomlContents(directory, '.prototools');
			versionString = findNodeVersionInToml(contents) || versionString;
			return versionString;
		}
		/**
		 * Reads in the mise.toml file contents and extracts the Node version from it.
		 *
		 * @param  {string} directory      Current working path
		 * @param  {string} versionString  The Node version if already found
		 * @return {string}                Updated versionString
		 */
		function findMiseDotToml(directory, versionString) {
			let contents = readTheTomlContents(directory, 'mise.toml');
			// Remove everything before the tools section
			contents = contents.split('[tools]')[1] || '';
			// Remove everything after the tools section
			contents = contents.split('[')[0] || '';
			versionString = findNodeVersionInToml(contents);
			return versionString;
		}

		const toolNameMap = {
			proto: findDotPrototools,
			mise: findMiseDotToml
		};
		if (toolNameMap[toolName]) {
			return toolNameMap[toolName](directory, versionString);
		}
		return versionString;
	}
	while (dir) {
		/**
		 * Attempt to find a Node version in various locations,
		 * once found, skip all subsequent checks. DevEngines
		 * is the official standardized location and should be
		 * prefererred over all other options.
		 */
		let versionString;
		versionString = findDevEnginesOrVolta(dir, versionString);
		versionString = findDotNodeVersion(dir, versionString);
		versionString = findDotNvmrc(dir, versionString);
		versionString = getNodeVersionFromTomlFile(dir, versionString, 'proto');
		versionString = getNodeVersionFromTomlFile(dir, versionString, 'mise');

		if (versionString) {
			try {
				version = NodeVersion.parse(versionString);
				version.arch = version.arch || version.defaultArch;
				break;
			} catch (error) {
				throw new Error('Failed to parse version', error);
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
				// This does NOT require the script to be sourced.
				'if (-not $global:NVS_ORIGINAL_PROMPT) {',
				'  $global:NVS_ORIGINAL_PROMPT = $Function:prompt',
				'}',
				'function global:prompt {',
				'  # We have to do this so a prompt customization tool (like Oh My Posh or Starship) can get',
				'  # the correct last command execution status and native command return code.',
				'  $global:NVS_ORIGINAL_LASTEXECUTIONSTATUS = $?',
				'  $originalExitCode = $global:LASTEXITCODE',
				'  . "' + psScriptFile + '" "prompt"',
				'  $global:LASTEXITCODE = $originalExitCode',
				'  $global:NVS_ORIGINAL_PROMPT.Invoke()',
				'}',
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
				'if ($global:NVS_ORIGINAL_PROMPT) {',
				'  $Function:prompt = $global:NVS_ORIGINAL_PROMPT',
				'  Remove-Variable -Name @("NVS_ORIGINAL_PROMPT", "NVS_ORIGINAL_LASTEXECUTIONSTATUS") -Scope global',
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
