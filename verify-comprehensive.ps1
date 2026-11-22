$base = "https://open-ballot.onrender.com"

$tests = @(
    @{name="Health"; url="$base/api/health"},
    @{name="Stats"; url="$base/api/stats"},
    @{name="Homepage"; url="$base/"},
    @{name="Login"; url="$base/login"},
    @{name="Register"; url="$base/register"},
    @{name="Verify"; url="$base/verify"},
    @{name="Elections"; url="$base/elections"},
    @{name="Privacy"; url="$base/privacy"},
    @{name="Terms"; url="$base/terms"},
    @{name="Refunds"; url="$base/refunds"},
    @{name="Archive"; url="$base/archive"},
    @{name="Audit"; url="$base/audit"},
    @{name="Status"; url="$base/status"},
    @{name="DPA"; url="$base/dpa"},
    @{name="Subprocessors"; url="$base/subprocessors"},
    @{name="Help"; url="$base/help"}
)

Write-Host "=== COMPREHENSIVE HEALTH CHECK ===" -ForegroundColor Cyan
$passed = 0
$failed = 0

foreach ($t in $tests) {
    try {
        $r = Invoke-WebRequest $t.url -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            Write-Host "OK PASS $($t.name): $($r.StatusCode)" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "FAIL $($t.name): $($r.StatusCode)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "FAIL $($t.name): $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Passed: $passed"
Write-Host "Failed: $failed"
Write-Host "Total:  $($tests.Count)"

Write-Host ""
Write-Host "=== ASSET CHECK ===" -ForegroundColor Cyan
try {
    $css = Invoke-WebRequest "$base/assets/index-BdYQROCU.css" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "OK CSS: $($css.StatusCode) ($($css.Content.Length) bytes)" -ForegroundColor Green
} catch {
    Write-Host "FAIL CSS: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $js = Invoke-WebRequest "$base/assets/index-DBqAnJwa.js" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Write-Host "OK JS:  $($js.StatusCode) ($($js.Content.Length) bytes)" -ForegroundColor Green
} catch {
    Write-Host "FAIL JS:  $($_.Exception.Message)" -ForegroundColor Red
}