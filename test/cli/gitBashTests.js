'use strict';

const childProcess = require('child_process');
const path = require('path');
let test = require('ava').default;

const nvsRootDir = path.resolve(__dirname, '..', '..');
const testParentDir = path.resolve(__dirname, '..', 'temp');
const testDir = path.join(testParentDir, 'git-bash');
const shellProfileFile = path.join(testParentDir, '.shell_profile');

const testNodeVersion = '10.24.1';
const testNpmVersion = '6.4.1';

test.before(t => {
	require('../fsUtil').createDirectoryIfNotFound(testParentDir);
});

test.after.always(t => {
	require('../fsUtil').removeDirectoryIfEmpty(testParentDir);
});

if (process.platform !== 'win32') {
	test = test.skip;
}

function runInGitBash(commands, nvsHome) {
	for (let i = commands.length - 1; i >= 0; i--) {
		// Print each command before executing it.
		commands.splice(i, 0, 'echo \\> ' + commands[i].replace('$', '\\$'));
	}

	// source rc file
	commands.unshift('[ -s "' + shellProfileFile + '" ] && source "' + shellProfileFile + '"');

	const gitBashExe = path.join(process.env['ProgramFiles'], 'Git', 'bin', 'bash.exe');
	const result = childProcess.spawnSync(
		gitBashExe,
		[ '-c', commands.join('; ') ],
		{
			env: {
				'NVS_HOME': nvsHome,
				'NVS_LINK_TO_SYSTEM': '0',
				'NVS_DEBUG': '1',
				'ProgramFiles': process.env['ProgramFiles'],
				'NVS_SHELL_PROFILE': shellProfileFile,
			},
			cwd: nvsRootDir,
		});
	return result;
}

test('Git Bash CLI', t => {
	const result = runInGitBash([
		'echo $NVS_HOME',
		'. ./nvs.sh',
		'nvs lsr 10',
		'nvs add ' + testNodeVersion,
		'nvs link ' + testNodeVersion,
		'nvs use',
		'node -v',
		// `npm install -g npm` doesn't work in Git bash, because the `npm` script file
		// (being executed) is locked while the npm install process tries to update it.
		// The workaround is to run the command via cmd.exe outside of bash.
		`cmd "/C npm install -g npm@${testNpmVersion}"`,
		'echo $PATH',
		'npm -v',
		'nvs unlink',
	], testDir);

	const output = result.stdout.toString().trim().replace(/\r\n/g, '\n');
	t.regex(output, new RegExp('\n> node -v *\nv' + testNodeVersion + ' *\n', 'm'));
	t.regex(output, new RegExp('\n> npm -v *\n' + testNpmVersion + ' *\n', 'm'));
});

test('Git Bash CLI - nvs install', t => {
	const result = runInGitBash([
		'. ./nvs.sh install',
		'nvs add ' + testNodeVersion,
		'nvs link ' + testNodeVersion,
		'nvs use',
		'node -v',
	], nvsRootDir);

	const output = result.stdout.toString().trim().replace(/\r\n/g, '\n');
	t.regex(output, new RegExp('\n> node -v *\nv' + testNodeVersion + ' *', 'm'));

	const testNodeVersion14 = '14.15.4';

	const resultAfterInstall = runInGitBash([
		'nvs add ' + testNodeVersion14,
		'nvs link ' + testNodeVersion14,
		'nvs use ' + testNodeVersion14,
		'echo $PATH',
		'node -v',
		'nvs unlink',
	], nvsRootDir);

	const outputInstall = resultAfterInstall.stdout.toString().trim().replace(/\r\n/g, '\n');
	t.regex(outputInstall, new RegExp('\n> node -v *\nv' + testNodeVersion14 + ' *\n', 'm'));
});
