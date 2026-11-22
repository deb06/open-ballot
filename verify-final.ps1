$base = "https://open-ballot.onrender.com"

# Get actual asset URLs from HTML
$html = (Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop).Content

if ($html -match 'src="(/assets/index-[^"]+\.js)"') {
    $jsUrl = $matches[1]
    Write-Host "JS: $jsUrl"
    $js = (Invoke-WebRequest "$base$jsUrl" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop).Content
    Write-Host ("  Length: {0}, Has Outlet: {1}, Has createRoot: {2}" -f $js.Length, $js.Contains('Outlet'), $js.Contains('createRoot'))
}

if ($html -match 'href="(/assets/index-[^"]+\.css)"') {
    $cssUrl = $matches[1]
    Write-Host "CSS: $cssUrl"
    $css = (Invoke-WebRequest "$base$cssUrl" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop).Content
    Write-Host ("  Length: {0}, Has :root: {1}, Has --panel: {2}" -f $css.Length, $css.Contains(':root'), $css.Contains('--panel'))
}

Write-Host ""
Write-Host "=== ALL ENDPOINTS ==="
$tests = @("api/health", "api/stats", "login", "register", "verify", "elections", "privacy", "terms", "refunds", "archive", "audit", "status", "dpa", "subprocessors", "help")
$passed = 0
$failed = 0
foreach ($t in $tests) {
    try {
        $r = Invoke-WebRequest "$base/$t" -UseBasicParsing -TimeoutSec 20 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { Write-Host "OK $t"; $passed++ } else { Write-Host ("FAIL {0}: {1}" -f $t, $r.StatusCode); $failed++ }
    } catch {
        $err = $_.Exception.Message
        Write-Host ("FAIL {0}: {1}" -f $t, $err)
        $failed++
    }
}
Write-Host ("Passed: {0} / Failed: {1}" -f $passed, $failed)