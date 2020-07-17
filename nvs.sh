# NVS (Node Version Switcher)
# Implemented as a POSIX-compliant function.
# To use, source this file from your profile.
# Inspired by NVM (https://github.com/creationix/nvm)
# and other node version switching tools.

# This shell script merely bootstraps node.exe if necessary, then forwards
# arguments to the main nvs.js script.

# Try to locate the NVS_ROOT path, where the nvs scripts are installed.
if [ -n "${BASH_SOURCE}" ]; then
	export NVS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" > /dev/null && \pwd)"
else
	if [ -n "${(%):-%x}" ]; then # zsh script source
		export NVS_ROOT="$(cd "$(dirname "${(%):-%x}")" > /dev/null && \pwd)"
	fi 2>/dev/null
	if [ -n "${NVS_HOME}" -a -z ${NVS_ROOT} ]; then
		export NVS_ROOT="${NVS_HOME}"
	fi
fi

# Parse the OS name and architecture from `uname`.
export NVS_OS="$(uname | sed 'y/ABCDEFGHIJKLMNOPQRSTUVWXYZ/abcdefghijklmnopqrstuvwxyz/')"

# When running inside Git bash on Windows, `uname` reports "MINGW64_NT".
case $NVS_OS in mingw64_nt* | msys_nt*)
	export NVS_OS="win"
esac

nvs() {
	# The NVS_HOME path may be overridden in the environment.
	if [ -z "${NVS_HOME}" ]; then
		export NVS_HOME="${NVS_ROOT}"
	fi

	# Generate 32 bits of randomness, to avoid clashing with concurrent executions.
	export NVS_POSTSCRIPT="${NVS_HOME}/nvs_tmp_$(dd if=/dev/urandom count=1 2> /dev/null | cksum | cut -f1 -d" ").sh"

	local NODE_EXE="node"
	if [ "${NVS_OS}" = "win" ]; then
		NODE_EXE="node.exe"
	fi

	local NODE_PATH="${NVS_HOME}/cache/${NODE_EXE}"
	if [ ! -f "${NODE_PATH}" ]; then
		# Parse the bootstrap parameters from defaults.json. This isn't real JSON parsing so
		# its extremely limited, but defaults.json should not be edited by the user anyway.
		local NODE_VERSION="$(grep '"bootstrap" *:' "${NVS_ROOT}/defaults.json" | sed -e 's/.*: *"//' -e 's/"[^\n]*//' -e 's/.*\///')"
		local NODE_REMOTE="$(grep '"bootstrap" *:' "${NVS_ROOT}/defaults.json" | sed -e 's/.*: *"//' -e 's/"[^\n]*//' -e 's/\/.*//')"
		local NODE_BASE_URI="$(grep "\"${NODE_REMOTE}\" *:" "${NVS_ROOT}/defaults.json" | sed -e 's/.*: *"//' -e 's/"[^\n]*//')"

		local NODE_ARCHIVE_EXT=".tar.gz"
		local TAR_FLAGS="-zxvf"
		if [ "${NVS_OS}" = "win" ]; then
			NODE_ARCHIVE_EXT=".7z"
		elif [ "${NVS_USE_XZ}" = "1" ]; then
			NODE_ARCHIVE_EXT=".tar.xz"
			TAR_FLAGS="-Jxvf"
		fi

		# Download a node binary to use to bootstrap the NVS script.
		# SmartOS (SunOS) reports `i86pc` which is synonymous with both x86 and x64.
		local NODE_ARCH="$(uname -m | sed -e 's/x86_64/x64/;s/i86pc/x64/;s/i686/x86/;s/aarch64/arm64/')"
		# On AIX `uname -m` reports the machine ID number of the hardware running the system.
		if [ "${NVS_OS}" = "aix" ]; then
			NODE_ARCH="ppc64"
		fi
		local NODE_FULLNAME="node-v${NODE_VERSION}-${NVS_OS}-${NODE_ARCH}"
		local NODE_URI="${NODE_BASE_URI}v${NODE_VERSION}/${NODE_FULLNAME}${NODE_ARCHIVE_EXT}"
		local NODE_ARCHIVE="${NVS_HOME}/cache/${NODE_FULLNAME}${NODE_ARCHIVE_EXT}"

		if [ ! -d "${NVS_HOME}/cache" ]; then
			command mkdir -p "${NVS_HOME}/cache"
		fi

		echo "Downloading bootstrap node from ${NODE_URI}"
		if type noglob > /dev/null 2>&1; then
			noglob curl -L -# "${NODE_URI}" -o "${NODE_ARCHIVE}"
		else
			curl -L -# "${NODE_URI}" -o "${NODE_ARCHIVE}"
		fi

		if [ ! -f "${NODE_ARCHIVE}" ] && [ "${NODE_ARCHIVE_EXT}" = ".tar.xz" ]; then
			# The .xz download was not found -- fallback to .gz
			NODE_ARCHIVE_EXT=".tar.gz"
			TAR_FLAGS="-zxvf"
			NODE_ARCHIVE="${NVS_HOME}/cache/${NODE_FULLNAME}${NODE_ARCHIVE_EXT}"
			echo "Retry download bootstrap node from ${NODE_URI} in gz format"
			if type noglob > /dev/null 2>&1; then
				noglob curl -L -# "${NODE_URI}" -o "${NODE_ARCHIVE}"
			else
				curl -L -# "${NODE_URI}" -o "${NODE_ARCHIVE}"
			fi
		fi

		if [ ! -f "${NODE_ARCHIVE}" ]; then
			echo "Failed to download node binary."
			return 1
		fi

		if [ "${NVS_OS}" = "win" ]; then
			"${NVS_ROOT}/tools/7-Zip/7zr.exe" e "-o${NVS_HOME}/cache" -y "${NODE_ARCHIVE}" "${NODE_FULLNAME}/${NODE_EXE}" > /dev/null 2>&1
		else
			if [ "${NVS_OS}" = "aix" ]; then
				gunzip "${NODE_ARCHIVE}" | tar -xvC "${NVS_HOME}/cache" "${NODE_FULLNAME}/bin/${NODE_EXE}" > /dev/null 2>&1
			else
				tar $TAR_FLAGS "${NODE_ARCHIVE}" -C "${NVS_HOME}/cache" "${NODE_FULLNAME}/bin/${NODE_EXE}" > /dev/null 2>&1
			fi
			mv "${NVS_HOME}/cache/${NODE_FULLNAME}/bin/${NODE_EXE}" "${NVS_HOME}/cache/${NODE_EXE}" > /dev/null 2>& 1
			rm -r "${NVS_HOME}/cache/${NODE_FULLNAME}" > /dev/null 2>& 1
		fi

		if [ ! -f "${NODE_PATH}" ]; then
			echo "Failed to setup node binary."
			return 1
		fi
		echo ""
	fi

	local EXIT_CODE=0

	# Check if invoked as a CD function that enables auto-switching.
	case "$@" in
		"cd")
			# Find the nearest .node-version file in current or parent directories
			local DIR=$PWD
			while [ "$DIR" != "" -a ! \( -e "$DIR/.node-version" -o -e "$DIR/.nvmrc" \) ]; do
				if [ "$DIR" = "/" ]; then
					DIR=
				else
					DIR=$(dirname "$DIR")
				fi
			done

			# If it's different from the last auto-switched directory, then switch.
			if [ "$DIR" != "$NVS_AUTO_DIRECTORY" ]; then
				command "${NODE_PATH}" "${NVS_ROOT}/lib/index.js" auto
				EXIT_CODE=$?
			fi

			export NVS_AUTO_DIRECTORY=$DIR
			;;
		*)
			# Forward args to the main JavaScript file.
			command "${NODE_PATH}" "${NVS_ROOT}/lib/index.js" "$@"
			EXIT_CODE=$?
			;;
	esac

	if [ ${EXIT_CODE} = 2 ]; then
		# The bootstrap node version is wrong. Delete it and start over.
		rm "${NODE_PATH}"
		nvs $@
	fi

	# Call the post-invocation script if it is present, then delete it.
	# This allows the invocation to potentially modify the caller's environment (e.g. PATH)
	if [ -f "${NVS_POSTSCRIPT}" ]; then
		. "${NVS_POSTSCRIPT}"
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

