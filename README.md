# NVS (Node Version Switcher)

[![Build Status: Mac + Linux](https://travis-ci.org/jasongin/nvs.svg?branch=master)](https://travis-ci.org/jasongin/nvs) [![Build status: Windows](https://ci.appveyor.com/api/projects/status/p0mo0nobkf0ws7ie/branch/master?svg=true)](https://ci.appveyor.com/project/jasongin/nvs)

NVS is a cross-platform utility for switching between different versions and forks of [**Node.js**](http://nodejs.org). NVS is itself written in node JavaScript.

This tool is obviously inspired by other node version manager tools, especially [**nvm**](https://github.com/creationix/nvm), from which it borrows a lot of ideas and some command-line syntax.

## Setup
Following are basic setup instructions. [For more details and options for setting up NVS, refer to the Setup page.](doc/SETUP.md)

### Windows
A Windows Installer (MSI) package is available from the [NVS releases page on GitHub](https://github.com/jasongin/nvs/releases).

You can also use [chocolatey](https://chocolatey.org) to install it:
```
choco install nvs
```

### Mac, Linux
Specify the installation path, clone the repo, and *source* the `install` command:
```
export NVS_HOME="$HOME/.nvs"
git clone https://github.com/jasongin/nvs "$NVS_HOME"
. "$NVS_HOME/nvs.sh" install
```

The `nvs.sh` script adds an `nvs` shell function to the environment. Afterward the tool should be invoked as just `nvs` without any path. The `install` command adds lines to your `~/.bashrc`, `~/.profile`, or `~/.zshrc` file to source `nvs.sh`, so that the `nvs` function is available in future shells.

For ksh, the source `nvs.sh` needs to be in your `~/.kshrc` or wherever `$ENV` points.

### CI Environments
[NVS can be used in a CI environment](doc/CI.md) such as AppVeyor or Travis CI, to test a Node.js app or library on any version of Node.js that NVS can install.

## Basic usage
To add the latest version of node:
```
$ nvs add latest
```
Or to add the latest LTS version of node:
```
$ nvs add lts
```
Then run the `nvs use` command to add a version of node to your PATH for the current shell:
```
$ nvs use lts
PATH += ~/.nvs/node/6.9.1/x64
```
To add it to PATH permanently, use `nvs link`:
```
$ nvs link lts
```

## Command reference
Command | Description
------- | -----------
`nvs help <command>`             | Get detailed help for a command
`nvs install`                    | Initialize your profile for using NVS
`nvs uninstall`                  | Remove NVS from profile and environment
`nvs --version`                  | Display the NVS tool version
`nvs add [version]`              | Download and extract a node version
`nvs rm <version>`               | Remove a node version
`nvs migrate <fromver> [tover]`  | Migrate global modules
`nvs upgrade [fromver]`          | Upgrade to latest patch of major version
`nvs use [version]`              | Use a node version in the current shell
`nvs auto [on/off]`              | Automatically switch based on cwd
`nvs run <ver> <js> [args...]`   | Run a script using a node version
`nvs exec <ver> <exe> [args...]` | Run an executable using a node version
`nvs which [version]`            | Show the path to a node version binary
`nvs ls [filter]`                | List local node versions
`nvs ls-remote [filter]`         | List node versions available to download
`nvs link [version]`             | Link a version as the default
`nvs unlink [version]`           | Remove links to a default version
`nvs alias [name] [value]`       | Set or recall aliases for versions
`nvs remote [name] [value]`      | Set or recall download base URIs

A version or filter consists of a complete or partial semantic version number or version label  ("lts", "latest", "Argon", etc.), optionally preceded by a remote name, optionally followed by an architecture, separated by slashes. Examples: "lts", "4.6.0", "6/x86", "node/6.7/x64".

[Refer to the docs](./doc) for more details about each command.

## Interactive menus
When invoked with no parameters, `nvs` displays an interactive menu for switching and downloading node versions.

![nvs menu](https://github.com/jasongin/nvs/releases/download/v0.8.0/nvs-menu.gif)

*NVS uses [**console-menu**](https://github.com/jasongin/console-menu), a module originally written for this project then published separately.*

## VS Code support
Visual Studio Code can use NVS to select a node version to use when launching or debugging. In `launch.json`, add a `"runtimeArgs"` attribute with an NVS version string and a `"runtimeExecutable"` attribute that refers to `nvs.cmd` (Windows) or `nvs` (Mac, Linux). (You may need to specify an absolute path such as `"${env:HOME}/.nvs/nvs"` if NVS is not in VS Code's PATH.)

Example: Configure `launch.json` so VS Code uses NVS to launch node version 6.10:
```json
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${file}",
      "args": [ ],
      "runtimeArgs": [ "6.10" ],
      "windows": { "runtimeExecutable": "nvs.cmd" },
      "osx": { "runtimeExecutable": "nvs" },
      "linux": { "runtimeExecutable": "nvs" }
    },
```

Or, remove the version string from `"runtimeArgs"` to get the version from a `.node-version` file in the project directory. For more details, see the [NVS VS Code documentation](doc/VSCODE.md) or run `nvs help vscode`.

## Configurable remotes
The `nvs remote` command allows configuration of multiple named download locations. NVS manages versions from different remote locations separately, so there is no risk of version collisions. By default there is a single remote pointing to Node.js official releases:
```
$ nvs remote
default  node
node     https://nodejs.org/dist/
```
This makes it possible to get builds from other sources. The following command sequence adds a remote entry for nightly builds, lists nightly builds, and adds a build:
```
$ nvs remote add nightly https://nodejs.org/download/nightly/
$ nvs lsr nightly/13
nightly/13.1.1-nightly20191120c7c566023f
...
$ nvs add nightly/13
```

Other remote sources are supported, for example:
```
nvs remote add iojs https://iojs.org/dist/
nvs remote add chakracore https://nodejs.org/download/chakracore-release/
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
[An alias may also refer to a local directory](doc/ALIAS.md#aliasing-directories), enabling NVS to switch to a local private build of node.

## Automatic switching per directory
In either Bash or PowerShell, NVS can automatically switch the node version in the current shell as you change directories. This function is disabled by default; to enable it run `nvs auto on`. Afterward, whenever you `cd` or `pushd` under a directory containing a `.node-version` or an [`.nvmrc`](https://github.com/nvm-sh/nvm#nvmrc) file then NVS will automatically switch the node version accordingly, downloading a new version if necessary. When you `cd` out to a directory with no `.node-version` or `.nvmrc` file anywhere above it, then the default (linked) version is restored, if any.
```
~$ nvs link 6.9.1
~/.nvs/default -> ~/.nvs/node/6.9.1/x64
~$ nvs use
PATH += ~/.nvs/default/bin
~$ nvs auto on
~$ cd myproject
PATH -= ~/.nvs/default/bin
PATH += ~/.nvs/node/4.6.1/x64/bin
~/myproject$ cd ..
PATH -= ~/.nvs/node/4.6.1/x64/bin
PATH += ~/.nvs/default/bin
```
*This feature is not available in Windows Command Prompt. Use PowerShell instead.*

## Manual switching using `.node-version`
If your shell isn't compatible with automatic switching or you'd prefer to switch manually but still take advantage of any `.node-version` or `.nvmrc` files, you can run `nvs use` with the version `auto` or just run `nvs auto`.

```
$ nvs use auto
```

is equivalent to

```
$ nvs auto
```

# How it works

## Bootstrapping node
NVS uses a small amount of platform-specific shell code that bootstraps the tool by automatically downloading a private copy of node. The bootstrap code is just a few dozen lines each of Windows command script, Windows powershell script, and POSIX shell script. Besides bootstrapping, the shell scripts are also used to export PATH changes to the calling shell (which a separate node process cannot do). But all the code for querying available versions, downloading and installing node and matching npm, switching versions/architectures/engines, uninstalling, parsing and updating PATH, and more can be written in JavaScript, and mostly in a cross-platform way.

## Version switching
NVS downloads node builds under the directory specified by the `NVS_HOME` environment variable, or under the NVS tool directory if `NVS_HOME` is not set. Each build goes in a subdirectory based on the remote name, semantic version, and architecture, for example `node/6.7.0/x64`.

When you `nvs use` a version, the `PATH` of the current shell is updated to include that version's `bin` directory.

## Global modules
When using `npm install -g` or `npm link` with NVS-installed node, global modules are installed or linked into a version-specific directory. (NVS clears any `NPM_CONFIG_PREFIX` environment variable that may have been set.) This means when NVS switches versions it is also switching the set of available global modules. The `nvs migrate` command can migrate those global modules from one node version to another.

## Symbolic links
The `nvs link` command creates a symbolic directory link at `$NVS_HOME/default` that points to the specified version (or the current version from `PATH` at the time of the command). This can be useful when there is a need to configure a fixed path elsewhere.

On non-Windows platforms, a new shell that sources the `nvs.sh` script also sets `PATH` to include the default version, if a link is present. On Windows, the `PATH` environment variable is updated in the user profile, so that new shells will use the default version.

The `nvs ls` command lists all local node versions, marks the version currently in the path with a `>`, and marks the default (linked) version, if any, with a `#`. These may be the same or different. For example:
```
  node/4.5.0/x64
 #node/4.6.0/x64
 >node/6.7.0/x64
```

## System linking
If `$NVS_HOME` is under a system path such as `/usr/local` or `%ProgramFiles%`, then the `nvs link` command additionally links into well-known Node.js system locations. (This is only allowed if there is not already a system-installed node.)

* On non-Windows platforms, symbolic links are created in `/usr/local/bin` for `node`, `npm`, and any globally-installed node modules that have executables. Note after installing or uninstalling global modules that include executables it may be necessary to run `nvs link` again to update the global links. Using NVS to link a different version of node (with different global modules) updates all the links accordingly.

* On Windows, a symbolic directory link is created at `%ProgramFiles%\Nodejs`, and that directory is added to the system `PATH`.

This system linking functionality is skipped when `$NVS_HOME` points to a non-system directory, because it would be wrong to create symlinks in system directories to user files.

## Dependencies
NVS has no external dependencies beyond the private copy of node that it automatically downloads. Runtime JS package dependencies are minimal and are checked in to the repo to avoid the need for an `npm install` at bootstrapping time.
