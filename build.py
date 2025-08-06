#!/usr/bin/env python3
"""
Build script for FIDU Vault application with PyInstaller.
This script ensures the Chat Lab frontend is built before creating the executable.
"""

import subprocess
import sys
import os
from pathlib import Path


def run_command(command, cwd=None, check=True):
    """Run a shell command and return the result."""
    print(f"Running: {command}")
    if cwd:
        print(f"Working directory: {cwd}")

    result = subprocess.run(
        command, shell=True, cwd=cwd, capture_output=True, text=True
    )

    if result.stdout:
        print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)

    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, command)

    return result


def main():
    """Main build function."""
    print("Starting FIDU Vault build process...")

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
        print("Warning: FIDU Chat Lab frontend directory not found, skipping frontend build")

    # Build with PyInstaller
    print("\n2. Building executable with PyInstaller...")
    try:
        run_command("pyinstaller main.spec")
        print("✓ PyInstaller build completed successfully")

        # Show output location
        dist_path = Path("dist/main")
        if dist_path.exists():
            print(f"\nExecutable created at: {dist_path.absolute()}")
            print(f"To run the application: {dist_path / 'main'}")
        else:
            print("Warning: Expected output directory not found")

    except Exception as e:
        print(f"Error building with PyInstaller: {e}")
        sys.exit(1)

    print("\nBuild process completed!")


if __name__ == "__main__":
    main()
