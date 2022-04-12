// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');

const settings = require('./settings').settings;
const Error = require('./error');

let nvsUse = require('./use');
let nvsLink = require('./link');
let nvsPostScript = require('./postScript');
let nvsAuto = require('./auto');

const isMingwBash = nvsUse.isMingwBash;
const isWindows = nvsUse.isWindows;

function install() {
	let result = [];

	if (isWindows) {
		let nvsRoot = path.resolve(__dirname, '..');
		let envPath = process.env['PATH'];
		let envPathParts = envPath.split(';');
		if (!envPathParts.find(pathPart => {
			if (pathPart.endsWith(path.sep)) {
				pathPart = pathPart.substr(0, pathPart.length - 1);
			}
			return pathPart.toLowerCase() === nvsRoot.toLowerCase();
		})) {
			result.push('PATH += ' + nvsUse.homePath(nvsRoot));

			envPath = nvsRoot + ';' + envPath;
			nvsPostScript.generate({ 'PATH': envPath });
		}

		let isSystem = isInSystemDirectory();
		result = result.concat(nvsLink.linkToWindowsProfilePath(
			true, settings.home, isSystem));
	} else {
		let profileFile = getShellProfile();
		result = result.concat(installToShellProfile(profileFile));
	}

	return result;
}

function uninstall() {
	let result = [];

	nvsAuto.enableAutoSwitch(false);
	result = result.concat(nvsUse.use(null));
	result = result.concat(nvsLink.unlink());

	if (isWindows) {
		let nvsRoot = path.resolve(__dirname, '..');
		let envPath = process.env['PATH'];
		let envPathParts = envPath.split(';');
		let index = envPathParts.findIndex(pathPart => {
			if (pathPart.endsWith(path.sep)) {
				pathPart = pathPart.substr(0, pathPart.length - 1);
			}
			return pathPart.toLowerCase() === nvsRoot.toLowerCase();
		});
		if (index >= 0) {
			result.push('PATH -= ' + nvsUse.homePath(nvsRoot));

			envPathParts.splice(index, 1);
			envPath = envPathParts.join(';');
			nvsPostScript.generate({ 'PATH': envPath });
		}

		let isSystem = isInSystemDirectory();
		result = result.concat(nvsLink.linkToWindowsProfilePath(
			false, settings.home, isSystem));
	} else {
		let profileFile = getShellProfile();
		if (profileFile) {
			result = result.concat(uninstallFromShellProfile(profileFile));
		}
	}

	// TODO: Remove all versions?

	return result;
}

function getShellProfile() {
	const profileFile = process.env['NVS_SHELL_PROFILE'];

	if (profileFile) {
		return profileFile;
	}

	let fileExists = f => {
		try {
			fs.accessSync(f);
			return true;
		} catch (e) {
			Error.throwIfNot(Error.ENOENT, e);
		}
	};

	const shell = process.env['SHELL'];
	const shellName = shell && path.basename(shell);
	if (isInSystemDirectory()) {
		if (shellName === 'bash') {
			if (fileExists('/etc/bashrc')) return '/etc/bashrc';
		}

		if (fileExists('/etc/profile')) return '/etc/profile';
	} else {
		const userHome = process.env['HOME'];
		if (!userHome) return null;

		if (shellName === 'bash') {
			if (fileExists(path.join(userHome, '.bashrc'))) {
				return path.join(userHome, '.bashrc');
			} else if (fileExists(path.join(userHome, '.bash_profile'))) {
				return path.join(userHome, '.bash_profile');
			}
		} else if (shellName === 'zsh') {
			if (fileExists(path.join(userHome, '.zshrc'))) {
				return path.join(userHome, '.zshrc');
			}
		}

		if (fileExists(path.join(userHome, '.profile'))) {
			return path.join(userHome, '.profile');
		}

		if (isMingwBash) {
			if (fileExists(path.join(userHome, '.bashrc'))) {
				return path.join(userHome, '.bashrc');
			}
			if (fileExists(path.join(userHome, '.bash_profile'))) {
				return path.join(userHome, '.bash_profile');
			}
			// force create .bashrc for MINGW64
			return path.join(userHome, '.bashrc');
		}
	}

	return null;
}

