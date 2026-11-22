$base = "https://open-ballot.onrender.com"

Write-Host "=== CSS ASSET ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/assets/index-BdYQROCU.css" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length) bytes"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== JS ASSET ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/assets/index-DBqAnJwa.js" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length) bytes"
    Write-Host "Has Outlet: $($r.Content.Contains('Outlet'))"
    Write-Host "Has skip-link: $($r.Content.Contains('skip-link'))"
    Write-Host "Has site-header: $($r.Content.Contains('site-header'))"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}