# Expose the running app on a permanent hostname with a Cloudflare named tunnel.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-named.ps1 login
#   $env:TUNNEL_HOSTNAME = 'vote.example.com'
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-named.ps1 setup
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-named.ps1 start
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-named.ps1 status
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-named.ps1 stop
#
# Requirements:
#   * a Cloudflare account and a domain (zone) added to that account
#   * the app running on http://127.0.0.1:3000
#
# `login` and `setup` are interactive. `start` is what live.bat calls once the
# tunnel is configured; it runs the connector in the background and records the
# permanent URL in data\tunnel-url.txt.

param(
    [ValidateSet('login', 'setup', 'start', 'stop', 'status')]
    [string]$Action = 'start',
    [string]$Name = $(if ($env:TUNNEL_NAME) { $env:TUNNEL_NAME } else { 'open-ballot' }),
    [string]$Hostname = $env:TUNNEL_HOSTNAME,
    [switch]$Force
)

. "$PSScriptRoot\lib.ps1"

$appPort = 3000
$TunnelDir = Join-Path $DataDir 'cloudflared'
$ConfigPath = Join-Path $TunnelDir 'config.yml'
$MetaPath = Join-Path $TunnelDir 'tunnel.json'
$LogPath = Join-Path $TunnelDir 'tunnel.log'
$ErrPath = Join-Path $TunnelDir 'tunnel-err.log'
$PidFile = Join-Path $DataDir 'tunnel.pid'
$UrlFile = Join-Path $DataDir 'tunnel-url.txt'
$ModeFile = Join-Path $DataDir 'tunnel-mode.txt'
$CertPath = Join-Path (Join-Path $env:USERPROFILE '.cloudflared') 'cert.pem'

New-Item -ItemType Directory -Force $TunnelDir | Out-Null

function Invoke-Cloudflared {
    param([string[]]$Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $CloudflaredExe @Arguments
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Get-NamedTunnel {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $raw = & $CloudflaredExe tunnel list --output json 2>$null
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($code -ne 0) {
        throw "Could not list Cloudflare tunnels. Run 'npm run tunnel:named:login' first."
    }
    $list = @()
    if ($raw) {
        try { $list = @(($raw -join "`n") | ConvertFrom-Json) } catch { $list = @() }
    }
    return $list | Where-Object { $_.name -eq $Name } | Select-Object -First 1
}

function Get-Meta {
    if (-not (Test-Path $MetaPath)) { return $null }
    try { return Get-Content $MetaPath -Raw | ConvertFrom-Json } catch { return $null }
}

function Show-NotConfigured {
    Write-Host 'The permanent named tunnel is not configured yet.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  1. npm run tunnel:named:login    (authorise Cloudflare in the browser)'
    Write-Host '  2. set TUNNEL_HOSTNAME, then npm run tunnel:named:setup'
    Write-Host '  3. npm run tunnel:named          (or just run live.bat)'
    Write-Host ''
    Write-Host 'The hostname must be in a domain (zone) that is active on Cloudflare.'
}

function Test-PublicUrl {
    param([string]$Url, [int]$TimeoutSeconds = 45)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod -Uri "$Url/api/health" -TimeoutSec 5
            if ($health.ok) { return $true }
        } catch {
            Start-Sleep -Milliseconds 750
        }
    }
    return $false
}

