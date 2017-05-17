# LIST Command - Node Version Switcher

    nvs ls [filter]
    nvs list [filter]

Lists local node versions that are immediately available to use.

The optional filter parameter may be a configured remote name, or a partial semantic version such as `6.5`, or a remote name and partial version such as `node/6`. If the filter is omitted then all available versions are listed.

The version currently in the path (if any) is marked with a `>`.
The default (linked) version (if any) is marked with a `#`.
