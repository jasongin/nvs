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
        case undefined:
            return require('./mainMenu').showMainMenuAsync();

        case 'install':
            if (args[1]) return help('install');
            return require('./install').install();

        case 'uninstall':
            if (args[1]) return help('uninstall');
            return require('./install').uninstall();

        case 'which':
            if (help) return help('which');
            if (args[1]) {
                version = require('./list').find(parseVersion(args[1]));
                if (!version) {
                    throw new Error('Specified version not found.' + os.EOL +
                        'To add this version now: nvs add ' + version, Error.ENOENT);
                }
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
            if (args[1]) {
                version = parseVersion(args[1]);
            }
            return require('./list').list(version);
        }

        case 'lr':
        case 'lsr':
        case 'ls-remote':
        case 'list-remote':
            if (help) return help('list-remote');
            if (args[1]) {
                version = parseVersion(args[1]);
            }
            return require('./list').listRemoteAsync(version);

        case 'alias':
        case 'aliases':
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
            return require('./settings').removeAlias(args[1]);

        case 'remote':
        case 'remotes':
            if (help) return help('remote');
            if (args[1] === '-d' || args[1] === 'rm' || args[1] === 'remove') {
                return require('./settings').removeRemote(args[2]);
            } else if (args[1] === 'add' || args[1] === 'set') {
                return require('./settings').setRemoteAsync(args[2], args[3]);
            } else if (args[1] === 'ls' || args[1] === 'list') {
                return require('./settings').listRemotes();
            } else if (args[2]) {
                return require('./settings').setRemoteAsync(args[1], args[2]);
            } else {
                return require('./settings').listRemotes(args[1]);
            }

        case 'run':
            if (help) return help('run');
            version = parseVersion(args[1]);
            return require('./use').run(version, args.slice(2));

        case 'exec':
            if (help) return help('exec');
            version = parseVersion(args[1]);
            return require('./use').exec(version, args[2], args.slice(3));

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

        case 'auto':
            if (help) return help('auto');
            if (!canUpdateEnv) {
                throw new Error(
                    'The \'auto\' command is not available when ' +
                    'invoking this script as an' + os.EOL +
                    'executable. To enable PATH updates, source ' +
                    'nvs.sh from your shell instead.');
            }
            if (!args[1]) {
                return require('./auto').autoSwitchAsync();
            } else {
                switch (args[1].toLowerCase()) {
                    case 'at':
                        return require('./auto').autoSwitchAsync(args[2]);
                    case 'on':
                    case 'enable':
                        return require('./auto').enableAutoSwitch(true);
                    case 'off':
                    case 'disable':
                        return require('./auto').enableAutoSwitch(false);
                    default:
                        return require('./help')('auto');
                }
            }

        case 'use':
            if (help) return help('use');
            if (!canUpdateEnv) {
                throw new Error(
                    'The \'use\' command is not available when ' +
                    'invoking this script as an' + os.EOL +
                    'executable. To enable PATH updates, source ' +
                    'nvs.sh from your shell instead.');
            }

            if (args[1] && !(args[1] === 'default' || args[1] === 'link')) {
                version = parseVersion(args[1]);
            }
            return require('./use').use(version || 'default');

        case 'migrate':
            if (help) return help('migrate');
            version = parseVersion(args[1]);
            return require('./migrate').migrateGlobalModules(
                version,
                args[2] ? parseVersion(args[2]) : require('./use').getCurrentVersion()
            );

        default:
            return require('./help')();
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
