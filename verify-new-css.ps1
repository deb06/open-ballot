$base = "https://open-ballot.onrender.com"
try {
    # Get the HTML to find the CSS file name
    $r = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $html = $r.Content
    if ($html -match 'href="(/assets/index-[^"]+\.css)"') {
        $cssUrl = $matches[1]
        Write-Host "Found CSS: $cssUrl"
        $css = Invoke-WebRequest "$base$cssUrl" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        $cssContent = $css.Content
        Write-Host "CSS Length: $($cssContent.Length)"
        Write-Host "Has :root: $($cssContent.Contains(':root'))"
        Write-Host "Has --panel: $($cssContent.Contains('--panel'))"
        Write-Host "Has --text: $($cssContent.Contains('--text'))"
        Write-Host "Has --bg: $($cssContent.Contains('--bg'))"
        $rootStart = $cssContent.IndexOf(':root')
        if ($rootStart -ge 0) {
            $rootEnd = $cssContent.IndexOf('}', $rootStart)
            if ($rootEnd -gt $rootStart) {
                Write-Host "=== :root BLOCK ==="
                Write-Host $cssContent.Substring($rootStart, $rootEnd - $rootStart + 1)
            }
        }
    } else {
        Write-Host "Could not find CSS link in HTML"
    }
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}