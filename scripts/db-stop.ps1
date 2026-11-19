# Stop the local MariaDB server started by scripts\db-start.ps1.

. "$PSScriptRoot\lib.ps1"

if (-not (Test-TcpPort '127.0.0.1' $DbPort)) {
    Write-Host 'MariaDB is not running.'
    Remove-Item (Join-Path $DataDir 'mysql.pid') -ErrorAction SilentlyContinue
    exit 0
}

if (Test-Path $MariaAdmin) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $MariaAdmin -u root -h 127.0.0.1 -P $DbPort shutdown *> $null
    $shutdownCode = $LASTEXITCODE
    $ErrorActionPreference = $previous

    if ($shutdownCode -eq 0 -and (Wait-TcpPortClosed '127.0.0.1' $DbPort 20)) {
        Remove-Item (Join-Path $DataDir 'mysql.pid') -ErrorAction SilentlyContinue
        Write-Host 'MariaDB stopped.'
        exit 0
    }
}

$pidFile = Join-Path $DataDir 'mysql.pid'
if (Test-Path $pidFile) {
    $mysqlPid = [int](Get-Content $pidFile -First 1)
    $process = Get-Process -Id $mysqlPid -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $mysqlPid -Force
        Write-Host "Stopped MariaDB process $mysqlPid."
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    exit 0
}

Write-Host 'Could not stop MariaDB: no PID file and the admin shutdown failed.' -ForegroundColor Red
exit 1
