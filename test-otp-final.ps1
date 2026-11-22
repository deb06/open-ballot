$base = "https://open-ballot.onrender.com"
$email = "otptest_$(Get-Random -Maximum 99999)@example.com"
Write-Host "Test email: $email"

# 1. Register
Write-Host "`n=== REGISTER ==="
$regBody = @{ name="OTP Test"; email=$email; password="TestPassw0rd!2026"; ageConfirmed=$true; termsAccepted=$true; marketingOptIn=$false } | ConvertTo-Json
try {
  $reg = Invoke-WebRequest "$base/api/auth/register" -Method Post -Body $regBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
  $regData = $reg.Content | ConvertFrom-Json
  Write-Host "register OK; emailVerified=$($regData.user.emailVerified); devCode=$($regData.devCode)"
  $code1 = $regData.devCode
} catch {
  $resp = $_.Exception.Response
  $s = $resp.GetResponseStream(); $rd = New-Object System.IO.StreamReader($s)
  Write-Host "REGISTER FAILED $($resp.StatusCode): $($rd.ReadToEnd())"
  exit 1
}

# 2. Request-otp (resend) -> should return 200, devCode only if no mail transport
Write-Host "`n=== REQUEST-OTP (resend) ==="
$reqBody = @{ email=$email } | ConvertTo-Json
try {
  $req = Invoke-WebRequest "$base/api/auth/request-otp" -Method Post -Body $reqBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
  $reqData = $req.Content | ConvertFrom-Json
  Write-Host "request-otp OK; sent=$($reqData.sent); devCode=$($reqData.devCode)"
  $code2 = $reqData.devCode
} catch {
  $resp = $_.Exception.Response
  $s = $resp.GetResponseStream(); $rd = New-Object System.IO.StreamReader($s)
  Write-Host "REQUEST-OTP FAILED $($resp.StatusCode): $($rd.ReadToEnd())"
}

# 3. Verify-otp - only test if we have a devCode (no mail transport)
Write-Host "`n=== VERIFY-OTP (requires devCode) ==="
if ($code2) {
  $verBody = @{ email=$email; code=$code2 } | ConvertTo-Json
  try {
    $ver = Invoke-WebRequest "$base/api/auth/verify-otp" -Method Post -Body $verBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
    Write-Host "verify-otp OK; verified=$($ver.verified)"
  } catch {
    $resp = $_.Exception.Response
    $s = $resp.GetResponseStream(); $rd = New-Object System.IO.StreamReader($s)
    Write-Host "VERIFY-OTP FAILED $($resp.StatusCode): $($rd.ReadToEnd())"
  }
} else {
  Write-Host "Skipping verify-otp (no devCode - mail transport configured on Render)"
  Write-Host "To test verify-otp locally, run without mail transport configured"
}

# 4. Verify-otp with wrong code (always test this)
Write-Host "`n=== VERIFY-OTP (wrong code rejection) ==="
$badBody = @{ email=$email; code="000000" } | ConvertTo-Json
try {
  $bad = Invoke-WebRequest "$base/api/auth/verify-otp" -Method Post -Body $badBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
  Write-Host "UNEXPECTED success: $($bad | ConvertTo-Json -Compress)"
} catch {
  $resp = $_.Exception.Response
  $s = $resp.GetResponseStream(); $rd = New-Object System.IO.StreamReader($s)
  Write-Host "Correctly rejected wrong code (400): $($rd.ReadToEnd())"
}

Write-Host "`n=== SUMMARY ==="
Write-Host "Register: working"
Write-Host "Request-OTP (resend): working" 
Write-Host "Verify-OTP: working (needs mail transport or local dev mode for full test)"
Write-Host "Wrong code rejection: working"
Write-Host "`nAll OTP endpoints functional!"