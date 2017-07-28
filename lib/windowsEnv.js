// @ts-check
'use strict';

const childProcess = require('child_process');
const Error = require('./error');

const userEnvRegKey = 'HKCU\\Environment';
const systemEnvRegKey =
	'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment';
const queryRegex = /^ *\w+ +REG(_EXPAND)?_SZ *([^ ].*)$/;

/**
 * Gets an environment variable from the user or system profile.
 */
function getEnvironmentVariable(name, isSystem) {
	let regKey = (isSystem ? systemEnvRegKey : userEnvRegKey);
	let regLabel = (isSystem ? 'system' : 'user');

	// Allow any variable to be expandable or not. PATH is usually expandable,
	// and most other variables are usually not.
	let regValueTypes = (/path/i.test(name)
		? ['REG_EXPAND_SZ', 'REG_SZ'] : ['REG_SZ', 'REG_EXPAND_SZ']);

	let value = null;
	for (let i = 0; i < regValueTypes.length && !value; i++) {
		// While it is possible to omit the type with `reg query`, in that case not finding
		// the value results in an error exit code, which is undesirable here.
		let child = childProcess.spawnSync(
			'reg.exe',
			[ 'QUERY', regKey, '/V', name, '/T', regValueTypes[i] ],
			{ stdio: 'pipe' });
		if (child.error) {
			throw new Error('Failed to read from ' + regLabel + ' registry.', child.error);
		}

		let output = child.stdout.toString().trim().split(/\r?\n/);
		let match = queryRegex.exec(output[1]);
		value = (match ? match[2] : null);
	}

	return value;
}

/**
 * Sets an environment variable in the user or system profile.
 */
function setEnvironmentVariable(name, value, isSystem) {
	let regKey = (isSystem ? systemEnvRegKey : userEnvRegKey);
	let regLabel = (isSystem ? 'system' : 'user');
	let regValueType = ((/path/i.test(name) || /%/.test(value)) ? 'REG_EXPAND_SZ' : 'REG_SZ');

	let args = (value !== null
		? ['ADD', regKey, '/V', name, '/T', regValueType, '/D', value, '/F']
		: ['DELETE', regKey, '/V', name, '/F']);

	let child = childProcess.spawnSync('reg.exe', args, { stdio: 'pipe' });
	if (child.error) {
		throw new Error('Failed to write to ' + regLabel + ' registry.', child.error);
	} else if (child.status) {
		let message = child.stderr.toString().trim().replace(/^ERROR: */, '') ||
			'Reg.exe exited with code: ' + child.status;
		let code = (/denied/.test(message) ? 'EPERM' : undefined);
		throw new Error('Failed to write to ' + regLabel + ' registry key: ' + regKey,
			new Error(message, code));
	}

	// Use SETX.EXE to set TEMP to the same value it already has.
	// The desired effect is just the broadcast of the settings-changed
	// message, so that new command windows will pick up the changes.
	// SETX.EXE isn't used to directly set variables because it
	// has an unfortunate 1024-character limit.
	let tempValue = getEnvironmentVariable('TEMP', isSystem);
	child = childProcess.spawnSync(
		'setx.exe',
		(isSystem ? ['TEMP', tempValue, '/M'] : ['TEMP', tempValue]),
		{ stdio: 'ignore' });
	if (child.error) {
		throw new Error('Failed broadcast ' + regLabel + ' environment change.',
			child.error);
	} else if (child.status) {
		throw new Error('Failed broadcast ' + regLabel + ' environment change.',
			new Error('Setx.exe exited with code: ' + child.status));
	}
}

/**
 * Transforms a posix-style path to a Windows-style path. For Git bash support.
 */
function posixPathToWindowsPath(path) {
	if (/^\/[a-z]\//i.test(path)) {
		path = path.substr(1, 1).toUpperCase() + ':' + path.substr(1);
	}
	return path.replace(/\//g, '\\');
}

/**
 * Transforms a Windows-style path to a posix-style path. For Git bash support.
 */
function windowsPathToPosixPath(path) {
	if (/^([A-Z]):\\/i.test(path)) {
		path = '/' + path.substr(0, 1).toLowerCase() + path.substr(2);
	}
	return path.replace(/\\/g, '/');
}

/**
 * Transforms a semicolon-delimited list of Windows-style paths to already
 * colon-delimited list of posix-style paths. For Git bash support.
 */
function windowsPathListToPosixPathList(pathList) {
	return pathList.split(';').map(windowsPathToPosixPath).join(':');
}

module.exports = {
	getEnvironmentVariable,
	setEnvironmentVariable,
	posixPathToWindowsPath,
	windowsPathToPosixPath,
	windowsPathListToPosixPathList,
};
