# NVS (Node Version Switcher)
# Implemented as a POSIX-compliant function.
# To use, source this file from your profile.
# Inspired by NVM (https://github.com/creationix/nvm)
# and other node version switching tools.

# This shell script merely bootstraps node.exe if necessary, then forwards
# arguments to the main nvs.js script.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null && \pwd)"

nvs() {
    # The NVS_HOME path may be overridden in the environment.
    if [ -z "${NVS_HOME-}" ]; then
        export NVS_HOME="${HOME}/.nvs"
    fi

    # Generate 32 bits of randomness, to avoid clashing with concurrent executions.
    export NVS_POSTSCRIPT="${NVS_HOME}/nvs_tmp_$(dd if=/dev/urandom count=1 2> /dev/null | cksum | cut -f1 -d" ").sh"

    local BOOTSTRAP_NODE_PATH="${NVS_HOME}/nvs_node/node"
    if [ ! -f "${BOOTSTRAP_NODE_PATH}" ]; then
        # Download a node binary to use to bootstrap the NVS script.

        if [ ! -d "${NVS_HOME}/nvs_node" ]; then
            command mkdir -p "${NVS_HOME}/nvs_node"
        fi

        local BOOTSTRAP_NODE_VERSION="v6.7.0"

        # TODO: Suppport other OS besides Mac
        local BOOTSTRAP_NODE_OS="darwin"
        local BOOTSTRAP_NODE_ARCH="x64"

        local BOOTSTRAP_NODE_FULLNAME="node-${BOOTSTRAP_NODE_VERSION}-${BOOTSTRAP_NODE_OS}-${BOOTSTRAP_NODE_ARCH}"

        local BOOTSTRAP_NODE_URI="https://nodejs.org/dist/${BOOTSTRAP_NODE_VERSION}/${BOOTSTRAP_NODE_FULLNAME}.tar.gz"
        local BOOTSTRAP_NODE_ARCHIVE="${NVS_HOME}/nvs_node/${BOOTSTRAP_NODE_FULLNAME}.tar.gz"

        echo "Downloading bootstrap node binary..."
        echo "  ${BOOTSTRAP_NODE_URI} -> ${BOOTSTRAP_NODE_ARCHIVE}"
        curl -# "${BOOTSTRAP_NODE_URI}" -o "${BOOTSTRAP_NODE_ARCHIVE}"

        tar -zxvf "${BOOTSTRAP_NODE_ARCHIVE}" -C "${NVS_HOME}/nvs_node" "${BOOTSTRAP_NODE_FULLNAME}/bin/node" > /dev/null 2>&1
        mv "${NVS_HOME}/nvs_node/${BOOTSTRAP_NODE_FULLNAME}/bin/node" "${NVS_HOME}/nvs_node/node"
        rm -r "${NVS_HOME}/nvs_node/${BOOTSTRAP_NODE_FULLNAME}"
        rm "${BOOTSTRAP_NODE_ARCHIVE}"

        if [ ! -f "${BOOTSTRAP_NODE_PATH}" ]; then
            echo "Failed to download boostrap node binary."
            return 1
        fi
    fi

    # Forward args to the main JavaScript file.
    command "${BOOTSTRAP_NODE_PATH}" "${SCRIPT_DIR}/nvs.js" "$@"

    # TODO: Check exit code.

    # Call the post-invocation script if it is present, then delete it.
    # This allows the invocation to potentially modify the caller's environment (e.g. PATH)
    if [ -f "${NVS_POSTSCRIPT}" ]; then
        source "${NVS_POSTSCRIPT}"
        #rm "${NVS_POSTSCRIPT}"
    fi
}
