@echo off
setlocal
title Make API Messenger share package
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to build the share package.
  pause
  exit /b 1
)

echo Building portable share package...
echo.
call npm run package:share
echo.
echo Done. Look in the share\ folder.
pause
