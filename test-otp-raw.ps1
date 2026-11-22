$base = "https://open-ballot.onrender.com"
$email = "otptest_$(Get-Random -Maximum 99999)@example.com"
Write-Host "Test email: $email"
$regBody = @{ name="OTP Test"; email=$email; password="TestPassw0rd!2026"; ageConfirmed=$true; termsAccepted=$true; marketingOptIn=$false } | ConvertTo-Json

# health first
try { $h = Invoke-WebRequest "$base/api/health" -UseBasicParsing -TimeoutSec 30; Write-Host "health: $($h.StatusCode)" } catch { Write-Host "health FAIL: $($_.Exception.Message)" }

try {
  $resp = Invoke-WebRequest "$base/api/auth/register" -Method Post -Body $regBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
  Write-Host "register status: $($resp.StatusCode)"
  Write-Host $resp.Content
} catch {
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $body = $reader.ReadToEnd()
  Write-Host "register FAILED $($_.Exception.Response.StatusCode.value__): $body"
  Write-Host "`nTest email (for cleanup): $email"
}