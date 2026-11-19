# Expose the running app on a public HTTPS URL with a Cloudflare quick tunnel.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-start.ps1
#
# No Cloudflare account is needed. The URL is random and changes every time the
# tunnel restarts, and this PC must stay powered on while the tunnel is live.
#
# For production, use a named tunnel on your own domain, or deploy the Docker
# image to a server (see README.md).

. "$PSScriptRoot\lib.ps1"

$appPort = 3000
$tunnelLog = Join-Path $DataDir 'tunnel-out.log'
$tunnelErr = Join-Path $DataDir 'tunnel-err.log'
$urlFile = Join-Path $DataDir 'tunnel-url.txt'
$pidFile = Join-Path $DataDir 'tunnel.pid'
$modeFile = Join-Path $DataDir 'tunnel-mode.txt'

if (-not (Test-TcpPort '127.0.0.1' $appPort)) {
    Write-Host "The app is not running on 127.0.0.1:$appPort. Start it with scripts\start.ps1 first." -ForegroundColor Red
    exit 1
}

if (Test-Path $pidFile) {
    $existingPid = [int](Get-Content $pidFile -First 1)
    $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existing -and $existing.ProcessName -like 'cloudflared*') {
        $mode = 'quick'
        if (Test-Path $modeFile) { $mode = (Get-Content $modeFile -First 1).Trim() }
        if (Test-Path $urlFile) {
            if ($mode -eq 'named') {
                Write-Host "A named tunnel is already running: $(Get-Content $urlFile -First 1)" -ForegroundColor Yellow
                Write-Host 'Stop it first if you really want a temporary quick tunnel.'
            } else {
                Write-Host "A tunnel is already running: $(Get-Content $urlFile -First 1)"
            }
            exit 0
        }
        Write-Host 'A cloudflared process is running but no URL was recorded. Stop it with scripts\tunnel-stop.ps1 first.' -ForegroundColor Red
        exit 1
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

Ensure-Cloudflared

# Never expose the seeded default administrator password.
$prepareCode = Invoke-Php @((Join-Path $Root 'scripts\prepare-public.php'))
if ($prepareCode -ne 0) {
    Write-Host 'Could not secure the administrator account. Aborting.' -ForegroundColor Red
    exit 1
}

Remove-Item $tunnelLog, $tunnelErr, $urlFile -ErrorAction SilentlyContinue

$process = Start-Process -FilePath $CloudflaredExe `
    -ArgumentList @('tunnel', '--url', "http://127.0.0.1:$appPort", '--no-autoupdate') `
    -RedirectStandardOutput $tunnelLog `
    -RedirectStandardError $tunnelErr `
    -WindowStyle Hidden -PassThru

$process.Id | Set-Content $pidFile
'quick' | Set-Content $modeFile

$url = $null
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 400
    foreach ($file in @($tunnelLog, $tunnelErr)) {
        if (-not (Test-Path $file)) { continue }
        $match = Select-String -Path $file -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
            ForEach-Object { $_.Matches } | Select-Object -First 1
        if ($match) {
            $url = $match.Value
            break
        }
    }
    if ($url) { break }
    if ($process.HasExited) { break }
}

if (-not $url) {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host 'The tunnel did not start. cloudflared output:' -ForegroundColor Red
    foreach ($file in @($tunnelLog, $tunnelErr)) {
        if (Test-Path $file) { Get-Content $file -Tail 15 }
    }
    exit 1
}

$url = $url.TrimEnd('/')
$url | Set-Content $urlFile

# Wait until the public URL actually serves the application.
$ready = $false
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    try {
        $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 5
        if ($health.ok) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 750
    }
}

if (-not $ready) {
    Write-Host "The tunnel is up but $url is not answering yet. Try it in a browser in a minute." -ForegroundColor Yellow
}

Write-Host ''
Write-Host '  Open Ballot is live' -ForegroundColor Green
Write-Host "  $url"
Write-Host ''
Write-Host '  Anyone with this link can use the site.'
Write-Host '  The link changes when the tunnel restarts, and it only works while this PC is on.'
Write-Host ''
Write-Host '  Stop the tunnel:  scripts\tunnel-stop.ps1   (or npm run tunnel:stop)'
Write-Host ''
