// @ts-check
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Error = require('./error');

const canUpdateEnv = !process.env['NVS_EXECUTE'];

/**
 * Show help for a topic, or a summary of all help topics.
 *
 * @param {string} [topic]
 */
function help(topic) {
	if (!process.exitCode) process.exitCode = 127;

	if (topic) {
		let helpFile = path.join(__dirname,
			'../doc/' + topic.toUpperCase() + '.md');
		let helpText;
		try {
			helpText = fs.readFileSync(helpFile, 'utf8');
		} catch (e) {
			Error.throwIfNot(Error.ENOENT, e, 'Failed to read help file: ' + helpFile);
		}

		if (helpText) {
			helpText = helpText.replace(/```[\w+-]*/g, '');
			helpText = wrapLines(helpText, process.stdout.columns);
			return helpText;
		}
	}

	return [
		'NVS (Node Version Switcher) usage',
		'',
		'nvs help <command>             Get detailed help for a command',
		'nvs install                    Initialize your profile for using NVS',
		'nvs --version                  Display the NVS tool version',
		'',
		'nvs menu                       Launch an interactive menu',
		'',
		'nvs add <version>              Download and extract a node version',
		'nvs rm <version>               Remove a node version',
		'nvs migrate <fromver> [tover]  Migrate global modules',
		'nvs upgrade [fromver]          Upgrade to latest patch of major version',
		'',
		'nvs use [version]              ' + (canUpdateEnv
			? 'Use a node version in the current shell'
			: '(Not available, source nvs.sh instead)'),
		'nvs auto [on/off]              ' + (canUpdateEnv
			? 'Automatically switch based on cwd'
			: '(Not available, source nvs.sh instead)'),
		'nvs run <ver> <js> [args...]   Run a script using a node version',
		'nvs exec <ver> <exe> [args...] Run an executable using a node version',
		'nvs which [version]            Show the path to a node version binary',
		'',
		'nvs ls [filter]                List local node versions',
		'nvs ls-remote [filter]         List node versions available to download',
		'nvs outdated                   List local node versions and available udates',
		'',
		'nvs link [version]             Link a version as the default',
		'nvs unlink [version]           Remove links to a default version',
		'',
		'nvs alias [name] [value]       Set or recall aliases for versions',
		'nvs remote [name] [uri]        Set or recall download base URIs',
		'',
		'A version string consists of a semantic version number or version label',
		'("lts" or "latest"), optionally preceeded by a remote name, optionally',
		'followed by an architecture, separated by slashes.',
		'Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64"',
		'Aliases may also be used anywhere in place of a version string.',
		'',
	].join(os.EOL);
}

function wrapLines(text, columns) {
	let lines = text.split(/\r?\n/);

	if (columns > 0) {
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			if (line.length > columns) {
				let nextLine;
				let wrapIndex = line.lastIndexOf(' ', columns - 1);
				if (wrapIndex > 0) {
					nextLine = line.substr(wrapIndex + 1);
					line = line.substr(0, wrapIndex);
				} else {
					nextLine = line.substr(columns);
					line = line.substr(0, columns);
				}
				lines.splice(i, 1, line, nextLine);
			}
		}
	}

	return lines.join(os.EOL);
}

module.exports = help;
