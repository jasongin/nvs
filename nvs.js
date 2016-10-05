// NVS (node version switcher) main script

const os = require('os');

const parseVersion = require('./lib/version').parse;
const debug = process.env['NVS_DEBUG'];

main(process.argv.slice(2));

function main(args) {
    var result = null;
    var version = null;
    try {
        switch (args[0]) {
            case undefined:
            case '-h':
            case '/h':
            case '-?':
            case '/?':
            case '-help':
            case '/help':
            case '--help':
                result = usage();
                break;

            case '-v':
            case '--version':
                result = require('./package.json').version;
                break;

            case 'w':
            case 'which':
                if (args[1]) {
                    version = parseVersion(args[1]);
                }
                result = require('./lib/env').getVersionBinary(version);
                break;

            case '+':
            case 'add':
            case 'install':
                version = parseVersion(args[1]);
                result = require('./lib/install').installAsync(version);
                break;

            case '-':
            case 'rm':
            case 'remove':
            case 'uninstall':
                version = parseVersion(args[1]);
                result = require('./lib/install').uninstall(version);
                break;

            case 'l':
            case 'list':
            case 'ls':
            case 'lsi':
            case 'ls-installed':
            case 'list-installed':
                if (args[1]) {
                    try {
                        version = parseVersion(args[1]);
                    } catch (e) {
                        version = null;
                    }
                    if (version) {
                        result = require('./lib/install').list(
                            version.feedName, version.semanticVersion);
                    } else {
                        result = require('./lib/install').list(args[1]);
                    }
                } else {
                    result = require('./lib/install').list();
                }
                if (result.length > os.EOL.length) {
                    result = result.substr(0, result.length - os.EOL.length);
                }
                break;

            case 'la':
            case 'lsa':
            case 'lr':
            case 'lsr':
            case 'ls-available':
            case 'ls-remote':
            case 'list-available':
            case 'list-remote':
                result = require('./lib/available').listAsync(args[1]);
                break;

            case 'r':
            case 'run':
                version = parseVersion(args[1]);
                result = require('./lib/env').run(version, args.slice(2));
                break;

            case 'link':
            case 'ln':
                if (args[1]) {
                    version = parseVersion(args[1]);
                }
                result = require('./lib/env').link(version);
                break;

            case 'unlink':
            case 'ul':
                if (args[1]) {
                    version = parseVersion(args[1]);
                }
                result = require('./lib/env').unlink(version);
                break;

            case 'use':
                if (args[1]) {
                    if (args[1] === 'link') {
                        version = require('./lib/env').getLinkedVersion();
                    } else {
                        version = parseVersion(args[1]);
                    }
                }
                result = require('./lib/env').use(version);
                break;

            default:
                version = parseVersion(args[1]);
                result = require('./lib/env').use(version);
                break;
        }
    } catch (e) {
        console.error(debug ? e.stack || e.message : e.message);
        process.exitCode = process.exitCode || 1;
    }

    if (result) {
        if (typeof result === 'object' && result.then) {
            result.then(result => {
                if (result) {
                    console.log(result);
                }
            }, e => {
                console.error(debug ? e.stack || e.message : e.message);
                process.exitCode = process.exitCode || 1;
            });
        } else {
            console.log(result);
        }
    }
}

function usage() {
    return [
        'NVS (Node Version Switcher) usage',
        '',
        'nvs add <version>            Download and install a node version',
        'nvs rm <version>             Uninstall a node version',
        'nvs use [version]            Use a node version in the current environment',
        'nvs run <version> [args]...  Run a script using a node version',
        'nvs ls                       List installed node versions',
        'nvs ls-available [feed]      List node versions available to install',
        'nvs which [version]          Show the path to a node version',
        'nvs link [version]           Create a "current" dir symlink to a version',
        'nvs unlink [version]         Remove a "current" dir symlink',
        '',
        'A version string consists of a semantic version number or version label',
        '("lts" or "latest"), optionally preceeded by a feed name, optionally',
        'followed by an architecture, separated by slashes.',
        'Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64"',
        '',
        'Configured feed names: ' + require('./lib/available').feedNames.join(', '),
        '',
    ].join(os.EOL);
}
