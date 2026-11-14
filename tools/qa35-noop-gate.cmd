@echo off
node "%~dp0qa35-noop-gate.cjs"
if errorlevel 1 exit /b 1
exit /b 0
