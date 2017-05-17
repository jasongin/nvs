# UNLINK Command - Node Version Switcher

    nvs unlink [version]
    nvs ul [version]

Removes a symbolic directory link if it exists at `$NVS_HOME/default`. If a version is specified, then the link is only removed if it points to that version.

On Windows, this command also removes the default (linked) version from the profile `PATH` environment variable. Afterward, new shell windows will not use any Node.js version.
