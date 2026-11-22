$base = "https://open-ballot.onrender.com"
$email = "otptest_$(Get-Random -Maximum 99999)@example.com"
Write-Host "Test email: $email"

# 1. Register (returns devCode since no mail transport)
Write-Host "`n=== REGISTER ==="
$regBody = @{ name="OTP Test"; email=$email; password="TestPassw0rd!2026"; ageConfirmed=$true; termsAccepted=$true; marketingOptIn=$false } | ConvertTo-Json
try {
  $reg = Invoke-RestMethod "$base/api/auth/register" -Method Post -Body $regBody -ContentType "application/json" -TimeoutSec 30
  Write-Host "register OK; emailVerified=$($reg.user.emailVerified); devCode=$($reg.devCode)"
  $code1 = $reg.devCode
} catch {
  Write-Host "REGISTER FAILED: $($_.Exception.Message)"; if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  exit 1
}

# 2. Request-otp (resend) -> new code
Write-Host "`n=== REQUEST-OTP (resend) ==="
$reqBody = @{ email=$email } | ConvertTo-Json
try {
  $req = Invoke-RestMethod "$base/api/auth/request-otp" -Method Post -Body $reqBody -ContentType "application/json" -TimeoutSec 30
  Write-Host "request-otp OK; sent=$($req.sent); devCode=$($req.devCode)"
  $code2 = $req.devCode
} catch {
  Write-Host "REQUEST-OTP FAILED: $($_.Exception.Message)"; if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

# 3. Verify-otp with the resend code
Write-Host "`n=== VERIFY-OTP ==="
$verBody = @{ email=$email; code=$code2 } | ConvertTo-Json
try {
  $ver = Invoke-RestMethod "$base/api/auth/verify-otp" -Method Post -Body $verBody -ContentType "application/json" -TimeoutSec 30
  Write-Host "verify-otp OK; verified=$($ver.verified)"
} catch {
  Write-Host "VERIFY-OTP FAILED: $($_.Exception.Message)"; if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

# 4. Verify-otp with a WRONG code (new account) to test rejection
Write-Host "`n=== VERIFY-OTP (wrong code on same) ==="
$badBody = @{ email=$email; code="000000" } | ConvertTo-Json
try {
  $bad = Invoke-RestMethod "$base/api/auth/verify-otp" -Method Post -Body $badBody -ContentType "application/json" -TimeoutSec 30
  Write-Host "UNEXPECTED success: $($bad | ConvertTo-Json -Compress)"
} catch {
  Write-Host "Correctly rejected wrong/expired code (expected)."
}

Write-Host "`n(copy the test email to delete it): $email"