#!/usr/bin/env python3
"""
Build script for FIDU Core application with PyInstaller.
This script ensures the ACM Lab frontend is built before creating the executable.
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
        command,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True
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
    print("Starting FIDU Core build process...")
    
    # Check if we're in the right directory
    if not Path("main.spec").exists():
        print("Error: main.spec not found. Please run this script from the project root.")
        sys.exit(1)
    
    # Build the ACM Lab frontend first
    acm_frontend_dir = Path("src/apps/acm-front-end")
    if acm_frontend_dir.exists():
        print("\n1. Building ACM Lab frontend...")
        try:
            # Install dependencies if needed
            if not (acm_frontend_dir / "node_modules").exists():
                print("Installing npm dependencies...")
                run_command("npm install", cwd=acm_frontend_dir)
            
            # Build the frontend
            print("Building frontend...")
            run_command("npm run build", cwd=acm_frontend_dir)
            
            # Check if build was successful
            dist_dir = acm_frontend_dir / "dist"
            if not dist_dir.exists() or not (dist_dir / "index.html").exists():
                raise Exception("Frontend build failed - dist/index.html not found")
            
            print("✓ ACM Lab frontend built successfully")
            
        except Exception as e:
            print(f"Error building ACM Lab frontend: {e}")
            sys.exit(1)
    else:
        print("Warning: ACM Lab frontend directory not found, skipping frontend build")
    
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