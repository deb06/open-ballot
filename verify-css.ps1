$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/assets/index-BdYQROCU.css" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $css = $r.Content
    Write-Host "CSS Length: $($css.Length)"
    Write-Host "=== FIRST 2000 CHARS ==="
    Write-Host $css.Substring(0, [Math]::Min(2000, $css.Length))
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}