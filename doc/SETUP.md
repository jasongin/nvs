# NVS Setup
NVS currently works on any platform for which Node.js binaries are available. The ability to build and install Node.js from source may be added later.

Before installing, decide on either a single-user installation or a system installation:
  * For individual development, a single-user installation is recommended because then NVS does not require root/admin privileges for any commands.
  * If multi-user functionality is desired, or if NVS should be able to link a version as a system Node.js installation, then it may be installed to a system folder. Adding, removing, or linking node versions will then require root/admin privileges, but *using* a node version will not.

By default, downloaded Node.js files are cached under the NVS installation directory. To override this behavior, set the `NVS_HOME` environment variable to another location.

## Windows
NVS requires PowerShell 3.0, which is included with Windows 8 and later. On Windows 7, get PowerShell 3.0 from [Windows Management Framework 3.0](https://www.microsoft.com/en-us/download/details.aspx?id=34595) (which requires Windows 7 Service Pack 1).

Download and run the Windows Installer (MSI) package from the [Releases page on GitHub](https://github.com/jasongin/nvs/releases). Note the single MSI package supports both x86 and x64 systems and both per-user and per-machine installations.

As an alternative to installing the MSI, the following manual steps may be used to setup NVS on Windows, from either a Command Prompt or PowerShell.

### Manual setup - Command Prompt
1. Specify the installation path using *one* of the following commands, for either a single-user or system installation:
```cmd
set NVS_HOME=%LOCALAPPDATA%\nvs
set NVS_HOME=%ProgramData%\nvs
```
2. Clone this repo:
```cmd
git clone https://github.com/jasongin/nvs "%NVS_HOME%"
```
3. Run the `install` command:
```cmd
"%NVS_HOME%\nvs.cmd" install
```

### Manual setup - PowerShell
1. Specify the installation path using **_one_** of the following two commands:

 - For a current-user installation (recommended):
```powershell
$env:NVS_HOME="$env:LOCALAPPDATA\nvs"
```
 - Or for a system installation:
```powershell
$env:NVS_HOME="$env:ProgramData\nvs"
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

### Git Bash on Windows
NVS can work in Git Bash on Windows (the bash tools installed by [Git](https://git-scm.com/) for Windows), though it requires some manual configuration:

1. Install NVS using the either the Windows MSI, Command Prompt, or PowerShell instructions above.

2. Ensure there is a `.bash_profile` file in your home (`%HOMEDRIVE%%HOMEPATH%`) directory that calls `.bashrc`. Create the file if it doesn't exist. It should include at least the following line:
```sh
if [ -f ~/.bashrc ]; then . ~/.bashrc; fi
```

3. Ensure there is a `.bashrc` file in the same directory. Create the file if it doesn't exist, and add the following lines. (If necessary, replace `$LOCALAPPDATA` with `$ProgramData` or other custom installation path.)
```sh
export NVS_HOME=$LOCALAPPDATA/nvs
. $NVS_HOME/nvs.sh
```

### Ubuntu Bash on Windows 10

NVS can also work in [Unbutu Bash on Windows 10](https://msdn.microsoft.com/en-us/commandline/wsl/about) using the following installation instructions for Linux. Be aware that instance of NVS and any Node.js versions it installs in that environment are only available to the Ubuntu subsystem. It actually downloads and runs the Node.js Linux binaries, _not_ the Windows binaries.

## Mac, Linux
1. Specify the installation path using **_one_** of the following two commands:

 - For a current-user installation (recommended):
```sh
export NVS_HOME="$HOME/.nvs"
```
 - Or for a system installation:
```sh
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

The `nvs.sh` script adds an `nvs` shell function to the environment. Afterward the tool should be invoked as just `nvs` without any path. The `install` command also adds lines to your `~/.bashrc`, `~/.profile`, or `~/.zshrc` file to source `nvs.sh`, so that the `nvs` function is available in future shells.

Note there is also an executable shell script named `nvs` (without the `.sh`), that may be used to invoke the tool without having to first *source* `nvs.sh`. However, when invoked in that way the script cannot update the caller's environment, so the `nvs use` command is disabled. And there is a `nvsudo` shell function that invokes `nvs` under `sudo` while preserving the `PATH` (and thus the *current* node version). The latter may be helpful when NVS is installed in a system directory.
