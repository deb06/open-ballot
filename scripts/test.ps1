# Run the end-to-end smoke test against the open_ballot_test database.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test.ps1
#   npm test

. "$PSScriptRoot\lib.ps1"

Assert-File $PhpExe 'Run scripts\setup.ps1 first.'

& "$PSScriptRoot\db-start.ps1"
if ($LASTEXITCODE -ne 0) {
    exit 1
}

$code = Invoke-Php @((Join-Path $Root 'test\smoke.php'))
exit $code
