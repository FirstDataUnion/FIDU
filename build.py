#!/usr/bin/env python3
"""
Build script for FIDU Vault application with PyInstaller.
This script ensures the Chat Lab frontend is built before creating the executable.
"""

import subprocess
import sys
import os
import shutil
from pathlib import Path
import platform

# Add the src directory to the path so we can import the versioning module
sys.path.insert(0, str(Path(__file__).parent / "src"))

try:
    from fidu_vault.versioning.version import get_version
except ImportError:
    print("Warning: Could not import version module, using default version")

    def get_version():
        return "0.0.0"


def run_command(command, cwd=None, check=True, env=None):
    """Run a shell command and return the result."""
    print(f"Running: {command}")
    if cwd:
        print(f"Working directory: {cwd}")

    # Set up environment variables for better macOS compatibility
    if env is None:
        env = os.environ.copy()

    if platform.system() == "Darwin":
        # macOS-specific environment variables for better compatibility
        env.update(
            {
                "MACOSX_DEPLOYMENT_TARGET": "10.15",  # Target Catalina as minimum
                "PYTHON_CONFIGURE_OPTS": "--enable-framework",
                "LDFLAGS": "-Wl,-rpath,@executable_path/../Frameworks",
                "CFLAGS": "-I/usr/local/include",
            }
        )

        # Ensure we're using the right Python version
        print(f"Building on macOS {platform.mac_ver()[0]}")
        print(f"Targeting minimum macOS version: 10.15 (Catalina)")

    result = subprocess.run(
        command, shell=True, cwd=cwd, capture_output=True, text=True, env=env
    )

    if result.stdout:
        print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)

    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, command)

    return result


def get_system_info():
    """Get system and architecture information for naming."""
    system = platform.system()
    machine = platform.machine()

    # Map common architecture names to more readable versions
    arch_map = {
        "x86_64": "x86_64",
        "amd64": "x86_64",
        "i386": "i386",
        "i686": "i686",
        "aarch64": "arm64",
        "arm64": "arm64",
        "armv7l": "armv7",
        "armv8l": "arm64",
    }

    arch = arch_map.get(machine, machine)

    # Map system names to more readable versions
    system_map = {
        "Darwin": "macOS",
        "Linux": "Linux",
        "Windows": "Windows",
    }

    system_name = system_map.get(system, system)

    return system_name, arch


def setup_build_environment():
    """Set up build environment for different platforms."""
    system = platform.system()
    current_arch = platform.machine()

    print(f"\nSetting up build environment...")
    print(f"System: {system}")
    print(f"Architecture: {current_arch}")

    if system == "Darwin":
        setup_macos_build_environment()
    elif system == "Linux":
        setup_linux_build_environment()
    elif system == "Windows":
        setup_windows_build_environment()
    else:
        print(f"Building on {system} - using default configuration")

    # Check if we need to install/update PyInstaller
    try:
        import PyInstaller

        print(f"PyInstaller version: {PyInstaller.__version__}")

        # Recommend updating to latest version for better compatibility
        if PyInstaller.__version__ < "5.0":
            print(
                "Warning: Consider updating PyInstaller to version 5.0+ for better compatibility"
            )
    except ImportError:
        print("PyInstaller not found. Installing...")
        run_command("pip install --upgrade pyinstaller")

    # Check Python version
    python_version = sys.version_info
    print(
        f"Python version: {python_version.major}.{python_version.minor}.{python_version.micro}"
    )

    # Recommend Python 3.8+ for better compatibility
    if python_version < (3, 8):
        print("Warning: Python 3.8+ recommended for better compatibility")


def setup_macos_build_environment():
    """Set up macOS-specific build environment."""
    if platform.system() != "Darwin":
        return

    print("\nSetting up macOS build environment...")

    # Check current architecture
    current_arch = platform.machine()
    target_arch = os.environ.get("TARGET_ARCH", None)
    build_universal = os.environ.get("BUILD_UNIVERSAL", "false").lower() == "true"

    print(f"Current system architecture: {current_arch}")

    if target_arch:
        print(f"Target architecture: {target_arch}")
        if target_arch != current_arch:
            print(f"🔄 Cross-compiling from {current_arch} to {target_arch}")
        else:
            print(f"✅ Building for current architecture")
    elif build_universal:
        print("🌐 Building universal binary (Intel + Apple Silicon)")
    else:
        print(f"✅ Building for current architecture: {current_arch}")

    # Check for cross-compilation requirements
    if target_arch == "arm64" and current_arch == "x86_64":
        print("\n🍎 ARM64 Cross-compilation Setup:")
        print("   - Ensure Xcode Command Line Tools are installed")
        print("   - Verify clang supports ARM64 targeting")
        print("   - Consider using --universal for better compatibility")

    elif build_universal:
        print("\n🌐 Universal Binary Setup:")
        print("   - Will create binary that works on both Intel and Apple Silicon")
        print("   - Larger file size but better compatibility")
        print("   - Recommended for distribution")


