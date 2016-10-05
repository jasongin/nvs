# NVS (Node Version Switcher)

NVS is a cross-platform tool for switching between different versions and forks of [**Node.js**](http://nodejs.org). NVS is itself written in node JavaScript.

## Why yet another version manager tool?
None of the existing node version manager tools support both Windows and non-Windows platforms. The obvious way to build a cross-platform tool for the node ecosystem is to write the tool itself in node JavaScript. While it may seem to be a "chicken-and-egg" problem for a node-downloader tool to itself require node, that's actually not such a big challenge, and once that is solved then a version manager tool can benefit tremendously from being coded in a language that is both cross-platform and familiar to everyone using it.

Also, NVS uniquely supports multiple configurable feeds for node downloads, rather than getting node versions only from a single source (`http://nodejs.org/dist/`). That allows for not only switching versions but switching between builds from other forks of node, potentially using other JavaScript engines.

This tool is obviously inspired by other node version manager tools, especially [**nvm**](https://github.com/creationix/nvm), from which it borrows a lot of ideas and some command-line syntax.

## Installation

### Windows
1. Clone this repo.
2. Add the repo root directory to your `PATH`.

### Mac, Linux, or other Unix
1. Clone this repo.
2. Source the `nvs.sh` script from your `~/.bashrc`, `~/.profile`, or `~/.zshrc` file:
```sh
export NVS_HOME="$HOME/.nvs"
[ -s "$NVS_HOME/nvs.sh" ] && . "$NVS_HOME/nvs.sh"
```

## Command-line usage
Command | Description
------- | -----------
`nvs add <version>`           | Download and install a node version
`nvs rm <version>`            | Uninstall a node version
`nvs use <version>`           | Use a node version in the current environment
`nvs run <version> [args]...` | Run a script using a node version
`nvs ls`                      | List installed node versions
`nvs ls-available [feed]`     | List node versions available to install
`nvs which [version]`         | Show the path to a node version
`nvs link [version]`          | Create a "current" dir symlink to a version
`nvs unlink [version]`        | Remove a "current" dir symlink

A version string consists of a semantic version number or version label ("lts" or "latest"), optionally preceeded by a feed name, optionally followed by an architecture, separated by slashes. Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64"

A feed name is one of the keys from `feeds.json`.

## Configurable feeds
The first time you run NVS, it creates a `feeds.json` file under `$NVS_HOME`. By default it just includes a single `"node"` feed pointing to the official node.js distribution URI:
```json
{
  "default": "node",
  "node": "https://nodejs.org/dist/"
}
```
To add another feed, for example nightly builds of node.js, just add an entry to the JSON file:
```json
{
  "default": "node",
  "node": "https://nodejs.org/dist/",
  "node-nightly": "https://nodejs.org/download/nightly/"
}
```
In the future, the NVS tool may support command-line options as a convenient alternative way to edit these entries.

# How it works

## Bootstrapping node
NVS uses a small amount of platform-specific shell code that bootstraps the tool by automatically downloading a private copy of node. The bootstrap code is just a few dozen lines each of Windows command script, Windows powershell script, and POSIX shell script. Besides bootstrapping, the shell scripts are also used to export PATH changes to the calling shell (which a separate node process cannot do). But all the code for querying available versions, downloading and installing node and matching npm, switching versions/architectures/engines, uninstalling, parsing and updating PATH, and more can be written in JavaScript, and mostly in a cross-platform way.

## Version switching
NVS downloads node builds under the directory specified by the `NVS_HOME` environment variable, by default `~/.nvs` (or `%APPDATA%\nvs` on Windows). Each build goes in a subdirectory based on the feed name, semantic version, and architecture, for example `node/6.7.0/x64`.

When you `nvs use` a version, the `PATH` of the current shell is updated to include that version's `bin` directory.

## Symbolic links
The `nvs link` command creates a symbolic directory link at `$NVS_HOME/current` that points to the specified version (or the current version from `PATH`). This can be useful when there is a need to configure a fixed path elsewhere. A new shell that sources the `nvs.sh` script also sets `PATH` to include the linked version, if a link is present.

The `nvs ls` command lists all installed versions, marks the version currently in the path with a `>`, and marks the version currently linked with a `#`. These may be the same or different. For example:
```
  node/4.5.0/x64
 #node/4.6.0/x64
 >node/6.7.0/x64
```

## Dependencies
NVS has no dependencies beyond the private copy of node that it automatically downloads. The NVS JavaScript code does not currently depend on any non-core node modules. Longer term, as functionality is expanded, it could be possible to add dependencies on additional node modules. The simplest way to do that will be to check them into the repo (avoiding the need for an npm install during bootstrapping), assuming they are pure JavaScript modules.
