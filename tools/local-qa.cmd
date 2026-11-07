@echo off
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo CHYBA: Nejprve nainstaluj Node.js 20 nebo novější.
  pause
  exit /b 1
)
node tools\local-qa.cjs %*
set "CODE=%ERRORLEVEL%"
echo.
echo Kontroly skoncily s kodem %CODE%.
pause
exit /b %CODE%
