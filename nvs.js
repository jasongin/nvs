// NVS (node version switcher) main script

const fs = require('fs');
const path = require('path');

var args = process.argv.slice(2);
switch (args[0]) {
    case "-v":
    case "--version": showVersion(); break;
    case "+":
    case "add":
    case "install": install(args[1]); break;
    case "-":
    case "rm":
    case "remove":
    case "uninstall": uninstall(args[1]); break;
    case "use": use(args[1]); break;
    case "r":
    case "run": run(); break;
    case "l":
    case "ls":
    case "ls-installed": listInstalled(); break;
    case "la":
    case "lr":
    case "ls-available":
    case "ls-remote": listAvailable(); break;
    case "which": showPath(args[1]); break;
    default: showUsage(); break;
}

function showUsage() {
    console.log("NVS (Node Version Switcher) usage");
    console.log("");
    console.log("nvs install <version>     Download and install a node version");
    console.log("nvs uninstall <version>   Uninstall a node version");
    console.log("nvs use <version>         Use a version in the current environment");
    console.log("nvs default               Configure the current version as the user default");
    console.log("nvs run <version> [args]...");
    console.log("nvs ls");
    console.log("nvs ls-available");
    console.log("nvs which");
    console.log("");
}

function showVersion() {
    var packageJson = require("./package.json");
    console.log(packageJson.version);
}

function install(version) {
}

function uninstall(version) {
}

function use(version) {
}

function run(version, args) {
}

function listInstalled() {
}

function listAvailable() {
}

function showPath(version) {
}

function generatePostScript(exportVars) {
    var envVars = Object.keys(exportVars || {});
    if (envVars.length > 0) {
        var postScriptLines = [];
        var postScriptFile = process.env["NVS_POSTSCRIPT"];
        var postScriptExtension = path.extname(postScriptFile).toUpperCase();
        if (postScriptExtension == ".CMD") {
            envVars.forEach(envVar => {
                postScriptLines.push("SET " + envVar + "=" + exportVars[envVar]);
            });
        } else if (postScriptExtension == ".PS1") {
            envVars.forEach(envVar => {
                postScriptLines.push("$env:" + envVar + "  =\"" + exportVars[envVar] + "\"");
            });
        } else if (postScriptExtension == ".SH") {
            envVars.forEach(envVar => {
                postScriptLines.push("EXPORT " + envVar + "  =\"" + exportVars[envVar] + "\"");
            });
        }

        fs.writeFileSync(postScriptFile, postScriptLines.join("\r\n") + "\r\n");
    }
}
