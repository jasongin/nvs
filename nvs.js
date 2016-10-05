// NVS (node version switcher) main script

const parseVersion = require('./lib/version').parse;
const debug = process.env['NVS_DEBUG'];

main(process.argv.slice(2));

function main(args) {
    var asyncResult = null;
    var version = null;
    try {
        switch (args[0]) {
            case '-v':
            case '--version':
                nvsVersion();
                break;

            case 'w':
            case 'which':
                if (args[1]) {
                    version = parseVersion(args[1]);
                }
                asyncResult = require('./lib/install').getPathAsync(version);
                break;

            case '+':
            case 'add':
            case 'install':
                version = parseVersion(args[1]);
                asyncResult = require('./lib/install').installAsync(version);
                break;

            case '-':
            case 'rm':
            case 'remove':
            case 'uninstall':
                version = parseVersion(args[1]);
                asyncResult = require('./lib/install').uninstallAsync(version);
                break;

            case 'l':
            case 'ls':
            case 'lsi':
            case 'ls-installed':
                asyncResult = require('./lib/install').listAsync();
                break;

            case 'la':
            case 'lsa':
            case 'lr':
            case 'lsr':
            case 'ls-available':
            case 'ls-remote':
                asyncResult = require('./lib/available').listAsync(args[1]);
                break;

            case 'r':
            case 'run':
                version = parseVersion(args[1]);
                asyncResult = require('./lib/env').runAsync(version, args.slice(2));
                break;

            case 'use':
                if (args[1]) {
                    version = parseVersion(args[1]);
                }
                asyncResult = require('./lib/env').useAsync(version);
                break;

            default:
                version = parseVersion(args[1]);
                asyncResult = require('./lib/env').useAsync(version);
                break;
        }
    } catch (e) {
        if (args.length > 0) {
            console.error(debug ? e.stack || e.message : e.message);
            console.log('');
        }
        usage();
    }

    if (asyncResult) {
        asyncResult.then(result => {
            if (result) {
                console.log(result);
            }
        }).catch(e => {
            console.error(debug ? e.stack || e.message : e.message);
            process.exitCode = process.exitCode || 1;
        });
    }
}

function usage() {
    console.log('NVS (Node Version Switcher) usage');
    console.log('');
    console.log('nvs add <version>            Download and install a node version');
    console.log('nvs rm <version>             Uninstall a node version');
    console.log('nvs use [version]            Use a node version in the current environment');
    console.log('nvs run <version> [args]...  Run a script using a node version');
    console.log('nvs ls                       List installed node versions');
    console.log('nvs ls-available [feed]      List node versions available to install');
    console.log('nvs which [version]          Show the path to a node version');
    console.log('');
    console.log('A version string consists of a semantic version number or version label');
    console.log('("lts" or "latest"), optionally preceeded by a feed name, optionally');
    console.log('followed by an architecture, separated by slashes.');
    console.log('Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64"');
    console.log('');
    console.log('Configured feed names: ' +
        require('./lib/available').feedNames.join(', '));
    console.log('');
}

function nvsVersion() {
    var packageJson = require('./package.json');
    console.log(packageJson.version);
}
