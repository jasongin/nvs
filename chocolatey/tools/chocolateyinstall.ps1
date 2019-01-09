$ErrorActionPreference = 'Stop'; # stop on all errors
$toolsDir   = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$url        = 'https://github.com/jasongin/nvs/releases/download/v1.5.2/nvs-1.5.2.msi' # download url, HTTPS preferred

$packageArgs = @{
  packageName   = $env:ChocolateyPackageName
  unzipLocation = $toolsDir
  fileType      = 'msi' #only one of these: exe, msi, msu
  url           = $url

  softwareName  = 'NVS' #part or all of the Display Name as you see it in Programs and Features. It should be enough to be unique

  checksum      = '63cb97e40de8a53196e59c2749b3781b40d0025615ef1d77d9d979c4084a1bbf3de92045e4259a99e14feb76984de1a7d1b7761f18317ac2b4ca87b710946461'
  checksumType  = 'sha512' #default is md5, can also be sha1, sha256 or sha512

  # MSI
  silentArgs    = "/quiet" # ALLUSERS=1 DISABLEDESKTOPSHORTCUT=1 ADDDESKTOPICON=0 ADDSTARTMENU=0
  validExitCodes= @(0, 3010, 1641)
}

Install-ChocolateyPackage @packageArgs # https://chocolatey.org/docs/helpers-install-chocolatey-package
