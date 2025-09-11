#!/bin/bash

# macOS-specific build script for FIDU Vault
# This script provides better compatibility across different macOS versions
# and supports cross-compilation for ARM64 (Apple Silicon) from x86_64 systems

set -e

echo "🐍 FIDU Vault macOS Build Script"
echo "=================================="

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS only"
    exit 1
fi

# Get macOS version and architecture
MACOS_VERSION=$(sw_vers -productVersion)
CURRENT_ARCH=$(uname -m)
echo "📱 Building on macOS $MACOS_VERSION ($CURRENT_ARCH)"

# Set environment variables for better compatibility
export MACOSX_DEPLOYMENT_TARGET="11.0"  # Target Big Sur as minimum for Python 3.13
export PYTHON_CONFIGURE_OPTS="--enable-framework"
export LDFLAGS="-Wl,-rpath,@executable_path/../Frameworks"
export CFLAGS="-I/usr/local/include"

# Additional environment variables for Python 3.13+ compatibility
export PYTHON_CONFIGURE_OPTS="--enable-framework --with-openssl=/opt/homebrew/opt/openssl"
export CPPFLAGS="-I/opt/homebrew/include"
export LDFLAGS="-L/opt/homebrew/lib -Wl,-rpath,@executable_path/../Frameworks"

echo "🎯 Targeting minimum macOS version: 11.0 (Big Sur) - Required for Python 3.13+"

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
TARGET_ARCH=""
BUILD_UNIVERSAL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --universal)
            BUILD_TYPE="universal"
            BUILD_UNIVERSAL=true
            echo "🌐 Building universal binary (Intel + Apple Silicon)"
            shift
            ;;
        --arm64)
            BUILD_TYPE="arm64"
            TARGET_ARCH="arm64"
            echo "🍎 Building for ARM64 (Apple Silicon) architecture"
            shift
            ;;
        --x86_64)
            BUILD_TYPE="x86_64"
            TARGET_ARCH="x86_64"
            echo "💻 Building for x86_64 (Intel) architecture"
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
            echo "  --universal    Build universal binary (Intel + Apple Silicon)"
            echo "  --arm64        Build specifically for ARM64 (Apple Silicon)"
            echo "  --x86_64       Build specifically for x86_64 (Intel)"
            echo "  --minimal      Build minimal binary (smaller size)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Build for current architecture"
            echo "  $0 --universal        # Build universal binary"
            echo "  $0 --arm64            # Build for Apple Silicon from Intel Mac"
            echo "  $0 --x86_64           # Build for Intel Macs"
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
if [[ "$TARGET_ARCH" == "arm64" ]]; then
    echo "🔧 Setting up ARM64 cross-compilation environment..."
    export TARGET_ARCH="arm64"
    export BUILD_UNIVERSAL="false"
    
    # Check if we have the necessary tools for ARM64 cross-compilation
    if ! command -v clang &> /dev/null; then
        echo "❌ clang not found. Installing Xcode Command Line Tools..."
        xcode-select --install
        echo "Please complete the Xcode installation and run this script again."
        exit 1
    fi
    
    # Verify we can target ARM64
    if ! clang -target arm64-apple-macos11.0 -E - < /dev/null &> /dev/null; then
        echo "❌ ARM64 cross-compilation not supported. Please update Xcode Command Line Tools."
        exit 1
    fi
    
    echo "✅ ARM64 cross-compilation environment ready"
    
elif [[ "$BUILD_UNIVERSAL" == true ]]; then
    echo "🔧 Setting up universal binary build environment..."
    export BUILD_UNIVERSAL="true"
    export TARGET_ARCH=""
    
    # For universal builds, we need to ensure we can build for both architectures
    if [[ "$CURRENT_ARCH" == "x86_64" ]]; then
        echo "💻 Building from Intel Mac - will create universal binary"
    else
        echo "🍎 Building from Apple Silicon Mac - will create universal binary"
    fi
    
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

# Post-build processing for better compatibility
echo ""
echo "🔧 Post-processing for macOS compatibility..."

# Find the built app
APP_PATH=""
if [[ -d "dist/FIDU_Vault" ]]; then
    APP_PATH="dist/FIDU_Vault"
elif [[ -d "build/FIDU_Vault" ]]; then
    APP_PATH="build/FIDU_Vault"
else
    echo "⚠️  Could not find built app directory"
