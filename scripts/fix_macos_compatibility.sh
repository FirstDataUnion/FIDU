#!/bin/bash

# macOS Compatibility Fix Script
# This script fixes common compatibility issues with FIDU Vault on macOS

set -e

echo "🔧 FIDU Vault macOS Compatibility Fix"
echo "======================================"

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS only"
    exit 1
fi

# Get the app path from command line argument or use current directory
if [[ -n "$1" ]]; then
    APP_PATH="$1"
else
    APP_PATH="."
fi

# Check if the path exists
if [[ ! -d "$APP_PATH" ]]; then
    echo "❌ Path does not exist: $APP_PATH"
    echo "Usage: $0 [path_to_fidu_vault_app]"
    echo "Example: $0 /Users/jeremy/Downloads/FIDU_Vault_v0.1.0_macOS_universal/FIDU_Vault"
    exit 1
fi

echo "📱 Fixing app at: $APP_PATH"

# Change to the app directory
cd "$APP_PATH"

# Check if this looks like a FIDU Vault app
if [[ ! -f "FIDU_Vault" ]]; then
    echo "⚠️  Warning: FIDU_Vault executable not found in this directory"
    echo "   Make sure you're pointing to the correct FIDU Vault app directory"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🧹 Step 1: Removing quarantine attributes..."
xattr -cr . 2>/dev/null || echo "   (No quarantine attributes found)"
echo "   ✅ Quarantine attributes removed"

echo ""
echo "🔧 Step 2: Fixing Python framework permissions..."
if [[ -d "Python" ]]; then
    chmod -R 755 Python 2>/dev/null || true
    echo "   ✅ Python framework permissions fixed"
    
    # Fix broken symlinks
    echo "   🔗 Checking for broken symlinks..."
    find Python -type l -exec sh -c 'for link; do [ -e "$link" ] || rm "$link"; done' _ {} + 2>/dev/null || true
    echo "   ✅ Broken symlinks removed"
else
    echo "   ⚠️  Python framework not found"
fi

echo ""
echo "📜 Step 3: Creating launcher script..."
cat > launch_fidu_vault.sh << 'EOF'
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
chmod +x launch_fidu_vault.sh
echo "   ✅ Launcher script created: launch_fidu_vault.sh"

echo ""
echo "✅ Compatibility fixes completed!"
echo ""
echo "📋 How to run FIDU Vault:"
echo "   1. Double-click FIDU_Vault (should work now)"
echo "   2. Or run: ./launch_fidu_vault.sh"
echo "   3. Or right-click FIDU_Vault and select 'Open'"
echo ""
echo "🔍 If you still have issues:"
echo "   - Make sure you're running macOS 11.0 (Big Sur) or later"
echo "   - Try running: xattr -cr ."
echo "   - Check that the app has execute permissions: ls -la FIDU_Vault"
echo ""
echo "🎯 For future builds, use: ./scripts/build_macos.sh"
