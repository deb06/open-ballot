$base = "https://open-ballot.onrender.com"
try {
    $resp = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $html = $resp.Content
    Write-Host "Status: $($resp.StatusCode)"
    Write-Host "First 500 chars:"
    Write-Host $html.Substring(0, [Math]::Min(500, $html.Length))
} catch {
    Write-Host "Failed: $($_.Exception.Message)"
}
