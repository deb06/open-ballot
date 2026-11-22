$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    Write-Host "=== RESPONSE HEADERS ==="
    $r.Headers.GetEnumerator() | ForEach-Object {
        Write-Host "$($_.Key): $($_.Value)"
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}