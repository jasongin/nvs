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
IF EXIST "%NVS_BOOTSTRAP_NODE_PATH%" GOTO :RUN

:BOOTSTRAP
:: Call the PowerShell flavor of this script to download the bootstrap node.exe.
powershell.exe -NoProfile -ExecutionPolicy Unrestricted -Command ". '%~dp0nvs.ps1' bootstrap"
SET NVS_EXITCODE=%ERRORLEVEL%
IF %NVS_EXITCODE% NEQ 0 GOTO :CLEANUP

:RUN
:: Forward the args to the main JavaScript file.
"%NVS_BOOTSTRAP_NODE_PATH%" "%~dp0lib\index.js" %*

IF NOT "%ERRORLEVEL%"=="2" GOTO :AFTERRUN
:: The bootstrap node version is wrong. Delete it and start over.
DEL "%NVS_BOOTSTRAP_NODE_PATH%"
GOTO :BOOTSTRAP
:AFTERRUN

ENDLOCAL

SET NVS_EXITCODE=%ERRORLEVEL%

:POSTSCRIPT
:: Call the post-invocation script if it is present, then delete it.
:: This allows the invocation to potentially modify the caller's environment (e.g. PATH).
IF NOT EXIST "%NVS_POSTSCRIPT%" GOTO :CLEANUP
CALL "%NVS_POSTSCRIPT%"
DEL "%NVS_POSTSCRIPT%"

:CLEANUP
SET NVS_POSTSCRIPT=

EXIT /B %NVS_EXITCODE%
