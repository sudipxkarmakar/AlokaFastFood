@echo off
title AutoBrix Launcher
echo ===================================================
echo   AutoBrix: AlokaFastFood OS Launcher
echo ===================================================
echo.
echo Starting Backend API Server in a new window...
start "AlokaFastFood Backend Server" cmd /k "cd /d "%~dp0server" && npm install && npm run dev"

echo.
echo Launching Frontend Application in default browser...
timeout /t 2 >nul
start "" "%~dp0index.html"

echo.
echo Success! You can close this launcher window. Keep the backend window open.
echo ===================================================
timeout /t 3 >nul
exit
