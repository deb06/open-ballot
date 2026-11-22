$resp = Invoke-WebRequest "https://open-ballot.onrender.com/api/stats" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
Write-Host "Status: $($resp.StatusCode)"
Write-Host "Content: $($resp.Content)"
