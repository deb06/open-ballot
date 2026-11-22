$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/assets/index-DBqAnJwa.js" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $js = $r.Content
    Write-Host "=== FIRST 2000 CHARS ==="
    Write-Host $js.Substring(0, [Math]::Min(2000, $js.Length))
    Write-Host ""
    Write-Host "=== LAST 500 CHARS ==="
    $start = [Math]::Max(0, $js.Length - 500)
    Write-Host $js.Substring($start)
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}