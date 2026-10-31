@echo off
title KalaSetu - Cohere AI Setup
cd /d "%~dp0"
echo ============================================
echo   KalaSetu AI Recommendation Setup
echo ============================================
echo.
echo This will save your Cohere key ONLY in local .env.
echo .env is already excluded from GitHub.
echo.
set /p COHERE_KEY=Paste your Cohere API key here: 

if "%COHERE_KEY%"=="" (
  echo No key entered. Nothing changed.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$path='.env';" ^
"$content = if (Test-Path $path) { Get-Content $path -Raw } else { 'PORT=4000`r`n' };" ^
"if ($content -match '(?m)^COHERE_API_KEY=') { $content = [regex]::Replace($content, '(?m)^COHERE_API_KEY=.*$', 'COHERE_API_KEY=%COHERE_KEY%') } else { $content += '`r`nCOHERE_API_KEY=%COHERE_KEY%`r`n' };" ^
"if ($content -notmatch '(?m)^COHERE_RERANK_MODEL=') { $content += 'COHERE_RERANK_MODEL=rerank-v4.0-fast`r`n' };" ^
"Set-Content -Path $path -Value $content -Encoding UTF8"

echo.
echo Cohere AI recommendation is configured.
echo Restart START_KALASETU.bat if KalaSetu is already running.
echo.
pause
