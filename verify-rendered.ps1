$base = "https://open-ballot.onrender.com"

# Check what the browser would actually see - the full HTML
try {
    $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $html = $r.Content
    Write-Host "=== FULL HTML ==="
    Write-Host $html
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}