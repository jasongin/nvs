# LINK Command - Node Version Switcher
```
nvs link [version]
nvs ln [version]
```
Creates a symbolic directory link at `$NVS_HOME/current` that points to the specified installed version (or the current version from `PATH`). This can be useful when there is a need to configure a fixed path elsewhere, allowing the version to be switched without changing the path.

On non-Windows platforms when a new shell sources the `nvs.sh` script it also sets `PATH` to include the linked version, if a link is present.
