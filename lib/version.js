/* global settings */

var versionRegex =
    /^(([\w\-]+)\/)?((v?(\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?))|([a-z][a-z_\-][0-9a-z_\-]*))(\/((x86)|(32)|((x)?64)))?$/i;

/**
 * Parses a node version string into feed name, semantic version, and architecture
 * components. Infers some unspecified components based on configuration and environment.
 */
function parse(versionString, requireFull) {
    if (!versionString) {
        throw new Error('A version parameter is required.');
    }

    var m = versionRegex.exec(versionString);
    if (!m) {
        throw new Error('Invalid version string: ' + versionString);
    }

    var feedName = m[2] || null;
    var semanticVersion = m[5] || null;
    var label = m[7] || null;
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

    if (!feedName || feedName === 'default') {
        feedName = settings.feeds['default'] || 'node';
    }

    if (!settings.feeds[feedName]) {
        throw new Error('Feed name not found in settings.json: ' + feedName);
    }

    switch (label) {
        case null:
        case 'lts':
        case 'latest':
            break;
        default:
            throw new Error('Invalid version label: ' + label);
    }

    switch (arch) {
        case '32':
        case 'x86':
            arch = 'x86';
            break;
        case '64':
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
        label,
        arch,
        os,
    };
    return version;
}

/**
 * Tests if two node version structures are equal.
 */
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
