$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/assets/index-BdYQROCU.css" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $css = $r.Content
    # Find --panel definition
    $panelIdx = $css.IndexOf('--panel')
    if ($panelIdx -ge 0) {
        $start = [Math]::Max(0, $panelIdx - 200)
        $end = [Math]::Min($css.Length, $panelIdx + 200)
        Write-Host "=== --panel CONTEXT ==="
        Write-Host $css.Substring($start, $end - $start)
    }
    # Find body styles
    $bodyIdx = $css.IndexOf('body{')
    if ($bodyIdx -lt 0) { $bodyIdx = $css.IndexOf('body {') }
    if ($bodyIdx -ge 0) {
        $end = $css.IndexOf('}', $bodyIdx)
        if ($end -gt $bodyIdx) {
            Write-Host "=== BODY STYLES ==="
            Write-Host $css.Substring($bodyIdx, $end - $bodyIdx + 1)
        }
    }
    # Find html styles
    $htmlIdx = $css.IndexOf('html{')
    if ($htmlIdx -lt 0) { $htmlIdx = $css.IndexOf('html {') }
    if ($htmlIdx -ge 0) {
        $end = $css.IndexOf('}', $htmlIdx)
        if ($end -gt $htmlIdx) {
            Write-Host "=== HTML STYLES ==="
            Write-Host $css.Substring($htmlIdx, $end - $htmlIdx + 1)
        }
    }
    # Check for #root styles
    $rootIdx = $css.IndexOf('#root')
    if ($rootIdx -ge 0) {
        $start = [Math]::Max(0, $rootIdx - 100)
        $end = [Math]::Min($css.Length, $rootIdx + 200)
        Write-Host "=== #root CONTEXT ==="
        Write-Host $css.Substring($start, $end - $start)
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}