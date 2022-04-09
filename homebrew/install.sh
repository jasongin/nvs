#!/usr/bin/env bash

NVS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Set environment variables
export HOME=~
export NVS_HOME=~/.nvs

# Link necessary files
ln -Ffs $NVS_DIR/nvs.sh $NVS_HOME
ln -Ffs $NVS_DIR/lib $NVS_HOME
ln -Ffs $NVS_DIR/deps $NVS_HOME
ln -Ffs $NVS_DIR/package.json $NVS_HOME
ln -Ffs $NVS_DIR/defaults.json $NVS_HOME

# Run install script
\. $NVS_DIR/nvs.sh install