# Stop the Cloudflare tunnel (quick or named) started by
# scripts\tunnel-start.ps1 or scripts\tunnel-named.ps1.

. "$PSScriptRoot\lib.ps1"

$pidFile = Join-Path $DataDir 'tunnel.pid'
$urlFile = Join-Path $DataDir 'tunnel-url.txt'
$modeFile = Join-Path $DataDir 'tunnel-mode.txt'

if (Test-Path $pidFile) {
    $tunnelPid = [int](Get-Content $pidFile -First 1)
    $process = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -like 'cloudflared*') {
        Stop-Process -Id $tunnelPid -Force
        Write-Host "Stopped the tunnel (pid $tunnelPid)."
    } else {
        Write-Host 'The recorded tunnel process is not running.'
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
    Write-Host 'No tunnel PID file found.'
}

Remove-Item $urlFile -ErrorAction SilentlyContinue
Remove-Item $modeFile -ErrorAction SilentlyContinue
