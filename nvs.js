// NVS (node version switcher) main script

const fs = require('fs');
const path = require('path');

const parseVersion = require('./lib/version').parse;

var args = process.argv.slice(2);
var version;
switch (args[0]) {
    case '-v':
    case '--version':
        nvsVersion();
        break;

    case '+':
    case 'add':
    case 'install':
        if ((version = parseVersion(args[1])) != null) {
            require('./lib/install').install(version);
        } else {
            usage();
        }
        break;

    case '-':
    case 'rm':
    case 'remove':
    case 'uninstall':
        if ((version = parseVersion(args[1])) != null) {
            require('./lib/install').uninstall(version);
        } else {
            usage();
        }
        break;

    case 'l':
    case 'ls':
    case 'lsi':
    case 'ls-installed':
        require('./lib/install').list();
        break;

    case 'la':
    case 'lsa':
    case 'lr':
    case 'lsr':
    case 'ls-available':
    case 'ls-remote':
        require('./lib/available').list(args[1]);
        break;

    case 'w':
    case 'which':
        if (args[1] && (version = parseVersion(args[1])) != null) {
            console.log(require('./lib/env').getPath(version));
        } else if (!args[1]) {
            console.log(require('./lib/env').getPath());
        } else {
            usage();
        }
        break;

    case 'default':
        if (args[1] && (version = parseVersion(args[1])) != null) {
            require('./lib/env').setDefault(version);
        } else if (!args[1]) {
            require('./lib/env').setDefault();
        } else {
            usage();
        }
        break;

    case 'r':
    case 'run':
        run();
        break;

    case 'use':
        if ((version = parseVersion(args[1])) != null) {
            require('./lib/env').use(version);
        } else {
            usage();
        }
        break;

    default:
        if ((version = parseVersion(args[0])) != null) {
            require('./lib/env').use(version);
        } else {
            usage();
        }
        break;
}

function usage() {
    console.log('NVS (Node Version Switcher) usage');
    console.log('');
    console.log('nvs install <version>        Download and install a node version');
    console.log('nvs uninstall <version>      Uninstall a node version');
    console.log('nvs use <version>            Use a node version in the current environment');
    console.log('nvs default [version]        Configure a node version as the user default');
    console.log('nvs run <version> [args]...  Run a script using a node version');
    console.log('nvs ls                       List installed node versions');
    console.log('nvs ls-available [dist]      List node versions available to install');
    console.log('nvs which [version]          Show the path to a node version');
    console.log('');
    console.log('A version string consists of a semantic version, optionally preceeded by');
    console.log('a distribution name, optionally followed by an arch, separated by slashes.');
    console.log('Examples: "4.6.0", "6.3.1/x86", "node/6.7.0/x64"');
    console.log('');
    console.log('Configured distribution names: ' +
        require('./lib/available').distNames.join(', '));
    console.log('');
}

function nvsVersion() {
    var packageJson = require('./package.json');
    console.log(packageJson.version);
}
