# FIDU Chat Grabber

> [!WARNING]
> Unsupported!
> 
> The FIDU Chat Grabber is implemented to write to the local FIDU Vault which
> is now deprecated. The code here remains to be integrated into the new
> cloud-based FIDU storage solutions (see Chat Lab for an example), but is not
> supported until that migration happens.


A browser extension that captures and manages conversations from various chatbot platforms.

## Features

- **Multi-Platform Support**: Works with ChatGPT, Claude, Gemini, Poe, and Perplexity
- **Automatic Capture**: Automatically detects and captures conversations as you chat
- **Local Storage**: Stores conversations locally in your browser
- **Export Functionality**: Export conversations as JSON files
- **Search & Filter**: Find specific conversations using search and filters
- **Real-time Status**: See capture status and statistics in real-time

## Installation

1. Clone this repository
2. Open Chrome/Edge and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your browser toolbar

## Usage

### Basic Usage

1. **Install the extension** (see Installation above)
2. **Navigate to a supported chatbot platform**:
   - ChatGPT: https://chat.openai.com
   - Claude: https://claude.ai
   - Gemini: https://gemini.google.com
   - Poe: https://poe.com
   - Perplexity: https://www.perplexity.ai

3. **Start a conversation** - the extension will automatically begin capturing
4. **View captured conversations** by clicking the extension icon and selecting "View Conversations"

### Extension Popup

The extension popup provides:
- **Status**: Shows if you're logged in and which profile is selected
- **Statistics**: Total conversations captured and session count
- **Actions**: View, export, or clear conversations
- **Settings**: Configure API URL and profile selection

### Conversation Viewer

The conversation viewer allows you to:
- **Browse all captured conversations**
- **Search conversations** by content or URL
- **Filter by chatbot platform**
- **View full conversation details** including all messages
- **Export individual conversations**

## Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| ChatGPT | https://chat.openai.com | ✅ Supported |
| Claude | https://claude.ai | ✅ Supported |
| Gemini | https://gemini.google.com | ✅ Supported |
| Poe | https://poe.com | ✅ Supported |
| Perplexity | https://www.perplexity.ai | ✅ Supported |

## Configuration

### FIDU Vault Integration

To integrate with FIDU Vault:

1. **Set API URL**: In the extension popup, go to Settings and set the FIDU Vault API URL
2. **Login**: Use the Login button to authenticate with FIDU Vault
3. **Select Profile**: Choose a profile to associate conversations with
4. **Automatic Sync**: Conversations will be automatically saved to FIDU Vault

### Local Storage

By default, conversations are stored locally in your browser using IndexedDB. This provides:
- **Privacy**: Data stays on your device
- **Offline Access**: View conversations without internet
- **Fast Performance**: No network delays

## File Structure

```
fidu-chat-grabber/
├── manifest.json          # Extension manifest
├── js/
│   ├── background.js      # Background service worker
│   ├── content.js         # Content script for webpage injection
│   ├── popup.js           # Popup script
│   └── viewer.js          # Conversation viewer script
├── pages/
│   ├── popup.html         # Extension popup
│   └── viewer.html        # Conversation viewer
├── images/
│   ├── icon16.png         # Extension icon (16px)
│   ├── icon48.png         # Extension icon (48px)
│   └── icon128.png        # Extension icon (128px)
└── README.md              # This file
```

## Development

### Prerequisites

- Node.js (for building icons)
- Modern browser with extension support

### Building Icons

To generate the extension icons:

```bash
cd images
./generate_icons.sh
```

### Testing

1. Load the extension in developer mode
2. Visit supported chatbot platforms
3. Start conversations and verify capture
4. Test the viewer and export functionality

## Troubleshooting

### Common Issues

**Extension not capturing conversations:**
- Ensure you're on a supported platform
- Check that the extension is enabled
- Look for the status indicator on the page
- Check browser console for errors

**Conversations not appearing in viewer:**
- Refresh the viewer page
- Check if conversations were captured (look for status indicator)
- Verify storage permissions are granted

**Export not working:**
- Ensure you have conversations to export
- Check browser download settings
- Try refreshing the popup

### Debug Mode

To enable debug logging:
1. Open browser developer tools
2. Go to Console tab
3. Look for messages starting with "FIDU Chat Grabber:"

### Platform-Specific Debugging

**POE Integration Issues:**
- Use the purple "Debug Poe" button that appears on POE pages
- Check the comprehensive [POE Troubleshooting Guide](POE_TROUBLESHOOTING.md)
- Use the test utilities in `test-poe-integration.js` for console debugging
- Test with the provided `test-poe.html` page

**Gemini Integration Issues:**
- Use the orange "Debug Gemini" button that appears on Gemini pages
- Check browser console for detailed debug information

**Claude Integration Issues:**
- Use the orange "Debug Claude" button that appears on Claude pages
- Check browser console for detailed debug information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the browser console for error messages
- Open an issue on GitHub with detailed information 