@echo off
node "%~dp0qa-fixture-gate.cjs"
if errorlevel 1 exit /b 1
if not errorlevel 0 exit /b 1
exit /b 0
