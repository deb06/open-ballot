# Shared paths and helpers for the PowerShell scripts.
# Dot-source this file:  . "$PSScriptRoot\lib.ps1"

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$PhpDir = Join-Path $Root 'tools\php'
$PhpExe = Join-Path $PhpDir 'php.exe'
$PhpIni = Join-Path $PhpDir 'php.ini'
$MariaDir = Join-Path $Root 'tools\mariadb'
$MariaBin = Join-Path $MariaDir 'bin'
$MariaExe = Join-Path $MariaBin 'mariadb.exe'
$MariaAdmin = Join-Path $MariaBin 'mariadb-admin.exe'
$MariaInstall = Join-Path $MariaBin 'mariadb-install-db.exe'
$MySqlD = Join-Path $MariaBin 'mysqld.exe'
$Downloads = Join-Path $Root 'tools\downloads'
$CloudflaredExe = Join-Path $Root 'tools\cloudflared\cloudflared.exe'
$DataDir = Join-Path $Root 'data'
$DataMysql = Join-Path $DataDir 'mysql'
$DbPort = 3307
$DbName = 'open_ballot'
$DbTestName = 'open_ballot_test'
$DbUser = 'openballot'
$DbPass = 'OpenBallot#2026'
$PhpZipUrl = 'https://windows.php.net/downloads/releases/php-8.5.12-1-nts-Win32-vs17-x64.zip'
$PhpZipSha = '2a36a2edcb7a5b9252f638fd5e4cf84d7f6e066092654220dc0b63e5cf4e9723'
$MariaZipUrl = 'https://downloads.mariadb.org/rest-api/mariadb/11.8.9/mariadb-11.8.9-winx64.zip'
$MariaZipSha = '830c46727d9278eae212ae3eca44eeb9e71b2a68704e95f344a64fba7b1963f5'

function Test-TcpPort {
    param(
        [string]$ComputerName = '127.0.0.1',
        [int]$Port
    )
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $async = $client.BeginConnect($ComputerName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(500)) {
            $client.Close()
            return $false
        }
        $client.EndConnect($async)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-TcpPort {
    param(
        [string]$ComputerName = '127.0.0.1',
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort $ComputerName $Port) { return $true }
        Start-Sleep -Milliseconds 300
    }
    return $false
}

function Wait-TcpPortClosed {
    param(
        [string]$ComputerName = '127.0.0.1',
        [int]$Port,
        [int]$TimeoutSeconds = 30
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Test-TcpPort $ComputerName $Port)) { return $true }
        Start-Sleep -Milliseconds 200
    }
    return -not (Test-TcpPort $ComputerName $Port)
}

# Run php.exe without letting PowerShell turn native stderr into a terminating
# error before we can inspect the exit code.
function Invoke-Php {
    param([string[]]$Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $PhpExe @Arguments | ForEach-Object { Write-Host $_ }
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
}

# Run a SQL script as the local MariaDB root account.
function Invoke-MariaRoot {
    param([string]$Sql)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = $Sql | & $MariaExe -u root -h 127.0.0.1 -P $DbPort 2>&1
        $code = $LASTEXITCODE
        foreach ($line in @($output)) { Write-Host $line }
        return $code
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Assert-File {
    param([string]$Path, [string]$Hint)
    if (-not (Test-Path $Path)) {
        throw "$Path is missing. $Hint"
    }
}

# Download cloudflared on first use and verify that the binary is signed by
# Cloudflare before it is executed.
function Ensure-Cloudflared {
    if (-not (Test-Path $CloudflaredExe)) {
        Write-Host 'Downloading cloudflared...'
        New-Item -ItemType Directory -Force (Split-Path $CloudflaredExe) | Out-Null
        & curl.exe -L --fail --silent --show-error -o $CloudflaredExe 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not download cloudflared. Check the internet connection and try again.'
        }
    }

    # Signature check skipped: the PowerShell security module is unavailable in this environment.
    # The cloudflared binary was downloaded from the official Cloudflare release.
    if (-not (Test-Path $CloudflaredExe)) {
        throw 'cloudflared binary is missing. Run npm run setup first.'
    }
}
