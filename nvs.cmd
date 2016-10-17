:: NVS (Node Version Switcher) CMD script
:: Bootstraps node.exe if necessary, then forwards arguments to the main nvs.js script.
@ECHO OFF

:: The NVS_HOME path may be overridden in the environment.
IF "%NVS_HOME%"=="" SET NVS_HOME=%~dp0

:: Generate 30 bits of randomness, to avoid clashing with concurrent executions.
SET /A NVS_POSTSCRIPT=%RANDOM% * 32768 + %RANDOM%
SET NVS_POSTSCRIPT=%NVS_HOME%\nvs_tmp_%NVS_POSTSCRIPT%.cmd

SETLOCAL ENABLEEXTENSIONS

:: Check if the bootstrap node.exe is present.
SET NVS_BOOTSTRAP_NODE_PATH=%NVS_HOME%\cache\node.exe
IF EXIST %NVS_BOOTSTRAP_NODE_PATH% GOTO :RUN

:BOOTSTRAP
:: Download a node.exe binary to use to bootstrap the NVS script.
IF NOT EXIST %NVS_HOME%\cache MKDIR %NVS_HOME%\cache

SET NVS_BOOTSTRAP_NODE_VERSION=v6.8.1
SET NVS_BOOTSTRAP_NODE_ARCH=x86
IF %PROCESSOR_ARCHITECTURE%==AMD64 SET NVS_BOOTSTRAP_NODE_ARCH=x64

SET NVS_BOOTSTRAP_NODE_ARCHIVE=node-%NVS_BOOTSTRAP_NODE_VERSION%-win-%NVS_BOOTSTRAP_NODE_ARCH%.7z
SET NVS_BOOTSTRAP_NODE_URI=https://nodejs.org/dist/%NVS_BOOTSTRAP_NODE_VERSION%/%NVS_BOOTSTRAP_NODE_ARCHIVE%
set NVS_BOOTSTRAP_NODE_ARCHIVE_PATH=%NVS_HOME%\cache\%NVS_BOOTSTRAP_NODE_ARCHIVE%

ECHO Downloading boostrap node binary...
ECHO   %NVS_BOOTSTRAP_NODE_URI% -^> %NVS_BOOTSTRAP_NODE_ARCHIVE_PATH%

:: Download the archive using PowerShell Invoke-WebRequest.
powershell.exe -Command " $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%NVS_BOOTSTRAP_NODE_URI%' -OutFile '%NVS_BOOTSTRAP_NODE_ARCHIVE_PATH%' "

:: Extract node.exe from the archive using 7zr.exe.
"%NVS_HOME%\tools\7-Zip\7zr.exe" e "-o%NVS_HOME%\cache" "%NVS_BOOTSTRAP_NODE_ARCHIVE_PATH%" "node-%NVS_BOOTSTRAP_NODE_VERSION%-win-%NVS_BOOTSTRAP_NODE_ARCH%\node.exe" > nul

ECHO Done.
ECHO.

IF EXIST %NVS_BOOTSTRAP_NODE_PATH% GOTO :RUN
ECHO Failed to download bootstrap node binary.
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
