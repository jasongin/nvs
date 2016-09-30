/**
 * Generates a shell script to be invoked after the main (Node.js) script finishes.
 * The NVS shim shell scripts take care of invoking the generated script and
 * deleting it afterward.
 */
function generate(exportVars) {
    var envVars = Object.keys(exportVars || {});
    if (envVars.length > 0) {
        var postScriptLines = [];
        var postScriptFile = process.env['NVS_POSTSCRIPT'];
        var postScriptExtension = path.extname(postScriptFile).toUpperCase();
        if (postScriptExtension == '.CMD') {
            envVars.forEach(envVar => {
                postScriptLines.push('SET ' + envVar + '=' + exportVars[envVar]);
            });
        } else if (postScriptExtension == '.PS1') {
            envVars.forEach(envVar => {
                postScriptLines.push('$env:' + envVar + '  ="' + exportVars[envVar] + '"');
            });
        } else if (postScriptExtension == '.SH') {
            envVars.forEach(envVar => {
                postScriptLines.push('EXPORT ' + envVar + '  ="' + exportVars[envVar] + '"');
            });
        }

        fs.writeFileSync(postScriptFile, postScriptLines.join('\r\n') + '\r\n');
    }
}

module.exports = {
    generate,
};
