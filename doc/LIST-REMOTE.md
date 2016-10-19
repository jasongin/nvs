# LIST-REMOTE Command - Node Version Switcher
```
nvs lsr [remote] [version]
nvs ls-remote [remote] [version]
nvs list-remote [remote] [version]
```
Lists node versions available to download.

If a remote name is specified, then only versions from that remote are listed; otherwise all remotes are listed. A remote name is one of the keys from the `remotes` mapping in `$NVS_HOME/settings.json`.

If a version filter is specified, then only versions matching the filter are listed; otherwise all versions are listed. A version filter is a complete or partial semantic version, for example `4`, `4.3`, or `4.3.2`.
