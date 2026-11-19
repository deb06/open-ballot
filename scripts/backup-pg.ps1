<#
.SYNOPSIS
Dump the Open Ballot PostgreSQL database to a timestamped .sql.gz file.

Usage:
  .\scripts\backup-pg.ps1
  npm run db:backup
#>
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\lib.ps1"

$pgDump = Join-Path $Root 'tools\pgsql\bin\pg_dump.exe'
$outDir = Join-Path $Root 'backups'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$host = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
$port = if ($env:DB_PORT) { $env:DB_PORT } else { '5433' }
$name = if ($env:DB_NAME) { $env:DB_NAME } else { 'open_ballot' }
$user = if ($env:DB_USER) { $env:DB_USER } else { 'postgres' }

if (-not (Test-Path $pgDump)) {
    Write-Error "pg_dump not found at $pgDump. Install portable PostgreSQL first."
    exit 1
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $outDir "open-ballot-$stamp.sql"
Write-Host "Dumping $name from ${host}:$port to $out ..."
& $pgDump -h $host -p $port -U $user -d $name -F p -f $out
if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump failed"; exit 1 }

$gzip = Get-Command gzip -ErrorAction SilentlyContinue
if ($gzip) { & gzip -f $out; $out += '.gz' }
Write-Host "Backup complete: $out"