def setup_linux_build_environment():
    """Set up Linux-specific build environment."""
    if platform.system() != "Linux":
        return

    print("\nSetting up Linux build environment...")

    # Check current architecture
    current_arch = platform.machine()
    target_arch = os.environ.get("TARGET_ARCH", None)
    build_universal = os.environ.get("BUILD_UNIVERSAL", "false").lower() == "true"

    print(f"Current system architecture: {current_arch}")

    if target_arch:
        print(f"Target architecture: {target_arch}")
        if target_arch != current_arch:
            print(f"🔄 Cross-compiling from {current_arch} to {target_arch}")
        else:
            print(f"✅ Building for current architecture")
    elif build_universal:
        print("🌐 Building universal binary (multiple architectures)")
    else:
        print(f"✅ Building for current architecture: {current_arch}")

    # Check for cross-compilation requirements
    if target_arch and target_arch != current_arch:
        print(f"\n🐧 Cross-compilation Setup:")
        print(f"   - Target: {target_arch}")
        print(f"   - Current: {current_arch}")
        print("   - Ensure appropriate cross-compilation tools are installed")
        print("   - Consider using --universal for better compatibility")

    elif build_universal:
        print("\n🌐 Universal Binary Setup:")
        print("   - Will create binary that works on multiple architectures")
        print("   - Larger file size but better compatibility")
        print("   - Recommended for distribution")


def setup_windows_build_environment():
    """Set up Windows-specific build environment."""
    if platform.system() != "Windows":
        return

    print("\nSetting up Windows build environment...")

    # Check current architecture
    current_arch = platform.machine()
    target_arch = os.environ.get("TARGET_ARCH", None)
    build_universal = os.environ.get("BUILD_UNIVERSAL", "false").lower() == "true"

    print(f"Current system architecture: {current_arch}")

    if target_arch:
        print(f"Target architecture: {target_arch}")
        if target_arch != current_arch:
            print(f"🔄 Cross-compiling from {current_arch} to {target_arch}")
        else:
            print(f"✅ Building for current architecture")
    elif build_universal:
        print("🌐 Building universal binary (multiple architectures)")
    else:
        print(f"✅ Building for current architecture: {current_arch}")

    # Check for cross-compilation requirements
    if target_arch and target_arch != current_arch:
        print(f"\n🪟 Cross-compilation Setup:")
        print(f"   - Target: {target_arch}")
        print(f"   - Current: {current_arch}")
        print("   - Ensure Visual Studio Build Tools are installed")
        print("   - Consider using --universal for better compatibility")

    elif build_universal:
        print("\n🌐 Universal Binary Setup:")
        print("   - Will create binary that works on multiple architectures")
        print("   - Larger file size but better compatibility")
        print("   - Recommended for distribution")

    # Windows-specific environment setup
    print("\n🪟 Windows-specific setup:")
    print("   - Targeting Windows 10+ compatibility")
    print("   - Using Windows-specific PyInstaller configuration")
    print("   - Including Windows-specific dependencies")


def rename_build_output():
    """Rename the build output to include version, system and architecture information."""
    system_name, arch = get_system_info()

    # Get the current version
    try:
        version = get_version()
        print(f"Current version: {version}")
    except Exception as e:
        print(f"Warning: Could not get version: {e}")
        version = "0.0.0"

    # Check if this is a universal build
    build_universal = os.environ.get("BUILD_UNIVERSAL", "false").lower() == "true"
    target_arch = os.environ.get("TARGET_ARCH", None)

    # Determine the architecture string for the directory name
    if build_universal:
        arch_string = "universal"
        print("🌐 Detected universal build")
    elif target_arch:
        arch_string = target_arch
        print(f"🎯 Detected target architecture: {target_arch}")
    else:
        arch_string = arch
        print(f"🏗️ Using current architecture: {arch}")

    # Find the PyInstaller output directory
    dist_dir = Path("dist")
    if not dist_dir.exists():
        print("❌ dist directory not found")
        return

    # Look for the FIDU_Vault directory (PyInstaller creates a directory with the spec name)
    fidu_dirs = list(dist_dir.glob("FIDU_Vault*"))
    if not fidu_dirs:
        print("❌ No FIDU_Vault directory found in dist")
        return

    fidu_dir = fidu_dirs[0]
    new_name = f"FIDU_Vault_v{version}_{system_name}_{arch_string}"
    new_path = dist_dir / new_name

    print(f"Renaming build output...")
    print(f"From: {fidu_dir}")
    print(f"To: {new_path}")

    # If the directory is already named correctly, don't rename it
    if fidu_dir.name == new_name:
        print(f"✅ Directory already named correctly: {new_name}")
        new_path = fidu_dir
    else:
        # Remove existing directory if it exists
        if new_path.exists():
            shutil.rmtree(new_path)

        # Rename the directory
        fidu_dir.rename(new_path)

    # The executable is already named FIDU_Vault, so no need to rename it
    executable = new_path / "FIDU_Vault"
    if executable.exists():
        print(f"Executable already named: FIDU_Vault")

    print(f"✅ Build output renamed to: {new_name}")
    return new_path


