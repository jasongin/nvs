# LIST-REMOTE Command - Node Version Switcher

    nvs lsr [filter]
    nvs ls-remote [filter]
    nvs list-remote [filter]

Lists node versions available to download.

The optional filter parameter may be a configured remote name, or a partial semantic version such as `6.5`, or a remote name and partial version such as `node/6`. If the filter is or includes a remote name, then available versions from that remote are listed; otherwise versions from the default remote are listed. A remote name is one of the keys from the `remotes` mapping in `$NVS_HOME/settings.json`.
