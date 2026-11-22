$base = "https://open-ballot.onrender.com"
Write-Host "=== COMPREHENSIVE FINAL CHECK ===" -ForegroundColor Cyan

$tests = @(
    @{name="Health"; url="$base/api/health"},
    @{name="Stats (clean)"; url="$base/api/stats"},
    @{name="Homepage"; url="$base/"},
    @{name="Login"; url="$base/login"},
    @{name="Register"; url="$base/register"},
    @{name="Verify (OTP)"; url="$base/verify-email"},
    @{name="Verify (link)"; url="$base/verify-email/some-token"},
    @{name="Elections list"; url="$base/elections"},
    @{name="Privacy"; url="$base/privacy"},
    @{name="Terms"; url="$base/terms"},
    @{name="Refunds"; url="$base/refunds"},
    @{name="Archive"; url="$base/archive"},
    @{name="Audit"; url="$base/audit"},
    @{name="Status"; url="$base/status"},
    @{name="DPA"; url="$base/dpa"},
    @{name="Subprocessors"; url="$base/subprocessors"},
    @{name="Help"; url="$base/help"},
    @{name="API Elections"; url="$base/api/elections"},
    @{name="API Request-OTP"; url="$base/api/auth/request-otp"; method="POST"; body='{"email":"test@example.com"}'},
    @{name="API Verify-OTP (wrong code)"; url="$base/api/auth/verify-otp"; method="POST"; body='{"email":"test@example.com","code":"000000"}'},
)

$passed = 0
$failed = 0

foreach ($t in $tests) {
    try {
        $params = @{ Uri = $t.url; UseBasicParsing = $true; TimeoutSec = 15; ErrorAction = "Stop" }
        if ($t.method) { $params.Method = $t.method }
        if ($t.body) { $params.Body = $t.body; $params.ContentType = "application/json" }
        $r = Invoke-WebRequest @params
        if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 400) {  # 400 is expected for wrong code test
            Write-Host "✓ PASS $($t.name): $($r.StatusCode)" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "✗ FAIL $($t.name): $($r.StatusCode)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "✗ FAIL $($t.name): $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Passed: $passed"
Write-Host "Failed: $failed"
Write-Host "Total:  $($tests.Count)"

# Check demo data is gone
Write-Host ""
Write-Host "=== DEMO DATA CHECK ===" -ForegroundColor Cyan
try {
    $s = Invoke-WebRequest "$base/api/stats" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    $data = $s.Content | ConvertFrom-Json
    Write-Host "openElections: $($data.openElections)"
    Write-Host "scheduledElections: $($data.scheduledElections)"
    Write-Host "completedElections: $($data.completedElections)"
    Write-Host "ballotsCast: $($data.ballotsCast)"
    Write-Host "registeredVoters: $($data.registeredVoters) (should be 1 = admin)"
    $e = Invoke-WebRequest "$base/api/elections" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    $edata = $e.Content | ConvertFrom-Json
    Write-Host "elections count: $($edata.elections.Count) (should be 0)"
} catch {
    Write-Host "Stats check failed: $($_.Exception.Message)"
}

# Contact email check
Write-Host ""
Write-Host "=== CONTACT EMAIL CHECK ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    $hasOutlook = $r.Content -match "openballot@outlook.com"
    $hasOld = $r.Content -match "admin@openballot.local"
    Write-Host "Footer has outlook.com: $hasOutlook"
    Write-Host "Footer has old email: $hasOld"
} catch {
    Write-Host "Homepage check failed: $($_.Exception.Message)"
}