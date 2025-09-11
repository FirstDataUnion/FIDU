@echo off
setlocal enabledelayedexpansion

REM Windows-specific build script for FIDU Vault
REM This script provides better compatibility across different Windows versions
REM and supports cross-compilation for different architectures

echo 🪟 FIDU Vault Windows Build Script
echo ===================================

REM Check if we're on Windows
if not "%OS%"=="Windows_NT" (
    echo ❌ This script is designed for Windows only
    exit /b 1
)

REM Get Windows version and architecture information
for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j
for /f "tokens=2 delims=[]" %%i in ('systeminfo ^| findstr /B /C:"OS Name"') do set OS_NAME=%%i
for /f "tokens=2 delims=[]" %%i in ('systeminfo ^| findstr /B /C:"OS Version"') do set OS_VERSION=%%i

REM Get processor architecture
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set CURRENT_ARCH=x86_64
) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    set CURRENT_ARCH=arm64
) else (
    set CURRENT_ARCH=%PROCESSOR_ARCHITECTURE%
)

echo 🪟 Building on %OS_NAME% %OS_VERSION% (%CURRENT_ARCH%)

REM Set environment variables for better compatibility
set PYTHONPATH=%PYTHONPATH%;%CD%
set PYTHONUNBUFFERED=1
set PYTHONIOENCODING=utf-8

REM Add PyInstaller Scripts directory to PATH
for /f "tokens=*" %%i in ('python -c "import site; print(site.getusersitepackages())"') do set USER_SITE_PACKAGES=%%i
set PATH=%PATH%;%USER_SITE_PACKAGES%\..\Scripts

echo 🎯 Targeting Windows compatibility

REM Check Python version
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python 3.8+ and add it to PATH
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo 🐍 Python version: %PYTHON_VERSION%

REM Check PyInstaller version
pyinstaller --version >nul 2>&1
if errorlevel 1 (
    echo ❌ PyInstaller not found. Installing...
    python -m pip install --upgrade pyinstaller
) else (
    for /f "tokens=1" %%i in ('pyinstaller --version 2^>^&1') do set PYINSTALLER_VERSION=%%i
    echo 📦 PyInstaller version: %PYINSTALLER_VERSION%
    
    REM Check if version is old (basic check)
    echo %PYINSTALLER_VERSION% | findstr /r "^[0-4]\." >nul
    if not errorlevel 1 (
        echo ⚠️  Warning: Consider updating PyInstaller to version 5.0+ for better Windows compatibility
        echo    Run: python -m pip install --upgrade pyinstaller
    )
)

REM Build options
set BUILD_TYPE=standard
set TARGET_ARCH=
set BUILD_UNIVERSAL=false

REM Parse command line arguments inline

REM Process first argument
if "%~1"=="--arm64" (
    set BUILD_TYPE=arm64
    set TARGET_ARCH=ARM
    echo 🖥️  Building for ARM64 architecture
    goto args_done
)
if "%~1"=="--universal" (
    set BUILD_TYPE=universal
    set BUILD_UNIVERSAL=true
    echo 🌐 Building universal binary (multiple architectures)
    goto args_done
)
if "%~1"=="--x86_64" (
    set BUILD_TYPE=x86_64
    set TARGET_ARCH=x86_64
    echo 💻 Building for x86_64 architecture
    goto args_done
)
if "%~1"=="--minimal" (
    set BUILD_TYPE=minimal
    echo 📦 Building minimal binary (smaller size, may have compatibility issues)
    goto args_done
)
if "%~1"=="--help" (
    goto show_help
)
if "%~1"=="-h" (
    goto show_help
)
if not "%~1"=="" (
    echo ❌ Unknown option: %~1
    echo Use --help for usage information
    exit /b 1
)

:args_done
goto continue_build

