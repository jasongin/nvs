
const versionRegex =
    /^(([\w\-]+)\/)?((v?(\d\d?\.\d\d?\.\d\d?))|(lts)|(latest))(\/((x86)|((ia)?32)|((x|(amd))?64)))?$/i;

function parse(versionString) {
    var m = versionRegex.exec(versionString);
    if (!m) {
        return null;
    }

    var distName = m[2];
    var semanticVersion = m[5];
    var namedVersion = m[6] || m[7];
    var arch = m[9] || process.arch;

    var distMap = require('./available').distMap;
    if (!distName || distName === "default") {
        distName = distMap["default"] || "node";
    }

    if (!distMap[distName]) {
        return null;
    }

    switch (arch) {
        case "32":
        case "ia32":
        case "x86":
            arch = "x86";
            break;
        case "64":
        case "amd64":
        case "x64":
            arch = "x64";
            break;
        default:
            return null;
    }

    var version = {
        distName: distName,
        semanticVersion: semanticVersion,
        namedVersion: namedVersion,
        arch: arch,
    };
    return version;
}

module.exports = {
    parse,
};