# export our functions so that subshells and scripts can use them
case "$(ps -p $$)" in
	*bash*)
		export -f nvs nvsudo
		;;
	*ksh*)
		# NOTE: for exports to work in ksh, this script has to be sourced from $ENV (usually ~/.kshrc)
		typeset -xf nvs nvsudo
		;;
esac

if [ ! "${NVS_OS}" = "win" ] && [ ! "${NVS_OS}" = "aix" ]; then
	# Check if `tar` has xz support. Look for a minimum libarchive or gnutar version.
	if [ -z "${NVS_USE_XZ}" ]; then
		export LIBARCHIVE_VER="$(tar --version | sed -n "s/.*libarchive \([0-9][0-9]*\(\.[0-9][0-9]*\)*\).*/\1/p")"
		if [ -n "${LIBARCHIVE_VER}" ]; then
			LIBARCHIVE_VER="$(printf "%.3d%.3d%.3d" $(echo "${LIBARCHIVE_VER}" | sed "s/\\./ /g"))"
			if [ $LIBARCHIVE_VER -ge 002008000 ]; then
				export NVS_USE_XZ=1
				if [ "${NVS_OS}" = "darwin" ]; then
					export MACOS_VER="$(printf "%.3d%.3d%.3d" $(sw_vers -productVersion | sed "s/\\./ /g"))"
					if [ $MACOS_VER -ge 010009000 ]; then
						export NVS_USE_XZ=1
					else
						export NVS_USE_XZ=0
					fi
					unset MACOS_VER
				fi
			else
				export NVS_USE_XZ=0
			fi
		else
			LIBARCHIVE_VER="$(tar --version | sed -n "s/.*(GNU tar) \([0-9][0-9]*\(\.[0-9][0-9]*\)*\).*/\1/p")"
			if [ -n "${LIBARCHIVE_VER}" ]; then
				LIBARCHIVE_VER="$(printf "%.3d%.3d%.3d" $(echo "${LIBARCHIVE_VER}" | sed "s/\\./ /g"))"
				if [ $LIBARCHIVE_VER -ge 001022000 ]; then
					if command -v xz &> /dev/null ; then
						export NVS_USE_XZ=1
					else
						export NVS_USE_XZ=0
					fi
				else
					export NVS_USE_XZ=0
				fi
			fi
		fi
		unset LIBARCHIVE_VER
	fi
fi

# If some version is linked as the default, begin by using that version.
if [ -d "${NVS_HOME}/default" ]; then
	if [ -f "${NVS_HOME}/default/bin/node" ]; then
		export PATH="${NVS_HOME}/default/bin:${PATH}"
		unset NPM_CONFIG_PREFIX
	elif [ -f "${NVS_HOME}/default/node" ]; then
		export PATH="${NVS_HOME}/default:${PATH}"
		unset NPM_CONFIG_PREFIX
	fi
fi

# If sourced with parameters, invoke the function now with those parameters.
if [ -n "$*" -a -z "${NVS_EXECUTE}" ]; then
	nvs $*
fi
