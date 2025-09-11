# macOS Compatibility Guide for FIDU Vault

This guide addresses common macOS compatibility issues when building and distributing Python applications with PyInstaller.

## Common Issues

### 1. "Python.framework is damaged and should be moved to the Trash"

**Symptoms:**
- App fails to launch on newer macOS versions
- Error message about damaged Python.framework
- App appears to be corrupted
- Error: `code signature in <UUID> not valid for use in process: library load disallowed by system policy`

**Causes:**
- **macOS Version Mismatch**: Building on older macOS (12.x) for newer macOS (13.x, 14.x)
- **Code Signing Issues**: Missing or invalid code signatures
- **Gatekeeper Restrictions**: macOS security blocking unsigned apps
- **Architecture Mismatch**: Intel vs Apple Silicon compatibility issues
- **Python 3.13+ Compatibility**: Newer Python versions have stricter security requirements
- **Quarantine Attributes**: macOS marks downloaded files as potentially unsafe

**Solutions:**

#### Immediate Fixes:
```bash
# Remove quarantine attributes (bypasses Gatekeeper)
xattr -cr /path/to/your/app

# Alternative: Right-click app → Open (bypasses Gatekeeper)
# Or use the launcher script if available:
./launch_fidu_vault.sh
```

#### Python 3.13+ Specific Fixes:
```bash
# For Python 3.13+ builds, ensure minimum macOS target
export MACOSX_DEPLOYMENT_TARGET="11.0"  # Big Sur minimum

# Remove all quarantine attributes recursively
xattr -cr /path/to/your/app

# Fix Python framework permissions
chmod -R 755 /path/to/your/app/Python
```

#### Build-Time Fixes:
```bash
# Use the macOS-optimized build script
./scripts/build_macos.sh

# For universal compatibility (Intel + Apple Silicon)
./scripts/build_macos.sh --universal
```

### 2. App Won't Launch on Different macOS Versions

**Symptoms:**
- App works on build machine but fails on target machines
- Different error messages on different macOS versions
- App crashes immediately on launch

**Solutions:**

#### Set Minimum macOS Target:
```bash
export MACOSX_DEPLOYMENT_TARGET="11.0"  # Big Sur minimum for Python 3.13+
```

#### Use Universal Binary:
```bash
# Build for both Intel and Apple Silicon
./scripts/build_macos.sh --universal
```

#### Test Across Versions:
- **macOS 12 (Monterey)**: Your build environment
- **macOS 13 (Ventura)**: Common target version
- **macOS 14 (Sonoma)**: Latest version

### 3. PyInstaller Compatibility Issues

**Symptoms:**
- Build failures
- Runtime errors
- Missing dependencies

**Solutions:**

#### Update PyInstaller:
```bash
pip install --upgrade pyinstaller
```

#### Use Compatible Python Version:
- **Python 3.8+**: Recommended for modern macOS
- **Python 3.9+**: Best for macOS 12+ compatibility
- **Python 3.10+**: Optimal for macOS 13+ compatibility
- **Python 3.13+**: Requires macOS 11.0+ (Big Sur), has stricter security requirements

## Build Configuration

### Environment Variables
```bash
# Set in your shell or build script
export MACOSX_DEPLOYMENT_TARGET="11.0"  # Big Sur minimum for Python 3.13+
export PYTHON_CONFIGURE_OPTS="--enable-framework"
export LDFLAGS="-Wl,-rpath,@executable_path/../Frameworks"
export CFLAGS="-I/usr/local/include"

# For Python 3.13+ compatibility
export PYTHON_CONFIGURE_OPTS="--enable-framework --with-openssl=/opt/homebrew/opt/openssl"
export CPPFLAGS="-I/opt/homebrew/include"
export LDFLAGS="-L/opt/homebrew/lib -Wl,-rpath,@executable_path/../Frameworks"
```

### PyInstaller Spec File
The updated `main.spec` includes:
- macOS-specific hidden imports
- Post-processing hooks for framework compatibility
- Exclusion of problematic modules

### Build Scripts
- **Standard Build**: `python3 build.py`
- **macOS Optimized**: `./scripts/build_macos.sh`
- **Universal Binary**: `./scripts/build_macos.sh --universal`

## Distribution Best Practices

