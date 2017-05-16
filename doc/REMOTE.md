# REMOTE Command - Node Version Switcher

    nvs remote
    nvs remote ls

    nvs remote <name>

    nvs remote <name> <uri>
    nvs remote add <name> <uri>

    nvs remote -d <name>
    nvs remote rm <name>

Queries, sets, or removes URIs for downloading node. When no arguments are specified, all remote names and URIs are listed. When just a name is specified, the URI for that remote is shown, if it exists. When a name and value are specified (optionally with an `add` command), the remote is added or updated to the persisted list. The `-d` or `rm` command removes an item.

A special `default` remote may also be set to refer to the name of another remote. A remote that is pointed to by the default may not be removed; switch the default to another remote first. The default remote is implied when a version string does not specify a remote. For example, `nvs add 6` is equivalent to `nvs add node/6` if `node` is the default remote.

The settings are persisted in `$NVS_HOME/settings.json`.
