# LIST-AVAILABLE Command - Node Version Switcher
```
nvs lsa [feed]
nvs lsr [feed]
nvs ls-available [feed]
nvs ls-remote [feed]
nvs list-available [feed]
nvs list-remote [feed]
```
Lists node versions available to install. If a feed name is specified then only versions from that feed are listed; otherwise all versions from all feeds are listed.

A feed name is one of the keys from the `feeds` mapping in `$NVS_HOME/settings.json`.