def create_launcher_script(script_path):
    """Create the run_fidu.sh launcher script."""
    script_content = """#!/bin/bash

# FIDU Vault Launcher
# Simple launcher for end users

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIDU_EXECUTABLE="$SCRIPT_DIR/FIDU_Vault"

# Check if the executable exists
if [ ! -f "$FIDU_EXECUTABLE" ]; then
    echo "Error: FIDU executable not found!"
    echo "Please make sure all files are extracted properly."
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if FIDU is already running (simple port check)
# Check if port 4000 is in use, which indicates FIDU is running
if netstat -tln 2>/dev/null | grep -q ":4000 "; then
    echo "FIDU is already running!"
    echo "You can access it at: http://127.0.0.1:4000"
    echo ""
    read -p "Press Enter to exit..."
    exit 0
fi

echo "Starting FIDU Vault..."
echo "This will open FIDU in a new terminal window."
echo "You can access FIDU at: http://127.0.0.1:4000"
echo "To stop FIDU, simply close the terminal window or press Ctrl+C"
echo ""

# Function to detect available terminal emulators
get_terminal() {
    if command -v gnome-terminal >/dev/null 2>&1; then
        echo "gnome-terminal -- bash -c \\"cd '$SCRIPT_DIR' && ./FIDU_Vault; exec bash\\""
    elif command -v konsole >/dev/null 2>&1; then
        echo "konsole -e bash -c \\"cd '$SCRIPT_DIR' && ./FIDU_Vault; exec bash\\""
    elif command -v xterm >/dev/null 2>&1; then
        echo "xterm -e \\"cd '$SCRIPT_DIR' && ./FIDU_Vault; exec bash\\""
    elif command -v lxterminal >/dev/null 2>&1; then
        echo "lxterminal -e \\"cd '$SCRIPT_DIR' && ./FIDU_Vault; exec bash\\""
    else
        echo "No supported terminal emulator found. Running in current terminal..."
        echo "cd '$SCRIPT_DIR' && ./FIDU_Vault"
        return 1
    fi
}

# Try to run in a new terminal window
TERMINAL_CMD=$(get_terminal)

if [ $? -eq 0 ]; then
    echo "Opening FIDU in a new terminal window..."
    eval $TERMINAL_CMD
else
    echo "Running FIDU in current terminal..."
    echo "Press Ctrl+C to stop FIDU"
    cd "$SCRIPT_DIR"
    ./FIDU_Vault
fi
"""

    with open(script_path, "w", encoding="utf-8") as f:
        f.write(script_content)

    # Make the script executable
    script_path.chmod(0o755)


def create_windows_launcher_script(script_path):
    """Create the run_fidu_windows.bat launcher script."""
    script_content = """@echo off
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
start "FIDU Vault" cmd /k "cd /d \\"%SCRIPT_DIR%\\" && \\"%FIDU_EXECUTABLE%\\""

REM Wait a moment for the window to open
timeout /t 2 /nobreak >nul

echo FIDU Vault should now be running in a new window.
echo If you don't see a new window, check the taskbar or try running manually:
echo   %FIDU_EXECUTABLE%
echo.
pause
"""

    with open(script_path, "w", encoding="utf-8") as f:
        f.write(script_content)


def include_documentation(build_path):
    """Include documentation and additional files in the build output."""
    if not build_path:
        return

    print("Including documentation and additional files...")

    # Copy the README file
    readme_source = Path("docs/RUNNING_FIDU_VAULT.md")
    if readme_source.exists():
        readme_dest = build_path / "README.md"
        shutil.copy2(readme_source, readme_dest)
        print(f"✅ Copied {readme_source} to {readme_dest}")
    else:
        print(f"⚠️  Warning: {readme_source} not found")

    # Copy the fidu-chat-grabber directory
    fidu_chat_grabber_source = Path("src/data_acquisition/fidu-chat-grabber")
    if fidu_chat_grabber_source.exists():
        fidu_chat_grabber_dest = build_path / "fidu-chat-grabber"
        if fidu_chat_grabber_dest.exists():
            shutil.rmtree(fidu_chat_grabber_dest)
        shutil.copytree(fidu_chat_grabber_source, fidu_chat_grabber_dest)
        print(f"✅ Copied {fidu_chat_grabber_source} to {fidu_chat_grabber_dest}")
    else:
        print(f"⚠️  Warning: {fidu_chat_grabber_source} not found")

    # Create the launcher script
    if platform.system() == "Windows":
        launcher_script = build_path / "run_fidu_windows.bat"
        create_windows_launcher_script(launcher_script)
        print(f"✅ Created Windows launcher script: {launcher_script}")
    else:
        launcher_script = build_path / "run_fidu.sh"
        create_launcher_script(launcher_script)
        print(f"✅ Created launcher script: {launcher_script}")


