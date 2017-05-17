# MIGRATE Command - Node Version Switcher

    nvs migrate <sourceversion> [targetversion]

Migrates globally-installed and globally-linked modules from a source node version to a target node version. Note this ignores any configuration (NPM_CONFIG_PREFIX environment variable or prefix setting in the user's npmrc) that might override the global modules directory location, because that configuration would apply apply to both versions and therefore no migration would be necessary or possible.

The source and target versions must refer to previously-added node versions. The target version optional; if unspecified then the currently used version is the target.
