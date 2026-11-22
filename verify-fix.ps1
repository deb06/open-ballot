$base = "https://open-ballot.onrender.com"
$js = (Invoke-WebRequest "$base/assets/index-PM-T_dsw.js" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop).Content

# Check that the JS bundle has the AppRoutes component
Write-Host "Has AppRoutes: $($js.Contains('AppRoutes'))"
Write-Host "Has AuthProvider: $($js.Contains('AuthProvider'))"
Write-Host "Has loading-screen: $($js.Contains('loading-screen'))"

# Get the HTML and check it has the right structure
$html = (Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop).Content
Write-Host ""
Write-Host "=== HTML CHECK ==="
Write-Host "Has title: $($html.Contains('<title>'))"
Write-Host "Has root div: $($html.Contains('id=\"root\"'))"
Write-Host "Has module script: $($html.Contains('type=\"module\"'))"
Write-Host "Has stylesheet link: $($html.Contains('rel=\"stylesheet\"'))"
if ($html -match 'src="(/assets/[^"]+\.js)"') {
    Write-Host "JS asset: $($matches[1])"
}
if ($html -match 'href="(/assets/[^"]+\.css)"') {
    Write-Host "CSS asset: $($matches[1])"
}