### 1. Code Signing
```bash
# Sign your app (requires Apple Developer account)
codesign --force --deep --sign "Developer ID Application: Your Name" /path/to/your/app
```

### 2. Notarization
```bash
# Notarize for App Store distribution
xcrun altool --notarize-app --primary-bundle-id "com.yourcompany.fiduvault" \
  --username "your@email.com" --password "@env:APP_SPECIFIC_PASSWORD" \
  --file /path/to/your/app.zip
```

### 3. Testing Checklist
- [ ] Test on build machine (macOS 12)
- [ ] Test on macOS 13 (Ventura)
- [ ] Test on macOS 14 (Sonoma)
- [ ] Test on both Intel and Apple Silicon Macs
- [ ] Test with Gatekeeper enabled
- [ ] Test with different user accounts

## Troubleshooting Commands

### Check App Structure
```bash
# Examine the built app
ls -la dist/your_app/
otool -L dist/your_app/your_app  # Check linked libraries
```

### Check macOS Version Compatibility
```bash
# Check what macOS version the app targets
otool -l dist/your_app/your_app | grep -A 4 "LC_BUILD_VERSION"
```

### Remove Quarantine Attributes
```bash
# Remove all quarantine attributes
xattr -cr /path/to/your/app

# Check what attributes exist
xattr -l /path/to/your/app
```

### Verify Code Signing
```bash
# Check if app is code signed
codesign -dv /path/to/your/app

# Verify code signature
codesign --verify /path/to/your/app
```

## Python 3.13+ Specific Issues

### Code Signature Errors
**Error:** `code signature in <UUID> not valid for use in process: library load disallowed by system policy`

**Solutions:**
```bash
# 1. Remove quarantine attributes
xattr -cr /path/to/your/app

# 2. Fix Python framework permissions
chmod -R 755 /path/to/your/app/Python

# 3. Use the launcher script (if available)
./launch_fidu_vault.sh

# 4. Right-click and "Open" instead of double-clicking
```

### Minimum macOS Version Requirements
- **Python 3.13+**: Requires macOS 11.0 (Big Sur) or later
- **Build Target**: Set `MACOSX_DEPLOYMENT_TARGET="11.0"`
- **Testing**: Test on macOS 11.0+ systems

### Build Environment Setup
```bash
# Ensure you have the latest Xcode Command Line Tools
xcode-select --install

# Update PyInstaller for Python 3.13 compatibility
pip install --upgrade pyinstaller

# Use the updated build script
./scripts/build_macos.sh
```

## Common Workarounds

### 1. Gatekeeper Issues
```bash
# Temporary: Disable Gatekeeper (not recommended for production)
sudo spctl --master-disable

# Re-enable Gatekeeper
sudo spctl --master-enable
```

### 2. Architecture Issues
```bash
# Check if app is universal
file /path/to/your/app

# Should show: "Mach-O universal binary with 2 architectures"
```

### 3. Framework Issues
```bash
# Check Python framework permissions
ls -la /path/to/your/app/Contents/Frameworks/Python.framework/

# Fix permissions if needed
chmod -R 755 /path/to/your/app/Contents/Frameworks/Python.framework/
```

## Prevention Strategies

### 1. Build Environment
- Use consistent macOS version for builds
- Keep PyInstaller updated
- Use Python 3.8+ for better compatibility

### 2. Testing Strategy
- Test on multiple macOS versions
- Test on both Intel and Apple Silicon
- Use virtual machines for testing

### 3. Distribution
- Consider code signing and notarization
- Provide clear installation instructions
- Include troubleshooting steps in documentation

## Getting Help

If you continue to experience issues:

1. **Check PyInstaller Issues**: [GitHub Issues](https://github.com/pyinstaller/pyinstaller/issues)
2. **macOS Developer Forums**: [Apple Developer Forums](https://developer.apple.com/forums/)
3. **Python Packaging**: [Python Packaging User Guide](https://packaging.python.org/)

## Quick Fix Summary

For immediate compatibility issues:
```bash
# 1. Use the optimized build script
./scripts/build_macos.sh

# 2. If app still shows as "damaged"
xattr -cr /path/to/your/app

# 3. For distribution, test on target macOS versions
# 4. Consider code signing for production use
```
