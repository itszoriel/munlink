@echo off
echo ========================================
echo   MunLink Zambales - Starting Project
echo ========================================
echo.

echo Starting Backend API Server...
start "Backend API" cmd /k "cd apps\api && python app.py"
timeout /t 3 /nobreak >nul

echo Starting Frontend Web Server...
start "Frontend Web" cmd /k "cd apps\web && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Servers Starting...
echo ========================================
echo.
echo Backend API:  http://localhost:5000
echo Frontend Web: http://localhost:3000
echo.
echo Press any key to open the application...
pause >nul

start http://localhost:3000
