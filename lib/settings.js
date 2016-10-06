var fs = require('fs');
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

/**
 * Loads settings from $NVS_HOME/settings.json. If the file is not present,
 * it is created using a copy of defaults.json.
 */
function loadSettings() {
    var settings = null;
    var settingsFile = path.join(homeDir, 'settings.json');
    try {
        settings = JSON.parse(fs.readFileSync(settingsFile));
    } catch (e) {
        if (e.code === 'ENOENT') {
            settings = require('../defaults.json');

            // Save a copy of the defaults where the user can edit it.
            fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        } else {
            throw new Error('Failed to read settings file: ' +
                settingsFile + '. ' + e.message);
        }
    }

    settings.home = homeDir;
    settings.feeds = settings.feeds || {};
    return settings;
}

module.exports = loadSettings();
