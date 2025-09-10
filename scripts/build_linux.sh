#!/bin/bash

# Linux-specific build script for FIDU Vault
# This script provides better compatibility across different Linux distributions
# and supports cross-compilation for different architectures

set -e

echo "🐧 FIDU Vault Linux Build Script"
echo "================================="

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ This script is designed for Linux only"
    exit 1
fi

# Get Linux distribution and architecture information
if command -v lsb_release &> /dev/null; then
    DISTRO=$(lsb_release -si)
    DISTRO_VERSION=$(lsb_release -sr)
else
    # Fallback for systems without lsb_release
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        DISTRO="$NAME"
        DISTRO_VERSION="$VERSION_ID"
    else
        DISTRO="Unknown"
        DISTRO_VERSION="Unknown"
    fi
fi

CURRENT_ARCH=$(uname -m)
echo "🐧 Building on $DISTRO $DISTRO_VERSION ($CURRENT_ARCH)"

# Set environment variables for better compatibility
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export PYTHONUNBUFFERED=1

echo "🎯 Targeting Linux compatibility"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "🐍 Python version: $PYTHON_VERSION"

# Check PyInstaller version
if command -v pyinstaller &> /dev/null; then
    PYINSTALLER_VERSION=$(pyinstaller --version)
    echo "📦 PyInstaller version: $PYINSTALLER_VERSION"
    
    # Recommend updating if version is old
    if [[ "$PYINSTALLER_VERSION" < "5.0" ]]; then
        echo "⚠️  Warning: Consider updating PyInstaller to version 5.0+ for better Linux compatibility"
        echo "   Run: pip install --upgrade pyinstaller"
    fi
else
    echo "❌ PyInstaller not found. Installing..."
    pip3 install --upgrade pyinstaller
fi

# Build options
BUILD_TYPE="standard"
TARGET_ARCH=""
BUILD_UNIVERSAL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --universal)
            BUILD_TYPE="universal"
            BUILD_UNIVERSAL=true
            echo "🌐 Building universal binary (multiple architectures)"
            shift
            ;;
        --x86_64)
            BUILD_TYPE="x86_64"
            TARGET_ARCH="x86_64"
            echo "💻 Building for x86_64 architecture"
            shift
            ;;
        --arm64)
            BUILD_TYPE="arm64"
            TARGET_ARCH="aarch64"
            echo "🖥️  Building for ARM64 architecture"
            shift
            ;;
        --armv7)
            BUILD_TYPE="armv7"
            TARGET_ARCH="armv7l"
            echo "📱 Building for ARMv7 architecture"
            shift
            ;;
        --minimal)
            BUILD_TYPE="minimal"
            echo "📦 Building minimal binary (smaller size, may have compatibility issues)"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --universal    Build universal binary (multiple architectures)"
            echo "  --x86_64       Build specifically for x86_64"
            echo "  --arm64        Build specifically for ARM64 (aarch64)"
            echo "  --armv7        Build specifically for ARMv7"
            echo "  --minimal      Build minimal binary (smaller size)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Build for current architecture"
            echo "  $0 --universal        # Build universal binary"
            echo "  $0 --x86_64           # Build for x86_64 systems"
            echo "  $0 --arm64            # Build for ARM64 systems"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set environment variables for cross-compilation
if [[ "$TARGET_ARCH" == "aarch64" ]]; then
    echo "🔧 Setting up ARM64 cross-compilation environment..."
    export TARGET_ARCH="aarch64"
    export BUILD_UNIVERSAL="false"
    
    # Check if we have the necessary tools for ARM64 cross-compilation
    if ! command -v aarch64-linux-gnu-gcc &> /dev/null; then
        echo "❌ ARM64 cross-compilation tools not found."
        echo "Install with: sudo apt install gcc-aarch64-linux-gnu"
        echo "Or use --universal for better compatibility"
        exit 1
    fi
    
    echo "✅ ARM64 cross-compilation environment ready"
    
