$base = "https://open-ballot.onrender.com"
try {
    $resp = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $html = $resp.Content
    Write-Host "Status: $($resp.StatusCode)"
    Write-Host "Has React root: $($html.Contains('id=\"root\"'))"
    Write-Host "Has JS bundle: $($html.Contains('index-Qb4Zva3U.js'))"
    Write-Host "Has CSS bundle: $($html.Contains('index-CdxLM3yI.css'))"
    Write-Host "Length: $($html.Length) bytes"
} catch {
    Write-Host "Home page failed: $($_.Exception.Message)"
}
