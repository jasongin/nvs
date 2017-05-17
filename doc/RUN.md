# RUN Command - Node Version Switcher

    nvs <module.js> [args...]
    nvs run <module.js> [args...]
    nvs run auto <module.js> [args...]

    nvs <version> <module.js> [args...]
    nvs run <version> <module.js> [args...]

Runs a node module using a specified node version, without changing the caller's `PATH`.

If no version (or "auto") is specified, NVS searches for the nearest `.node-version` file in the current directory or parent directories. If found, the version specified in the file is then downloaded (if necessary) and used to run the module. If no `.node-version` file is found, then the current version of node is used to run the module; if there is no current version then the default (linked) version, if any, is used to run the module.
