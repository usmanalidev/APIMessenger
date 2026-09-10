@echo off
setlocal
title Make B Postman share package
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to build the share package.
  pause
  exit /b 1
)

echo Building portable B Postman share package...
echo.
call npm run package:share
echo.
echo Done. Look in the share\ folder for B-Postman-portable.zip
pause
