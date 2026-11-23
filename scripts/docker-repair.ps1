# Fixes Docker Desktop failing to start with errors like
#   "listening on unix://...\Docker\run\dockerInference: remove ...: The file cannot be accessed by the system"
# An unclean shutdown (crash, power loss, killed process) leaves stale socket files that Windows
# cannot delete. Docker then refuses to start. The folders holding them can be renamed, so this
# script moves them aside and starts Docker Desktop again. Nothing is lost: images, containers and
# volumes live elsewhere (in the docker-desktop WSL disk).
$ErrorActionPreference = 'Continue'
Get-Process | Where-Object { $_.ProcessName -match 'Docker' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 3
$stamp = Get-Date -Format yyyyMMddHHmmss
foreach ($p in @("$env:LOCALAPPDATA\Docker\run", "$env:LOCALAPPDATA\docker-secrets-engine")) {
    if (Test-Path -LiteralPath $p) {
        Rename-Item -LiteralPath $p -NewName ((Split-Path $p -Leaf) + ".stale." + $stamp)
        Write-Host "moved aside: $p"
    }
}
Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Minimized
Write-Host "Docker Desktop started. Wait about a minute, then run: docker ps"
