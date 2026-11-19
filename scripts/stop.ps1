# Stop the public tunnel, the PHP server and MariaDB.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop.ps1
#   powershell -File scripts\stop.ps1 -KeepDatabase

param(
    [switch]$KeepDatabase
)

. "$PSScriptRoot\lib.ps1"

$tunnelPidFile = Join-Path $DataDir 'tunnel.pid'
if (Test-Path $tunnelPidFile) {
    & "$PSScriptRoot\tunnel-stop.ps1"
}

$pidFile = Join-Path $DataDir 'php.pid'
if (Test-Path $pidFile) {
    $phpPid = [int](Get-Content $pidFile -First 1)
    $process = Get-Process -Id $phpPid -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $phpPid -Force
        Write-Host "Stopped the PHP server (pid $phpPid)."
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
    Write-Host 'No PHP server PID file found.'
}

if (-not $KeepDatabase) {
    & "$PSScriptRoot\db-stop.ps1"
}
