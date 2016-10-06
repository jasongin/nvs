// NVS (node version switcher) main script

var os = require('os');

var parseVersion = require('./version').parse;
var debug = process.env['NVS_DEBUG'];
var canUpdateEnv = !process.env['NVS_EXECUTE'];

global.settings = require('./settings');

main(process.argv.slice(2));

function main(args) {
    var result = null;
    try {
        result = doCommand(args);
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

function doCommand(args) {
    var help = null;
    if (args[0] === 'help' && args[1]) {
        help = require('./help');
        args = args.slice(1);
    }

    var version = null;
    switch (args[0]) {
        case undefined:
        case '-h':
        case '/h':
        case '-?':
        case '/?':
        case '-help':
        case '/help':
        case '--help':
        case 'help':
            return require('./help')();

        case '-v':
        case '--version':
            return require('./package.json').version;

        case 'which':
            if (help) return help('which');
            if (args[1]) {
                version = parseVersion(args[1]);
            }
            return require('./env').getVersionBinary(version);

        case 'add':
        case 'install':
            if (help) return help('add');
            version = parseVersion(args[1]);
            return require('./install').installAsync(version);

        case 'rm':
        case 'remove':
        case 'uninstall':
            if (help) return help('remove');
            version = parseVersion(args[1]);
            return require('./install').uninstall(version);

        case 'list':
        case 'ls':
        case 'lsi':
        case 'ls-installed':
        case 'list-installed': {
            if (help) return help('list-installed');
            let result;
            if (args[1]) {
                try {
                    version = parseVersion(args[1]);
                } catch (e) {
                    version = null;
                }
                if (version) {
                    result = require('./install').list(
                        version.feedName, version.semanticVersion);
                } else {
                    result = require('./install').list(args[1]);
                }
            } else {
                result = require('./install').list();
            }
            if (result.length > os.EOL.length) {
                result = result.substr(0, result.length - os.EOL.length);
            }
            return result;
        }

        case 'la':
        case 'lsa':
        case 'lr':
        case 'lsr':
        case 'ls-available':
        case 'ls-remote':
        case 'list-available':
        case 'list-remote':
            if (help) return help('list-available');
            return require('./available').listAsync(args[1]);

        case 'run':
            if (help) return help('run');
            version = parseVersion(args[1]);
            return require('./env').run(version, args.slice(2));

        case 'link':
        case 'ln':
            if (help) return help('link');
            if (args[1]) {
                version = parseVersion(args[1]);
            }
            return require('./env').link(version);

        case 'unlink':
        case 'ul':
            if (help) return help('unlink');
            if (args[1]) {
                version = parseVersion(args[1]);
            }
            return require('./env').unlink(version);

        case 'use':
            if (help) return help('use');
            if (!canUpdateEnv) {
                throw new Error(
                    'The \'use\' command is not available when ' +
                    'invoking this script as an' + os.EOL +
                    'executable. To enable PATH updates, source ' +
                    'nvs.sh from your shell instead.');
            }

            if (args[1]) {
                if (args[1] === 'link') {
                    version = require('./env').getLinkedVersion();
                } else {
                    version = parseVersion(args[1]);
                }
            }
            return require('./env').use(version);

        default:
            if (help) return help();
            version = parseVersion(args[1]);
            return require('./env').use(version);
    }
}