function installToShellProfile(profileFile) {
	let rootPathAbs = path.resolve(__dirname, '..');
	let homePathAbs = path.resolve(settings.home);

	let rootPath = nvsUse.homePath(rootPathAbs).replace('~', '$HOME');
	let homePath = nvsUse.homePath(settings.home).replace('~', '$HOME');
	if (homePath.endsWith('/') || homePath.endsWith('\\')) {
		homePath = homePath.substr(0, homePath.length - 1);
	}

	if (rootPathAbs === homePathAbs) {
		rootPath = '$NVS_HOME';
	}

	const installLines = isMingwBash
		? [
			'function setupNvs {',
			'	export NVS_HOME="' + homePath + '";',
			'	[ -s "' + rootPath + '/nvs.sh" ] && source "' + rootPath + '/nvs.sh" >> /dev/null;',
			'	return 0;',
			'}',
			'setupNvs',
		]
		// normal POSIX shell
		: [
			'export NVS_HOME="' + homePath + '"',
			'[ -s "' + rootPath + '/nvs.sh" ] && . "' + rootPath + '/nvs.sh"',
		];

	if (!profileFile) {
		return [
			'Shell profile file not detected. To initialize NVS,',
			'add lines similar to the following to your profile:',
			'',
		].concat(installLines).concat(['']);
	}

	let profileContents = fs.existsSync(profileFile) ? fs.readFileSync(profileFile, 'utf8') : '';
	if (/\/nvs.sh/.test(profileContents)) {
		return [
			'NVS invocation detected already in profile file: ' +
				nvsUse.homePath(profileFile),
		];
	}

	let extraLine = profileContents.endsWith('\n') ? '' : '\n';
	profileContents += extraLine + installLines.join('\n') + '\n';
	fs.writeFileSync(profileFile, profileContents, 'utf8');

	return [ nvsUse.homePath(profileFile) + ' += nvs.sh' ];
}

function uninstallFromShellProfile(profileFile) {
	let profileContents = fs.readFileSync(profileFile, 'utf8');
	let nvsInvocationRegex = /(\n[^\n]*((NVS_HOME)|(\/nvs\.sh))[^\n]*)+\n/;
	let m = nvsInvocationRegex.exec(profileContents);
	if (m) {
		profileContents = profileContents.replace(nvsInvocationRegex, '\n');
		fs.writeFileSync(profileFile, profileContents, 'utf8');

		return [ nvsUse.homePath(profileFile) + ' -= nvs.sh' ];
	} else {
		return [
			'NVS invocation not detected in profile file: ' +
				nvsUse.homePath(profileFile),
		];
	}
}

/**
 * Checks whether NVS is installed in a user or system directory.
 * When installed in a system directory, special linking behavior is enabled.
 */
function isInSystemDirectory() {
	if (typeof settings.linkToSystem === 'boolean') {
		return settings.linkToSystem;
	}

	if (process.env['NVS_LINK_TO_SYSTEM']) {
		return process.env['NVS_LINK_TO_SYSTEM'] === '1';
	}

	let isHomeUnder = envDir => {
		if (!envDir) {
			return false;
		}

		if (!envDir.endsWith(path.sep)) {
			envDir += path.sep;
		}

		return settings.home.toLowerCase().startsWith(envDir.toLowerCase());
	};

	if (isWindows) {
		let userAppdataDir = process.env['LOCALAPPDATA'];
		let userProfileDir = process.env['USERPROFILE'];
		let progFilesDir = process.env['ProgramFiles'];
		let progFilesX86Dir = process.env['ProgramFiles(x86)'];
		let progDataDir = process.env['ProgramData'];

		if (isHomeUnder(userAppdataDir) || isHomeUnder(userProfileDir)) {
			return false;
		} else if (isHomeUnder(progFilesDir) || isHomeUnder(progFilesX86Dir) ||
			isHomeUnder(progDataDir)) {
			return true;
		}
	} else {
		let userHomeDir = process.env['HOME'];
		if (isHomeUnder(userHomeDir)) {
			return false;
		} else if (isHomeUnder('/usr/local/')) {
			return true;
		}
	}

	throw new Error('NVS_HOME is not under a well-known user or system directory. ' +
		'Set the "linkToSystem" property in settings.json to true or false to specify ' +
		'whether NVS should link to into system directories.');
}

module.exports = {
	install,
	uninstall,
	isInSystemDirectory,
};
