@echo off
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo CHYBA: Nejprve nainstaluj Node.js 20 nebo novější.
  pause
  exit /b 1
)
if "%~1"=="" (
  node tools\local-browser-qa.cjs --smoke
) else (
  node tools\local-browser-qa.cjs %*
)
set "CODE=%ERRORLEVEL%"
echo.
echo Kontrola Chromium skoncila s kodem %CODE%.
pause
exit /b %CODE%