def main():
    """Main build function."""
    print("Starting FIDU Vault build process...")

    # Show version information
    try:
        version = get_version()
        print(f"Building FIDU Vault version: {version}")
    except Exception as e:
        print(f"Warning: Could not get version: {e}")
        print("Using default version: 0.0.0")

    # Set up build environment
    setup_build_environment()

    # Check if we're in the right directory
    if not Path("main.spec").exists():
        print(
            "Error: main.spec not found. Please run this script from the project root."
        )
        sys.exit(1)

    # Build the FIDU Chat Lab frontend first
    chat_lab_dir = Path("src/apps/chat-lab")
    if chat_lab_dir.exists():
        print("\n1. Building FIDU Chat Lab frontend...")
        try:
            # Install dependencies if needed
            if not (chat_lab_dir / "node_modules").exists():
                print("Installing npm dependencies...")
                run_command("npm install", cwd=chat_lab_dir)

            # Build the frontend
            print("Building frontend...")
            run_command("npm run build", cwd=chat_lab_dir)

            # Check if build was successful
            dist_dir = chat_lab_dir / "dist"
            if not dist_dir.exists() or not (dist_dir / "index.html").exists():
                raise Exception("Frontend build failed - dist/index.html not found")

            print("✓ FIDU Chat Lab frontend built successfully")

        except Exception as e:
            print(f"Error building FIDU Chat Lab frontend: {e}")
            sys.exit(1)
    else:
        print(
            "Warning: FIDU Chat Lab frontend directory not found, skipping frontend build"
        )

    # Build with PyInstaller
    print("\n2. Building executable with PyInstaller...")
    try:
        # Use specific PyInstaller flags for better compatibility
        pyinstaller_cmd = "pyinstaller main.spec"

        if platform.system() == "Darwin":
            # Add macOS-specific flags
            pyinstaller_cmd += " --clean --noconfirm"
            print("Using macOS-optimized PyInstaller configuration")
        elif platform.system() == "Linux":
            # Add Linux-specific flags
            pyinstaller_cmd += " --clean --noconfirm"
            print("Using Linux-optimized PyInstaller configuration")
        elif platform.system() == "Windows":
            # Add Windows-specific flags
            pyinstaller_cmd += " --clean --noconfirm"
            print("Using Windows-optimized PyInstaller configuration")

        run_command(pyinstaller_cmd)
        print("✓ PyInstaller build completed successfully")

        # Rename the build output
        print("\n3. Renaming build output...")
        build_path = rename_build_output()

        # Include documentation and additional files
        print("\n4. Including documentation and additional files...")
        include_documentation(build_path)

        # Show output location
        if build_path and build_path.exists():
            print(f"\n✅ Executable created at: {build_path.absolute()}")
            print(f"📁 Directory name includes version and platform information")
            executable_path = build_path / "FIDU_Vault"
            launcher_script = build_path / "run_fidu.sh"

            if executable_path.exists():
                print(f"To run the application: {executable_path}")
                if launcher_script.exists():
                    print(f"Or use the launcher script: {launcher_script}")

            # Platform-specific post-build instructions
            if platform.system() == "Darwin":
                print("\nmacOS Build Notes:")
                print("- If you encounter 'damaged' errors on newer macOS versions:")
                print("  1. Right-click the app and select 'Open'")
                print("  2. Or run: xattr -cr /path/to/your/app")
                print("- For distribution, consider code signing and notarization")
                print("- Test on target macOS versions before distribution")
            elif platform.system() == "Linux":
                print("\nLinux Build Notes:")
                print(
                    "- The launcher script 'run_fidu.sh' is included for easy startup"
                )
                print("- Double-click 'run_fidu.sh' or run: ./run_fidu.sh")
                print("- Test on target Linux distributions before distribution")
            elif platform.system() == "Windows":
                print("\nWindows Build Notes:")
                print("- The launcher script 'run_fidu_windows.bat' is included for easy startup")
                print("- Double-click 'run_fidu_windows.bat' or run: run_fidu_windows.bat")
                print("- Test on target Windows versions before distribution")
                print("- Consider creating an installer for distribution")
        else:
            print("Warning: Expected output directory not found")

    except Exception as e:
        print(f"Error building with PyInstaller: {e}")
        sys.exit(1)

    print("\nBuild process completed!")


if __name__ == "__main__":
    main()
