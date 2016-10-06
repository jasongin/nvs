# USE Command - Node Version Switcher
```
nvs <version>
nvs use [version]
```
Updates the `PATH` of the calling shell to include the specified node version (which must be already installed). If no version is specified, then any NVS-installed node directories are removed from the `PATH`.

A version string consists of a semantic version number, optionally preceded by a feed name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. Version labels ("lts", "latest") are not supported for use with the USE command. Examples: "4.6.0", "6.3.1/x86", "node/6.7.0/x64"

A feed name is one of the keys from the `feeds` mapping in `$NVS_HOME/settings.json`.
