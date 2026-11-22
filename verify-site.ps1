$base = "https://open-ballot.onrender.com"

Write-Host "=== HEALTH ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/api/health" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Body: $($r.Content)"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== HOMEPAGE ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    $html = $r.Content
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($html.Length) bytes"
    Write-Host "Has React root: $($html.Contains('id=""root""'))"
    Write-Host "Has JS bundle: $($html.Contains('.js'))"
    Write-Host "Has CSS bundle: $($html.Contains('.css'))"
    Write-Host "Has assets path: $($html.Contains('/assets/'))"
    
    $start = $html.IndexOf('<body>')
    if ($start -ge 0) {
        Write-Host "---BODY---"
        $end = [Math]::Min($start + 500, $html.Length)
        Write-Host $html.Substring($start, $end - $start)
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}
