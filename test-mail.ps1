$base = "https://open-ballot.onrender.com"
try {
  $r = Invoke-WebRequest "$base/api/auth/request-otp" -Method Post -Body '{"email":"test@example.com"}' -ContentType "application/json" -TimeoutSec 20 -ErrorAction Stop
  Write-Host "Status: $($r.StatusCode)"
  Write-Host $r.Content
} catch {
  Write-Host "Exception: $($_.Exception.Message)"
}