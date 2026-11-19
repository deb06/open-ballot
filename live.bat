@echo off
rem Bring Open Ballot online: start the app if it is not running, then open a
rem public HTTPS tunnel and print the URL. A configured named tunnel (permanent
rem hostname) is preferred; otherwise a Cloudflare quick tunnel is used.
setlocal
set TRUST_PROXY=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "exit [int](-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue))"
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
    if errorlevel 1 exit /b 1
)
if exist "%~dp0data\cloudflared\config.yml" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\tunnel-named.ps1" start
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\tunnel-start.ps1"
)
exit /b %ERRORLEVEL%
