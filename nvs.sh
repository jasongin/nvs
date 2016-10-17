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
        export NVS_HOME="${SCRIPT_DIR}"
    fi

    # Generate 32 bits of randomness, to avoid clashing with concurrent executions.
    export NVS_POSTSCRIPT="${NVS_HOME}/nvs_tmp_$(dd if=/dev/urandom count=1 2> /dev/null | cksum | cut -f1 -d" ").sh"

    local BOOTSTRAP_NODE_PATH="${NVS_HOME}/cache/node"
    if [ ! -f "${BOOTSTRAP_NODE_PATH}" ]; then
        # Download a node binary to use to bootstrap the NVS script.

        if [ ! -d "${NVS_HOME}/cache" ]; then
            command mkdir -p "${NVS_HOME}/cache"
        fi

        local BOOTSTRAP_NODE_VERSION="v6.8.1"

        local BOOTSTRAP_NODE_OS="$(uname | sed 'y/ABCDEFGHIJKLMNOPQRSTUVWXYZ/abcdefghijklmnopqrstuvwxyz/')"
        local BOOTSTRAP_NODE_ARCH="$(uname -m | sed 's/x86_64/x64/')"

        local BOOTSTRAP_NODE_FULLNAME="node-${BOOTSTRAP_NODE_VERSION}-${BOOTSTRAP_NODE_OS}-${BOOTSTRAP_NODE_ARCH}"
        local BOOTSTRAP_NODE_URI="https://nodejs.org/dist/${BOOTSTRAP_NODE_VERSION}/${BOOTSTRAP_NODE_FULLNAME}.tar.gz"
        local BOOTSTRAP_NODE_ARCHIVE="${NVS_HOME}/cache/${BOOTSTRAP_NODE_FULLNAME}.tar.gz"

        echo "Downloading bootstrap node binary..."
        echo "  ${BOOTSTRAP_NODE_URI} -> ${BOOTSTRAP_NODE_ARCHIVE}"
        curl -# "${BOOTSTRAP_NODE_URI}" -o "${BOOTSTRAP_NODE_ARCHIVE}"

        tar -zxvf "${BOOTSTRAP_NODE_ARCHIVE}" -C "${NVS_HOME}/cache" "${BOOTSTRAP_NODE_FULLNAME}/bin/node" > /dev/null 2>&1
        mv "${NVS_HOME}/cache/${BOOTSTRAP_NODE_FULLNAME}/bin/node" "${NVS_HOME}/cache/node"
        rm -r "${NVS_HOME}/cache/${BOOTSTRAP_NODE_FULLNAME}"

        if [ ! -f "${BOOTSTRAP_NODE_PATH}" ]; then
            echo "Failed to download boostrap node binary."
            return 1
        fi
    fi

    # Forward args to the main JavaScript file.
    command "${BOOTSTRAP_NODE_PATH}" "${SCRIPT_DIR}/lib/main.js" "$@"
    local EXIT_CODE=$?

    # Call the post-invocation script if it is present, then delete it.
    # This allows the invocation to potentially modify the caller's environment (e.g. PATH)
    if [ -f "${NVS_POSTSCRIPT}" ]; then
        source "${NVS_POSTSCRIPT}"
        rm "${NVS_POSTSCRIPT}"
        export NVS_POSTSCRIPT=
    fi

    return $EXIT_CODE
}

nvsudo() {
    # Forward the current version path to the sudo environment.
    local NVS_CURRENT=`nvs which`
    if [ -n "${NVS_CURRENT}" ]; then
        NVS_CURRENT=`dirname "${NVS_CURRENT}"`
    fi
    sudo "NVS_CURRENT=${NVS_CURRENT}" "${SCRIPT_DIR}/nvs" $*
}

# If some version is linked, begin by using that version.
if [ -d "${NVS_HOME}/default" ]; then
    export PATH="${NVS_HOME}/default/bin:${PATH}"
fi

# If sourced with parameters, invoke the function now with those parameters.
if [ -n "$*" -a -z "${NVS_EXECUTE}" ]; then
    nvs $*
fi
