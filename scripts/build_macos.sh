#!/bin/bash

# macOS-specific build script for FIDU Vault
# This script provides better compatibility across different macOS versions

set -e

echo "🐍 FIDU Vault macOS Build Script"
echo "=================================="

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS only"
    exit 1
fi

# Get macOS version
MACOS_VERSION=$(sw_vers -productVersion)
echo "📱 Building on macOS $MACOS_VERSION"

# Set environment variables for better compatibility
export MACOSX_DEPLOYMENT_TARGET="10.15"  # Target Catalina as minimum
export PYTHON_CONFIGURE_OPTS="--enable-framework"
export LDFLAGS="-Wl,-rpath,@executable_path/../Frameworks"
export CFLAGS="-I/usr/local/include"

echo "🎯 Targeting minimum macOS version: 10.15 (Catalina)"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "🐍 Python version: $PYTHON_VERSION"

# Check PyInstaller version
if command -v pyinstaller &> /dev/null; then
    PYINSTALLER_VERSION=$(pyinstaller --version)
    echo "📦 PyInstaller version: $PYINSTALLER_VERSION"
    
    # Recommend updating if version is old
    if [[ "$PYINSTALLER_VERSION" < "5.0" ]]; then
        echo "⚠️  Warning: Consider updating PyInstaller to version 5.0+ for better macOS compatibility"
        echo "   Run: pip install --upgrade pyinstaller"
    fi
else
    echo "❌ PyInstaller not found. Installing..."
    pip3 install --upgrade pyinstaller
fi

# Build options
BUILD_TYPE="standard"
if [[ "$1" == "--universal" ]]; then
    BUILD_TYPE="universal"
    echo "🌐 Building universal binary (Intel + Apple Silicon)"
elif [[ "$1" == "--minimal" ]]; then
    BUILD_TYPE="minimal"
    echo "📦 Building minimal binary (smaller size, may have compatibility issues)"
fi

echo ""
echo "🚀 Starting build process..."

# Run the main build script
cd "$(dirname "$0")/.."
python3 build.py

echo ""
echo "✅ Build completed!"

# Post-build macOS-specific instructions
echo ""
echo "📋 macOS Post-Build Instructions:"
echo "=================================="

if [[ "$BUILD_TYPE" == "universal" ]]; then
    echo "🌐 Universal binary created - should work on both Intel and Apple Silicon Macs"
fi

echo ""
echo "🔧 If you encounter 'damaged' errors on newer macOS versions:"
echo "   1. Right-click the app and select 'Open' (bypasses Gatekeeper)"
echo "   2. Or run: xattr -cr /path/to/your/app (removes quarantine attributes)"
echo ""
echo "📱 For distribution to other macOS versions:"
echo "   - Test on target macOS versions before distribution"
echo "   - Consider code signing and notarization for App Store distribution"
echo "   - Use the --universal flag for better cross-platform compatibility"
echo ""
echo "🧪 Testing recommendations:"
echo "   - Test on macOS 12 (Monterey) - your build environment"
echo "   - Test on macOS 13 (Ventura) - common target"
echo "   - Test on macOS 14 (Sonoma) - latest version"
echo ""
echo "🎉 Happy building!"
