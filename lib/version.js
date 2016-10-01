
const versionRegex =
    /^(([\w\-]+)\/)?((v?(\d\d?\.\d\d?\.\d\d?))|(lts)|(latest))(\/((x86)|((ia)?32)|((x|(amd))?64)))?$/i;

function parse(versionString) {
    var m = versionRegex.exec(versionString);
    if (!m) {
        return null;
    }

    var feedName = m[2];
    var semanticVersion = m[5];
    var namedVersion = m[6] || m[7];
    var arch = m[9] || process.arch;

    var feedMap = require('./available').feedMap;
    if (!feedName || feedName === "default") {
        feedName = feedMap["default"] || "node";
    }

    if (!feedMap[feedName]) {
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
        feedName,
        semanticVersion,
        namedVersion,
        arch,
    };
    return version;
}

module.exports = {
    parse,
};
