# NVS (Node Version Switcher)
# Implemented as a POSIX-compliant function.
# To use, source this file from your profile.
# Inspired by NVM (https://github.com/creationix/nvm)
# and other node version switching tools.

# This script merely bootstraps node.exe if necessary, then forwards
# arguments to the main nvs.js script.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null && \pwd)"

nvs() {
    # The NVS_HOME path may be overridden in the environment.
    if [ -z "${NVS_HOME-}" ]; then
        export NVS_HOME="${HOME}/.nvs"
    fi

    # TODO: Define NVS_POSTSCRIPT

    local BOOTSTRAP_NODE_PATH="${NVS_HOME}/node/node"
    if [ ! -f "${BOOTSTRAP_NODE_PATH}" ]; then
        # Download a node binary to use to bootstrap the NVS script.

        if [ ! -d "${NVS_HOME}/node" ]; then
            command mkdir -p "${NVS_HOME}/node"
        fi

        local BOOTSTRAP_NODE_VERSION="v6.7.0"

        # TODO: Suppport other OS besides Mac
        local BOOTSTRAP_NODE_OS="darwin"
        local BOOTSTRAP_NODE_ARCH="x64"

        local BOOTSTRAP_NODE_FULLNAME="node-${BOOTSTRAP_NODE_VERSION}-${BOOTSTRAP_NODE_OS}-${BOOTSTRAP_NODE_ARCH}"

        local BOOTSTRAP_NODE_URI="https://nodejs.org/dist/${BOOTSTRAP_NODE_VERSION}/${BOOTSTRAP_NODE_FULLNAME}.tar.gz"
        local BOOTSTRAP_NODE_ARCHIVE="${NVS_HOME}/node/${BOOTSTRAP_NODE_FULLNAME}.tar.gz"

        echo "Downloading bootstrap node binary..."
        echo "  ${BOOTSTRAP_NODE_URI} -> ${BOOTSTRAP_NODE_ARCHIVE}"
        curl -# "${BOOTSTRAP_NODE_URI}" -o "${BOOTSTRAP_NODE_ARCHIVE}"

        tar -zxvf "${NVS_HOME}/node/${BOOTSTRAP_NODE_FULLNAME}.tar.gz" "${BOOTSTRAP_NODE_FULLNAME}/bin/node" -C "${NVS_HOME}/node" > /dev/null 2>&1
        mv "${NVS_HOME}/node/${BOOTSTRAP_NODE_FULLNAME}/bin/node" "${NVS_HOME}/node/node"
        rm -r "${NVS_HOME}/node/${BOOTSTRAP_NODE_FULLNAME}"
        rm "${NVS_HOME}/node/${BOOTSTRAP_NODE_FULLNAME}.tar.gz"

        if [ ! -f "${BOOTSTRAP_NODE_PATH}" ]; then
            echo "Failed to download boostrap node binary."
            return 1
        fi
    fi

    # Forward args to the main JavaScript file.
    command "${BOOTSTRAP_NODE_PATH}" "${SCRIPT_DIR}/nvs.js" "$@"

    # TODO: Check exit code.

    # TODO: Call the post-invocation script if it is present, then delete it.
    # This allows the invocation to potentially modify the caller's environment (e.g. PATH).

}
