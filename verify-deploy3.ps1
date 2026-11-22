$base = "https://open-ballot.onrender.com"
try {
    $resp = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $html = $resp.Content
    Write-Host "Status: $($resp.StatusCode)"
    Write-Host "Length: $($html.Length) bytes"
    Write-Host "Has React root: $($html.Contains('id=\"root\"'))"
    Write-Host "Has JS bundle: $($html.Contains('.js'))"
    Write-Host "Has CSS bundle: $($html.Contains('.css'))"
    Write-Host "Has assets path: $($html.Contains('/assets/'))"
    
    # Print body start
    $start = $html.IndexOf('<body>')
    if ($start -ge 0) {
        Write-Host "---BODY---"
        $end = [Math]::Min($start + 500, $html.Length)
        Write-Host $html.Substring($start, $end - $start)
    }
} catch {
    Write-Host "Failed: $($_.Exception.Message)"
}
