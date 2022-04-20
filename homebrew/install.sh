#!/usr/bin/env bash

NVS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Set environment variables
export HOME=~
export NVS_HOME=~/.nvs

# Run install script
\. $NVS_DIR/nvs.sh install