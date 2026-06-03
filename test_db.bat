@echo off
title DB Connection Test
echo ===================================================
echo   AlokaFastFood — MySQL Connection Diagnostic
echo ===================================================
echo.
cd /d "%~dp0server"
node test-db.js
echo.
echo ===================================================
pause
