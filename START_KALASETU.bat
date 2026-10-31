@echo off
title KalaSetu AI - SIH Final Project
cd /d "%~dp0"

echo =======================================================
echo        KalaSetu AI - Final SIH Prototype
echo =======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Node.js is not installed.
  echo Install Node.js LTS, restart Windows/VS Code, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: npm was not found.
  echo Reinstall Node.js LTS and run this file again.
  pause
  exit /b 1
)

echo [1/3] Installing/checking Node packages...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
  echo.
  echo ERROR: npm install failed.
  echo Check your internet connection and run START_KALASETU.bat again.
  pause
  exit /b 1
)

echo.
echo [2/3] Starting KalaSetu backend...
start "KalaSetu Server - KEEP THIS WINDOW OPEN" cmd /k "cd /d ""%~dp0"" && npm start"

echo [3/3] Opening browser...
timeout /t 4 /nobreak >nul
start "" "http://localhost:4000"

echo.
echo KalaSetu should now be running at:
echo http://localhost:4000
echo.
echo Keep the "KalaSetu Server" window open while using the project.
echo You can close this setup window.
echo.
pause
