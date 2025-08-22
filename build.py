#!/usr/bin/env python3
"""
Build script for FIDU Vault application with PyInstaller.
This script ensures the Chat Lab frontend is built before creating the executable.
"""

import subprocess
import sys
import os
from pathlib import Path
import platform


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


def setup_macos_build_environment():
    """Set up macOS-specific build environment."""
    if platform.system() != "Darwin":
        return

    print("\nSetting up macOS build environment...")

    # Check if we need to install/update PyInstaller
    try:
        import PyInstaller

        print(f"PyInstaller version: {PyInstaller.__version__}")

        # Recommend updating to latest version for better macOS compatibility
        if PyInstaller.__version__ < "5.0":
            print(
                "Warning: Consider updating PyInstaller to version 5.0+ for better macOS compatibility"
            )
    except ImportError:
        print("PyInstaller not found. Installing...")
        run_command("pip install --upgrade pyinstaller")

    # Check Python version
    python_version = sys.version_info
    print(
        f"Python version: {python_version.major}.{python_version.minor}.{python_version.micro}"
    )

    # Recommend Python 3.8+ for better macOS compatibility
    if python_version < (3, 8):
        print("Warning: Python 3.8+ recommended for better macOS compatibility")


def main():
    """Main build function."""
    print("Starting FIDU Vault build process...")

    # Set up macOS-specific environment if needed
    setup_macos_build_environment()

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
        # Use specific PyInstaller flags for better macOS compatibility
        pyinstaller_cmd = "pyinstaller main.spec"

        if platform.system() == "Darwin":
            # Add macOS-specific flags
            pyinstaller_cmd += " --clean --noconfirm"
            print("Using macOS-optimized PyInstaller configuration")

        run_command(pyinstaller_cmd)
        print("✓ PyInstaller build completed successfully")

        # Show output location
        dist_path = Path("dist/fidu_vault_0_0_2")
        if dist_path.exists():
            print(f"\nExecutable created at: {dist_path.absolute()}")
            print(f"To run the application: {dist_path / 'fidu_vault_0_0_2'}")

            # macOS-specific post-build instructions
            if platform.system() == "Darwin":
                print("\nmacOS Build Notes:")
                print("- If you encounter 'damaged' errors on newer macOS versions:")
                print("  1. Right-click the app and select 'Open'")
                print("  2. Or run: xattr -cr /path/to/your/app")
                print("- For distribution, consider code signing and notarization")
                print("- Test on target macOS versions before distribution")
        else:
            print("Warning: Expected output directory not found")

    except Exception as e:
        print(f"Error building with PyInstaller: {e}")
        sys.exit(1)

    print("\nBuild process completed!")


if __name__ == "__main__":
    main()
