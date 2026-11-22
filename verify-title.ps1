$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $html = $r.Content
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Length: $($html.Length) bytes"
    Write-Host "Has title tag: $($html.Contains('<title>'))"
    $start = $html.IndexOf('<title>')
    if ($start -ge 0) {
        Write-Host "Title tag found at position $start"
        $end = [Math]::Min($start + 100, $html.Length)
        Write-Host "Snippet: $($html.Substring($start, $end - $start))"
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}