switch ($Action) {
    'login' {
        Ensure-Cloudflared
        if ((Test-Path $CertPath) -and -not $Force) {
            Write-Host "cloudflared is already authorised ($CertPath)."
            Write-Host 'To switch to a different Cloudflare account or domain, run again with -Force.'
            exit 0
        }
        Write-Host 'Opening the Cloudflare authorisation page...'
        Write-Host 'Sign in, choose the domain (zone) that will host the permanent address, and authorize it.'
        Write-Host 'The command continues when the browser returns.'
        Write-Host ''
        $code = Invoke-Cloudflared @('tunnel', 'login')
        if ($code -ne 0 -or -not (Test-Path $CertPath)) {
            Write-Host 'Authorisation did not complete.' -ForegroundColor Red
            exit 1
        }
        Write-Host ''
        Write-Host 'Authorised. Next: set TUNNEL_HOSTNAME and run setup.' -ForegroundColor Green
        exit 0
    }

    'setup' {
        Ensure-Cloudflared
        if (-not (Test-Path $CertPath)) {
            Write-Host 'cloudflared is not authorised yet. Run: npm run tunnel:named:login' -ForegroundColor Red
            exit 1
        }
        if (-not $Hostname) {
            $Hostname = Read-Host 'Permanent hostname (for example vote.example.com)'
        }
        $Hostname = $Hostname.Trim().TrimEnd('.').ToLowerInvariant()
        if ($Hostname -notmatch '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') {
            Write-Host "That does not look like a valid hostname: $Hostname" -ForegroundColor Red
            exit 1
        }

        $tunnel = Get-NamedTunnel
        if (-not $tunnel) {
            Write-Host "Creating the named tunnel '$Name'..."
            $code = Invoke-Cloudflared @('tunnel', 'create', $Name)
            if ($code -ne 0) {
                Write-Host 'Could not create the tunnel.' -ForegroundColor Red
                exit 1
            }
            for ($attempt = 0; $attempt -lt 5 -and -not $tunnel; $attempt += 1) {
                Start-Sleep -Seconds 1
                $tunnel = Get-NamedTunnel
            }
        }
        if (-not $tunnel) {
            Write-Host 'The tunnel was created but could not be found in the tunnel list.' -ForegroundColor Red
            exit 1
        }

        $tunnelId = [string]$tunnel.id
        $credentials = Join-Path (Join-Path $env:USERPROFILE '.cloudflared') "$tunnelId.json"
        if (-not (Test-Path $credentials)) {
            Write-Host "Missing tunnel credentials: $credentials" -ForegroundColor Red
            exit 1
        }

        $yaml = @"
tunnel: $tunnelId
credentials-file: '$credentials'
ingress:
  - hostname: $Hostname
    service: http://127.0.0.1:$appPort
  - service: http_status:404
"@
        [System.IO.File]::WriteAllText($ConfigPath, $yaml, (New-Object System.Text.UTF8Encoding($false)))
        @{ name = $Name; id = $tunnelId; hostname = $Hostname } | ConvertTo-Json | Set-Content -Path $MetaPath -Encoding UTF8

        Write-Host "Routing $Hostname to the tunnel..."
        $code = Invoke-Cloudflared @('tunnel', 'route', 'dns', $Name, $Hostname)
        if ($code -ne 0) {
            Write-Host 'Cloudflare did not create the DNS record. It may already exist, or the domain may not be active on this account.' -ForegroundColor Yellow
            Write-Host "Check the DNS dashboard for $Hostname before starting the tunnel."
        }

        Write-Host ''
        Write-Host "Named tunnel '$Name' is configured for https://$Hostname" -ForegroundColor Green
        Write-Host 'Start it with: npm run tunnel:named   (live.bat uses it automatically)'
        exit 0
    }

    'start' {
        Ensure-Cloudflared
        if (-not (Test-Path $ConfigPath)) {
            Show-NotConfigured
            exit 1
        }
        $meta = Get-Meta
        if (-not $meta) {
            Write-Host "The tunnel configuration exists but $MetaPath is missing." -ForegroundColor Red
            exit 1
        }
        if (-not (Test-TcpPort '127.0.0.1' $appPort)) {
            Write-Host "The app is not running on 127.0.0.1:$appPort. Start it with .\start.bat first." -ForegroundColor Red
            exit 1
        }
        $publicUrl = "https://$($meta.hostname)"

        if (Test-Path $PidFile) {
            $existingPid = [int](Get-Content $PidFile -First 1)
            $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
            if ($existing -and $existing.ProcessName -like 'cloudflared*') {
                $mode = 'quick'
                if (Test-Path $ModeFile) { $mode = (Get-Content $ModeFile -First 1).Trim() }
                if ($mode -eq 'named') {
                    Write-Host "The tunnel is already running: $publicUrl"
                    if (-not (Test-PublicUrl $publicUrl 10)) {
                        Write-Host 'The connector is running but the public URL is not answering yet.' -ForegroundColor Yellow
                    }
                    exit 0
                }
                Write-Host 'Stopping the quick tunnel before starting the named tunnel.'
                & "$PSScriptRoot\tunnel-stop.ps1"
            } else {
                Remove-Item $PidFile -ErrorAction SilentlyContinue
            }
        }

        $prepareCode = Invoke-Php @((Join-Path $Root 'scripts\prepare-public.php'))
        if ($prepareCode -ne 0) {
            Write-Host 'Could not secure the administrator account. Aborting.' -ForegroundColor Red
            exit 1
        }

        Remove-Item $LogPath, $ErrPath -ErrorAction SilentlyContinue
        $process = Start-Process -FilePath $CloudflaredExe `
            -ArgumentList @('tunnel', '--config', $ConfigPath, '--no-autoupdate', 'run') `
            -RedirectStandardOutput $LogPath `
            -RedirectStandardError $ErrPath `
            -WindowStyle Hidden -PassThru
        $process.Id | Set-Content $PidFile
        $publicUrl | Set-Content $UrlFile
        'named' | Set-Content $ModeFile

        Write-Host "Starting the named tunnel for $publicUrl ..."
        if (-not (Test-PublicUrl $publicUrl 60)) {
            if ($process.HasExited) {
                Write-Host 'cloudflared exited. Log tail:' -ForegroundColor Red
                foreach ($file in @($LogPath, $ErrPath)) {
                    if (Test-Path $file) { Get-Content $file -Tail 20 }
                }
                Remove-Item $PidFile -ErrorAction SilentlyContinue
                Remove-Item $ModeFile -ErrorAction SilentlyContinue
                exit 1
            }
            Write-Host 'The connector is running but the hostname is not answering yet.' -ForegroundColor Yellow
            Write-Host 'Check the DNS record and the tunnel routes in the Cloudflare dashboard.'
        } else {
            Write-Host 'The permanent address is live.' -ForegroundColor Green
        }
        Write-Host ''
        Write-Host "  $publicUrl"
        Write-Host ''
        Write-Host 'Stop it with: npm run tunnel:named:stop   (or .\stop.bat)'
        exit 0
    }

    'stop' {
        & "$PSScriptRoot\tunnel-stop.ps1"
        exit $LASTEXITCODE
    }

    'status' {
        if (-not (Test-Path $ConfigPath)) {
            Show-NotConfigured
            exit 1
        }
        $meta = Get-Meta
        if (-not $meta) {
            Write-Host "The tunnel configuration exists but $MetaPath is missing." -ForegroundColor Red
            exit 1
        }
        $publicUrl = "https://$($meta.hostname)"
        $running = $false
        if (Test-Path $PidFile) {
            $existingPid = [int](Get-Content $PidFile -First 1)
            $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
            $running = [bool]($existing -and $existing.ProcessName -like 'cloudflared*')
        }
        Write-Host "Tunnel:  $($meta.name) ($($meta.id))"
        Write-Host "Address: $publicUrl"
        if ($running) {
            Write-Host 'Process: running'
            $healthy = Test-PublicUrl $publicUrl 10
            if ($healthy) { Write-Host 'Health:  OK' } else { Write-Host 'Health:  not answering yet' }
        } else {
            Write-Host 'Process: stopped'
        }
        exit 0
    }
}
