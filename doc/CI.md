# Using NVS in a CI Environment

NVS can be used in a continuous-integration environment such as [AppVeyor](https://www.appveyor.com/) (Windows) or [Travis CI](https://travis-ci.org/) (Linux, Mac), to test a Node.js app or library on any version of Node.js that NVS can install.

Generally, the following steps should work with any CI system:
 1. In the test matrix, define an environment variable that is the Node.js version to use, using any supported NVS version syntax.
 2. In the installation script, clone NVS. It is strongly recommended to use `git clone --branch` to clone a specific tagged [release version](https://github.com/jasongin/nvs/releases) to ensure consistent results. (Avoid exposure to potential regressions and future semver-major breaking changes.)
 3. Add the NVS directory to the `PATH` (on Windows) or source the `nvs.sh` script.
 4. Use [`nvs add`](ADD.md) and [`nvs use`](USE.md) commands to install the version of Node.js indicated by that environment variable.

The examples below use NVS to run tests on three different Node.js versions:
 - `node/6` - The latest 6.x (LTS) release
 - `nightly/latest` - The latest Node.js nightly build
 - `chakracore/latest` - The latest Node-ChakraCore release

Of course there are many other possibilities: you may specify specific versions such as `6.10.3`, or even use [`nvs remote`](REMOTE.md) to define a URI where some other fork of Node.js may be obtained.

## AppVeyor
Instead of using [AppVeyor's `Install-Product node`](https://www.appveyor.com/docs/lang/nodejs-iojs/) in the installation script, clone NVS and then use NVS commands to install Node.js.

### Example `.appveyor.yml`:
```yaml
version: "{build}"
environment:
  NVS_VERSION: 1.2.0
  matrix:
  - NODEJS_VERSION: node/6
  - NODEJS_VERSION: nightly/latest
  - NODEJS_VERSION: chakracore/latest
install:
# Install NVS.
- git clone --branch v%NVS_VERSION% --depth 1 https://github.com/jasongin/nvs %LOCALAPPDATA%\nvs
- set PATH=%LOCALAPPDATA%\nvs;%PATH%
- nvs --version
# Install the selected version of Node.js using NVS.
- nvs add %NODEJS_VERSION%
- nvs use %NODEJS_VERSION%
- node --version
- npm --version
# Install the application's NPM dependencies.
- npm install --no-optional
build: off
test_script:
- npm test
```

## Travis CI
Travis CI has some built-in support for specifying Node.js versions; normally it would use `nvm` to install them. To use NVS, keep `language: node_js`, but instead of the [top-level `node_js` collection](https://docs.travis-ci.com/user/languages/javascript-with-nodejs/#Specifying-Node.js-versions), use an environment variable to specify the Node.js version. Add multiple definitions of the variable to set up a matrix for testing on multiple Node.js versions.

When testing with Node-ChakraCore, set `dist: trusty` to tell Travis CI to use an Ubuntu 14.04 image; Node-ChakraCore doesn't support Ubuntu 12.04, which Travis CI uses by default.

### Example `.travis.yml`
```yaml
os:
- linux
- osx
dist: trusty
language: node_js
env:
  global:
  - NVS_VERSION=1.2.0
  matrix:
  - NODEJS_VERSION=node/6
  - NODEJS_VERSION=nightly/latest
  - NODEJS_VERSION=chakracore/latest
before_install:
# Install NVS.
- git clone --branch v$NVS_VERSION --depth 1 https://github.com/jasongin/nvs ~/.nvs
- . ~/.nvs/nvs.sh
- nvs --version
install:
# Install the selected version of Node.js using NVS.
- nvs add $NODEJS_VERSION
- nvs use $NODEJS_VERSION
- node --version
- npm --version
# Install the application's NPM dependencies.
- npm install
```

## GitHub API Tokens
When querying and downloading GitHub releases (as with Node-ChakraCore official releases), NVS uses the GitHub API. GitHub enforces rate-limiting on unauthenticated requests to their API, and CI systems can easily bump into that rate limit when they have many jobs using the GitHub API. If that happens, the error output of `nvs add` will indicate the problem:
```
$ nvs add $NODEJS_VERSION
Failed to query GitHub releases: https://github.com/nodejs/node-chakracore/releases/
HTTP response status: 403
{"message":"API rate limit exceeded ...
```

To resolve the issue:
 1. In your [GitHub account settings](https://github.com/settings/tokens), generate a new Personal Access Token with _public access_ permissions (uncheck all the scope boxes).
 2. In the CI job settings web page, define an environment variable named `NVS_GITHUB_TOKEN` and paste in your token. Make the variable hidden/encrypted so it doesn't appear in log files.
 **Do not put the token directly into a `.yml` configuration file.**

NVS automatically uses the value from the `NVS_GITHUB_TOKEN` environment variable to authenticate GitHub API requests.
