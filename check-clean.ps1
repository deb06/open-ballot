$base = "https://open-ballot.onrender.com"
Write-Host "=== STATS (should be all 0) ==="
(Invoke-WebRequest "$base/api/stats" -UseBasicParsing -TimeoutSec 20).Content
Write-Host "`n=== ELECTIONS (should be empty array) ==="
(Invoke-WebRequest "$base/api/elections" -UseBasicParsing -TimeoutSec 20).Content