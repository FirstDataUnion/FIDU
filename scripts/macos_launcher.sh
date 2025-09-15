#!/bin/bash

# FIDU Vault macOS Launcher Script
# This script helps bypass macOS security restrictions and compatibility issues
# Automatically included in macOS builds

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the app directory
cd "$SCRIPT_DIR"

echo "🚀 FIDU Vault macOS Launcher"
echo "============================="

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This launcher is designed for macOS only"
    echo "   Please run FIDU_Vault directly on other platforms"
    exit 1
fi

# Check if FIDU_Vault executable exists
if [[ ! -f "FIDU_Vault" ]]; then
    echo "❌ FIDU_Vault executable not found in this directory"
    echo "   Current directory: $SCRIPT_DIR"
    echo "   Please make sure you're running this script from the FIDU Vault app directory"
    exit 1
fi

echo "📱 Running FIDU Vault on macOS..."
echo "   Directory: $SCRIPT_DIR"

# Remove quarantine attributes to prevent "damaged" errors
echo "🧹 Removing quarantine attributes..."
xattr -cr . 2>/dev/null || echo "   (No quarantine attributes found)"

# Fix Python framework permissions if it exists
if [[ -d "_internal/Python.framework" ]]; then
    echo "🔧 Fixing Python framework permissions..."
    chmod -R 755 _internal/Python.framework 2>/dev/null || true
    
    # Fix any broken symlinks in the Python framework
    find _internal/Python.framework -type l -exec sh -c 'for link; do [ -e "$link" ] || rm "$link"; done' _ {} + 2>/dev/null || true
    echo "   ✅ Python framework permissions fixed"
fi

# Check macOS version compatibility
MACOS_VERSION=$(sw_vers -productVersion)
echo "📋 macOS version: $MACOS_VERSION"

# Check if macOS version is compatible (Python 3.8+ requires macOS 10.15+)
MAJOR_VERSION=$(echo "$MACOS_VERSION" | cut -d. -f1)
MINOR_VERSION=$(echo "$MACOS_VERSION" | cut -d. -f2)

if [[ $MAJOR_VERSION -lt 10 ]] || [[ $MAJOR_VERSION -eq 10 && $MINOR_VERSION -lt 15 ]]; then
    echo "⚠️  Warning: macOS $MACOS_VERSION detected"
    echo "   FIDU Vault requires macOS 10.15 (Catalina) or later for Python 3.8+ compatibility"
    echo "   You may experience compatibility issues"
    echo ""
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Exiting..."
        exit 1
    fi
fi

echo ""
echo "🎯 Launching FIDU Vault..."
echo "   If you encounter any issues, see MACOS_QUICK_FIX.md for troubleshooting"
echo ""

# Launch the main executable
exec ./FIDU_Vault "$@"
