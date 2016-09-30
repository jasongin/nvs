var isWindows = process.platform === "win32";
var isMac = process.platform === "darwin";

var homeDir = function () {
    var homeDir = process.env['NVS_HOME'];
    if (!homeDir) {
        if (isWindows) {
            homeDir = path.join(process.env['APPDATA'], 'nvs');
        } else {
            homeDir = path.join(process.env['HOME'], '.nvs');
        }
        if (!fs.existsSync(homeDir)) {
            fs.mkdirSync(homeDir);
        }
    }
    return homeDir;
}();

function use(version) {
    // TODO: Update the environment path to include the specified version.
}

function run(version, args) {
    // TODO: Run the version of node.exe with the args.
}

function setDefault(version) {
    // TODO: create/update a linked directory to the specified version,
    // or the current environment version if no vesion was specified.
    // Also update the user path (not environment path) to include that version.
}

function getPath(version) {
    // TODO: Get the path to the specified version's bin directory,
    // or the current version if the version arg is not specified.
}

module.exports = {
    isWindows,
    isMac,
    homeDir,
    use,
    run,
    setDefault,
    getPath,
};
