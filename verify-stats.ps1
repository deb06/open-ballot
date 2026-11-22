$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/api/stats" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "Stats API: $($r.StatusCode)"
    Write-Host "Content: $($r.Content)"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}