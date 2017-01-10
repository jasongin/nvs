/* global settings */
const path = require('path');

const versionRegex =
	/^(([\w\-]+)[\/\-])?((v?(\d+(\.\d+(\.\d+)?)?(-[0-9A-Za-z.]+)?))|([a-z][a-z_\-][0-9a-z_\-]*))(\/((x86)|(32)|((x)?64)|(arm\w*)|(ppc\w*)))?$/i;

class NodeVersion {
	constructor(remoteName, semanticVersion, arch) {
		this.remoteName = remoteName;
		this.semanticVersion = semanticVersion;
		this.arch = arch;
	}

	static get defaultOs() {
		let os = process.platform;
		if (os === 'win32') {
			os = 'win';
		}
		return os;
	}

	static get defaultArch() {
		return NodeVersion._standardArchName(process.arch);
	}

	/**
	 * Parses a node version string into remote name, semantic version, and architecture
	 * components. Infers some unspecified components based on configuration.
	 */
	static parse(versionString, requireFull) {
		if (!versionString) {
			throw new Error('A version parameter is required.');
		}

		// Check if the version string includes an alias, and resolve it.
		let versionParts = versionString.split('/');
		if (versionParts.length < 3 && !requireFull) {
			let resolvedVersion = settings.aliases[versionParts[0]];
			if (resolvedVersion) {
				if (path.isAbsolute(resolvedVersion)) {
					let version = new NodeVersion();
					version.label = versionParts[0];
					version.path = resolvedVersion;
					return version;
				} else {
					versionString = resolvedVersion;
					if (versionParts.length === 2) {
						versionString += '/' + versionParts[1];
					}
				}
			}
		}

		let match = versionRegex.exec(versionString);
		if (!match) {
			throw new Error('Invalid version string: ' + versionString);
		}

		let remoteName = match[2] || null;
		let semanticVersion = match[5] || null;
		let label = match[9];
		let arch = match[11];

		if (requireFull) {
			if (!remoteName) {
				throw new Error('A remote name is required.');
			}
			if (!arch) {
				throw new Error('A processor architecture is required.');
			}
			if (!/\d+\.\d+\.\d+/.test(semanticVersion)) {
				throw new Error('A complete semantic version is required.');
			}
		}

		if (!remoteName && label && label !== 'default' && settings.remotes[label]) {
			remoteName = label;
			label = undefined;
		}

		if (!remoteName && label !== 'current' && label !== 'default') {
			// Use the default remote if none was specified,
			// unless a special "current" or "default" label was specified.
			remoteName = 'default';
		}

		if (remoteName === 'default') {
			remoteName = settings.remotes['default'] || 'node';
		}

		if (!settings.remotes[remoteName] && label !== 'current' && label !== 'default') {
			throw new Error('Remote name not found in settings.json: ' + remoteName);
		}

		if (arch) {
			arch = NodeVersion._standardArchName(arch);
		}

		let version = new NodeVersion(remoteName, semanticVersion);
		version.label = label;
		version.arch = arch;
		return version;
	}

	static _standardArchName(arch) {
		switch (arch) {
			case '32':
			case 'x86':
			case 'ia32':
				return 'x86';
			case '64':
			case 'x64':
			case 'amd64':
				return 'x64';
			default:
				return arch;
		}
	}

	/**
	 * Attempts to parse a version string into parts; returns null on failure instead of throwing
	 * an error.
	 */
	static tryParse(versionString) {
		try {
			return NodeVersion.parse(versionString);
		} catch (e) {
			return null;
		}
	}

	/**
	 * Tests if two node version structures are equal.
	 */
	static equal(versionA, versionB) {
		return versionA.remoteName === versionB.remoteName &&
            versionA.semanticVersion === versionB.semanticVersion &&
            versionA.arch === versionB.arch &&
            versionA.os === versionB.os &&
            versionA.path === versionB.path;
	}

	/**
	 * Sorts versions in descending order, grouped by remote name.
	 */
	static compare(versionA, versionB) {
		if (versionA.path || versionB.path) {
			if (!versionA.path) return -1;
			if (!versionB.path) return 1;
			let pathA = versionA.path.toLowerCase();
			let pathB = versionB.path.toLowerCase();
			return pathA === pathB ? 0 : pathA < pathB ? -1 : 1;
		}

		let remoteNames = Object.keys(settings.remotes);
		let remoteIndexA = remoteNames.indexOf(versionA.remoteName);
		let remoteIndexB = remoteNames.indexOf(versionB.remoteName);
		if (remoteIndexA !== remoteIndexB) {
			return remoteIndexA < remoteIndexB ? -1 : 1;
		}

		if (versionA.semanticVersion !== versionB.semanticVersion) {
			if (!versionA.semanticVersion) {
				return -1;
			} else if (!versionB.semanticVersion) {
				return 1;
			}

			// Note reverse results here for descending version sorting.
			let versionPartsA = versionA.semanticVersion.split('.');
			let versionPartsB = versionB.semanticVersion.split('.');
			if (versionPartsA[0] !== versionPartsB[0]) {
				return (1 * versionPartsA[0] < 1 * versionPartsB[0]) ? 1 : -1;
			} else if (versionPartsA[1] !== versionPartsB[1]) {
				return (1 * versionPartsA[1] < 1 * versionPartsB[1]) && versionPartsB[1] ? 1 : -1;
			} else if (versionPartsA[2] !== versionPartsB[2]) {
				return (1 * versionPartsA[2] < 1 * versionPartsB[2] && versionPartsB[2]) ? 1 : -1;
			}
		}

		if (!versionA.arch || !versionB.arch) {
			return versionA.arch ? 1 : versionB.arch ? -1 : 0;
		}

		if (versionA.arch.toLowerCase() !== versionB.arch.toLowerCase()) {
			return versionA.arch.toLowerCase() < versionB.arch.toLowerCase() ? -1 : 1;
		}

		return 0;
	}

	/**
	 * Tests if a partial version (filter) matches a specific version.
	 */
	match(specificVersion) {
		return (!this.remoteName || this.remoteName === specificVersion.remoteName) &&
			(!this.semanticVersion || this.semanticVersion === specificVersion.semanticVersion ||
				specificVersion.semanticVersion.startsWith(this.semanticVersion + '.') ||
				specificVersion.semanticVersion.startsWith(this.semanticVersion + '-')) &&
			(!this.label || (specificVersion.label &&
				this.label.toLowerCase() === specificVersion.label.toLowerCase())) &&
			(!this.arch || !specificVersion.arch || this.arch === specificVersion.arch) &&
			(!this.os || !specificVersion.os || this.os === specificVersion.os);
	}

	/**
	 * Formats a version as a string, optionally including the version label.
	 * @param this Must be bound to a version object.
	 */
	toString(options) {
		return (options && options.marks ? (this.current && this.default ? '>#'
				: this.current ? ' >' : this.default ? ' #' : this.local ? ' *' : '  ') : '') +
			(this.path ? this.path : this.remoteName + '/' + (this.semanticVersion || this.label)) +
			(this.os && options && options.os ? '/' + this.os : '') +
			(this.arch ? '/' + this.arch : '') +
			(options && options.label && (this.semanticVersion || this.path) && this.label
				? ' (' + this.label + ')' : '');
	}
}

module.exports = NodeVersion;
