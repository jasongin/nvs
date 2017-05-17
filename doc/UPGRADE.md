# UPGRADE Command - Node Version Switcher

    nvs upgrade [fromversion]

Upgrades the specified Node version to the latest available build with the same major version. If no version is specified, the version currently in use is implied, if any.

## Upgrade procedure
The following steps are performed automatically by the upgrade command:

 1. Query the remote to identify the latest available version with the same major version as the specified version.
 2. Download and install (`nvs add`) the newer version, if not already added.
 3. Migrate global packages (`nvs migrate`) from the old to the new version.
 4. If the old version was linked, link (`nvs link`) the new version instead.
 5. Use (`nvs use`) the new version if the old version was previously in use.
 6. Remove the old version.

## Examples

    nvs add lts  # Adds 6.10.1
    # Some time later 6.10.2 is published
    nvs use lts  # Uses 6.10.1 (nvs use does not check for a newer version)
    nvs upgrade  # Upgrades from 6.10.1 to 6.10.2

    nvs add argon  # Adds 4.8.1
    # Some time later 4.9.0 is published
    nvs upgrade argon  # Upgrades from 4.8.1 to 4.9.0

    nvs add 7.7  # Adds 7.7.4
    nvs add 7  # Adds 7.8.0... forgot to use the upgrade command
    nvs upgrade 7.7 # Upgrades from 7.7.4 to 7.8.0

    nvs add nightly  # Adds the latest build from the "nightly" remote: 8.0.0-nightly20170331...
    # One day later
    nvs upgrade nightly  # Upgrades from 8.0.0-nightly20170331... to 8.0.0-nightly20170401...