:show_help
echo Usage: %~nx0 [OPTIONS]
echo.
echo Options:
echo   --universal    Build universal binary (multiple architectures)
echo   --x86_64       Build specifically for x86_64
echo   --arm64        Build specifically for ARM64
echo   --minimal      Build minimal binary (smaller size)
echo   --help, -h     Show this help message
echo.
echo Examples:
echo   %~nx0                    # Build for current architecture
echo   %~nx0 --universal        # Build universal binary
echo   %~nx0 --x86_64           # Build for x86_64 systems
echo   %~nx0 --arm64            # Build for ARM64 systems
exit /b 0

:continue_build
REM Set environment variables for cross-compilation
if "%TARGET_ARCH%"=="ARM" (
    echo 🔧 Setting up ARM64 cross-compilation environment...
    set TARGET_ARCH=arm64
    set BUILD_UNIVERSAL=false
    
    REM Check if we have the necessary tools for ARM64 cross-compilation
    where cl >nul 2>&1
    if errorlevel 1 (
        echo ❌ Visual Studio Build Tools not found.
        echo Install Visual Studio Build Tools or Visual Studio Community
        echo Or use --universal for better compatibility
        exit /b 1
    )
    
    echo ✅ ARM64 cross-compilation environment ready
    
) else if "%BUILD_UNIVERSAL%"=="true" (
    echo 🔧 Setting up universal binary build environment...
    set BUILD_UNIVERSAL=true
    set TARGET_ARCH=
    
    echo 🌐 Will create binary that works on multiple architectures
    
) else (
    echo 🔧 Building for current architecture: %CURRENT_ARCH%
    set TARGET_ARCH=
    set BUILD_UNIVERSAL=false
)

echo.
echo 🚀 Starting build process...

REM Run the main build script
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR:~0,-1%
set PROJECT_ROOT=%PROJECT_ROOT:~0,-1%
cd /d "%PROJECT_ROOT%"

REM Export environment variables for the Python build script
set BUILD_UNIVERSAL=%BUILD_UNIVERSAL%
set TARGET_ARCH=%TARGET_ARCH%

python build.py

if errorlevel 1 (
    echo ❌ Build failed
    exit /b 1
)

echo.
echo ✅ Build completed!

REM Post-build Windows-specific instructions
echo.
echo 📋 Windows Post-Build Instructions:
echo ===================================

if "%BUILD_TYPE%"=="universal" (
    echo 🌐 Universal binary created - should work on multiple architectures
    echo    - x86_64 systems: Will run natively
    echo    - ARM64 systems: Will run natively
) else if "%TARGET_ARCH%"=="arm64" (
    echo 🖥️  ARM64 binary created - optimized for ARM64 systems
    echo    - Will run natively on ARM64 systems
    echo    - May not run on x86_64 systems
) else if "%TARGET_ARCH%"=="x86_64" (
    echo 💻 x86_64 binary created - optimized for x86_64 systems
    echo    - Will run natively on x86_64 systems
    echo    - May not run on ARM64 systems
)

echo.
echo 🔧 Make sure the executable has proper permissions:
echo    The executable should be ready to run directly
echo.
echo 📦 For distribution:
echo    - Test on target Windows versions before distribution
echo    - Consider creating an installer (NSIS, Inno Setup, etc.)
echo    - Package dependencies appropriately
echo    - Consider code signing for better security
echo.
echo 🧪 Testing recommendations:
echo    - Test on Windows 10 (common target)
echo    - Test on Windows 11 (latest version)
echo    - Test on Windows Server 2019/2022 (enterprise target)
echo    - If building for ARM64, test on actual ARM64 hardware when possible
echo.
echo 🎯 Architecture-specific notes:
if "%TARGET_ARCH%"=="arm64" (
    echo    - ARM64 builds may be larger due to additional optimizations
    echo    - Performance will be best on ARM64 systems
    echo    - Consider also building universal binary for distribution
) else if "%BUILD_UNIVERSAL%"=="true" (
    echo    - Universal binaries are larger but provide best compatibility
    echo    - Recommended for distribution to mixed user bases
)
echo.
echo 🪟 Happy building!
