// @ts-check
'use strict';

let fs = require('fs');  // Non-const enables test mocking
const os = require('os');
const path = require('path');
const Error = require('./error');

const settings = {};

function getHomeDir() {
	let homeDir = process.env['NVS_HOME'];
	if (!homeDir) {
		homeDir = path.resolve(path.join(__dirname, '..'));
	} else if (process.platform === 'win32' && homeDir && homeDir.indexOf('/') >= 0) {
		homeDir = require('./windowsEnv').posixPathToWindowsPath(homeDir);
	}

	if (!homeDir.endsWith(path.sep)) {
		homeDir += path.sep;
	}

	return homeDir;
}

/**
 * Loads settings from $NVS_HOME/settings.json. If the file is not present,
 * it is created using a copy of defaults.json.
 */
function loadSettings() {
	let homeDir = getHomeDir();
	let settingsFile = path.join(homeDir, 'settings.json');

	const defaultSettings = require('../defaults.json');
	Object.keys(defaultSettings).forEach(key => {
		settings[key] = defaultSettings[key];
	});

	try {
		const loadedSettings = JSON.parse(fs.readFileSync(settingsFile).toString());
		Object.keys(loadedSettings).forEach(key => {
			settings[key] = loadedSettings[key];
		});
	} catch (e) {
		if (e.code === Error.ENOENT) {
			// Save a copy of the defaults where the user can edit it.
			settings.home = homeDir;
			try {
				saveSettings();
			} catch (e) {
				// Don't complain about no permissions when initializing settings.
				if (e.code !== Error.EPERM && e.code !== Error.EACCES) {
					throw e;
				}
			}
		} else {
			throw new Error('Failed to read settings file: ' +
				settingsFile, e);
		}
	}

	settings.aliases = settings.aliases || {};
	settings.remotes = settings.remotes || {};
	settings.home = homeDir;
	settings.cache = path.join(homeDir, 'cache');
}

/**
 * Saves settings to $NVS_HOME/settings.json.
 */
function saveSettings() {
	// Don't persist these properties.
	let homeDir = settings.home;
	let cacheDir = settings.cache;
	delete settings.home;
	delete settings.cache;
	delete settings.bootstrap;

	let settingsFile = path.join(homeDir, 'settings.json');
	try {
		if (!fs.existsSync(homeDir)) {
			fs.mkdirSync(homeDir);
		}

		fs.writeFileSync(settingsFile, JSON.stringify(settings, null, '\t'));
	} catch (e) {
		throw new Error('Failed to write settings file: ' +
			settingsFile, e);
	} finally {
		settings.home = homeDir;
		settings.cache = cacheDir;
	}
}

function setAlias(name, value) {
	if (!name || !value) {
		throw new Error('An alias name and value are required.');
	}

	if (name.toLowerCase() === 'default') {
		throw new Error('A default alias is not supported. Use the `nvs link` command to ' +
			'set a default node version.');
	}

	if (path.isAbsolute(value)) {
		// Enable creating an alias that points to a locally-built node binary.
		let exe = (process.platform === 'win32' ? 'node.exe' : 'node');
		try {
			fs.accessSync(path.join(value, exe), fs.constants.X_OK);
		} catch (e) {
			Error.throwIfNot(Error.ENOENT, e);
			throw new Error('Invalid node build directory target. Specify an absolute path to ' +
				'a directory containing a ' + exe + ' executable.');
		}
	} else {
		let version = require('./version').parse(value);
		let versionPart = (version.label || version.semanticVersion);
		if (value === versionPart) {
			value = 'default/' + value;
		} else if (!(value === version.remoteName + '/' + versionPart)) {
			throw new Error('Invalid alias target. Specify a semantic version, ' +
				'optionally preceded by a remote name.');
		}
	}

	settings.aliases[name] = value;
	saveSettings();
}

function removeAlias(name) {
	if (!name) {
		throw new Error('Specify an alias name.');
	}

	delete settings.aliases[name];
	saveSettings();
}

function listAliases(name) {
	if (name) {
		return settings.aliases[name];
	}

	let names = Object.keys(settings.aliases);
	let columnWidth = names
		.map(item => item.length)
		.reduce((a, b) => a > b ? a : b, 0) + 2;

	return names
		.sort()
		.map(name => {
			let value = settings.aliases[name];
			return name + ' '.repeat(columnWidth - name.length) + value;
		}).join(os.EOL);
}

function setRemoteAsync(name, uri) {
	if (!name || !uri) {
		throw new Error('Specify a remote name and URI to add.');
	}

	if (name === 'default') {
		if (!settings.remotes[uri]) {
			throw new Error(
				'Remote default target name does not exist: ' + uri);
		}
	} else {
		// TODO: Validate URI by downloading the index
	}

	settings.remotes[name] = uri;
	saveSettings();

	return Promise.resolve();
}

function removeRemote(name) {
	if (!name) {
		throw new Error('Specify a remote name to remove.');
	}
	if (name === 'default') {
		throw new Error('The default remote pointer cannot be deleted.');
	} else if (settings.remotes['default'] === name) {
		throw new Error('The \'' + name + '\' remote is currently set as the ' +
			'default.' + os.EOL + 'Switch the default to another ' +
			'before deleting this one.');
	}

	delete settings.remotes[name];
	saveSettings();
}

function listRemotes(name) {
	if (name) {
		let value = settings.remotes[name];
		return name === 'default'
			? value + '  ' + settings.remotes[value] : value;
	}

	let names = Object.keys(settings.remotes);
	let columnWidth = names
		.map(item => item.length)
		.reduce((a, b) => a > b ? a : b, 0) + 2;

	return names
		.sort((a, b) => a === 'default' ? -1 : b === 'default' ? 1 : a < b ? -1 : 1)
		.map(name => {
			let uri = settings.remotes[name];
			return name + ' '.repeat(columnWidth - name.length) + uri;
		}).join(os.EOL);
}

module.exports = {
	settings,
	loadSettings,
	saveSettings,
	setAlias,
	removeAlias,
	listAliases,
	setRemoteAsync,
	removeRemote,
	listRemotes,
};
