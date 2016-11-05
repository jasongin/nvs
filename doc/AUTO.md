# AUTO Command - Node Version Switcher
```
nvs auto
nvs auto on
nvs auto off
```
When invoked with no parameters, `nvs auto` searches for the nearest `.node-version` file in the current directory or parent directories. If found, the version specified in the file is then added (if necessary) and used. If no `.node-version` file is found, then the default (linked) version, if any, is used.

The `nvs auto on` command enables automatic switching as needed whenever the current shell's working directory changes; `nvs auto off` disables automatic switching in the current shell. (This feature is not supported in Windows Command Prompt.)

A `.node-version` file must contain a single line with a valid NVS version string. A version string consists of a semantic version number, optionally preceded by a remote name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. Version labels ("lts", "latest") are not supported for use with the USE command. Examples: "4.6.0", "6.3.1/x86", "node/6.7.0/x64"
