# Keep Open Ballot public tunnels alive. Manage primary and backup independently.
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root 'data'
$cf = Join-Path $Root 'tools\cloudflared\cloudflared.exe'
$LogFile = Join-Path $DataDir 'watchdog.log'

$tunnels = @(
    @{ Name='primary'; UrlFile=(Join-Path $DataDir 'public-url.txt'); PidFile=(Join-Path $DataDir 'cf-primary.pid'); ErrFile=(Join-Path $DataDir 'cf-primary.err') },
    @{ Name='backup';  UrlFile=(Join-Path $DataDir 'backup-url.txt');  PidFile=(Join-Path $DataDir 'cf-backup.pid');  ErrFile=(Join-Path $DataDir 'cf-backup.err') }
)

function Log($msg) { Add-Content -Path $LogFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" }

function Test-Health($url) {
    if (-not $url) { return $false }
    try {
        $h = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 8
        return [bool]$h.ok
    } catch { return $false }
}

function Parse-Url($errFile) {
    if (-not (Test-Path $errFile)) { return $null }
    $line = Get-Content $errFile -ErrorAction SilentlyContinue | Select-String -Pattern 'trycloudflare\.com' | Select-Object -Last 1
    if (-not $line) { return $null }
    $m = [regex]::Match($line.ToString(), 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) { return $m.Value }
    return $null
}

function Ensure-Tunnel($t) {
    $url = $null
    if (Test-Path $t.UrlFile) { $url = (Get-Content $t.UrlFile -First 1).Trim() }
    if (Test-Health $url) { return }
    Log "$($t.Name) unhealthy ($url), restarting"
    if (Test-Path $t.PidFile) {
        $old = [int](Get-Content $t.PidFile -First 1 -ErrorAction SilentlyContinue)
        Stop-Process -Id $old -Force -ErrorAction SilentlyContinue
        Remove-Item $t.PidFile -ErrorAction SilentlyContinue
    }
    Remove-Item $t.ErrFile -ErrorAction SilentlyContinue
    $proc = Start-Process -FilePath $cf -ArgumentList "tunnel","--url","http://127.0.0.1:3000","--no-autoupdate" -RedirectStandardError $t.ErrFile -WindowStyle Hidden -PassThru
    $proc.Id | Set-Content $t.PidFile
    Log "$($t.Name) started cloudflared pid $($proc.Id)"
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        $newUrl = Parse-Url $t.ErrFile
        if ($newUrl) {
            $newUrl | Set-Content $t.UrlFile
            Log "$($t.Name) URL updated to $newUrl"
            break
        }
    }
}

Log "watchdog started"

while ($true) {
    foreach ($t in $tunnels) { Ensure-Tunnel $t }
    Start-Sleep -Seconds 20
}
PY