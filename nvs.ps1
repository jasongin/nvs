# NVS (Node Version Switcher) PowerShell script
# Bootstraps node.exe if necessary, then forwards arguments to the main nvs.js script.

# The NVS_HOME path may be overridden in the environment.
if (-not $env:NVS_HOME) {
    $env:NVS_HOME = Join-Path $env:APPDATA "nvs"
}

# Generate 31 bits of randomness, to avoid clashing with concurrent executions.
$env:NVS_POSTSCRIPT = Join-Path $env:NVS_HOME ("" + (Get-Random) + ".PS1")

# Check if the bootstrap node.exe is present.
$bootstrapNodePath = Join-Path $env:NVS_HOME (Join-Path "node" "node.exe")
if (-not (Test-Path $bootstrapNodePath)) {
    # Download a node.exe binary to use to bootstrap the NVS script.

    if (-not (Test-Path (Join-Path $env:NVS_HOME "node"))) {
        New-Item -ItemType Directory -Force -Path (Join-Path $env:NVS_HOME "node")
    }

    $bootstrapNodeVersion = "v6.7.0"
    $bootstrapNodeArch = "x86"
    if ($env:PROCESSOR_ARCHITECTURE -ieq "AMD64") {
        $bootstrapNodeArch = "x64"
    }

    $bootstrapNodeUri = "https://nodejs.org/dist/$bootstrapNodeVersion/win-$bootstrapNodeArch/node.exe"
    Write-Output "Downloading boostrap node.exe..."
    Write-Output "  $bootstrapNodeUri -> $bootstrapNodePath"
    powershell.exe -Command " `$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '$bootstrapNodeUri' -OutFile '$bootstrapNodePath' "
    Write-Output "Done."
    Write-Output ""

    if (-not (Test-Path $bootstrapNodePath)) {
        Write-Error "Failed to download bootstrap node.exe."
        $env:NVS_POSTSCRIPT = $null
        return
    }
}

# Forward the args to the main JavaScript file.
$mainScript = Join-Path (Split-Path $MyInvocation.MyCommand.Path) "nvs.js"
. $bootstrapNodePath $mainScript @args

# TODO: Check exit code

# Call the post-invocation script if it is present, then delete it.
# This allows the invocation to potentially modify the caller's environment (e.g. PATH).
if (Test-Path $env:NVS_POSTSCRIPT) {
    . $env:NVS_POSTSCRIPT
    Remove-Item -Force $env:NVS_POSTSCRIPT
}

$env:NVS_POSTSCRIPT = $null