fi

if [[ -n "$APP_PATH" ]]; then
    echo "📱 Processing app at: $APP_PATH"
    
    # Remove quarantine attributes to prevent "damaged" errors
    echo "🧹 Removing quarantine attributes..."
    xattr -cr "$APP_PATH" 2>/dev/null || echo "   (No quarantine attributes found)"
    
    # Set proper permissions on the Python framework
    PYTHON_FRAMEWORK="$APP_PATH/Python"
    if [[ -d "$PYTHON_FRAMEWORK" ]]; then
        echo "🔧 Fixing Python framework permissions..."
        chmod -R 755 "$PYTHON_FRAMEWORK" 2>/dev/null || true
        
        # Fix any broken symlinks in the Python framework
        find "$PYTHON_FRAMEWORK" -type l -exec sh -c 'for link; do [ -e "$link" ] || rm "$link"; done' _ {} + 2>/dev/null || true
    fi
    
    # Create a simple launcher script for better compatibility
    LAUNCHER_SCRIPT="$APP_PATH/launch_fidu_vault.sh"
    cat > "$LAUNCHER_SCRIPT" << 'EOF'
#!/bin/bash
# FIDU Vault Launcher Script
# This script helps bypass macOS security restrictions

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the app directory
cd "$SCRIPT_DIR"

# Remove quarantine attributes if they exist
xattr -cr . 2>/dev/null || true

# Launch the main executable
exec ./FIDU_Vault "$@"
EOF
    chmod +x "$LAUNCHER_SCRIPT"
    echo "📜 Created launcher script: launch_fidu_vault.sh"
    
    echo "✅ Post-processing completed!"
else
    echo "⚠️  Skipping post-processing - app directory not found"
fi

# Post-build macOS-specific instructions
echo ""
echo "📋 macOS Post-Build Instructions:"
echo "=================================="

if [[ "$BUILD_TYPE" == "universal" ]]; then
    echo "🌐 Universal binary created - should work on both Intel and Apple Silicon Macs"
    echo "   - Intel Macs: Will run natively"
    echo "   - Apple Silicon Macs: Will run natively via Rosetta 2"
elif [[ "$TARGET_ARCH" == "arm64" ]]; then
    echo "🍎 ARM64 binary created - optimized for Apple Silicon Macs"
    echo "   - Will run natively on Apple Silicon Macs"
    echo "   - May run slower on Intel Macs via Rosetta 2"
elif [[ "$TARGET_ARCH" == "x86_64" ]]; then
    echo "💻 x86_64 binary created - optimized for Intel Macs"
    echo "   - Will run natively on Intel Macs"
    echo "   - Will run via Rosetta 2 on Apple Silicon Macs"
fi

echo ""
echo "🔧 If you encounter 'damaged' errors on newer macOS versions:"
echo "   1. 🚀 RECOMMENDED: Run ./launch_fidu_vault.sh (automatically fixes issues)"
echo "   2. Right-click the app and select 'Open' (bypasses Gatekeeper)"
echo "   3. Or run: xattr -cr /path/to/your/app (removes quarantine attributes)"
echo "   4. See MACOS_TROUBLESHOOTING.md for detailed troubleshooting"
echo ""
echo "📱 For distribution to other macOS versions:"
echo "   - Test on target macOS versions before distribution"
echo "   - Consider code signing and notarization for App Store distribution"
echo "   - Universal binaries provide the best cross-platform compatibility"
echo ""
echo "🧪 Testing recommendations:"
echo "   - Test on macOS 12 (Monterey) - your build environment"
echo "   - Test on macOS 13 (Ventura) - common target"
echo "   - Test on macOS 14 (Sonoma) - latest version"
echo "   - If building for ARM64, test on Apple Silicon Macs when possible"
echo ""
echo "🎯 Architecture-specific notes:"
if [[ "$TARGET_ARCH" == "arm64" ]]; then
    echo "   - ARM64 builds may be larger due to additional optimizations"
    echo "   - Performance will be best on Apple Silicon Macs"
    echo "   - Consider also building universal binary for distribution"
elif [[ "$BUILD_UNIVERSAL" == true ]]; then
    echo "   - Universal binaries are larger but provide best compatibility"
    echo "   - Recommended for distribution to mixed user bases"
fi
echo ""
echo "�� Happy building!"
