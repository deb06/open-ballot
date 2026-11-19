# One-time portable setup: PHP 8.5 + MariaDB 11.8 under tools\.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1
#
# Downloads are only performed when the binaries are missing. Nothing is
# installed system-wide and no Windows services are created.

. "$PSScriptRoot\lib.ps1"

function Get-CheckedDownload {
    param(
        [string]$Url,
        [string]$Destination,
        [string]$Sha256
    )
    New-Item -ItemType Directory -Force (Split-Path $Destination) | Out-Null
    Write-Host "Downloading $(Split-Path $Destination -Leaf)..."
    & curl.exe -L --fail --silent --show-error -o $Destination $Url
    if ($LASTEXITCODE -ne 0) {
        throw "Download failed: $Url"
    }
    $actual = (Get-FileHash $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Sha256.ToLowerInvariant()) {
        Remove-Item $Destination -Force -ErrorAction SilentlyContinue
        throw "Checksum mismatch for $(Split-Path $Destination -Leaf)."
    }
}

Write-Host ''
Write-Host '  Open Ballot - portable PHP + MariaDB setup'
Write-Host ''

New-Item -ItemType Directory -Force $Downloads, $DataDir | Out-Null

if (-not (Test-Path $PhpExe)) {
    $phpZip = Join-Path $Downloads 'php.zip'
    if (-not (Test-Path $phpZip)) {
        Get-CheckedDownload -Url $PhpZipUrl -Destination $phpZip -Sha256 $PhpZipSha
    }
    Write-Host 'Extracting PHP...'
    if (Test-Path $PhpDir) {
        Remove-Item $PhpDir -Recurse -Force
    }
    Expand-Archive $phpZip -DestinationPath $PhpDir -Force
}

if (-not (Test-Path $PhpIni)) {
    $logPath = (Join-Path $DataDir 'php-error.log') -replace '\\', '/'
    @"
[PHP]
extension_dir = "ext"
extension=pdo_mysql
extension=mysqli
extension=mbstring
extension=openssl
extension=curl
memory_limit = 256M
max_execution_time = 30
display_errors = Off
display_startup_errors = Off
log_errors = On
error_log = "$logPath"
date.timezone = "UTC"
default_charset = "UTF-8"
session.save_handler = files
"@ | Set-Content -Encoding ASCII $PhpIni
}

& $PhpExe -r "exit(extension_loaded('pdo_mysql') ? 0 : 1);"
if ($LASTEXITCODE -ne 0) {
    throw 'PHP is installed but the pdo_mysql extension is not available.'
}

if (-not (Test-Path $MySqlD)) {
    $mariaZip = Join-Path $Downloads 'mariadb.zip'
    if (-not (Test-Path $mariaZip)) {
        Get-CheckedDownload -Url $MariaZipUrl -Destination $mariaZip -Sha256 $MariaZipSha
    }
    Write-Host 'Extracting MariaDB...'
    $extract = Join-Path $Root 'tools\_maria'
    if (Test-Path $extract) {
        Remove-Item $extract -Recurse -Force
    }
    if (Test-Path $MariaDir) {
        Remove-Item $MariaDir -Recurse -Force
    }
    Expand-Archive $mariaZip -DestinationPath $extract -Force
    $inner = Get-ChildItem $extract -Directory | Select-Object -First 1
    if (-not $inner) {
        throw 'The MariaDB archive did not contain a directory.'
    }
    Move-Item $inner.FullName $MariaDir
    Remove-Item $extract -Recurse -Force
}

if (-not (Test-Path (Join-Path $DataMysql 'mysql'))) {
    Write-Host 'Initialising the MariaDB data directory...'
    & $MariaInstall -d $DataMysql -P $DbPort
    if ($LASTEXITCODE -ne 0) {
        throw 'mariadb-install-db failed.'
    }
}

& "$PSScriptRoot\db-start.ps1"
if ($LASTEXITCODE -ne 0) {
    throw 'MariaDB could not be started.'
}

Write-Host 'Creating databases and the application user...'
$sql = @"
CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS $DbTestName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DbUser'@'127.0.0.1' IDENTIFIED BY '$DbPass';
CREATE USER IF NOT EXISTS '$DbUser'@'localhost' IDENTIFIED BY '$DbPass';
GRANT ALL PRIVILEGES ON $DbName.* TO '$DbUser'@'127.0.0.1';
GRANT ALL PRIVILEGES ON $DbName.* TO '$DbUser'@'localhost';
GRANT ALL PRIVILEGES ON $DbTestName.* TO '$DbUser'@'127.0.0.1';
GRANT ALL PRIVILEGES ON $DbTestName.* TO '$DbUser'@'localhost';
FLUSH PRIVILEGES;
"@
$code = Invoke-MariaRoot $sql
if ($code -ne 0) {
    throw 'Could not create the databases. Is a different MySQL server already using port 3307?'
}

$code = Invoke-Php @((Join-Path $Root 'scripts\init-db.php'), '--verbose')
if ($code -ne 0) {
    throw 'Database initialisation failed.'
}

Write-Host ''
Write-Host '  Setup complete.' -ForegroundColor Green
Write-Host ''
Write-Host '  Start the app:  powershell -File scripts\start.ps1   (or .\start.bat)'
Write-Host '  Run the tests:  powershell -File scripts\test.ps1    (or npm test)'
Write-Host ''
Write-Host '  Admin email:    admin@openballot.local'
Write-Host '  Admin password: Admin#2026   <- change it after signing in'
Write-Host ''
Write-Host '  MariaDB root has no password and only listens on 127.0.0.1.'
Write-Host ''
