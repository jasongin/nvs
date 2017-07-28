// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const canUpdateEnv = !process.env['NVS_EXECUTE'];

// Lines may be accumulated across multiple calls to generate().
let postScriptLines = [];

/**
 * Generates a shell script to be invoked after the main (Node.js) script finishes.
 * The NVS shim shell scripts take care of invoking the generated script and
 * deleting it afterward.
 */
function generate(exportVars, additionalLines) {
	if (!canUpdateEnv) {
		// Don't throw an error; this allows commands like uninstall to
		// work even when they can't update PATH.
		console.warn('Warning: NVS cannot update PATH unless sourced from the shell.');
		return;
	}

	let envVars = Object.keys(exportVars || {});
	let postScriptFile = process.env['NVS_POSTSCRIPT'];
	if (!postScriptFile) {
		throw new Error('NVS_POSTSCRIPT environment variable not set.');
	}

	let postScriptExtension = path.extname(postScriptFile).toUpperCase();
	if (postScriptExtension === '.CMD') {
		envVars.forEach(envVar => {
			if (exportVars[envVar] !== null) {
				postScriptLines.push('SET ' + envVar + '=' + exportVars[envVar]);
			} else {
				postScriptLines.push('SET ' + envVar + '=');
			}
		});
	} else if (postScriptExtension === '.PS1') {
		envVars.forEach(envVar => {
			if (exportVars[envVar] !== null) {
				postScriptLines.push('$env:' + envVar + '="' + exportVars[envVar] + '"');
			} else {
				postScriptLines.push('Remove-Item env:' + envVar + ' -ErrorAction SilentlyContinue');
			}
		});
	} else if (postScriptExtension === '.SH') {
		envVars.forEach(envVar => {
			let value = exportVars[envVar];
			if (value !== null) {
				if (process.platform === 'win32' && /PATH/i.test(envVar)) {
					value = require('./windowsEnv').windowsPathListToPosixPathList(value);
				}

				postScriptLines.push('export ' + envVar + '="' + value + '"');
			} else {
				postScriptLines.push('unset ' + envVar);
			}
		});
	}

	if (additionalLines && additionalLines[postScriptExtension]) {
		postScriptLines = postScriptLines.concat(additionalLines[postScriptExtension]);
	}

	if (postScriptLines.length > 0) {
		fs.writeFileSync(postScriptFile, postScriptLines.join(os.EOL) + os.EOL);
	}
}

module.exports = {
	generate,
};
