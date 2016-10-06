:: NVS (Node Version Switcher) CMD script
:: Bootstraps node.exe if necessary, then forwards arguments to the main nvs.js script.
@ECHO OFF

:: The NVS_HOME path may be overridden in the environment.
IF "%NVS_HOME%"=="" SET NVS_HOME=%APPDATA%\nvs

:: Generate 30 bits of randomness, to avoid clashing with concurrent executions.
SET /A NVS_POSTSCRIPT=%RANDOM% * 32768 + %RANDOM%
SET NVS_POSTSCRIPT=%NVS_HOME%\nvs_tmp_%NVS_POSTSCRIPT%.cmd

SETLOCAL ENABLEEXTENSIONS

:: Check if the bootstrap node.exe is present.
SET NVS_BOOTSTRAP_NODE_PATH=%NVS_HOME%\nvs_node\node.exe
IF EXIST %NVS_BOOTSTRAP_NODE_PATH% GOTO :RUN

:BOOTSTRAP
:: Download a node.exe binary to use to bootstrap the NVS script.
IF NOT EXIST %NVS_HOME%\nvs_node MKDIR %NVS_HOME%\nvs_node

SET NVS_BOOTSTRAP_NODE_VERSION=v6.7.0
SET NVS_BOOTSTRAP_NODE_ARCH=x86
IF %PROCESSOR_ARCHITECTURE%==AMD64 SET NVS_BOOTSTRAP_NODE_ARCH=x64

SET NVS_BOOTSTRAP_NODE_URI=https://nodejs.org/dist/%NVS_BOOTSTRAP_NODE_VERSION%/win-%NVS_BOOTSTRAP_NODE_ARCH%/node.exe
ECHO Downloading boostrap node.exe...
ECHO   %NVS_BOOTSTRAP_NODE_URI% -^> %NVS_BOOTSTRAP_NODE_PATH%
powershell.exe -Command " $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%NVS_BOOTSTRAP_NODE_URI%' -OutFile '%NVS_BOOTSTRAP_NODE_PATH%' "
ECHO Done.
ECHO.

IF EXIST %NVS_BOOTSTRAP_NODE_PATH% GOTO :RUN
ECHO Failed to download bootstrap node.exe.
GOTO :CLEANUP

:RUN
:: Forward the args to the main JavaScript file.
"%NVS_BOOTSTRAP_NODE_PATH%" "%~dp0lib\main.js" %*

ENDLOCAL

SET NVS_EXITCODE=%ERRORLEVEL%

:POSTSCRIPT
:: Call the post-invocation script if it is present, then delete it.
:: This allows the invocation to potentially modify the caller's environment (e.g. PATH).
IF NOT EXIST %NVS_POSTSCRIPT% GOTO :CLEANUP
CALL %NVS_POSTSCRIPT%
DEL %NVS_POSTSCRIPT%

:CLEANUP
SET NVS_POSTSCRIPT=

EXIT /B %NVS_EXITCODE%
