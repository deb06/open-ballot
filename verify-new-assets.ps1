$base = "https://open-ballot.onrender.com"

Write-Host "=== CSS ASSET ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/assets/main-BdYQROCU.css" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length) bytes"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== JS ASSET ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/assets/main-C3FC2iPE.js" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($r.Content.Length) bytes"
    Write-Host "Has PublicLayout: $($r.Content.Contains('PublicLayout'))"
    Write-Host "Has Home: $($r.Content.Contains('Home'))"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}