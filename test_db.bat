@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
title PostgreSQL Connection Test
echo ===================================================
echo   AlokaFastFood - PostgreSQL Connection Diagnostic
echo ===================================================
echo.
cd /d "%~dp0server"
node test-db.js
echo.
echo ===================================================
pause
