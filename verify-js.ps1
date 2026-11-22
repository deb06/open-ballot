$base = "https://open-ballot.onrender.com"
try {
    $r = Invoke-WebRequest "$base/assets/index-CSdCFSC-.js" -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $js = $r.Content
    Write-Host "JS Length: $($js.Length)"
    Write-Host "Has React: $($js.Contains('React'))"
    Write-Host "Has App: $($js.Contains('App'))"
    Write-Host "Has PublicLayout: $($js.Contains('PublicLayout'))"
    Write-Host "Has useAuth: $($js.Contains('useAuth'))"
    Write-Host "Has createRoot: $($js.Contains('createRoot'))"
    Write-Host "Has StrictMode: $($js.Contains('StrictMode'))"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
}