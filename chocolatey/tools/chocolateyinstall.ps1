$ErrorActionPreference = 'Stop'; # stop on all errors
$toolsDir   = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$url        = 'https://github.com/jasongin/nvs/releases/download/v1.4.2/nvs-1.4.2.msi' # download url, HTTPS preferred

$packageArgs = @{
  packageName   = $env:ChocolateyPackageName
  unzipLocation = $toolsDir
  fileType      = 'msi' #only one of these: exe, msi, msu
  url           = $url

  softwareName  = 'NVS' #part or all of the Display Name as you see it in Programs and Features. It should be enough to be unique

  checksum      = '87fa567001baea5604e4be03188d6d11ae2a2e055781e5168da5ea2f0f8fb5479aa0c3511b641f5147ef7bbffe03cbff1a36588c1f37a8dd2c27010e24d0d3f9'
  checksumType  = 'sha512' #default is md5, can also be sha1, sha256 or sha512

  # MSI
  silentArgs    = "/quiet" # ALLUSERS=1 DISABLEDESKTOPSHORTCUT=1 ADDDESKTOPICON=0 ADDSTARTMENU=0
  validExitCodes= @(0, 3010, 1641)
}

Install-ChocolateyPackage @packageArgs # https://chocolatey.org/docs/helpers-install-chocolatey-package
