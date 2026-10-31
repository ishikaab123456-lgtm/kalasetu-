@echo off
title KalaSetu Project Check
cd /d "%~dp0"

echo Checking Node.js...
node -v
echo.
echo Checking npm...
npm -v
echo.
echo Checking important files...
if exist package.json (echo [OK] package.json) else (echo [MISSING] package.json)
if exist index.js (echo [OK] index.js) else (echo [MISSING] index.js)
if exist public\index.html (echo [OK] frontend) else (echo [MISSING] frontend)
if exist routes\auth.js (echo [OK] authentication) else (echo [MISSING] authentication)
if exist routes\recommendations.js (echo [OK] recommendation API) else (echo [MISSING] recommendation API)
if exist services\database.js (echo [OK] database service) else (echo [MISSING] database service)
if exist supabase\schema.sql (echo [OK] Supabase schema) else (echo [MISSING] Supabase schema)
echo.
echo If all items show OK, run START_KALASETU.bat
pause
