#!/usr/bin/env bash

LINK_DIR=$1
NVS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Set environment variables
export HOME=~
export NVS_HOME=~/.nvs

# Run install script
\. $NVS_DIR/nvs.sh install

# Link to a specified location to avoid changing shell profile while upgrading
ln -Ffs $NVS_DIR $LINK_DIR