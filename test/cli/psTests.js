'use strict';

const childProcess = require('child_process');
const path = require('path');
let test = require('ava').default;

const nvsRootDir = path.resolve(__dirname, '..', '..');
const testParentDir = path.resolve(__dirname, '..', 'temp');
const testDir = path.join(testParentDir, 'ps');

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

test('PowerShell CLI', t => {
	const commands = [
		'echo $env:NVS_HOME',
		'.\\nvs.ps1 lsr 8',
		'.\\nvs.ps1 add ' + testNodeVersion,
		'.\\nvs.ps1 link ' + testNodeVersion,
		'.\\nvs.ps1 use',
		'echo $env:PATH',
		'node -v',
		'npm install -g npm@' + testNpmVersion,
		'npm -v',
		'.\\nvs.ps1 unlink',
		'Remove-Item -Recurse -Force $env:NVS_HOME',
	];
	for (let i = commands.length - 1; i >= 0; i--) {
		// Print each command before executing it.
		commands.splice(i, 0, 'echo \'> ' + commands[i] + '\'');
	}

	const result = childProcess.spawnSync(
		'cmd.exe',
		[ '/c', 'powershell.exe', '-NoLogo', '-Command', '& {' + commands.join('; ') + '}' ],
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
