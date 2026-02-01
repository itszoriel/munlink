@echo off
echo ========================================
echo   MunLink Zambales - Starting Project
echo ========================================
echo.

cd /d "%~dp0"

echo Starting Backend API Server...
start "Backend API" cmd /k "cd /d \"%~dp0apps\api\" && python app.py"

timeout /t 3 /nobreak >nul

echo Starting Frontend Web Server...
start "Frontend Web" cmd /k "cd /d \"%~dp0apps\web\" && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Servers Starting...
echo ========================================
echo.
echo Backend API:  http://localhost:5000
echo Frontend Web: http://localhost:3000
echo.
echo Opening application in browser...
timeout /t 2 /nobreak >nul

start http://localhost:3000

echo.
echo Press any key to exit...
pause >nul
