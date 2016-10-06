# ADD Command - Node Version Switcher
```
nvs add <version>
nvs install <version>

Downloads and installs a requested node version.

A version string consists of a semantic version number or version label ("lts" or "latest"), optionally preceded by a feed name, optionally followed by a processor architecture, separated by slashes. Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64"

A feed name is one of the keys from the `feeds` mapping in `$NVS_HOME/settings.json`.
