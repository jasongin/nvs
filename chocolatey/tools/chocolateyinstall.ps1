$ErrorActionPreference = 'Stop'; # stop on all errors
$toolsDir   = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$url        = 'https://github.com/jasongin/nvs/releases/download/v1.5.0/nvs-1.5.0.msi' # download url, HTTPS preferred

$packageArgs = @{
  packageName   = $env:ChocolateyPackageName
  unzipLocation = $toolsDir
  fileType      = 'msi' #only one of these: exe, msi, msu
  url           = $url

  softwareName  = 'NVS' #part or all of the Display Name as you see it in Programs and Features. It should be enough to be unique

  checksum      = 'f6e753ec426ee41f645334465ab57e61e6e1ab379e9443ec2db10f627da4329dfe3a269c15a6f41b51abfba5be71655c75acc9b3798052c41d99899a0dc01079'
  checksumType  = 'sha512' #default is md5, can also be sha1, sha256 or sha512

  # MSI
  silentArgs    = "/quiet" # ALLUSERS=1 DISABLEDESKTOPSHORTCUT=1 ADDDESKTOPICON=0 ADDSTARTMENU=0
  validExitCodes= @(0, 3010, 1641)
}

Install-ChocolateyPackage @packageArgs # https://chocolatey.org/docs/helpers-install-chocolatey-package
