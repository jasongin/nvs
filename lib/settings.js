/* global settings */
var fs = require('fs');
var os = require('os');
var path = require('path');

var homeDir = (function () {
    var homeDir = process.env['NVS_HOME'];
    if (!homeDir) {
        if (process.platform === 'win32') {
            homeDir = path.join(process.env['APPDATA'], 'nvs');
        } else {
            homeDir = path.join(process.env['HOME'], '.nvs');
        }
        if (!fs.existsSync(homeDir)) {
            fs.mkdirSync(homeDir);
        }
    }

    if (!homeDir.endsWith(path.sep)) {
        homeDir += path.sep;
    }

    return homeDir;
})();

var settingsFile = path.join(homeDir, 'settings.json');

/**
 * Loads settings from $NVS_HOME/settings.json. If the file is not present,
 * it is created using a copy of defaults.json.
 */
function loadSettings() {
    try {
        settings = JSON.parse(fs.readFileSync(settingsFile));
    } catch (e) {
        if (e.code === 'ENOENT') {
            settings = require('../defaults.json');

            // Save a copy of the defaults where the user can edit it.
            saveSettings(settings);
        } else {
            throw new Error('Failed to read settings file: ' +
                settingsFile + '. ' + e.message);
        }
    }

    settings.aliases = settings.aliases || {};
    settings.remotes = settings.remotes || {};
    settings.home = homeDir;
}

/**
 * Saves settings to $NVS_HOME/settings.json.
 */
function saveSettings() {
    try {
        delete settings.home; // Don't persist the home property.
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        settings.home = homeDir;
    } catch (e) {
        throw new Error('Failed to write settings file: ' +
            settingsFile + '. ' + e.message);
    }
}

function setAlias(name, value) {
    if (!name || !value) {
        throw new Error('An alias name and value are required.');
    }

    var version = require('./version').parse(value);
    var versionPart = (version.label || version.semanticVersion);
    if (value === versionPart) {
        value = 'default/' + value;
    } else if (!(value === version.remoteName + '/' + versionPart)) {
        throw new Error('Invalid alias target. Specify a semantic version, ' +
            'optionally preceded by a remote name.');
    }

    settings.aliases[name] = value;
    saveSettings();
}

function removeAlias(name) {
    if (!name) {
        throw new Error('Specify an alias name.');
    }

    delete settings.aliases[name];
    saveSettings();
}

function listAliases(name) {
    if (name) {
        return settings.aliases[name];
    }

    var names = Object.keys(settings.aliases);
    var columnWidth = names
        .map(item => item.length)
        .reduce((a, b) => a > b ? a : b, 0) + 2;

    return names
        .sort()
        .map(name => {
            var value = settings.aliases[name];
            return name + ' '.repeat(columnWidth - name.length) + value;
        }).join(os.EOL);
}

function setRemoteAsync(name, uri) {
    if (!name || !uri) {
        throw new Error('A remote name and URI are required.');
    }

    if (name === 'default') {
        if (!settings.remotes[uri]) {
            throw new Error(
                'Remote default target name does not exist: ' + uri);
        }
    } else {
        // TODO: Validate URI by downloading the index
    }

    settings.remotes[name] = uri;
    saveSettings();

    return Promise.resolve();
}

function removeRemote(name) {
    if (!name) {
        throw new Error('Specify a remote name.');
    }
    if (name === 'default') {
        throw new Error('The default remote pointer cannot be deleted.');
    } else if (settings.remotes['default'] === name) {
        throw new Error('The \'' + name + '\' remote is currently set as the ' +
            'default.' + os.EOL + 'Switch the default to another ' +
            'before deleting this one.');
    }

    delete settings.remotes[name];
    saveSettings();
}

function listRemotes(name) {
    if (name) {
        var value = settings.remotes[name];
        return name === 'default'
            ? value + '  ' + settings.remotes[value] : value;
    }

    var names = Object.keys(settings.remotes);
    var columnWidth = names
        .map(item => item.length)
        .reduce((a, b) => a > b ? a : b, 0) + 2;

    return names
        .sort()
        .map(name => {
            var uri = settings.remotes[name];
            return name + ' '.repeat(columnWidth - name.length) + uri;
        }).join(os.EOL);
}

module.exports = {
    loadSettings,
    saveSettings,
    setAlias,
    removeAlias,
    listAliases,
    setRemoteAsync,
    removeRemote,
    listRemotes,
};
