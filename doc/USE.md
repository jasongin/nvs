# USE Command - Node Version Switcher
```
nvs <version>
nvs use [version]
```
Updates the `PATH` of the calling shell to include the specified node version (which must have been already added). If no version is specified, then any NVS-managed node directories are removed from the `PATH`.

A version string consists of a semantic version number, optionally preceded by a remote name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. Version labels ("lts", "latest") are not supported for use with the USE command. Examples: "4.6.0", "6.3.1/x86", "node/6.7.0/x64"

A remote name is one of the keys from the `remotes` mapping in `$NVS_HOME/settings.json`.
