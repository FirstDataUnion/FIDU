# Quick Installation Guide

## Prerequisites

- Google Chrome browser
- Basic knowledge of Chrome extensions

## Step-by-Step Installation

### 1. Prepare the Extension

1. **Navigate to the extension directory:**
   ```bash
   cd src/data_acquisition/chrome-extension
   ```

2. **Create placeholder icons (required):**
   - Create three PNG files in the `icons/` directory:
     - `icon16.png` (16x16 pixels)
     - `icon48.png` (48x48 pixels)
     - `icon128.png` (128x128 pixels)
   
   **Quick method:** Use any square image and resize it to these dimensions, or use the canvas method described in `icons/README.md`

### 2. Load in Chrome

1. **Open Chrome Extensions Page:**
   - Open Chrome
   - Navigate to `chrome://extensions/`
   - OR: Click the three dots menu → More tools → Extensions

2. **Enable Developer Mode:**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension:**
   - Click "Load unpacked" button
   - Select the `chrome-extension` directory
   - Click "Select Folder"

4. **Grant Permissions:**
   - The extension will appear in your extensions list
   - Click on the extension icon in the toolbar
   - Grant any requested permissions

### 3. Verify Installation

1. **Check Extension Status:**
   - The extension should appear in your extensions list
   - The icon should be visible in the Chrome toolbar
   - Status should show "Enabled"

2. **Test Basic Functionality:**
   - Click the extension icon to open the popup
   - Click "Options" to open the options page
   - Verify you can see the whitelist and settings

3. **Test on a Chatbot Page:**
   - Navigate to a whitelisted site (e.g., chatgpt.com)
   - The extension should detect the page
   - Use "Save Current Page" to test manual saving

## Troubleshooting

### Extension Won't Load

- **Check file structure:** Ensure all required files are present
- **Check manifest.json:** Verify it's valid JSON
- **Check icons:** Ensure icon files exist and are the correct size
- **Check console:** Look for error messages in the extensions page

### Permission Errors

- **Grant permissions:** Click the extension icon and grant requested permissions
- **Check site access:** Ensure the extension has access to the sites you want to monitor
- **Reload extension:** Try disabling and re-enabling the extension

### No Data Being Saved

- **Check whitelist:** Verify the domain is in the whitelist
- **Check console:** Look for error messages in the background script
- **Test manually:** Use the "Save Current Page" button to test
- **Check IndexedDB:** Use DevTools to verify data is being stored

### Extension Not Working on Specific Sites

- **Add domain to whitelist:** Use the options page to add new domains
- **Check URL format:** Ensure the URL matches the expected pattern
- **Test manually:** Try manual save to see if the issue is with automatic detection

## Testing the Extension

### Manual Testing

1. **Open the test script:**
   - Open any webpage in Chrome
   - Open DevTools (F12)
   - Copy and paste the contents of `test-extension.js` into the console
   - Press Enter to run the tests

2. **Check results:**
   - Look for test results in the console
   - All tests should pass for full functionality

### Real-World Testing

1. **Visit a chatbot site:**
   - Go to chatgpt.com, claude.ai, or another whitelisted site
   - Start a conversation
   - Wait for automatic saving (every 5 minutes) or use manual save

2. **Check saved data:**
   - Open the extension options page
   - Look for saved conversations in the list
   - Verify metadata is correct

3. **Test data export:**
   - Use Chrome DevTools → Application → Storage → IndexedDB
   - Navigate to `ChatbotConversationsDB` → `conversations`
   - Export data as needed

## Next Steps

After successful installation:

1. **Configure whitelist:** Add any additional domains you want to monitor
2. **Adjust settings:** Change the save interval if needed
3. **Monitor usage:** Check the options page for statistics
4. **Export data:** Use the provided methods to export saved conversations
5. **Post-process:** Use the saved HTML data for your analysis needs

## Support

If you encounter issues:

1. Check the main `README.md` for detailed documentation
2. Review the troubleshooting section above
3. Check Chrome's extension error logs
4. Verify all files are present and correctly formatted 