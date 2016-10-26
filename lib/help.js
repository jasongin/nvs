const fs = require('fs');
const os = require('os');
const path = require('path');
const Error = require('./error');

const canUpdateEnv = !process.env['NVS_EXECUTE'];

function help(topic) {
    if (!process.exitCode) process.exitCode = 127;

    if (topic) {
        let helpFile = path.join(__dirname,
            '../doc/' + topic.toUpperCase() + '.md');
        let helpText;
        try {
            helpText = fs.readFileSync(helpFile, 'utf8');
        } catch (e) {
            Error.throwIfNot(Error.ENOENT, e, 'Failed to read help file: ' + helpFile);
        }

        if (helpText) {
            helpText = helpText.replace(/# /g, '');
            helpText = helpText.replace(/```/g, '');
            helpText = wrapLines(helpText, process.stdout.columns);
            return helpText;
        }
    }

    return [
        'NVS (Node Version Switcher) usage',
        '',
        'nvs help <command>           Get detailed help for a command',
        'nvs install                  Initialize your profile for using NVS',
        'nvs --version                Display the NVS tool version',
        '',
        'nvs add <version>            Download and extract a node version',
        'nvs rm <version>             Remove a node version',
        '',
        'nvs use [version]            ' + (canUpdateEnv
            ? 'Use a node version in the current environment'
            : '(Not available, source nvs.sh instead)'),
        'nvs run <version> [args]...  Run a script using a node version',
        'nvs which [version]          Show the path to an installed node version',
        '',
        'nvs ls                       List local node versions',
        'nvs ls-remote [remote]       List node versions available to download',
        '',
        'nvs link [version]           Link a version as the default',
        'nvs unlink                   Remove links to a default version',
        '',
        'nvs alias [name] [value]     Set or recall aliases for versions',
        'nvs remote [name] [uri]      Set or recall download base URIs',
        '',
        'A version string consists of a semantic version number or version label',
        '("lts" or "latest"), optionally preceeded by a remote name, optionally',
        'followed by an architecture, separated by slashes.',
        'Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64"',
        'Aliases may also be used anywhere in place of a version string.',
        '',
    ].join(os.EOL);
}

function wrapLines(text, columns) {
    let lines = text.split(/\r?\n/);

    if (columns > 0) {
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.length > columns) {
                let nextLine;
                let wrapIndex = line.lastIndexOf(' ', columns - 1);
                if (wrapIndex > 0) {
                    nextLine = line.substr(wrapIndex + 1);
                    line = line.substr(0, wrapIndex);
                } else {
                    nextLine = line.substr(columns);
                    line = line.substr(0, columns);
                }
                lines.splice(i, 1, line, nextLine);
            }
        }
    }

    return lines.join(os.EOL);
}

module.exports = help;
