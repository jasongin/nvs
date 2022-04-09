#!/usr/bin/env bash

NVS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Set environment variables
export HOME=~
export NVS_HOME=~/.nvs

# Link necessary files
ln -fs $NVS_DIR/nvs.sh $NVS_HOME/nvs.sh
ln -fs $NVS_DIR/lib $NVS_HOME/lib
ln -fs $NVS_DIR/deps $NVS_HOME/deps
ln -fs $NVS_DIR/package.json $NVS_HOME/package.json
ln -fs $NVS_DIR/defaults.json $NVS_HOME/defaults.json

# Run install script
\. $NVS_DIR/nvs.sh install