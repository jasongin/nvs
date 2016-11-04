# ADD Command - Node Version Switcher
```
nvs add <version>
```
Downloads and extracts a requested node version. An added node version is then ready to activate with a USE command.

A version string consists of a semantic version number or version label ("lts" or "latest"), optionally preceded by a remote name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64". An alias may also be used in place of a version string.

A remote name is one of the keys from the `remotes` mapping in `$NVS_HOME/settings.json`.
