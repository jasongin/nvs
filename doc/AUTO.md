# AUTO Command - Node Version Switcher

```
nvs auto
nvs auto on
nvs auto off
```

When invoked with no parameters, `nvs auto` searches for the nearest `package.json` file, if found, it will use the Node version supplied by [devEngines](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#devengines) or the [volta](https://github.com/volta-cli/volta) object if either are available. If not, it will use the nearest `.node-version` or `.nvmrc` file in the current directory or parent directories. If a Node version is found in any of these locations, it will be downloaded (if necessary) and used. If no Node version is found, then the default (linked) version, if any, is used.

The `nvs auto on` command enables automatic switching as needed whenever the current shell's working directory changes; `nvs auto off` disables automatic switching in the current shell. (This feature is not supported in Windows Command Prompt.)

A `.node-version` file must contain a single line with a valid NVS version string, with UTF8 encoding. A version string consists of a complete or partial semantic version number or version label  ("lts", "latest", "Argon", etc.), optionally preceded by a remote name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. When a partial version matches multiple available versions, the latest version is automatically selected. Examples: "4.6.0", "6/x86", "node/6.7/x64"
