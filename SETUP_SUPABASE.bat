@echo off
title KalaSetu Supabase Setup
cd /d "%~dp0"

if not exist ".env" (
  copy ".env.example" ".env" >nul
)

echo.
echo =======================================================
echo   KalaSetu AI - Supabase Setup
echo =======================================================
echo.
echo 1. Create your Supabase project.
echo 2. Run supabase\schema.sql in Supabase SQL Editor.
echo 3. In the .env file set:
echo.
echo    USE_SUPABASE=true
echo    SUPABASE_URL=your_project_url
echo    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
echo.
echo The .env file will open now.
echo NEVER upload this file to GitHub.
echo.
pause
start "" notepad ".env"
