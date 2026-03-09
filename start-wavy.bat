@echo off
echo 🌊 Starting WAVY Backend with MediaMTX...

REM Check if MediaMTX is installed
where mediamtx >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ MediaMTX not found. Please install MediaMTX first:
    echo    Download from: https://github.com/bluenviron/mediamtx/releases
    echo    Add mediamtx.exe to your PATH
    pause
    exit /b 1
)

REM Start MediaMTX in background
echo 🎵 Starting MediaMTX server...
start /B mediamtx mediamtx.yml

REM Wait a moment for MediaMTX to start
timeout /t 2 /nobreak >nul

REM Start Node.js backend
echo 🚀 Starting WAVY Backend...
start /B npm start

echo ✅ WAVY Backend running on http://localhost:3000
echo ✅ MediaMTX WebRTC running on ws://localhost:8889
echo ✅ MediaMTX HLS running on http://localhost:8888
echo.
echo Press any key to stop all services
pause >nul

REM Stop services
echo.
echo 🛑 Stopping services...
taskkill /f /im mediamtx.exe >nul 2>nul
taskkill /f /im node.exe >nul 2>nul
echo ✅ All services stopped