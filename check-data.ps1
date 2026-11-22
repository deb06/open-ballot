$base = "https://open-ballot.onrender.com"
Write-Host "=== STATS (public) ==="
try { (Invoke-WebRequest "$base/api/stats" -UseBasicParsing -TimeoutSec 20).Content } catch { "FAIL: $($_.Exception.Message)" }
Write-Host ""
Write-Host "=== ELECTIONS (public) ==="
try { (Invoke-WebRequest "$base/api/elections" -UseBasicParsing -TimeoutSec 20).Content } catch { "FAIL: $($_.Exception.Message)" }