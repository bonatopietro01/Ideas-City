# Avvia AIdeaCity: accende il server se è spento e apre l'app nel browser.
$progetto = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:3000"

function Test-Acceso {
  try { (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $false }
}

if (-not (Test-Acceso)) {
  if (-not (Test-Path (Join-Path $progetto "node_modules"))) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install" -WorkingDirectory $progetto -Wait -WindowStyle Minimized
  }
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $progetto -WindowStyle Hidden
  $limite = (Get-Date).AddSeconds(90)
  while (-not (Test-Acceso) -and (Get-Date) -lt $limite) { Start-Sleep -Milliseconds 700 }
}

Start-Process $url
