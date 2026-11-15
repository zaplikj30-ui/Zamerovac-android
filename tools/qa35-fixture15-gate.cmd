@echo off
rem Only authorized one-shot Windows fixture. Keep original 15-case gate logic.
set "ZAMEROVAC_QA35_FIXTURE15=1"
set "ZAMEROVAC_DIAGNOSTICS=1"
call "%~dp0qa-fixture-gate.cmd"
if errorlevel 1 exit /b 1
exit /b 0
