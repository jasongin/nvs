$ErrorActionPreference = 'Stop'; # stop on all errors
$toolsDir   = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$url        = 'https://github.com/jasongin/nvs/releases/download/v1.5.1/nvs-1.5.1.msi' # download url, HTTPS preferred

$packageArgs = @{
  packageName   = $env:ChocolateyPackageName
  unzipLocation = $toolsDir
  fileType      = 'msi' #only one of these: exe, msi, msu
  url           = $url

  softwareName  = 'NVS' #part or all of the Display Name as you see it in Programs and Features. It should be enough to be unique

  checksum      = '82252d1cbe6e935bf56225efbcba87c2a865f5160dff845eb1e86584a1178608cd41ccc0f43c4d6fa246f1aaae56f6a25db3992d01e875b3a5e2581fa754ec31'
  checksumType  = 'sha512' #default is md5, can also be sha1, sha256 or sha512

  # MSI
  silentArgs    = "/quiet" # ALLUSERS=1 DISABLEDESKTOPSHORTCUT=1 ADDDESKTOPICON=0 ADDSTARTMENU=0
  validExitCodes= @(0, 3010, 1641)
}

Install-ChocolateyPackage @packageArgs # https://chocolatey.org/docs/helpers-install-chocolatey-package
