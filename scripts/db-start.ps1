# Start the local MariaDB server (port 3307, data in data\mysql).
# No Windows service and no administrator rights required.

. "$PSScriptRoot\lib.ps1"

if (Test-TcpPort '127.0.0.1' $DbPort) {
    Write-Host "MariaDB is already running on 127.0.0.1:$DbPort."
    exit 0
}

Assert-File $MySqlD 'Run scripts\setup.ps1 first to install the portable stack.'
Assert-File (Join-Path $DataMysql 'mysql') 'Run scripts\setup.ps1 first to initialise the database directory.'

New-Item -ItemType Directory -Force $DataDir | Out-Null

$mysqlArgs = @(
    "--datadir=`"$DataMysql`"",
    "--port=$DbPort",
    "--bind-address=127.0.0.1",
    "--console"
)

$process = Start-Process -FilePath $MySqlD `
    -ArgumentList $mysqlArgs `
    -RedirectStandardOutput (Join-Path $DataDir 'mysql-out.log') `
    -RedirectStandardError (Join-Path $DataDir 'mysql-err.log') `
    -WindowStyle Hidden -PassThru

$process.Id | Set-Content (Join-Path $DataDir 'mysql.pid')

if (-not (Wait-TcpPort '127.0.0.1' $DbPort 30)) {
    Write-Host 'MariaDB did not start. Log tail:' -ForegroundColor Red
    if (Test-Path (Join-Path $DataDir 'mysql-err.log')) {
        Get-Content (Join-Path $DataDir 'mysql-err.log') -Tail 20
    }
    exit 1
}

Write-Host "MariaDB is listening on 127.0.0.1:$DbPort (pid $($process.Id))."
