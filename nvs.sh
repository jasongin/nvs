# NVS (Node Version Switcher)
# Implemented as a POSIX-compliant function.
# To use, source this file from your profile.
# Inspired by NVM (https://github.com/creationix/nvm)
# and other node version switching tools.

# This shell script merely bootstraps node.exe if necessary, then forwards
# arguments to the main nvs.js script.

export NVS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null && \pwd)"

nvs() {
    # The NVS_HOME path may be overridden in the environment.
    if [ -z "${NVS_HOME}" ]; then
        export NVS_HOME="${NVS_ROOT}"
    fi

    # Generate 32 bits of randomness, to avoid clashing with concurrent executions.
    export NVS_POSTSCRIPT="${NVS_HOME}/nvs_tmp_$(dd if=/dev/urandom count=1 2> /dev/null | cksum | cut -f1 -d" ").sh"

    local BOOTSTRAP_NODE_PATH="${NVS_HOME}/cache/node"
    if [ ! -f "${BOOTSTRAP_NODE_PATH}" ]; then
        # Download a node binary to use to bootstrap the NVS script.

        if [ ! -d "${NVS_HOME}/cache" ]; then
            command mkdir -p "${NVS_HOME}/cache"
        fi

        local BOOTSTRAP_NODE_VERSION="v6.9.1"

        local BOOTSTRAP_NODE_OS="$(uname | sed 'y/ABCDEFGHIJKLMNOPQRSTUVWXYZ/abcdefghijklmnopqrstuvwxyz/')"
        local BOOTSTRAP_NODE_ARCH="$(uname -m | sed 's/x86_64/x64/')"

        local BOOTSTRAP_ARCHIVE_EXT=".tar.gz"
        local TAR_FLAGS="-zxvf"
        if [ "${NVS_USE_XZ}" -eq "1" ]; then
            BOOTSTRAP_ARCHIVE_EXT=".tar.xz"
            TAR_FLAGS="-Jxvf"
        fi

        local BOOTSTRAP_NODE_FULLNAME="node-${BOOTSTRAP_NODE_VERSION}-${BOOTSTRAP_NODE_OS}-${BOOTSTRAP_NODE_ARCH}"
        local BOOTSTRAP_NODE_URI="https://nodejs.org/dist/${BOOTSTRAP_NODE_VERSION}/${BOOTSTRAP_NODE_FULLNAME}${BOOTSTRAP_ARCHIVE_EXT}"
        local BOOTSTRAP_NODE_ARCHIVE="${NVS_HOME}/cache/${BOOTSTRAP_NODE_FULLNAME}${BOOTSTRAP_ARCHIVE_EXT}"

        echo "Downloading bootstrap node binary..."
        curl -# "${BOOTSTRAP_NODE_URI}" -o "${BOOTSTRAP_NODE_ARCHIVE}"

        tar $TAR_FLAGS "${BOOTSTRAP_NODE_ARCHIVE}" -C "${NVS_HOME}/cache" "${BOOTSTRAP_NODE_FULLNAME}/bin/node" > /dev/null 2>&1
        mv "${NVS_HOME}/cache/${BOOTSTRAP_NODE_FULLNAME}/bin/node" "${NVS_HOME}/cache/node"
        rm -r "${NVS_HOME}/cache/${BOOTSTRAP_NODE_FULLNAME}"

        if [ ! -f "${BOOTSTRAP_NODE_PATH}" ]; then
            echo "Failed to download boostrap node binary."
            return 1
        fi
        echo ""
    fi

    local EXIT_CODE

    # Check if invoked as a CD function that enables auto-switching.
    if [[ "$@" == "cd" ]]; then
        # Find the nearest .node-version file in current or parent directories
        local DIR=$PWD
        while [[ "$DIR" != "" && ! -e "$DIR/.node-version" ]]; do
            if [[ "$DIR" == "/" ]]; then
                DIR=
            else
                DIR=$(dirname "$DIR")
            fi
        done

        # If it's different from the last auto-switched directory, then switch.
        if [[ "$DIR" != "$NVS_AUTO_DIRECTORY" ]]; then
            command "${BOOTSTRAP_NODE_PATH}" "${NVS_ROOT}/lib/main.js" auto
            EXIT_CODE=$?
        fi

        export NVS_AUTO_DIRECTORY=$DIR
    else
        # Forward args to the main JavaScript file.
        command "${BOOTSTRAP_NODE_PATH}" "${NVS_ROOT}/lib/main.js" "$@"
        EXIT_CODE=$?
    fi

    # Call the post-invocation script if it is present, then delete it.
    # This allows the invocation to potentially modify the caller's environment (e.g. PATH)
    if [ -f "${NVS_POSTSCRIPT}" ]; then
        source "${NVS_POSTSCRIPT}"
        rm "${NVS_POSTSCRIPT}"
        unset NVS_POSTSCRIPT
    fi

    return $EXIT_CODE
}

nvsudo() {
    # Forward the current version path to the sudo environment.
    local NVS_CURRENT=`nvs which`
    if [ -n "${NVS_CURRENT}" ]; then
        NVS_CURRENT=`dirname "${NVS_CURRENT}"`
    fi
    sudo "NVS_CURRENT=${NVS_CURRENT}" "${NVS_ROOT}/nvs" $*
}

# Check if `tar` has xz support. Look for a minimum libarchive or gnutar version.
if [ -z "${NVS_USE_XZ}" ]; then
    export LIBARCHIVE_VER="$(tar --version | sed -n "s/.*libarchive \([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p")"
    if [ -n "${LIBARCHIVE_VER}" ]; then
        LIBARCHIVE_VER="$(printf "%.3d%.3d%.3d" $(echo "${LIBARCHIVE_VER}" | sed "s/\\./ /g"))"
        if [ $LIBARCHIVE_VER -ge 002008000 ]; then
            export NVS_USE_XZ=1
        fi
    else
        LIBARCHIVE_VER="$(tar --version | sed -n "s/.*(GNU tar) \([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\).*/\1/p")"
        if [ -n "${LIBARCHIVE_VER}" ]; then
            LIBARCHIVE_VER="$(printf "%.3d%.3d%.3d" $(echo "${LIBARCHIVE_VER}" | sed "s/\\./ /g"))"
            if [ $LIBARCHIVE_VER -ge 001022000 ]; then
                export NVS_USE_XZ=1
            fi
        fi
    fi
    unset LIBARCHIVE_VER
fi

# If some version is linked, begin by using that version.
if [ -d "${NVS_HOME}/default" ]; then
    export PATH="${NVS_HOME}/default/bin:${PATH}"
    unset NPM_CONFIG_PREFIX
fi

# If sourced with parameters, invoke the function now with those parameters.
if [ -n "$*" -a -z "${NVS_EXECUTE}" ]; then
    nvs $*
fi
