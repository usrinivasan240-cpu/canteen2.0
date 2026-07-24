@echo off
REM =============================================================
REM VIOLET BITES - NEW LAPTOP QUICK SETUP (Windows)
REM =============================================================

echo ==========================================
echo   VIOLET BITES - Quick Setup
echo ==========================================

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js %%i

REM Setup canteen2.0
echo.
echo >>> Setting up canteen2.0...
if exist "..\canteen2.0-main\canteen2.0-main" (
    cd "..\canteen2.0-main\canteen2.0-main"
    call npm install
    echo [OK] canteen2.0 dependencies installed
    cd "%~dp0"
) else if exist "..\canteen2.0" (
    cd "..\canteen2.0"
    call npm install
    echo [OK] canteen2.0 dependencies installed
    cd "%~dp0"
) else (
    echo [SKIP] canteen2.0 not found
)

REM Setup Canteen-App
echo.
echo >>> Setting up Canteen-App...
if exist "..\Canteen-App" (
    cd "..\Canteen-App"
    call npm install
    echo [OK] Canteen-App dependencies installed
    cd "%~dp0"
) else (
    echo [SKIP] Canteen-App not found
)

REM Setup superadmin
echo.
echo >>> Setting up canteen-superadmin...
if exist "..\canteen-superadmin" (
    cd "..\canteen-superadmin"
    call npm install
    echo [OK] canteen-superadmin dependencies installed
    cd "%~dp0"
) else (
    echo [SKIP] canteen-superadmin not found
)

echo.
echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo To run: cd canteen2.0 ^&^& npm run dev
echo To build APK: cd Canteen-App ^&^& npx expo prebuild --platform android
echo ==========================================
pause
