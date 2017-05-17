# LINK Command - Node Version Switcher

    nvs link [version]
    nvs ln [version]

Creates a symbolic directory link at `$NVS_HOME/default` that points to the specified version (or the current version from `PATH` at the time of the command). This sets a "default" node version, which is restored whenever the current version is removed, or when running `nvs use` with no version. It can also be useful when there is a need to configure a fixed path elsewhere (such as in an IDE), allowing the version to be switched without changing the path.

On Windows, this command also updates the profile `PATH` environment variable to include the default (linked) version, so that any newly opened shells will use that default version.

On non-Windows platforms when a new shell sources the `nvs.sh` script it also sets `PATH` to include the default (linked) version, if a link is present.

When NVS is installed to a system directory, linking a node version also creates symbolic links at `%ProgramFiles%\nodejs` or `/usr/local/bin`, if there is not already a system-installed Node.js there.
