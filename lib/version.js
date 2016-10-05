const versionRegex =
    /^(([\w\-]+)\/)?((v?(\d\d?\.\d\d?\.\d\d?))|(lts)|(latest))(\/((x86)|((ia)?32)|((x|(amd))?64)))?$/i;

function parse(versionString, requireFull) {
    if (!versionString) {
        throw new Error('A version parameter is required.');
    }

    var m = versionRegex.exec(versionString);
    if (!m) {
        throw new Error('Invalid version string: ' + versionString);
    }

    var feedName = m[2];
    var semanticVersion = m[5];
    var namedVersion = m[6] || m[7];
    var arch = m[9] || process.arch;
    var os = process.platform;

    if (requireFull) {
        if (!feedName) {
            throw new Error('A feed name is required.');
        }
        if (!arch) {
            throw new Error('A processor architecture is required.');
        }
    }

    var feedMap = require('./available').feedMap;
    if (!feedName || feedName === 'default') {
        feedName = feedMap['default'] || 'node';
    }

    if (!feedMap[feedName]) {
        throw new Error('Feed name not found in feeds.json: ' + feedName);
    }

    switch (arch) {
        case '32':
        case 'ia32':
        case 'x86':
            arch = 'x86';
            break;
        case '64':
        case 'amd64':
        case 'x64':
            arch = 'x64';
            break;
        default:
            throw new Error('Invalid architecture: ' + arch);
    }

    if (os === 'win32') {
        os = 'win';
    }

    var version = {
        feedName,
        semanticVersion,
        namedVersion,
        arch,
        os,
    };
    return version;
}

function equal(versionA, versionB) {
    return versionA.feedName === versionB.feedName &&
        versionA.semanticVersion === versionB.semanticVersion &&
        versionA.arch === versionB.arch;
}

module.exports = {
    versionRegex,
    parse,
    equal,
};
