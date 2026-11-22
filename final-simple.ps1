$base = "https://open-ballot.onrender.com"
Write-Host "=== STATS ==="
try { $r = Invoke-WebRequest "$base/api/stats" -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop; $r.Content } catch { "FAIL: $($_.Exception.Message)" }
Write-Host ""
Write-Host "=== ELECTIONS ==="
try { $r = Invoke-WebRequest "$base/api/elections" -UseBasicParsing -TimeoutSec 20; $r.Content } catch { "FAIL: $($_.Exception.Message)" }
Write-Host ""
Write-Host "=== HOMEPAGE TITLE ==="
try { $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 20; $html = $r.Content; if ($html -match "<title>(.*?)</title>") { $matches[1] } else { "NO TITLE" } } catch { "FAIL: $($_.Exception.Message)" }
Write-Host ""
Write-Host "=== CONTACT EMAIL ==="
try { $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 20; $html = $r.Content; if ($html -match "openballot@outlook.com") { "HAS OUTLOOK" } else { "NO OUTLOOK" }; if ($html -match "admin@openballot.local") { "HAS OLD EMAIL" } else { "NO OLD EMAIL" } } catch { "FAIL: $($_.Exception.Message)" }