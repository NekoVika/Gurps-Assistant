@echo off
REM Start the whole app for development. Double-click this, or run .\dev.cmd
REM Anything you pass is forwarded: dev.cmd -Stop, dev.cmd -NoBrowser, ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1" %*

REM Double-clicked from Explorer, a failure would otherwise flash past and the
REM window would vanish before you could read why.
if errorlevel 1 (
  echo.
  pause
)
