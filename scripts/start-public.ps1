# Start a public Cloudflare quick tunnel for Open Ballot and record its URL.
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root 'data'
$cf = Join-Path $Root 'tools\cloudflared\cloudflared.exe'
$UrlFile = Join-Path $DataDir 'public-url.txt'
$BackupFile = Join-Path $DataDir 'backup-url.txt'
$ErrFile = Join-Path $DataDir 'cf-public.err'

# Stop any existing cloudflared processes.
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item $ErrFile -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath $cf -ArgumentList "tunnel","--url","http://127.0.0.1:3000","--no-autoupdate" -RedirectStandardError $ErrFile -WindowStyle Hidden -PassThru

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $ErrFile) {
        $line = Get-Content $ErrFile -ErrorAction SilentlyContinue | Select-String -Pattern 'trycloudflare\.com' | Select-Object -Last 1
        if ($line) {
            $m = [regex]::Match($line.ToString(), 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($m.Success) {
                $m.Value | Set-Content $UrlFile
                $m.Value | Set-Content $BackupFile
                break
            }
        }
    }
}
PY