elif [[ "$TARGET_ARCH" == "armv7l" ]]; then
    echo "🔧 Setting up ARMv7 cross-compilation environment..."
    export TARGET_ARCH="armv7l"
    export BUILD_UNIVERSAL="false"
    
    # Check if we have the necessary tools for ARMv7 cross-compilation
    if ! command -v gcc-arm-linux-gnueabihf &> /dev/null; then
        echo "❌ ARMv7 cross-compilation tools not found."
        echo "Install with: sudo apt install gcc-arm-linux-gnueabihf"
        echo "Or use --universal for better compatibility"
        exit 1
    fi
    
    echo "✅ ARMv7 cross-compilation environment ready"
    
elif [[ "$BUILD_UNIVERSAL" == true ]]; then
    echo "🔧 Setting up universal binary build environment..."
    export BUILD_UNIVERSAL="true"
    export TARGET_ARCH=""
    
    echo "🌐 Will create binary that works on multiple architectures"
    
else
    echo "🔧 Building for current architecture: $CURRENT_ARCH"
    export TARGET_ARCH=""
    export BUILD_UNIVERSAL="false"
fi

echo ""
echo "🚀 Starting build process..."

# Run the main build script
cd "$(dirname "$0")/.."
python3 build.py

echo ""
echo "✅ Build completed!"

# Post-build Linux-specific instructions
echo ""
echo "📋 Linux Post-Build Instructions:"
echo "================================="

if [[ "$BUILD_TYPE" == "universal" ]]; then
    echo "🌐 Universal binary created - should work on multiple architectures"
    echo "   - x86_64 systems: Will run natively"
    echo "   - ARM64 systems: Will run natively"
    echo "   - ARMv7 systems: Will run natively"
elif [[ "$TARGET_ARCH" == "aarch64" ]]; then
    echo "🖥️  ARM64 binary created - optimized for ARM64 systems"
    echo "   - Will run natively on ARM64 systems"
    echo "   - May not run on x86_64 systems"
elif [[ "$TARGET_ARCH" == "armv7l" ]]; then
    echo "📱 ARMv7 binary created - optimized for ARMv7 systems"
    echo "   - Will run natively on ARMv7 systems"
    echo "   - May not run on other architectures"
elif [[ "$TARGET_ARCH" == "x86_64" ]]; then
    echo "💻 x86_64 binary created - optimized for x86_64 systems"
    echo "   - Will run natively on x86_64 systems"
    echo "   - May not run on ARM systems"
fi

echo ""
echo "🔧 Make sure the executable has proper permissions:"
echo "   chmod +x dist/FIDU_Vault_*/FIDU_Vault"
echo ""
echo "📦 For distribution:"
echo "   - Test on target Linux distributions before distribution"
echo "   - Consider creating distribution packages (deb, rpm, AppImage, etc.)"
echo "   - Package dependencies appropriately"
echo ""
echo "🧪 Testing recommendations:"
echo "   - Test on Ubuntu 20.04+ (common target)"
echo "   - Test on Debian 11+ (common target)"
echo "   - Test on CentOS/RHEL 8+ (enterprise target)"
echo "   - Test on Arch Linux (rolling release)"
echo "   - If building for ARM, test on actual ARM hardware when possible"
echo ""
echo "🎯 Architecture-specific notes:"
if [[ "$TARGET_ARCH" == "aarch64" ]]; then
    echo "   - ARM64 builds may be larger due to additional optimizations"
    echo "   - Performance will be best on ARM64 systems"
    echo "   - Consider also building universal binary for distribution"
elif [[ "$TARGET_ARCH" == "armv7l" ]]; then
    echo "   - ARMv7 builds are optimized for older ARM systems"
    echo "   - Good for Raspberry Pi and similar devices"
    echo "   - Consider also building universal binary for distribution"
elif [[ "$BUILD_UNIVERSAL" == true ]]; then
    echo "   - Universal binaries are larger but provide best compatibility"
    echo "   - Recommended for distribution to mixed user bases"
fi
echo ""
echo "🐧 Happy building!"
