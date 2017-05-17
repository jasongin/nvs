# ALIAS Command - Node Version Switcher

    nvs alias
    nvs alias <name>
    nvs alias <name> <version>
    nvs alias <name> <directory>
    nvs alias -d <name>

Queries, sets, or removes version aliases. When no arguments are specified, all alias names and values are listed. When just a name is specified, the value for that alias is shown, if it exists. When a name and value are specified, the alias is added or updated to the persisted list. The `-d` switch removes an item. The alias settings are persisted in `$NVS_HOME/settings.json`.

An alias may refer to a combination of a remote name and a semantic version. (Processor architectures are not aliased.) When setting an alias, the remote name may be omitted, in which case the alias refers to the default remote. For example `nvs alias 6.7.0` is exactly equivalent to `nvs alias default/6.7.0`.

When using an alias with other commands, a processor architecture may be optionally appended to override the system default, the same as with semantic versions. For example:

    $ nvs alias myalias 6.7.0
    $ nvs alias
    myalias default/6.7.0
    $ nvs run myalias --version
    v6.7.0
    $ nvs which myalias
    ~/.nvs/node/6.7.0/x64/bin/node
    $ nvs which myalias/32
    ~/.nvs/node/6.7.0/x86/bin/node

## Aliasing directories

An alias may also refer to a local directory containing any node executable. Create an alias like this to enable NVS to switch to/from a version of node that was built locally from source:

    $ nvs alias dev ~/src/node/out/Release
    $ nvs use dev
    PATH += ~/src/node/out/Release
    $ nvs ls
     #node/6.9.1/x64
     >/home/username/src/node/out/Release (dev)
    $ nvs use lts
    PATH -= ~/src/node/out/Release
    PATH += ~/.nvs/node/6.9.1/x64/bin

Note it is not possible to `nvs use` a directory without using an alias.
