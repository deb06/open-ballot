# Back up the Open Ballot database and secret.key.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup.ps1
param(
    [string]$BackupDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'data\backups')
)

$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root 'data'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $BackupDir $stamp
New-Item -ItemType Directory -Force -Path $target | Out-Null

# Database dump
$mysqldump = Join-Path $Root 'tools\mariadb\bin\mysqldump.exe'
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { 'open_ballot' }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { 'openballot' }
$dbPass = if ($env:DB_PASS) { $env:DB_PASS } else { 'OpenBallot#2026' }
$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { '3307' }

& $mysqldump -h $dbHost -P $dbPort -u $dbUser "-p$dbPass" --single-transaction --routines $dbName 2>$null |
    Out-File -FilePath (Join-Path $target 'open_ballot.sql') -Encoding utf8

# Secret key (required to verify receipts)
if (Test-Path (Join-Path $DataDir 'secret.key')) {
    Copy-Item (Join-Path $DataDir 'secret.key') (Join-Path $target 'secret.key') -Force
}

Write-Host "Backup written to $target"