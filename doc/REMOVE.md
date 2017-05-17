# REMOVE Command - Node Version Switcher

    nvs rm <version>
    nvs remove <version>

Removes a node version that was previously added via an ADD command. Any symlinks or PATH entries (in the calling shell environment only) pointing to that version are also removed.

A version string consists of a semantic version number, optionally preceded by a remote name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. Examples: "4.6.0", "6/x86", "node/6.7/x64"

A remote name is one of the keys from the `remotes` mapping in `$NVS_HOME/settings.json`.
