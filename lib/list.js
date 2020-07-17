// @ts-check
'use strict';

const path = require('path');
const url = require('url');
let fs = require('fs');   // Non-const enables test mocking
let { http, https } = require('../deps/node_modules/follow-redirects/index');  // Non-const enables test mocking
const { HttpProxyAgent } = require('../deps/node_modules/http-proxy-agent/dist/index');
const { HttpsProxyAgent } = require('../deps/node_modules/https-proxy-agent/dist/index');

const settings = require('./settings').settings;
const Error = require('./error');

const NodeVersion = require('./version');
let nvsUse = null;  // Lazy load
let nvsLink = null;  // Lazy load

const githubReleasesRegex =
	/^https?:\/\/github.com\/([^/]+)\/([^/]+)(?:\/releases)?\/?(?:#(.*))?$/;

/**
 * Finds the most recent version matching a filter in locally-available versions, or in a
 * specified (sorted) list of versions.
 *
 * @param {NodeVersion} filter
 * @param {NodeVersion[]} [versions]
 * @returns The fully-resolved version, or null if not found.
 */
function find(filter, versions) {
	if (!versions) {
		versions = getVersions();
	}

	let filteredVersions = filterVersions(filter, versions);
	let uniqueArchs = filteredVersions
		.map(v => v.arch).filter((a, i, self) => a && self.indexOf(a) === i);
	if (uniqueArchs.length > 0) {
		filteredVersions = filteredVersions
			.filter(v => v.arch === (filter.arch || NodeVersion.defaultArch));
	}

	let resolvedVersion = filteredVersions[0];
	if (!resolvedVersion) {
		return null;
	}

	let foundVersion = new NodeVersion(
		resolvedVersion.remoteName,
		resolvedVersion.semanticVersion,
		resolvedVersion.arch || filter.arch || NodeVersion.defaultArch);
	foundVersion.label = resolvedVersion.label;
	foundVersion.path = resolvedVersion.path;
	foundVersion.os = NodeVersion.defaultOs;

	if (resolvedVersion.packages) {
		foundVersion.packages = resolvedVersion.packages;
	}

	return foundVersion;
}

/**
 * @param {NodeVersion} filter
 * @param {NodeVersion[]} versions
 */
function filterVersions(filter, versions) {
	let specialFilter = null;
	if (filter.label === 'latest' || filter.label === 'lts' ||
		filter.label === 'current' || filter.label === 'default') {
		specialFilter = filter.label;
		filter = new NodeVersion(filter.remoteName, filter.semanticVersion, filter.arch);
	}

	let filteredVersions = versions.filter(v => filter.match(v));

	if (specialFilter === 'latest') {
		filteredVersions = filteredVersions.filter(v => !v.path);
	} else if (specialFilter === 'lts') {
		filteredVersions = filteredVersions.filter(v => !v.path && v.label);
	} else if (specialFilter === 'current') {
		filteredVersions = filteredVersions.filter(v => v.current);
	} else if (specialFilter === 'default') {
		filteredVersions = filteredVersions.filter(v => v.default);
	}

	return filteredVersions;
}

/**
 * Lists all locally-available versions of node known to NVS.
 *
 * @param {NodeVersion?} [filter] Optional partial NodeVersion structure used to filter the results.
 * @returns {string[]} An array of lines appropriate for console output.
 */
function list(filter) {
	let versions = getVersions();

	if (filter) {
		versions = filterVersions(filter, versions);
	}

	return versions.map(v => v.toString({ marks: true, label: true }));
}

/**
 * Lists all locally-available versions of node known to NVS and whether they have updates available.
 *
 * @returns {Promise<string[]>} An array of lines appropriate for console output.
 */
function listOutdatedAsync() {
	const semver = require('../deps/node_modules/semver');
	function canUpgrade(v, rv, range) {
		return semver.neq(v.semanticVersion, rv.semanticVersion) && semver.satisfies(rv.semanticVersion, range + v.semanticVersion);
	}

	const versions = getVersions()
		.map(v => {
			return getRemoteVersionsAsync(v.remoteName).then(rvl => {
				let upgrades = '';

				const patchVersions = rvl.filter(rv => canUpgrade(v, rv, '~'));
				if (patchVersions.length > 0) {
					upgrades += ' [~' + patchVersions[0].semanticVersion + ']';
				}

				const minorUpgradeVersions = rvl.filter(rv => canUpgrade(v, rv, '^'));
				if (minorUpgradeVersions.length > 0 && minorUpgradeVersions[0] !== patchVersions[0]) {
					upgrades += ' [^' + minorUpgradeVersions[0].semanticVersion + ']';
				}

				return v.toString({ marks: true, label: false }) + upgrades;
			});
		});
	return Promise.all(versions);
}

/**
 * Gets all locally-available versions of node known to NVS.
 *
 * @param {string} [remoteName] Optional remote name to scope the listing.
 * @param {string} [semanticVersion] Optional specific semantic version to scope the listing.
 * @param {string} [arch] Optional processor architecture filter for the listing.
 * @returns {NodeVersion[]} An array of version objects.
 */
function getVersions(remoteName, semanticVersion, arch) {
	nvsUse = nvsUse || require('./use');
	nvsLink = nvsLink || require('./link');

	let versions = getVersionsInternal(remoteName, semanticVersion, arch);

	let currentVersion = nvsUse.getCurrentVersion();
	let defaultVersion = nvsLink.getLinkedVersion();

	Object.keys(settings.aliases).forEach(name => {
		let value = settings.aliases[name];
		if (path.isAbsolute(value)) {
			let version = new NodeVersion();
			version.label = name;
			version.path = value;
			versions.push(version);
		}
	});

	versions.forEach(v => {
		v.current = currentVersion && NodeVersion.equal(currentVersion, v);
		v.default = defaultVersion && NodeVersion.equal(defaultVersion, v);
	});
	versions = versions.sort(NodeVersion.compare);

	return versions;
}

function getVersionsInternal(remoteName, semanticVersion, arch) {
	let readdirIfExists = dir => {
		try {
			return fs.readdirSync(dir);
		} catch (e) {
			Error.throwIfNot(Error.ENOENT, e, 'Cannot access directory: ' + dir);
			return [];
		}
	};

	let result = [];
	if (!remoteName) {
		// Scan all directories under the home directory, which might be remote names.
		let childNames = readdirIfExists(settings.home);
		childNames.forEach(childName => {
			let childPath = path.join(settings.home, childName);
			let stats = fs.lstatSync(childPath);
			if (stats.isDirectory() && childName !== 'node_modules') {
				result = result.concat(getVersionsInternal(childName, semanticVersion, arch));
			}
		});
	} else if (!semanticVersion) {
		// Scan all directories under the remote directory, which might be semantic versions.
		let childNames = readdirIfExists(path.join(settings.home, remoteName));
		childNames.forEach(childName => {
			let childPath = path.join(settings.home, remoteName, childName);
			let stats = fs.lstatSync(childPath);
			if (stats.isDirectory()) {
				result = result.concat(getVersionsInternal(remoteName, childName, arch));
			}
		});
	} else if (!arch) {
		// Scan all directories under the semantic version directory, which might be architectures.
		let childNames = readdirIfExists(path.join(
			settings.home, remoteName, semanticVersion));
		childNames.forEach(childName => {
			let childPath = path.join(settings.home, remoteName, semanticVersion, childName);
			let stats = fs.lstatSync(childPath);
			if (stats.isDirectory()) {
				result = result.concat(getVersionsInternal(remoteName, semanticVersion, childName));
			}
		});
	} else {
		// Check if a valid full version directory was found.
		let version = NodeVersion.tryParse(remoteName + '/' + semanticVersion + '/' + arch);
		if (version) {
			try {
				let versionProperties = JSON.parse(fs.readFileSync(
					path.join(nvsUse.getVersionDir(version), '.nvs'), 'utf8'));
				if (versionProperties) {
					version.label = versionProperties.label;
				}
			} catch (e) {
				Error.throwIfNot(Error.ENOENT, e);
			}

			let binPath = nvsUse.getVersionBinary(version);
			if (binPath) {
				result.push(version);
			}
		}
	}
	return result;
}

/**
 * Lists node versions available to download, according to a downloaded remote index file.
 *
 * @param filter Optional partial NodeVersion structure used to filter the results.
 * @returns {Promise<string[]>} An array of lines appropriate for console output.
 */
function listRemoteAsync(filter) {
	let remoteName = filter && filter.remoteName;
	if (!remoteName) {
		remoteName = settings.remotes['default'];
		if (!remoteName) {
			throw new Error('No default remote is set in settings.json');
		}
	}

	return getRemoteVersionsAsync(remoteName).then(versions => {
		if (filter) {
			versions = filterVersions(filter, versions);
			if (filter.label === 'latest' && versions.length > 0) {
				versions = [versions[0]];
			}
		}

		// return versions.map(v => v.toString({ marks: true, label: true }) +
		//     '\n' + v.packages.map(f => '    ' + f.uri).join('\n'));
		return versions.map(v => v.toString({ marks: true, label: true }));
	});
}

/**
 * Cache of remote versions, used for memoization of `getRemoteVersionsAsync()`.
 * (This is exposed so the cache can be manipulated for testing purposes.)
 * @type Map<string, Promise<NodeVersion[]>>
 */
getRemoteVersionsAsync.cache = new Map();

/**
 * Gets node versions available to download, according to downloaded remote index file(s).
 *
 * @param {string} [remoteName] Required name of one of the remotes configured in settings.json.
 * @returns {Promise<NodeVersion[]>} An array of version objects.
 */
function getRemoteVersionsAsync(remoteName) {
	if (getRemoteVersionsAsync.cache.has(remoteName)) {
		return Promise.resolve(getRemoteVersionsAsync.cache.get(remoteName));
	}
	let res = _getRemoteVersionsAsync(remoteName);
	getRemoteVersionsAsync.cache.set(remoteName, res);
	return res;
}

/**
 * @param {string} [remoteName]
 * @returns {Promise<NodeVersion[]>}
 */
function _getRemoteVersionsAsync(remoteName) {
	if (!remoteName || remoteName === 'default') {
		remoteName = settings.remotes['default'] || 'node';
	}

	let remoteUri = settings.remotes[remoteName];
	if (!remoteUri) {
		return Promise.reject(new Error('No URI found in settings.json for remote: ' + remoteName));
	}

	let localVersions = getVersions(remoteName);
	let currentVersion = localVersions.find(v => v.current);
	let defaultVersion = localVersions.find(v => v.default);

	// Ignore the processor architecture when comparing to current and default.
	if (currentVersion) delete currentVersion.arch;
	if (defaultVersion) delete defaultVersion.arch;

	/** @type Promise<NodeVersion[]> */
	let asyncResult;
	if (path.isAbsolute(remoteUri)) {
		asyncResult = getNetworkRemoteVersionsAsync(remoteName, remoteUri);
	} else if (githubReleasesRegex.test(remoteUri)) {
		asyncResult = getGithubRemoteVersionsAsync(remoteName, remoteUri);
	} else {
		asyncResult = getNodejsRemoteVersionsAsync(remoteName, remoteUri);
	}

	return asyncResult.then(remoteVersions => {
		return remoteVersions.map(version => {
			version.local = !!localVersions.find(v =>
				v.remoteName === remoteName &&
				v.semanticVersion === version.semanticVersion);
			version.current = currentVersion && NodeVersion.equal(currentVersion, version);
			version.default = defaultVersion && NodeVersion.equal(defaultVersion, version);
			return version;
		}).sort(NodeVersion.compare);
	});
}

/**
 * Parse an index.json file for available versions.
 * @returns {Promise<NodeVersion[]>}
 */
function getNodejsRemoteVersionsAsync(remoteName, remoteUri) {
	let remoteIndexUri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') + 'index.json';

	const secure = remoteIndexUri.startsWith('https:');
	const httpGet = secure
		? https.get.bind(https) : http.get.bind(http);
	const proxy = secure
		? process.env.https_proxy || process.env.HTTPS_PROXY
		: process.env.http_proxy || process.env.HTTP_PROXY;
	const Agent = secure ? HttpsProxyAgent : HttpProxyAgent;
	/** @type {any} */
	let opt = url.parse(remoteIndexUri);
	if (proxy) opt.agent = new Agent(proxy);
	return new Promise((resolve, reject) => {
		httpGet(opt, (res) => {
			if (res.statusCode === 200) {
				let responseBody = '';
				res.on('data', (data) => {
					responseBody += data;
				});
				res.on('end', () => {
					let remoteIndex;
					try {
						remoteIndex = JSON.parse(responseBody);
					} catch (e) {
						reject(new Error('Failed to parse index: ' + remoteIndexUri, e));
						return;
					}

					if (!Array.isArray(remoteIndex)) {
						reject(new Error('Remote index.json is not an array.'));
					} else {
						let versions = remoteIndex
							.map(nodeReleaseInfoToVersion.bind(null, remoteName, remoteUri))
							.filter(v => v);
						resolve(versions);
					}
				});
			} else if (res.statusCode === 404) {
				reject(new Error('Remote index file not found: ' + remoteIndexUri,
					new Error('HTTP response status: ' + res.statusCode)));
			} else {
				reject(new Error('Failed to download index: ' + remoteIndexUri,
					new Error('HTTP response status: ' + res.statusCode)));
			}
		}).on('error', (e) => {
			reject(new Error('Failed to download index: ' + remoteIndexUri, e));
		});
	});
}

/**
 * Convert one entry from an index.json file to a NodeVersion structure.
 */
function nodeReleaseInfoToVersion(remoteName, remoteUri, release) {
	let semanticVersion = release.version;
	if (!semanticVersion.startsWith('v') ||
		(semanticVersion.startsWith('v0') && !/^v0.[7-9]|1[0-9]/.test(semanticVersion))
	) {
		// Filter out very old versions (< v0.7) that are not supported by NVS.
		return null;
	}

	semanticVersion = semanticVersion.substr(1);

	if (!Array.isArray(release.files)) {
		return null;
	}

	let packages = [];
	let binaryNameReturned = release.binary;
	let extReturned = release.ext;
	release.files.forEach(f => {
		let fileParts = f.split('-');
		let os = fileParts[0];
		let arch = fileParts[1];
		let ext = fileParts[2];

		if (!arch) {
			return;
		}

		if (os === 'win') {
			// Official Node.js builds from before about July 2016 did not publish .7z or .zip
			// archives for Windows. For those versions, the MSI package is used instead.
			// It contains all the same files, but is a little bigger and slower to extract.
			// The MSI is not actually installed, though it is assumed that the contained
			// files are laid out in a consistent way.
			if (settings.useMsi ||
					// iojs versions
					NodeVersion.getBinaryNameFromVersion(semanticVersion) === 'iojs' ||
					// nodejs versions
					/^0\./.test(semanticVersion) ||
					/^4\.[0-4]\./.test(semanticVersion) ||
					/^5\./.test(semanticVersion) ||
					/^6\.[0-1]\./.test(semanticVersion) ||
					/^6\.2\.0/.test(semanticVersion)) {
				ext = '.msi';
			} else {
				ext = '.7z';
			}
		} else {
			// Official builds before 0.12.10, 0.10.42 or 0.8.* did not publish .tar.xz packages.
			if (process.env['NVS_USE_XZ'] === '1' && !(
				/^0\.12\.[0-9]$/.test(semanticVersion) ||
				/^0\.11\./.test(semanticVersion) ||
				/^0\.10\.4[0-1]$/.test(semanticVersion) ||
				/^0\.10\.[1-3]?[0-9]$/.test(semanticVersion) ||
				/^0\.8\./.test(semanticVersion))
			) {
				ext = '.tar.xz';
			} else {
				ext = '.tar.gz';
			}

			if (os === 'osx') {
				os = 'darwin';
			}
		}
		if (extReturned) {
			ext = extReturned;
		}

		let uri;
		let binaryName = binaryNameReturned || NodeVersion.getBinaryNameFromVersion(semanticVersion);
		if (ext === '.msi') {
			uri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') +
				'v' + semanticVersion + '/' + binaryName + '-v' + semanticVersion +
				'-' + arch + ext;
			if (/^0\./.test(semanticVersion) && arch === 'x64') {
				// In 0.x versions, the x64 MSI is under an x64 subdirectory.
				uri = uri.substr(0, uri.lastIndexOf('/') + 1) +
					arch + '/' + binaryName + '-v' + semanticVersion +
					'-' + arch + ext;
			}
		} else {
			uri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') +
				'v' + semanticVersion + '/' + binaryName + '-v' + semanticVersion +
				'-' + os + '-' + arch + ext;
		}

		let version = new NodeVersion(remoteName, semanticVersion, arch);
		version.os = os;
		version.uri = uri;
		version.ext = ext;
		version.shasumUri = remoteUri + (remoteUri.endsWith('/') ? '' : '/') +
			'v' + semanticVersion + '/SHASUMS256.txt';

		if (!packages.find(v => NodeVersion.equal(version, v))) {
			packages.push(version);
		}
	});

	if (packages.length === 0) {
		// Omit releases that don't have any recognizable packages.
		return null;
	}

	let version = new NodeVersion(remoteName, semanticVersion);
	version.label = release.lts;
	version.packages = packages;
	return version;
}

/**
 * Query the GitHub releases API for available versions.
 * @returns {Promise<NodeVersion[]>}
 */
function getGithubRemoteVersionsAsync(remoteName, remoteUri) {
	let match = githubReleasesRegex.exec(remoteUri);
	if (!match) {
		throw new Error('Invalid GitHub releases URI: ' + remoteUri);
	}

	const owner = match[1];
	const repo = match[2];
	const filter = match[3] ? new RegExp(match[3]) : null;

	return new Promise((resolve, reject) => {
		let headers = {
			'User-Agent': 'NVS (github.com/jasongin/nvs)',
		};

		let token = process.env['NVS_GITHUB_TOKEN'];
		if (token) {
			headers['Authorization'] = 'token ' + token;
		}

		https.get({
			hostname: 'api.github.com',
			path: `/repos/${owner}/${repo}/releases`,
			headers,
		}, (res) => {
			let responseBody = '';
			res.on('data', (data) => {
				responseBody += data;
			});
			res.on('end', () => {
				if (res.statusCode === 200) {
					let releases;
					try {
						releases = JSON.parse(responseBody);
					} catch (e) {
						reject(new Error('Failed to parse GitHub releases query result: ' +
							remoteUri, e));
						return;
					}

					let versions = releases
						.map(githubReleaseInfoToVersion.bind(null, remoteName, repo, filter))
						.filter(v => v);
					resolve(versions);
				} else if (res.statusCode === 404) {
					reject(new Error('GitHub releases not found: ' + remoteUri,
						new Error('HTTP response status: ' + res.statusCode)));
				} else {
					reject(new Error('Failed to query GitHub releases: ' + remoteUri,
						new Error('HTTP response status: ' + res.statusCode +
						(responseBody ? '\n' + responseBody : ''))));
				}
			});
		}).on('error', (e) => {
			reject(new Error('Failed to query GitHub releases: ' + remoteUri, e));
		});
	});
}

/**
 * Convert a github release entry to a NodeVersion structure.
 */
function githubReleaseInfoToVersion(remoteName, repo, filter, release) {
	let semanticVersion = release.tag_name;
	if (!semanticVersion) {
		return null;
	}

	if (semanticVersion.startsWith(repo + '-')) {
		semanticVersion = semanticVersion.substr(repo.length + 1);
	}

	if (semanticVersion.startsWith('v')) {
		semanticVersion = semanticVersion.substr(1);
	}

	if (!/^[0-9]+(\.[0-9]+)?(\.[0-9]+)?(-.*)?$/.test(semanticVersion)) {
		return null;
	}

	if (!Array.isArray(release.assets)) {
		return null;
	}

	const supportedExtensions = ['.tar.gz', '.tar.xz', '.zip', '.7z', '.msi'];

	let packages = release.assets.map(a => {
		let fileName = path.basename(a.browser_download_url || '').toLowerCase();
		let ext = supportedExtensions.find(ext => fileName.endsWith(ext));
		if (!ext) {
			return null;
		}

		let fileNameParts = path.basename(fileName, ext).split('-');
		let arch = fileNameParts[fileNameParts.length - 1];
		let os = (ext === '.msi' ? 'win' : fileNameParts[fileNameParts.length - 2]);
		if (!arch || !os) {
			return null;
		}

		if (filter && !filter.test(fileName)) {
			return null;
		}

		let v = new NodeVersion(remoteName, semanticVersion, arch);
		v.os = os;
		v.uri = a.browser_download_url;
		v.ext = ext;
		return v;
	}).filter(v => v);

	if (packages.length === 0) {
		// Omit releases that don't have any recognizable packages.
		return null;
	}

	let version = new NodeVersion(remoteName, semanticVersion);
	version.packages = packages;
	return version;
}

/**
 * Scan a local directory or network share for available versions.
 * @returns {Promise<NodeVersion[]>}
 */
function getNetworkRemoteVersionsAsync(remoteName, pathPattern) {
	pathPattern = pathPattern.replace(/\/|\\/g, path.sep);

	const versionToken = '{version}';
	const archToken = '{arch}';
	const osToken = '{os}';
	let versionTokenIndex = pathPattern.indexOf(versionToken);
	let archTokenIndex = pathPattern.indexOf(archToken);
	if (versionTokenIndex < 0 || archTokenIndex < 0) {
		return Promise.reject(new Error('Invalid network path for remote: ' + remoteName +
			'; ' + versionToken + ' and ' + archToken + ' tokens are required.'));
	}

	let baseDir = pathPattern.substr(0, versionTokenIndex);
	if (!baseDir.endsWith(path.sep)) {
		// The version token starts in the middle of a directory name, so
		// exclude that whole directory name from the base directory path.
		baseDir = path.dirname(baseDir);
	}

	return new Promise((resolve, reject) => {
		fs.readdir(baseDir, (e, childNames) => {
			if (e) {
				reject(new Error(
					e.code === Error.ENOENT
						? 'Remote ' + remoteName + ' path not found: ' + baseDir
						: 'Failed to access remote ' + remoteName + ' path: ' + baseDir, e));
			}

			let versions = [];
			let addVersionToList = i => {
				let semanticVersion = childNames[i];
				if (!semanticVersion) {
					resolve(versions);
					return;
				}

				if (!/^[0-9]+(\.[0-9]+)?(\.[0-9]+)?(-.*)?$/.test(semanticVersion)) {
					addVersionToList(i + 1);
					return;
				}

				const os = process.platform.replace('win32', 'win');
				let versionDir = pathPattern
					.substr(0, versionTokenIndex + versionToken.length)
					.replace(versionToken, semanticVersion);
				fs.stat(versionDir, (e, stats) => {
					if (e || !stats.isDirectory()) {
						addVersionToList(i + 1);
						return;
					}

					// TODO: Add support for other processor architectures here.
					let x86ArchivePath = pathPattern
						.replace(versionToken, semanticVersion)
						.replace(osToken, os)
						.replace(archToken, 'x86');
					let x64ArchivePath = pathPattern
						.replace(versionToken, semanticVersion)
						.replace(osToken, os)
						.replace(archToken, 'x64');
					fs.access(x86ArchivePath, e1 => {
						fs.access(x64ArchivePath, e2 => {
							if (!e1 || !e2) {
								let version = new NodeVersion(remoteName, semanticVersion);
								version.packages = [];

								if (!e1) {
									let x86Package = new NodeVersion(
										remoteName, semanticVersion, 'x86');
									x86Package.uri = x86ArchivePath;
									x86Package.os = os;
									x86Package.ext = path.extname(x86ArchivePath);
									version.packages.push(x86Package);
								}
								if (!e2) {
									let x64Package = new NodeVersion(
										remoteName, semanticVersion, 'x64');
									x64Package.uri = x86ArchivePath;
									x64Package.os = os;
									x64Package.ext = path.extname(x86ArchivePath);
									version.packages.push(x64Package);
								}

								versions.push(version);
							}
							addVersionToList(i + 1);
						});
					});
				});
			};
			addVersionToList(0);
		});
	});
}

module.exports = {
	find,
	list,
	listOutdatedAsync,
	getVersions,
	listRemoteAsync,
	getRemoteVersionsAsync,
	getNodejsRemoteVersionsAsync,
	getGithubRemoteVersionsAsync,
	getNetworkRemoteVersionsAsync,
};
