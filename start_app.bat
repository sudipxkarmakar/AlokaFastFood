@echo off
title AlokaFastFood Launcher
echo ===================================================
echo   AlokaFastFood OS Launcher
echo ===================================================
echo.

echo Starting MySQL80 service...
net start MySQL80 2>nul
if %errorLevel% neq 0 (
    echo MySQL80 already running or starting...
)
timeout /t 2 >nul

echo.
echo Starting Backend API Server in a new window...
start "AlokaFastFood Backend Server" cmd /k "cd /d "%~dp0server" && npm install && npm run dev"

echo.
echo Waiting for server to start...
timeout /t 4 >nul

echo.
echo Launching app at http://localhost:3001 ...
start "" "http://localhost:3001"

echo.
echo Success! You can close this launcher window. Keep the backend window open.
echo ===================================================
timeout /t 3 >nul
exit
