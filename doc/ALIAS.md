# ALIAS Command - Node Version Switcher
```
nvs alias
nvs alias <name>
nvs alias <name> <version>
nvs alias -d <name>
```
Queries, sets, or removes version aliases. When no arguments are specified, all alias names and values are listed. When just a name is specified, the value for that alias is shown, if it exists. When a name and value are specified, the alias is added or updated to the persisted list. The `-d` switch removes an item.

An alias refers to a combination of a remote name and a semantic version. (Processor architectures are not aliased.) When setting an alias, the remote name may be omitted, in which case the alias refers to the default remote. For example `nvs alias 6.7.0` is exactly equivalent to `nvs alias default/6.7.0`.

When using an alias with other commands, a processor architecture may be optionally appended to override the system default, the same as with semantic versions. For example:
```
$ nvs alias myalias 6.7.0
$ nvs alias
myalias default/6.7.0
$ nvs run myalias --version
v6.7.0
$ nvs which myalias
~/.nvs/node/6.7.0/x64/bin/node
$ nvs which myalias/32
~/.nvs/node/6.7.0/x86/bin/node
```
The alias settings are persisted in `$NVS_HOME/settings.json`.
