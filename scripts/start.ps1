# Start MariaDB (if needed), initialise the schema, then launch the PHP server.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start.ps1
#
# Environment variables: PORT (default 3000), HOST (default 127.0.0.1),
# ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, DB_NAME, DB_USER, DB_PASS.

. "$PSScriptRoot\lib.ps1"

Assert-File $PhpExe 'Run scripts\setup.ps1 first.'

& "$PSScriptRoot\db-start.ps1"
if ($LASTEXITCODE -ne 0) {
    exit 1
}

$code = Invoke-Php @((Join-Path $Root 'scripts\init-db.php'))
if ($code -ne 0) {
    exit 1
}

$listenHost = if ($env:HOST) { $env:HOST } else { '127.0.0.1' }
$listenPort = if ($env:PORT) { [int]$env:PORT } else { 3000 }

if (Test-TcpPort $listenHost $listenPort) {
    Write-Host "Port $listenPort is already in use. Stop the other server or set PORT=<another port>." -ForegroundColor Red
    exit 1
}

$phpArgs = @('-S', "${listenHost}:${listenPort}", '-t', 'public', 'router.php')
$process = Start-Process -FilePath $PhpExe `
    -ArgumentList $phpArgs `
    -WorkingDirectory $Root `
    -RedirectStandardOutput (Join-Path $DataDir 'php-out.log') `
    -RedirectStandardError (Join-Path $DataDir 'php-err.log') `
    -WindowStyle Hidden -PassThru

$process.Id | Set-Content (Join-Path $DataDir 'php.pid')

$ready = $false
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
    try {
        $health = Invoke-RestMethod -Uri "http://${listenHost}:${listenPort}/api/health" -TimeoutSec 2
        if ($health.ok) {
            $ready = $true
            break
        }
    } catch {
        # Keep waiting until the deadline.
    }
}

if (-not $ready) {
    Write-Host 'The PHP server did not start. Log tail:' -ForegroundColor Red
    if (Test-Path (Join-Path $DataDir 'php-err.log')) {
        Get-Content (Join-Path $DataDir 'php-err.log') -Tail 20
    }
    exit 1
}

$adminEmail = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { 'admin@openballot.local' }
$credentialsFile = Join-Path $DataDir 'admin-credentials.txt'
Write-Host ''
Write-Host '  Open Ballot'
Write-Host "  Secure online voting - running at http://${listenHost}:${listenPort}"
Write-Host ''
Write-Host "  Admin email:    $adminEmail"
if ($env:ADMIN_PASSWORD) {
    Write-Host '  Admin password: (from ADMIN_PASSWORD)'
} elseif (Test-Path $credentialsFile) {
    Write-Host '  Admin password: see data\admin-credentials.txt'
} else {
    Write-Host '  Admin password: Admin#2026   <- change this after signing in'
}
Write-Host ''
Write-Host "  Server log:     data\php-err.log"
Write-Host '  Stop with:      .\stop.bat   (or scripts\stop.ps1)'
Write-Host ''
Write-Host '  Put it online:  .\live.bat   (named tunnel if configured, otherwise quick tunnel)'
Write-Host ''
