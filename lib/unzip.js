// Implements unzipping on Windows using Windows Script Host.
var zipFile = WScript.Arguments(0);
var targetDir = WScript.Arguments(1);
var shell = new ActiveXObject("Shell.Application");
var zipFileNs = shell.NameSpace(zipFile);
var targetDirNs = shell.NameSpace(targetDir);
var copyFlags = 1028; // No progress UI (4) + no error UI (1024)
targetDirNs.CopyHere(zipFileNs.Items(), copyFlags);
