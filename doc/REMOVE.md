# REMOVE Command - Node Version Switcher
```
nvs rm <version>
nvs remove <version>
nvs uninstall <version>
```
Removes a node version that was previously installed via an ADD command. Any symlinks or PATH entries (in the calling shell environment only) pointing to that version are also removed.

A version string consists of a semantic version number, optionally preceded by a feed name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. Version labels ("lts", "latest") are not supported for use with the REMOVE command. Examples: "4.6.0", "6.3.1/x86", "node/6.7.0/x64"

A feed name is one of the keys from the `feeds` mapping in `$NVS_HOME/settings.json`.
