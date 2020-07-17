// NVS (node version switcher) main script

// @ts-check
'use strict';

const os = require('os');

const settings = require('./settings').settings;
const Error = require('./error');

const debug = process.env['NVS_DEBUG'];
if (debug) {
	process.on('unhandledRejection', printError);
}

main(process.argv.slice(2));

function main(args) {
	let result = null;
	try {
		result = doCommand(args);
	} catch (e) {
		printError(e);
		process.exitCode = process.exitCode || 1;
	}

	if (result) {
		if (typeof result === 'object' && result.then) {
			result.then(result => {
				printResult(result);
			}, e => {
				printError(e);
				process.exitCode = process.exitCode || 1;
			});
		} else {
			printResult(result);
		}
	}
}

function doCommand(args) {
	const parseVersion = require('./version').parse;

	if (args.length === 1) {
		switch (args[0]) {
			case '-h':
			case '/h':
			case '-?':
			case '/?':
			case '-help':
			case '/help':
			case '--help':
			case 'help':
				return require('./help')();

			case '-v':
			case '--version':
				const fs = require('fs');
				const path = require('path');
				const packageJson = fs.readFileSync(path.resolve(__dirname, '../package.json'));
				return JSON.parse(packageJson.toString()).version;
		}
	}

	// For compatibility with the VS Code node debugger, allow command-line options
	// before any commands. They will be forwarded to any invocation of node.
	let options = [];
	while (args[0] && args[0].startsWith('-')) {
		options.push(args[0]);
		args.splice(0, 1);
	}

	let help = null;
	if (args[0] === 'help' && args[1]) {
		help = require('./help');
		args = args.slice(1);
	}

	require('./settings').loadSettings();

	let version = null;
	switch (args[0]) {
		case undefined:
			if (settings.hideMenu) return require('./help')();
			else return require('./mainMenu').showMainMenuAsync();

		case 'setup':
		case 'install':
			if (help || args[1]) return require('./help')('setup');
			return require('./install').install();

		case 'uninstall':
			if (help || args[1]) return require('./help')('uninstall');
			return require('./install').uninstall();

		case 'which':
			if (help) return help('which');
			if (args[1]) {
				version = require('./list').find(parseVersion(args[1]));
				if (!version) {
					throw new Error('Specified version not found.' + os.EOL +
						'To add this version now: nvs add ' + version, Error.ENOENT);
				}
			} else {
				version = require('./use').getCurrentVersion();
			}
			return require('./use').getVersionBinary(version);

		case 'add':
			if (help) return help('add');
			if (!args[1]) {
				return require('./auto').findAutoVersionAsync();
			}
			version = parseVersion(args[1]);
			return require('./addRemove').addAsync(version);

		case 'rm':
		case 'remove':
			if (help) return help('remove');
			version = parseVersion(args[1]);
			return require('./addRemove').remove(version);

		case 'up':
		case 'upgrade':
			if (help) return help('upgrade');
			if (args[1]) {
				version = parseVersion(args[1]);
			}
			return require('./upgrade').upgradeAsync(version);

		case 'list':
		case 'ls': {
			if (help) return help('list');
			if (args[1]) {
				version = parseVersion(args[1]);
			}
			return require('./list').list(version);
		}

		case 'lr':
		case 'lsr':
		case 'ls-remote':
		case 'list-remote':
			if (help) return help('list-remote');
			if (args[1]) {
				version = parseVersion(args[1]);
			}
			return require('./list').listRemoteAsync(version);

		case 'outdated':
			return require('./list').listOutdatedAsync();

		case 'alias':
		case 'aliases':
			if (help) return help('alias');
			if (args[2] && args[1] === '-d') {
				return require('./settings').removeAlias(args[2]);
			} else if (args[2]) {
				return require('./settings').setAlias(args[1], args[2]);
			} else {
				return require('./settings').listAliases(args[1]);
			}

		case 'unalias':
			if (help) return help('alias');
			return require('./settings').removeAlias(args[1]);

		case 'remote':
		case 'remotes':
			if (help) return help('remote');
			if (args[1] === '-d' || args[1] === 'rm' || args[1] === 'remove') {
				return require('./settings').removeRemote(args[2]);
			} else if (args[1] === 'add' || args[1] === 'set') {
				return require('./settings').setRemoteAsync(args[2], args[3]);
			} else if (args[1] === 'ls' || args[1] === 'list') {
				return require('./settings').listRemotes();
			} else if (args[2]) {
				return require('./settings').setRemoteAsync(args[1], args[2]);
			} else {
				return require('./settings').listRemotes(args[1]);
			}

		case 'run':
			if (help) return help('run');
			if (args[1] && isJsFileOrDirectory(args[1])) {
				version = 'auto';
			} else {
				if (args[1] === 'default' || args[1] === 'auto') {
					version = args[1];
				} else {
					version = parseVersion(args[1]);
				}
				args.splice(1, 1);
			}

			version = version || 'auto';
			if (version === 'auto') {
				return require('./auto').findAutoVersionAsync().then(version => {
					return require('./use').run(version, options.concat(args.slice(1)));
				});
			} else {
				return require('./use').run(version, options.concat(args.slice(1)));
			}

		case 'exec':
			if (help) return help('exec');
			version = parseVersion(args[1]);
			return require('./use').exec(version, args[2], args.slice(3));

		case 'link':
		case 'ln':
			if (help) return help('link');
			if (args[1]) {
				version = parseVersion(args[1]);
			}
			return require('./link').link(version);

		case 'unlink':
		case 'ul':
			if (help) return help('unlink');
			if (args[1]) {
				version = parseVersion(args[1]);
			}
			return require('./link').unlink(version);

		case 'auto':
			if (help) return help('auto');
			if (!args[1]) {
				return require('./auto').autoSwitchAsync();
			} else {
				switch (args[1].toLowerCase()) {
					case 'at':
						return require('./auto').autoSwitchAsync(args[2]);
					case 'on':
					case 'enable':
						return require('./auto').enableAutoSwitch(true);
					case 'off':
					case 'disable':
						return require('./auto').enableAutoSwitch(false);
					default:
						return require('./help')('auto');
				}
			}

		case 'use':
			if (help) return help('use');
			if (args[1]) {
				if (args[1] === 'default' || args[1] === 'auto') {
					version = args[1];
				} else {
					version = parseVersion(args[1]);
				}
			}

			version = version || 'auto';
			if (version === 'auto') {
				return require('./auto').findAutoVersionAsync().then(version => {
					return require('./use').use(version);
				});
			} else {
				return require('./use').use(version);
			}

		case 'migrate':
			if (help) return help('migrate');
			version = parseVersion(args[1]);
			return require('./migrate').migrateGlobalModules(
				version,
				args[2] ? parseVersion(args[2]) : require('./use').getCurrentVersion()
			);

		case 'menu':
			if (help) return help('menu');
			return require('./mainMenu').showMainMenuAsync();

		case 'vscode':
			return require('./help')('vscode');

		default:
			if (!help) {
				if (isJsFileOrDirectory(args[0])) {
					// A .js file or directory was specified without any command.
					// Execute an implicit run command with auto-detected version.
					return require('./auto').findAutoVersionAsync().then(version => {
						return require('./use').run(version, options.concat(args));
					});
				} else if (args.slice(1).find(a => isJsFileOrDirectory(a))) {
					// A .js file or directory was specified after (presumably) a version specifier.
					// Execute an implicit run command with the specified version.
					if (args[0] === 'default' || args[0] === 'auto') {
						version = args[0];
					} else {
						version = parseVersion(args[0]);
					}

					if (version === 'auto') {
						return require('./auto').findAutoVersionAsync().then(version => {
							return require('./use').run(version, options.concat(args.slice(1)));
						});
					} else {
						return require('./use').run(version, options.concat(args.slice(1)));
					}
				} else {
					// No .js file or directory was specified. If a version specifier can be parsed
					// then execute an implicit use command with that version.
					if (args[0] === 'default' || args[0] === 'auto') {
						version = args[0];
					} else {
						version = require('./version').tryParse(args[0]);
					}
					if (version) {
						if (version === 'auto') {
							return require('./auto').findAutoVersionAsync().then(version => {
								return require('./use').use(version);
							});
						} else {
							return require('./use').use(version);
						}
					}
				}
			}

			return require('./help')();
	}
}

function isJsFileOrDirectory(arg) {
	if (!arg) {
		return false;
	} else if (arg.startsWith('-')) {
		return false;
	} else if (/\.js$/i.test(arg)) {
		return true;
	}

	try {
		let stats = require('fs').statSync(arg);
		if (stats.isDirectory()) {
			return true;
		}
	} catch (e) {}
	return false;
}

function printResult(result) {
	if (Array.isArray(result)) {
		result = result.join(os.EOL);
	}
	if (result) {
		try {
			console.log(result);
		} catch (e) {
			// Ignore errors due to the stdout stream getting closed early.
		}
	}
}

function printError(e) {
	if (e) {
		let isPermissionError = (e.code === 'EPERM' || e.code === 'EACCES');
		console.error(debug ? e.stack || e.message : e.message);
		while (e.cause) {
			e = e.cause;
			console.error(debug ? e.stack || e.message : e.message);
		}
		if (isPermissionError) {
			if (process.platform === 'win32') {
				console.error('Try running again as Administrator.');
			} else if (!process.env['NVS_EXECUTE']) {
				console.error('Try running again with sudo:\n  ' +
					'nvsudo ' + process.argv.slice(2).join(' '));
			} else {
				console.error('Try running again with sudo.');
			}
		}
	}
}
