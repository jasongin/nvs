# NVS (Node Version Switcher)

NVS is a cross-platform tool for switching between different versions and forks of [**Node.js**](http://nodejs.org). NVS is itself written in node JavaScript.

## Why yet another version manager tool?
NVS has three significant advantages over similar tools:

1. None of the existing node version manager tools support both Windows and non-Windows platforms. The obvious way to build a cross-platform tool for the node ecosystem is to write the tool itself in node JavaScript. While it may seem to be a "chicken-and-egg" problem for a node-downloader tool to itself require node, that's actually not such a big challenge, and once that is solved then a version manager tool can benefit tremendously from being coded in a language that is both cross-platform and familiar to everyone using it.

2. NVS supports multiple configurable remotes for node downloads, rather than getting node versions only from a single source (`https://nodejs.org/dist/`). That allows for not only switching versions but switching between builds from other forks of node, potentially using other JavaScript engines.

3. NVS uses a combination of `PATH` environment updates to manage the current version and and symbolic links to manage the user or system default node version, in a way that is simple and consistent across platforms.

This tool is obviously inspired by other node version manager tools, especially [**nvm**](https://github.com/creationix/nvm), from which it borrows a lot of ideas and some command-line syntax.

## Installation
NVS currently works on any platform for which Node.js binaries are available. The ability to build and install Node.js from source may be added later.

Before installing, decide on either a single-user installation or a system installation. For individual development, a single-user installation is recommended because then NVS does not require root/admin privileges for any commands. However if multi-user capability is desired, or if NVS should be able to link a version as a system Node.js installation, then it may be installed to a system folder.

By default, downloaded Node.js files are cached under the NVS installation directory. To override this behavior, set the `NVS_HOME` environment variable to another location.

### Windows
A Windows installer package may be available later. Until then these manual steps are simple. Regardless of whether it is initially installed from Command Prompt or PowerShell, NVS will work from either shell afterward.

#### Command Prompt
1. Specify the installation path using *one* of the following commands, for either a single-user or system installation:
```cmd
set NVS_HOME=%LOCALAPPDATA%\nvs
set NVS_HOME=%ProgramFiles%\nvs
```
2. Clone this repo:
```cmd
git clone https://github.com/jasongin/nvs "%NVS_HOME"
```
3. Run the `install` command:
```cmd
"%NVS_HOME%\nvs.cmd" install
```

#### PowerShell

1. Specify the installation path using *one* of the following commands, for either a single-user or system installation:
```powershell
$env:NVS_HOME="$env:LOCALAPPDATA\nvs"
$env:NVS_HOME="$env:ProgramFiles\nvs"
```
2. Clone this repo:
```powershell
git clone https://github.com/jasongin/nvs "$env:NVS_HOME"
```
3. Run the `install` command:
```powershell
. "$env:NVS_HOME\nvs.ps1" install
```

After installation, running just `nvs` from the current shell or any new Command Prompt or PowerShell then invokes either the `nvs.cmd` or `nvs.ps1` script accordingly.

#### Bash on Windows

NVS can also work in [Unbutu Bash on Windows 10](https://msdn.microsoft.com/en-us/commandline/wsl/about) using the following installation instructions. Of course then that instance of NVS and any Node.js versions it installs in that environment are only available to the Ubuntu subsystem.

### Mac, Linux
1. Specify the installation path using *one* of the following commands, for either a single-user or system installation:
```sh
export NVS_HOME="$HOME/.nvs"
export NVS_HOME="/usr/local/nvs"
```
2. Clone this repo:
```sh
git clone https://github.com/jasongin/nvs "$NVS_HOME"
```
3. Source the `install` command:
```sh
. "$NVS_HOME/nvs.sh" install
```

The `nvs.sh` script adds a shell function to the environment. Afterward the tool should be invoked as `nvs`, without any path. The `install` command also adds lines to your `~/.bashrc`, `~/.profile`, or `~/.zshrc` file to source `nvs.sh` so that the `nvs` function is available in future shells.

Note there is also an executable shell script named `nvs` (without the `.sh`), that may be used to invoke the tool without having to first *source* `nvs.sh`. However, when invoked in that way the script cannot update the caller's environment, so the `nvs use` command is disabled. And there is a `nvsudo` shell function that invokes `nvs` under `sudo` while preserving the `PATH` (and thus the *current* node version). The latter may be helpful when NVS is installed in a system directory.

## Command-line usage
Command | Description
------- | -----------
`nvs help <command>`          | Get detailed help for a command
`nvs install`                 | Initialize your profile for using NVS
`nvs uninstall`               | Remove NVS from profile and environment
`nvs --version`               | Display the NVS tool version
`nvs add <version>`           | Download and extract a node version
`nvs rm <version>`            | Remove a node version
`nvs use <version>`           | Use a node version in the current environment
`nvs run <version> [args]...` | Run a script using a node version
`nvs which [version]`         | Show the path to a node version
`nvs ls`                      | List local node versions
`nvs ls-remote [remote]`      | List node versions available to download
`nvs link [version]`          | Link a version as the default
`nvs unlink`                  | Remove links to a default version
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
It's easy to add another remote. The following command sequence adds a remote pointing to nightly builds of node.js, then lists builds from that remote, and adds a build:
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
NVS downloads node builds under the directory specified by the `NVS_HOME` environment variable, or under the NVS tool directory if `NVS_HOME` is not set. Each build goes in a subdirectory based on the remote name, semantic version, and architecture, for example `node/6.7.0/x64`.

When you `nvs use` a version, the `PATH` of the current shell is updated to include that version's `bin` directory.

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
