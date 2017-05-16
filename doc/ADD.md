# ADD Command - Node Version Switcher

    nvs add <version>

Downloads and extracts a requested node version. An added node version is then ready to activate with a USE command.

A version string consists of a complete or partial semantic version number or version label  ("lts", "latest", "Argon", etc.), optionally preceded by a remote name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. When a partial version matches multiple available versions, the latest version is automatically selected. Examples: "node/lts", "4.6.0", "6/x86", "node/6.7/x64". An alias may also be used in place of a version string.

A remote name is one of the keys from the `remotes` mapping in `$NVS_HOME/settings.json`; these may be managed using the `nvs remote` command.
