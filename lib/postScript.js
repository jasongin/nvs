const fs = require('fs');
const path = require('path');
const os = require('os');

const canUpdateEnv = !process.env['NVS_EXECUTE'];

/**
 * Generates a shell script to be invoked after the main (Node.js) script finishes.
 * The NVS shim shell scripts take care of invoking the generated script and
 * deleting it afterward.
 */
function generate(exportVars) {
    if (!canUpdateEnv) {
        // Don't throw an error; this allows commands like uninstall to
        // work even when they can't update PATH.
        console.warn('Warning: NVS cannot update PATH unless sourced from the shell.');
        return;
    }

    var envVars = Object.keys(exportVars || {});
    if (envVars.length > 0) {
        var postScriptLines = [];
        var postScriptFile = process.env['NVS_POSTSCRIPT'];
        if (!postScriptFile) {
            throw new Error('NVS_POSTSCRIPT environment variable not set.');
        }

        var postScriptExtension = path.extname(postScriptFile).toUpperCase();
        if (postScriptExtension === '.CMD') {
            envVars.forEach(envVar => {
                postScriptLines.push('SET ' + envVar + '=' + exportVars[envVar]);
            });
        } else if (postScriptExtension === '.PS1') {
            envVars.forEach(envVar => {
                postScriptLines.push('$env:' + envVar + '="' + exportVars[envVar] + '"');
            });
        } else if (postScriptExtension === '.SH') {
            envVars.forEach(envVar => {
                postScriptLines.push('export ' + envVar + '="' + exportVars[envVar] + '"');
            });
        }

        fs.writeFileSync(postScriptFile, postScriptLines.join(os.EOL) + os.EOL);
    }
}

module.exports = {
    generate,
};
