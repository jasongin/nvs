# NVS (Node Version Switcher)

NVS is a cross-platform tool for switching between different versions and forks of [**Node.js**](http://nodejs.org). NVS is itself written in node JavaScript.

## Why yet another version manager tool?
None of the existing node version manager tools support both Windows and non-Windows platforms. The obvious way to build a cross-platform tool for the node ecosystem is to write the tool itself in node JavaScript. While it may seem to be a "chicken-and-egg" problem for a node-downloader tool to itself require node, that's actually not such a big challenge, and once that is solved then a version manager tool can benefit tremendously from being coded in a language that is both cross-platform and familiar to everyone using it.

Also, NVS uniquely supports multiple configurable remotes for node downloads, rather than getting node versions only from a single source (`https://nodejs.org/dist/`). That allows for not only switching versions but switching between builds from other forks of node, potentially using other JavaScript engines.

This tool is obviously inspired by other node version manager tools, especially [**nvm**](https://github.com/creationix/nvm), from which it borrows a lot of ideas and some command-line syntax.

## Installation
NVS currently works on any platform for which Node.js binaries are available. The ability to build and install Node.js from source may be added later.

### Windows
1. Clone this repo.
2. Add the repo root directory to your `PATH`.

Running the `nvs` command from Windows then invokes either the `nvs.cmd` or `nvs.ps1` script, depending on whether the shell is Command Prompt or PowerShell.

NVS can also work in Unbutu Bash on Windows 10 using the Linux installation instructions below.

### Mac, Linux
1. Clone this repo.
2. Source the `nvs.sh` script from your `~/.bashrc`, `~/.profile`, or `~/.zshrc` file:
```sh
export NVS_HOME="$HOME/.nvs"
[ -s "$NVS_HOME/nvs.sh" ] && . "$NVS_HOME/nvs.sh"
```
The `nvs.sh` script adds a shell function to the environment. Afterward the tool should be invoked as `nvs`, without any path.

Note there is also an executable shell script named `nvs` (without the `.sh`), that may be used to invoke the tool without having to first *source* `nvs.sh`. However, when invoked in that way the script cannot update the caller's environment, so the `nvs use` command is disabled.

## Command-line usage
Command | Description
------- | -----------
`nvs help <command>`          | Get detailed help for a command
`nvs add <version>`           | Download and install a node version
`nvs rm <version>`            | Uninstall a node version
`nvs use <version>`           | Use a node version in the current environment
`nvs run <version> [args]...` | Run a script using a node version
`nvs which [version]`         | Show the path to a node version
`nvs ls`                      | List installed node versions
`nvs ls-remote [remote]`      | List node versions available to download
`nvs link [version]`          | Create a "default" dir symlink to a version
`nvs unlink [version]`        | Remove a "default" dir symlink
`nvs alias [name] [value]`    | Set or recall aliases for versions
`nvs remote [name] [value]`   | Set or recall download base URIs

A version string consists of a semantic version number or version label ("lts" or "latest"), optionally preceded by a remote name, optionally followed by an architecture, separated by slashes. Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64".

[Refer to the docs](./doc) for more details about each command.

## Configurable remotes
The `nvs remote` command allows configuration of multiple named download locations. NVS manages versions from different remote locations separately, so there is no risk of version collisions across forks. By default there is single `"node"` remote pointing to the official node.js distribution URI:
```
$ nvs remote
default  node
node     https://nodejs.org/dist/
```
It's easy to add another remote. The following command sequence adds a remote pointing to nightly builds of node.js, then lists builds from that remote, and installs a build:
```
$ nvs remote nightly https://nodejs.org/download/nightly/
$ nvs remote
default  node
nightly  https://nodejs.org/download/nightly/
node     https://nodejs.org/dist/
$ nvs lsr nightly
7.0.0-nightly20161006bd0bedb86a ...
$ nvs add nightly/7.0.0-nightly20161006bd0bedb86a
```
## Aliases
An alias refers to a combination of a remote name and a semantic version. (Processor architectures are not aliased.) When setting an alias, the remote name may be omitted, in which case the alias refers to the default remote. An alias may be used in place of a version string in any of the other commands.
```
$ nvs alias myalias 6.7.0
$ nvs alias
myalias default/6.7.0
$ nvs run myalias --version
v6.7.0
$ nvs which myalias
~/.nvs/node/6.7.0/x64/bin/node
$ nvs which myalias/32
~/.nvs/node/6.7.0/x86/bin/node
```
# How it works

## Bootstrapping node
NVS uses a small amount of platform-specific shell code that bootstraps the tool by automatically downloading a private copy of node. The bootstrap code is just a few dozen lines each of Windows command script, Windows powershell script, and POSIX shell script. Besides bootstrapping, the shell scripts are also used to export PATH changes to the calling shell (which a separate node process cannot do). But all the code for querying available versions, downloading and installing node and matching npm, switching versions/architectures/engines, uninstalling, parsing and updating PATH, and more can be written in JavaScript, and mostly in a cross-platform way.

## Version switching
NVS downloads node builds under the directory specified by the `NVS_HOME` environment variable, by default `~/.nvs` (or `%APPDATA%\nvs` on Windows). Each build goes in a subdirectory based on the remote name, semantic version, and architecture, for example `node/6.7.0/x64`.

When you `nvs use` a version, the `PATH` of the current shell is updated to include that version's `bin` directory.

## Symbolic links
The `nvs link` command creates a symbolic directory link at `$NVS_HOME/default` that points to the specified version (or the current version from `PATH` at the time of the command). This can be useful when there is a need to configure a fixed path elsewhere. A new shell that sources the `nvs.sh` script also sets `PATH` to include the default version, if a link is present.

The `nvs ls` command lists all installed versions, marks the version currently in the path with a `>`, and marks the default (linked) version, if any, with a `#`. These may be the same or different. For example:
```
  node/4.5.0/x64
 #node/4.6.0/x64
 >node/6.7.0/x64
```

## Dependencies
NVS has no dependencies beyond the private copy of node that it automatically downloads. The NVS JavaScript code does not currently depend on any non-core node modules. Longer term, as functionality is expanded, it could be possible to add dependencies on additional node modules. The simplest way to do that will be to check them into the repo (avoiding the need for an npm install during bootstrapping), assuming they are pure JavaScript modules.
