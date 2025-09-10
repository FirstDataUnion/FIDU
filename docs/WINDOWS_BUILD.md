# Windows Build Guide for FIDU Vault

This guide explains how to build FIDU Vault for Windows platforms, including support for both x86_64 and ARM64 architectures.

## Prerequisites

### Required Software
- **Python 3.8+** - Download from [python.org](https://www.python.org/downloads/)
- **Visual Studio Build Tools** or **Visual Studio Community** - For C++ compilation
- **Git** - For version control (optional but recommended)

### Python Dependencies
The build script will automatically install PyInstaller if not present, but you can install it manually:
```cmd
pip install --upgrade pyinstaller
```

## Building FIDU Vault

### Quick Start
```cmd
cd scripts
build_windows.bat
```

### Build Options

#### Standard Build (Current Architecture)
```cmd
build_windows.bat
```
Builds for your current Windows architecture (x86_64 or ARM64).

#### Universal Build (Multiple Architectures)
```cmd
build_windows.bat --universal
```
Creates a binary that works on both x86_64 and ARM64 systems.

#### Architecture-Specific Builds
```cmd
# For x86_64 systems
build_windows.bat --x86_64

# For ARM64 systems
build_windows.bat --arm64
```

#### Minimal Build
```cmd
build_windows.bat --minimal
```
Creates a smaller binary but may have compatibility issues.

### Build Process

The build script will:
1. Check your Python and PyInstaller versions
2. Build the FIDU Chat Lab frontend (if present)
3. Create the Windows executable using PyInstaller
4. Include documentation and launcher scripts
5. Rename the output with version and architecture information

## Output Structure

After a successful build, you'll find the output in the `dist/` directory:

```
dist/
└── FIDU_Vault_v{version}_Windows_{architecture}/
    ├── FIDU_Vault.exe              # Main executable
    ├── run_fidu_windows.bat        # Windows launcher script
    ├── README.md                   # Documentation
    ├── ARCHITECTURE.txt            # Build information
    └── fidu-chat-grabber/          # Browser extension files
```

## Running FIDU Vault

### Method 1: Launcher Script (Recommended)
Double-click `run_fidu_windows.bat` or run:
```cmd
run_fidu_windows.bat
```

### Method 2: Direct Execution
```cmd
FIDU_Vault.exe
```

## Troubleshooting

### Common Issues

#### "Python not found" Error
- Ensure Python is installed and added to your PATH
- Try running `python --version` in Command Prompt
- Reinstall Python with "Add to PATH" option checked

#### "PyInstaller not found" Error
- The script will attempt to install PyInstaller automatically
- If it fails, install manually: `pip install --upgrade pyinstaller`

#### "Visual Studio Build Tools not found" Error
- Install Visual Studio Build Tools from Microsoft
- Or install Visual Studio Community (free)
- Ensure C++ build tools are included

#### "Permission denied" Errors
- Run Command Prompt as Administrator
- Check antivirus software isn't blocking the build
- Ensure you have write permissions in the project directory

#### Build Fails with Import Errors
- Update PyInstaller: `pip install --upgrade pyinstaller`
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Try a clean build by deleting `build/` and `dist/` directories

### Architecture-Specific Issues

#### ARM64 Build Issues
- Ensure you're building on an ARM64 system or have proper cross-compilation tools
- Consider using `--universal` for better compatibility
- Test on actual ARM64 hardware when possible

#### x86_64 Build Issues
- Most common architecture, should work on most systems
- If issues persist, try `--universal` build

## Distribution

### Testing Before Distribution
- Test on Windows 10 (common target)
- Test on Windows 11 (latest version)
- Test on Windows Server 2019/2022 (enterprise target)
- If building for ARM64, test on actual ARM64 hardware

### Creating an Installer
Consider using tools like:
- **NSIS** (Nullsoft Scriptable Install System)
- **Inno Setup** (Free installer creator)
- **WiX Toolset** (Microsoft's installer framework)

### Code Signing
For better security and user trust:
- Obtain a code signing certificate
- Sign the executable before distribution
- This prevents Windows SmartScreen warnings

## Advanced Configuration

### Environment Variables
You can set these environment variables to customize the build:

- `TARGET_ARCH` - Target architecture (x86_64, arm64)
- `BUILD_UNIVERSAL` - Set to "true" for universal builds
- `PYTHONPATH` - Additional Python path entries

### Custom PyInstaller Options
Edit `main.spec` to customize PyInstaller settings:
- Add/remove hidden imports
- Modify data files inclusion
- Change executable options

## Support

If you encounter issues:
1. Check this troubleshooting guide
2. Review the build output for error messages
3. Ensure all prerequisites are installed
4. Try a clean build (delete `build/` and `dist/` directories)
5. Check the project's main README for additional help

## Notes

- Windows builds are larger than Linux/macOS due to additional dependencies
- Universal builds are even larger but provide best compatibility
- The launcher script (`run_fidu_windows.bat`) provides a user-friendly way to start FIDU
- Consider creating an installer for easier distribution to end users
