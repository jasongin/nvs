/* global settings */

const versionRegex =
    /^(([\w\-]+)\/)?((v?(\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?))|([a-z][a-z_\-][0-9a-z_\-]*))(\/((x86)|(32)|((x)?64)))?$/i;

/**
 * Parses a node version string into remote name, semantic version, and architecture
 * components. Infers some unspecified components based on configuration and environment.
 */
function parse(versionString, requireFull) {
    if (!versionString) {
        throw new Error('A version parameter is required.');
    }

    // Check if the version string includes an alias, and resolve it.
    let versionParts = versionString.split('/');
    if (versionParts.length < 3) {
        let resolvedVersion = settings.aliases[versionParts[0]];
        if (resolvedVersion) {
            versionString = resolvedVersion;
            if (versionParts.length === 2) {
                versionString += '/' + versionParts[1];
            }
        }
    }

    let match = versionRegex.exec(versionString);
    if (!match) {
        throw new Error('Invalid version string: ' + versionString);
    }

    let remoteName = match[2] || null;
    let semanticVersion = match[5] || null;
    let label = match[7] || null;
    let arch = match[9];
    let os = process.platform;

    if (requireFull) {
        if (!remoteName) {
            throw new Error('A remote name is required.');
        }
        if (!arch) {
            throw new Error('A processor architecture is required.');
        }
    }

    if (label === 'current' && !remoteName && !arch) {
        let currentVersion = require('./use').getCurrentVersion();
        if (!currentVersion) {
            throw new Error('There is no current version. Use `nvs use` to set one.');
        }

        label = null;
        semanticVersion = currentVersion.semanticVersion;
        arch = currentVersion.arch;
    }

    if (!remoteName || remoteName === 'default') {
        remoteName = settings.remotes['default'] || 'node';
    }

    if (!settings.remotes[remoteName]) {
        throw new Error('remote name not found in settings.json: ' + remoteName);
    }

    if (label && label !== 'latest' && label !== 'lts' && !label.startsWith('lts-')) {
        throw new Error('Invalid version label or alias: ' + label);
    }

    if (!arch) {
        arch = process.arch;
    }

    switch (arch) {
        case '32':
        case 'x86':
        case 'ia32':
            arch = 'x86';
            break;
        case '64':
        case 'x64':
        case 'amd64':
            arch = 'x64';
            break;
        default:
            throw new Error('Invalid architecture: ' + arch);
    }

    if (os === 'win32') {
        os = 'win';
    }

    let version = {
        remoteName,
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
    return versionA.remoteName === versionB.remoteName &&
        versionA.semanticVersion === versionB.semanticVersion &&
        versionA.arch === versionB.arch;
}

module.exports = {
    versionRegex,
    parse,
    equal,
};
