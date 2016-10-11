// NVS (node version switcher) main script

const os = require('os');

global.settings = null;

const debug = process.env['NVS_DEBUG'];

main(process.argv.slice(2));

function main(args) {
    let result = null;
    try {
        result = doCommand(args);
    } catch (e) {
        printError(e);
        process.exitCode = process.exitCode || 1;
    }

    if (result) {
        if (typeof result === 'object' && result.then) {
            result.then(result => {
                printResult(result);
            }, e => {
                printError(e);
                process.exitCode = process.exitCode || 1;
            });
        } else {
            printResult(result);
        }
    }
}

function doCommand(args) {
    const parseVersion = require('./version').parse;
    const canUpdateEnv = !process.env['NVS_EXECUTE'];

    let help = null;
    if (args[0] === 'help' && args[1]) {
        help = require('./help');
        args = args.slice(1);
    }

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
            return require('../package.json').version;
    }

    require('./settings').loadSettings();

    let version = null;
    switch (args[0]) {
        case 'install':
            if (args[1]) return help('install');
            return require('./install').install();

        case 'uninstall':
            if (args[1]) return help('uninstall');
            return require('./install').uninstall();

        case 'which':
            if (help) return help('which');
            if (args[1]) {
                version = parseVersion(args[1]);
            } else {
                version = require('./use').getCurrentVersion();
            }
            return require('./use').getVersionBinary(version);

        case 'add':
            if (help) return help('add');
            version = parseVersion(args[1]);
            return require('./addRemove').addAsync(version);

        case 'rm':
        case 'remove':
            if (help) return help('remove');
            version = parseVersion(args[1]);
            return require('./addRemove').remove(version);

        case 'list':
        case 'ls': {
            if (help) return help('list');
            let result;
            if (args[1]) {
                try {
                    version = parseVersion(args[1]);
                } catch (e) {
                    version = null;
                }
                if (version) {
                    result = require('./addRemove').list(
                        version.remoteName, version.semanticVersion);
                } else {
                    result = require('./addRemove').list(args[1]);
                }
            } else {
                result = require('./addRemove').list();
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

        case 'alias':
            if (help) return help('alias');
            if (args[2] && args[1] === '-d') {
                return require('./settings').removeAlias(args[2]);
            } else if (args[2]) {
                return require('./settings').setAlias(args[1], args[2]);
            } else {
                return require('./settings').listAliases(args[1]);
            }

        case 'unalias':
            if (help) return help('alias');
            return require('./settings').unalias(args[1]);

        case 'remote':
            if (help) return help('remote');
            if (args[2] && args[1] === '-d') {
                return require('./settings').removeRemote(args[2]);
            } else if (args[2]) {
                return require('./settings').setRemoteAsync(args[1], args[2]);
            } else {
                return require('./settings').listRemotes(args[1]);
            }

        case 'run':
            if (help) return help('run');
            version = parseVersion(args[1]);
            return require('./use').run(version, args.slice(2));

        case 'link':
        case 'ln':
            if (help) return help('link');
            if (args[1]) {
                version = parseVersion(args[1]);
            }
            return require('./link').link(version);

        case 'unlink':
        case 'ul':
            if (help) return help('unlink');
            if (args[1]) {
                version = parseVersion(args[1]);
            }
            return require('./link').unlink(version);

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
                    version = require('./link').getLinkedVersion();
                } else {
                    version = parseVersion(args[1]);
                }
            }
            return require('./use').use(version);

        default:
            if (help) return help();
            version = parseVersion(args[1]);
            return require('./use').use(version);
    }
}

function printResult(result) {
    if (result) {
        if (Array.isArray(result)) {
            result = result.join(os.EOL);
        }
        if (result) {
            console.log(result);
        }
    }
}

function printError(e) {
    if (e) {
        let isPermissionError = (e.code === 'EPERM' || e.code === 'EACCES');
        console.error(debug ? e.stack || e.message : e.message);
        while (e.cause) {
            e = e.cause;
            console.error(debug ? e.stack || e.message : e.message);
        }
        if (isPermissionError) {
            if (process.platform === 'win32') {
                console.error('Try running again as Administrator.');
            } else if (!process.env['NVS_EXECUTE']) {
                console.error('Try running again with sudo:\n  ' +
                    'nvsudo ' + process.argv.slice(2).join(' '));
            } else {
                console.error('Try running again with sudo.');
            }
        }
    }
}
