// NVS (node version switcher) main script

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const versionRegex =
    /^(([\w\-]+)\/)?((v?(\d\d?\.\d\d?\.\d\d?))|(lts)|(latest))(\/((x86)|((ia)?32)|((x|(amd))?64)))?$/i;

var args = process.argv.slice(2);
var version;
switch (args[0]) {
    case "-v":
    case "--version": showVersion(); break;
    case "+":
    case "add":
    case "install":
        if ((version = parseVersion(args[1])) != null) install(version);
        else showUsage(); break;
    case "-":
    case "rm":
    case "remove":
    case "uninstall":
        if ((version = parseVersion(args[1])) != null) uninstall(version);
        else showUsage(); break;
    case "u":
    case "use":
        if ((version = parseVersion(args[1])) != null) use(version);
        else showUsage(); break;
    case "default":
        if ((version = parseVersion(args[1])) != null) setDefault(version);
        else showUsage(); break;
    case "r":
    case "run":
        run(); break;
    case "l":
    case "ls":
    case "lsi":
    case "ls-installed":
        listInstalled(); break;
    case "la":
    case "lsa":
    case "lr":
    case "lsr":
    case "ls-available":
    case "ls-remote":
        listAvailable(args[1]); break;
    case "w":
    case "which":
        if ((version = parseVersion(args[1])) != null) showPath(version);
        else showUsage(); break;
    default:
        if ((version = parseVersion(args[0])) != null) use(version);
        else showUsage(); break;
}

function showUsage() {
    console.log("NVS (Node Version Switcher) usage");
    console.log("");
    console.log("nvs install <version>        Download and install a node version");
    console.log("nvs uninstall <version>      Uninstall a node version");
    console.log("nvs use <version>            Use a node version in the current environment");
    console.log("nvs default                  Configure the current version as the user default");
    console.log("nvs run <version> [args]...  Run a script using a node version");
    console.log("nvs ls                       List installed node versions");
    console.log("nvs ls-available             List node versions available to install");
    console.log("nvs which                    Show the path to a node version");
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

function listAvailable(distName) {
    var distMap = loadDistMap();
    var distNames = Object.keys(distMap);

    var defaultIndex = distNames.indexOf("default");
    if (distNames.indexOf("default") >= 0) {
        distNames.splice(defaultIndex, 1);
    }

    var found = false;
    var listDistIndex = function(i) {
        if (distNames[i]) {
            if (!distName || distNames[i] == distName) {
                found = true;
                downloadIndexAsync(distMap, distName).then(distIndex => {
                    showDistIndex(distName, distIndex);
                    listDistIndex(i + 1);
                }).catch(function (e) {
                    console.warn(
                        "Failed to download index for distribution: " +
                        distName + ". " + e.message);
                    listDistIndex(i + 1);
                });
            } else {
                listDistIndex(i + 1);
            }
        } else if (!found && distName) {
            console.warn("No distribution found with name: " + distName);
        }
    };
    listDistIndex(0);
}

function showDistIndex(distName, distIndex) {
    console.log("");
    console.log(distName);
    if (Array.isArray(distIndex)) {
        var lines = formatAsColumns(distIndex.filter(item => {
            return item.version.startsWith("v") && !item.version.startsWith("v0");
        }).map(item => {
            return item.version.substr(1);
        }), process.stdout.columns || 80);
        lines.forEach(line => {
            console.log(line);
        });
    } else {
        console.warn("  index.json is not an array: " + distName);
    }
}

function formatAsColumns(data, lineLength) {
    var columnWidth = data.map(item => item.length).reduce((a, b) => a > b ? a : b, 0) + 2;
    var lines = [];
    var line = "";
    for (var i = 0; i < data.length; i++) {
        line += "  " + data[i] + " ".repeat(columnWidth - 2 - data[i].length);
        if (line.length + columnWidth > lineLength) {
            lines.push(line);
            line = "";
        }
    }
    if (line) {
        lines.push(line);
    }
    return lines;
}

function showPath(version) {
}

function parseVersion(versionString) {
    var m = versionRegex.exec(versionString);
    if (!m) {
        return null;
    }

console.log(m);
    var distName = m[2];
    var numericVersion = m[5];
    var namedVersion = m[6] || m[7];
    var arch = m[9] || process.arch;

    var distMap = loadDistMap();
    if (!distName || distName === "default") {
        distName = distMap["default"] || "node";
    }

    switch (arch) {
        case "32":
        case "ia32":
            arch = "x86";
            break;
        case "64":
        case "amd64":
            arch = "x64";
            break;
    }

    var version = {
        distName: distName,
        numericVersion: numericVersion,
        namedVersion: namedVersion,
        arch: arch,
    };
console.log(version);
    return version;
}

function loadDistMap() {
    var distMap = null;
    var distMapFile = path.join(process.env["NVS_HOME"], "dist.json");
    if (fs.existsSync(distMapFile)) {
        try {
            distMap = JSON.parse(fs.readFileSync(distMapFile));
        } catch (e) {
            return Promise.reject("Failed to read file: " + distMapFile, e);
        }
    } else {
        distMap = require("./dist.json");
        fs.writeFileSync(distMapFile, JSON.stringify(distMap, null, 2));
    }
    return distMap;
}

function downloadIndexAsync(distMap, distName) {
    if (!distName || distName === "default") {
        distName = distMap["default"] || "node";
    }

    var distUri = distMap[distName];
    if (!distUri) {
        return Promise.reject("No URI found for distribution: " + distName);
    }

    var distIndexUri = distUri + (distUri.endsWith("/") ? "" : "/") + "index.json";

    var client = distIndexUri.startsWith("https:") ? https : http;
    return new Promise((resolve, reject) => {
        https.get(distIndexUri, (res) => {
            var responseBody = "";
            res.on('data', (data) => {
                responseBody += data;
            });
            res.on('end', function() {
                var index;
                try {
                    index = JSON.parse(responseBody);
                } catch (e) {
                    reject(e);
                    return;
                }
                resolve(index);
            });

        }).on('error', (e) => {
            reject(e);
        });
    });
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
