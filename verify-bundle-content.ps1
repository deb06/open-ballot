$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/assets/main-C3FC2iPE.js" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    $js = $r.Content
    Write-Host "JS Length: $($js.Length)"
    Write-Host "Has skip-link: $($js.Contains('skip-link'))"
    Write-Host "Has site-header: $($js.Contains('site-header'))"
    Write-Host "Has primary-nav: $($js.Contains('primary-nav'))"
    Write-Host "Has OpenBallot: $($js.Contains('OpenBallot'))"
    Write-Host "Has brand-mark: $($js.Contains('brand-mark'))"
    Write-Host "Has footer: $($js.Contains('site-footer'))"
    Write-Host "Has AuthProvider: $($js.Contains('AuthProvider'))"
    Write-Host "Has useAuth: $($js.Contains('useAuth'))"
    Write-Host "Has createRoot: $($js.Contains('createRoot'))"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}