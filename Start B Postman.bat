@echo off
setlocal
title B Postman
cd /d "%~dp0"

echo.
echo  B Postman
echo  ---------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
  echo.
)

if not exist "dist\index.html" (
  echo Building UI...
  call npm run build
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
  )
  echo.
)

echo Starting on http://localhost:3847
echo Close this window or press Ctrl+C to stop.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3847/"

call npm start
echo.
echo Server stopped.
pause
