# NVS (Node Version Switcher) PowerShell script
# Bootstraps node.exe if necessary, then forwards arguments to the main nvs.js script.

$scriptDir = Split-Path $MyInvocation.MyCommand.Path

# The NVS_HOME path may be overridden in the environment.
if (-not $env:NVS_HOME) {
    $env:NVS_HOME = $scriptDir
}

# Generate 31 bits of randomness, to avoid clashing with concurrent executions.
$env:NVS_POSTSCRIPT = Join-Path $env:NVS_HOME ("nvs_tmp_" + (Get-Random) + ".ps1")

# Check if the bootstrap node.exe is present.
$cacheDir = Join-Path $env:NVS_HOME "cache"
$bootstrapNodePath = Join-Path $cacheDir "node.exe"
if (-not (Test-Path $bootstrapNodePath)) {
    # Download a node.exe binary to use to bootstrap the NVS script.

    try {
        if (-not (Test-Path $cacheDir)) {
            New-Item -ItemType Directory -Force -Path $cacheDir -ErrorAction:Stop > $null
        }
        $testFile = Join-Path $cacheDir "check-access.txt"
        New-Item -ItemType File -Force -Path $testFile -ErrorAction:Stop > $null
        Remove-Item -Force -Path $testFile -ErrorAction:Stop > $null
    } catch [UnauthorizedAccessException] {
        Write-Error "No write access to $cacheDir`nTry running again as Administrator."
        exit 1
    }

    $bootstrapNodeVersion = "v6.8.1"
    $bootstrapNodeArch = "x86"
    if ($env:PROCESSOR_ARCHITECTURE -ieq "AMD64" -or $env:PROCESSOR_ARCHITEW6432 -ieq "AMD64") {
        $bootstrapNodeArch = "x64"
    }

    $bootstrapNodeArchive = "node-$bootstrapNodeVersion-win-$bootstrapNodeArch.7z"
    $bootstrapNodeUri = "https://nodejs.org/dist/$bootstrapNodeVersion/$bootstrapNodeArchive"
    $bootstrapNodeArchivePath = Join-Path $env:NVS_HOME (Join-Path "cache" $bootstrapNodeArchive)

    Write-Output "Downloading boostrap node binary..."

    # Download the archive using PowerShell Invoke-WebRequest.
    powershell.exe -Command " `$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '$bootstrapNodeUri' -OutFile '$bootstrapNodeArchivePath' "

    # Extract node.exe from the archive using 7zr.exe.
    . "$env:NVS_HOME\tools\7-Zip\7zr.exe" e "-o$(Split-Path $bootstrapNodePath)" -y "$bootstrapNodeArchivePath" "node-$bootstrapNodeVersion-win-$bootstrapNodeArch\node.exe" > $null

    Write-Output ""

    if (-not (Test-Path $bootstrapNodePath)) {
        Write-Error "Failed to download bootstrap node binary."
        $env:NVS_POSTSCRIPT = $null
        exit 1
    }
}

# Forward the args to the main JavaScript file.
$mainScript = Join-Path $scriptDir "lib\main.js"
. "$bootstrapNodePath" "$mainScript" @args
$exitCode = $LastExitCode

# Call the post-invocation script if it is present, then delete it.
# This allows the invocation to potentially modify the caller's environment (e.g. PATH).
if (Test-Path $env:NVS_POSTSCRIPT) {
    . $env:NVS_POSTSCRIPT
    Remove-Item -Force $env:NVS_POSTSCRIPT
}

$env:NVS_POSTSCRIPT = $null

exit $exitCode
