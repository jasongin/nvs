# USE Command - Node Version Switcher

    nvs <version>
    nvs use <version>

    nvs use
    nvs use auto

    nvs use default

Updates the `PATH` of the calling shell to include the specified node version (which must have been already added). If no version (or "auto") is specified, NVS searches for the nearest `.node-version` file in the current directory or parent directories. If found, the version specified in the file is then added (if necessary) and used. If no `.node-version` file is found, then the default (linked) version, if any, is used.

A version string consists of a complete or partial semantic version number or version label ("lts", "latest", "Argon", etc.), optionally preceded by a remote name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. When a partial version matches multiple available versions, the latest version is automatically selected. Examples: "node/lts", "4.6.0", "6/x86", "node/6.7/x64". An alias may also be used in place of a version string.

A remote name is one of the keys from the `remotes` mapping in `$NVS_HOME/settings.json`; these may be managed using the `nvs remote` command.
