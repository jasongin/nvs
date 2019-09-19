# NVS (Node Version Switcher) PowerShell script
# Bootstraps node.exe if necessary, then forwards arguments to the main nvs.js script.

$scriptDir = $PSScriptRoot
$mainScript = Join-Path $scriptDir "lib\index.js"

# The NVS_HOME path may be overridden in the environment.
if (-not $env:NVS_HOME) {
	$env:NVS_HOME = $scriptDir
}

if (-not ($args -eq "bootstrap")) {
	# Generate 31 bits of randomness, to avoid clashing with concurrent executions.
	$env:NVS_POSTSCRIPT = Join-Path $env:NVS_HOME ("nvs_tmp_" + (Get-Random -SetSeed $PID) + ".ps1")
}

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

	# Parse the bootstrap parameters from defaults.json.
	$bootstrapNodeVersion = ((Get-Content -Raw $scriptDir\defaults.json | ConvertFrom-Json |% "bootstrap") -replace ".*/")
	$bootstrapNodeRemote = ((Get-Content -Raw $scriptDir\defaults.json | ConvertFrom-Json |% "bootstrap") -replace "/.*")
	$bootstrapNodeBaseUri = (Get-Content -Raw $scriptDir\defaults.json | ConvertFrom-Json |% "remotes" |% $bootstrapNodeRemote)

	$bootstrapNodeArch = "x86"
	if ($env:PROCESSOR_ARCHITECTURE -ieq "AMD64" -or $env:PROCESSOR_ARCHITEW6432 -ieq "AMD64") {
		$bootstrapNodeArch = "x64"
	}

	$bootstrapNodeArchive = "node-v$bootstrapNodeVersion-win-$bootstrapNodeArch.7z"
	$bootstrapNodeUri = "$($bootstrapNodeBaseUri)v$bootstrapNodeVersion/$bootstrapNodeArchive"
	$bootstrapNodeArchivePath = Join-Path $env:NVS_HOME (Join-Path "cache" $bootstrapNodeArchive)

	Write-Output "Downloading boostrap node from $bootstrapNodeUri"

	# Download the archive using PowerShell Invoke-WebRequest.
	powershell.exe -Command " `$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '$bootstrapNodeUri' -OutFile '$bootstrapNodeArchivePath' "

	# Extract node.exe from the archive using 7zr.exe.
	. "$scriptDir\tools\7-Zip\7zr.exe" e "-o$(Split-Path $bootstrapNodePath)" -y "$bootstrapNodeArchivePath" "node-v$bootstrapNodeVersion-win-$bootstrapNodeArch\node.exe" > $null

	Write-Output ""

	if (-not (Test-Path $bootstrapNodePath)) {
		Write-Error "Failed to download bootstrap node binary."
		$env:NVS_POSTSCRIPT = $null
		exit 1
	}
}

if ($args -eq "bootstrap") {
	# This script was invoked by nvs.cmd just for bootstrapping.
	exit 0
}
elseif ($args -eq "prompt") {
	# This script was invoked as a PS prompt function that enables auto-switching.
	Invoke-Expression $env:NVS_ORIGINAL_PROMPT

	# Find the nearest .node-version file in current or parent directories
	for ($parentDir = $pwd.Path; $parentDir; $parentDir = Split-Path $parentDir) {
		if ((Test-Path (Join-Path $parentDir ".node-version") -PathType Leaf) -or (Test-Path (Join-Path $parentDir ".nvmrc") -PathType Leaf)) { break }
	}

	# If it's still the same as the last auto-switched directory, then there's nothing to do.
	if ([string]$parentDir -eq [string]$env:NVS_AUTO_DIRECTORY) {
		exit 0
	}
	$env:NVS_AUTO_DIRECTORY = $parentDir

	# Output needs to be redirected to Write-Host, because stdout is ignored by prompt.
	# Process a byte at a time so that output like progress bars is real-time.
	$startInfo = New-Object System.Diagnostics.ProcessStartInfo $bootstrapNodePath
	$startInfo.Arguments = ($mainScript, "auto", "at", $pwd.Path)
	$startInfo.UseShellExecute = $false
	$startInfo.RedirectStandardOutput = $true
	$proc = [System.Diagnostics.Process]::Start($startInfo)
	while (($b = $proc.StandardOutput.Read()) -ne -1) {
		Write-Host -NoNewline ([char]$b)
	}
	$proc.WaitForExit
	$exitCode = $proc.ExitCode
}
else {
	# Forward the args to the main JavaScript file.
	. "$bootstrapNodePath" "$mainScript" @args
	$exitCode = $LastExitCode
}

if ($exitCode -eq 2) {
	# The bootstrap node version is wrong. Delete it and start over.
	Remove-Item "$bootstrapNodePath"
	. "$scriptDir\nvs.ps1" $args
	$exitCode = $LastExitCode
}

# Call the post-invocation script if it is present, then delete it.
# This allows the invocation to potentially modify the caller's environment (e.g. PATH).
if ($env:NVS_POSTSCRIPT -and (Test-Path $env:NVS_POSTSCRIPT)) {
	. $env:NVS_POSTSCRIPT
	Remove-Item -Force $env:NVS_POSTSCRIPT
}

$env:NVS_POSTSCRIPT = $null
exit $exitCode
