@echo off
setlocal enabledelayedexpansion

REM FIDU Vault Windows Launcher
REM Simple launcher for end users

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set FIDU_EXECUTABLE=%SCRIPT_DIR%FIDU_Vault.exe

REM Check if the executable exists
if not exist "%FIDU_EXECUTABLE%" (
    echo Error: FIDU executable not found!
    echo Please make sure all files are extracted properly.
    echo Expected location: %FIDU_EXECUTABLE%
    pause
    exit /b 1
)

REM Check if FIDU is already running (simple port check)
REM Check if port 4000 is in use, which indicates FIDU is running
netstat -an | findstr ":4000 " >nul 2>&1
if not errorlevel 1 (
    echo FIDU is already running!
    echo You can access it at: http://127.0.0.1:4000
    echo.
    pause
    exit /b 0
)

echo Starting FIDU Vault...
echo This will open FIDU in a new command window.
echo You can access FIDU at: http://127.0.0.1:4000
echo To stop FIDU, simply close the command window or press Ctrl+C
echo.

REM Try to run in a new command window
start "FIDU Vault" cmd /k "cd /d \"%SCRIPT_DIR%\" && \"%FIDU_EXECUTABLE%\""

REM Wait a moment for the window to open
timeout /t 2 /nobreak >nul

echo FIDU Vault should now be running in a new window.
echo If you don't see a new window, check the taskbar or try running manually:
echo   %FIDU_EXECUTABLE%
echo.
pause
