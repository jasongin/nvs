# VS Code Support - Node Version Switcher

Visual Studio Code can use NVS to select a node version to use when launching or debugging. In `launch.json`, add a `"runtimeArgs"` attribute with a version string recognizable by NVS, and a `"runtimeExecutable"` attribute that refers to `nvs.cmd` (Windows) or `nvs` (Mac, Linux).

For multi-platform development, configuration can be customized for each platform. You may need to specify an absolute path such as `"${env:HOME}/.nvs/nvs"` if NVS is not in VS Code's PATH.

Example: Configure `launch.json` so VS Code uses NVS to launch node version 6.10:
```json
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${file}",
      "args": [ ],
      "runtimeArgs": [ "6.10" ],
      "windows": { "runtimeExecutable": "nvs.cmd" },
      "osx": { "runtimeExecutable": "nvs" },
      "linux": { "runtimeExecutable": "nvs" }
    },
```

The NVS version string value in `"runtimeArgs"` consists of a complete or partial semantic version number or version label ("lts", "latest", "Argon", etc.), optionally preceded by a remote name, optionally followed by a processor architecture or bitness ("x86", "x64", "32", "64"), separated by slashes. When a partial version matches multiple available versions, the latest version is automatically selected. Examples: "node/lts", "4.6.0", "6/x86", "node/6.7/x64". An NVS alias may also be used in place of a version string.

Or, the version string in `"runtimeArgs"` may be omitted (equivalent to "auto"), in which case NVS searches for the nearest `.node-version` file in the project directory or parent directories. If found, the version specified in the file is then downloaded (if necessary) and launched. If no `.node-version` file is found, then the default (linked) version, if any, is launched.

When NOT using the automatic mode with a `.node-version` file, the node version specified in launch.json must have been already downloaded using the `nvs add` command. Otherwise the launch will fail and NVS prints the error message "specified version not found".
