$base = "https://open-ballot.onrender.com"

Write-Host "=== CSS ASSET ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/assets/index-CdxLM3yI.css" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length) bytes"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== JS ASSET ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/assets/index-Qb4Zva3U.js" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length) bytes"
    Write-Host "First 200 chars: $($r.Content.Substring(0,[Math]::Min(200,$r.Content.Length)))"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}
