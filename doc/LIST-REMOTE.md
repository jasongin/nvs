# LIST-REMOTE Command - Node Version Switcher
```
nvs lsr [remote] [filter]
nvs ls-remote [remote] [filter]
nvs list-remote [remote] [filter]
```
Lists node versions available to download.

If a remote name is specified, then only versions from that remote are listed; otherwise all remotes are listed. A remote name is one of the keys from the `remotes` mapping in `$NVS_HOME/settings.json`.

The optional filter parameter may be a configured remote name, or a partial semantic version such as `6.5`, or a remote name and partial version such as `node/6`. If the filter is omitted then all available versions are listed.

