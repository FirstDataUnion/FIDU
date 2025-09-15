# macOS Quick Fix Guide

## App can't be verified/untrusted

If you get an error complaining the app can't be trusted or scanned for malware, you will have to go to your Privacy & Security settings page and find the button to "Run FIDU Anyway". This is a short term fix until we are able to sign our apps. See the Installation page of the README on our GitHub for more details + screenshots. 

## If FIDU Vault Shows "Damaged" or Won't Launch

There have been reports of newer versions of MacOS complaining about the FIDU app. 

We have a longer term fix in the pipeline, but for now, you can try the following if you are encountering this issue:

### 🚀 **RECOMMENDED: Use the Launcher Script**
```bash
# Navigate to your FIDU Vault folder
cd /path/to/your/FIDU_Vault

# Run the launcher script (automatically handles compatibility issues)
./launch_fidu_vault.sh
```

The launcher script automatically:
- ✅ Removes quarantine attributes
- ✅ Fixes Python framework permissions  
- ✅ Checks macOS version compatibility
- ✅ Provides helpful error messages

### Manual Fix: Remove Quarantine attributes
```bash
# Navigate to your FIDU Vault folder
cd /path/to/your/FIDU_Vault

# Remove quarantine attributes
xattr -cr .

# Try running again
./FIDU_Vault
```

### Alternative Methods

#### Method 1: Right-click and Open
1. Right-click on `FIDU_Vault` 
2. Select "Open" from the context menu
3. Click "Open" in the security dialog

#### Method 2: Manual Steps
```bash
# 1. Remove quarantine attributes
xattr -cr /path/to/your/FIDU_Vault

# 2. Fix permissions
chmod -R 755 /path/to/your/FIDU_Vault/Python

# 3. Create launcher script
cat > /path/to/your/FIDU_Vault/launch_fidu_vault.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
xattr -cr . 2>/dev/null || true
exec ./FIDU_Vault "$@"
EOF
chmod +x /path/to/your/FIDU_Vault/launch_fidu_vault.sh

# 4. Run using launcher
./launch_fidu_vault.sh
```

## System Requirements

- **macOS 11.0 (Big Sur)** or later
- **Python 3.8+** builds require Catalina minimum

## Still Having Issues?

1. **Check macOS version**: `sw_vers -productVersion`
2. **Check app permissions**: `ls -la FIDU_Vault`
3. **Check quarantine status**: `xattr -l FIDU_Vault`
4. **Try disabling Gatekeeper temporarily**:
   ```bash
   sudo spctl --master-disable
   # Run your app
   sudo spctl --master-enable
   ```
