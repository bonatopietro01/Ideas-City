# Crea il collegamento "AIdeaCity" sul Desktop con il logo dell'app.
$script = Join-Path $PSScriptRoot "avvia.ps1"
$icona = Join-Path $PSScriptRoot "aideacity.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = Join-Path $desktop "AIdeaCity.lnk"

$shell = New-Object -ComObject WScript.Shell
$c = $shell.CreateShortcut($lnk)
$c.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$c.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$c.WorkingDirectory = Split-Path -Parent $PSScriptRoot
$c.IconLocation = "$icona,0"
$c.Description = "Apri AIdeaCity, la città delle idee"
$c.WindowStyle = 7
$c.Save()
Write-Output "Collegamento creato: $lnk"
