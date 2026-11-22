$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/assets/index-BdYQROCU.css" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $css = $r.Content
    Write-Host "CSS Length: $($css.Length)"
    Write-Host "Has :root: $($css.Contains(':root'))"
    Write-Host "Has --panel: $($css.Contains('--panel'))"
    Write-Host "Has --text: $($css.Contains('--text'))"
    Write-Host "Has --bg: $($css.Contains('--bg'))"
    Write-Host "Has body: $($css.Contains('body{') -or $css.Contains('body {'))"
    # Check for CSS variables in :root
    $rootStart = $css.IndexOf(':root')
    if ($rootStart -ge 0) {
        $rootEnd = $css.IndexOf('}', $rootStart)
        if ($rootEnd -gt $rootStart) {
            Write-Host "=== :root BLOCK ==="
            Write-Host $css.Substring($rootStart, $rootEnd - $rootStart + 1)
        }
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}