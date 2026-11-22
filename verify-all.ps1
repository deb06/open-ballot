$base = "https://open-ballot.onrender.com"
$tests = @(
    @{name="Health"; url="$base/api/health"},
    @{name="Stats"; url="$base/api/stats"},
    @{name="Homepage"; url="$base/"},
    @{name="Privacy"; url="$base/privacy"},
    @{name="Terms"; url="$base/terms"},
    @{name="Refunds"; url="$base/refunds"},
    @{name="Archive"; url="$base/archive"},
    @{name="Audit"; url="$base/audit"},
    @{name="Status"; url="$base/status"},
    @{name="Login"; url="$base/login"},
    @{name="Register"; url="$base/register"},
    @{name="Verify"; url="$base/verify"}
)

foreach ($t in $tests) {
    try {
        $r = Invoke-WebRequest $t.url -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        Write-Host "OK  $($t.name): $($r.StatusCode)"
    } catch {
        Write-Host "FAIL $($t.name): $($_.Exception.Message)"
    }
}
