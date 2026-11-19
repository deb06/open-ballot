@echo off
rem Stop the PHP server and MariaDB.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1" %*
exit /b %ERRORLEVEL%
