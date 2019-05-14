'use strict';

const childProcess = require('child_process');
const path = require('path');
let test = require('ava').default;

const nvsRootDir = path.resolve(__dirname, '..', '..');
const testParentDir = path.resolve(__dirname, '..', 'temp');
const testDir = path.join(testParentDir, 'git-bash');

const testNodeVersion = '8.5.0';
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

test('Git Bash CLI', t => {
	const commands = [
		'echo $NVS_HOME',
		'. ./nvs.sh',
		'nvs lsr 8',
		'nvs add ' + testNodeVersion,
		'nvs link ' + testNodeVersion,
		'nvs use',
		'echo $PATH',
		'node -v',
		// `npm install -g npm` doesn't work in Git bash, because the `npm` script file
		// (being executed) is locked while the npm install process tries to update it.
		// The workaround is to run the command via cmd.exe outside of bash.
		`cmd "/C npm install -g npm@${testNpmVersion}"`,
		'npm -v',
		'nvs unlink',
		'rm -rf $NVS_HOME',
	];
	for (let i = commands.length - 1; i >= 0; i--) {
		// Print each command before executing it.
		commands.splice(i, 0, 'echo \\> ' + commands[i].replace('$', '\\$'));
	}

	const gitBashExe = path.join(process.env['ProgramFiles'], 'Git', 'bin', 'bash.exe');
	const result = childProcess.spawnSync(
		gitBashExe,
		[ '-c', commands.join('; ') ],
		{
			env: {
				'NVS_HOME': testDir,
				'NVS_LINK_TO_SYSTEM': '0',
				'NVS_DEBUG': '1',
				'ProgramFiles': process.env['ProgramFiles'],
			},
			cwd: nvsRootDir,
		});
	const output = result.stdout.toString().trim().replace(/\r\n/g, '\n');
	t.regex(output, new RegExp('\n> node -v *\nv' + testNodeVersion + ' *\n', 'm'));
	t.regex(output, new RegExp('\n> npm -v *\n' + testNpmVersion + ' *\n', 'm'));
});
