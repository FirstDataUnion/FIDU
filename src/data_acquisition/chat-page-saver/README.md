# Chat Page Saver - Chrome Extension

A Chrome extension that automatically saves chatbot conversation pages to either local IndexedDB storage or a FIDU Core backend for centralized data management.

## Features

- **Automatic Saving**: Periodically saves conversation pages from whitelisted chatbot domains
- **Dual Storage**: Choose between local IndexedDB storage or FIDU Core backend
- **Domain Whitelist**: Configurable list of chatbot domains to monitor
- **Rich Metadata**: Saves HTML content, timestamps, URLs, and conversation titles
- **Easy Management**: Options page for configuration and conversation management
- **FIDU Core Integration**: Seamless integration with FIDU Core for centralized data storage

## Supported Chatbots

- ChatGPT (chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Bard (bard.google.com)
- Bing Chat (bing.com)
- Perplexity (perplexity.ai)

## Installation

1. Clone or download this extension
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your toolbar

## Configuration

### Basic Settings

1. Click the extension icon to open the popup
2. Click "Open Options" to access the full configuration
3. Configure the following settings:
   - **Save Interval**: How often to save conversations (1-60 minutes)
   - **Domain Whitelist**: Add/remove chatbot domains to monitor

### FIDU Core Integration

To use FIDU Core backend instead of local storage:

1. In the options page, go to the "FIDU Core Integration" section
2. Check "Use FIDU Core Backend"
3. Enter your FIDU Core API URL (default: `http://127.0.0.1:4000/api/v1`)
4. Configure authentication settings:
   - **Require Authentication**: Enable if your FIDU Core requires auth
   - **Auto-login**: Enable for automatic authentication on startup
5. Click "Test Connection" to verify connectivity
6. Save your settings

### Authentication Setup

If using FIDU Core with authentication:

1. Ensure you have a valid authentication token stored in the extension
2. Select a profile ID in the FIDU Core interface
3. The extension will automatically use these credentials when saving data

## Data Storage

### Local Storage (IndexedDB)

When FIDU Core is disabled, conversations are stored locally in the browser's IndexedDB:

- **Database Name**: `ChatPageSaverDB`
- **Store Name**: `conversations`
- **Data Structure**: Each conversation includes HTML content, metadata, and timestamps

### FIDU Core Storage

When FIDU Core is enabled, conversations are sent to the FIDU Core backend:

- **Data Packets**: Conversations are stored as data packets with tags
- **Tags**: `["Chat-Page-Saver", "Conversation", {modelName}]`
- **Profile Association**: Data is associated with the selected FIDU Core profile
- **Fallback**: If FIDU Core is unavailable, data falls back to local storage

## Data Structure

Each saved conversation includes:

```javascript
{
  uniqueId: "hash_based_unique_identifier",
  modelName: "ChatGPT|Claude|Gemini|etc",
  date: "YYYY-MM-DD",
  time: "HH:MM:SS",
  dateTime: "ISO_8601_timestamp",
  url: "conversation_url",
  htmlContent: "full_page_html",
  title: "conversation_title",
  lastSaved: "ISO_8601_timestamp"
}
```

## Usage

### Automatic Saving

1. Navigate to a supported chatbot website
2. The extension automatically detects the domain and begins monitoring
3. Conversations are saved periodically based on your configured interval
4. A status indicator shows when saving is active

### Manual Saving

1. Click the extension icon while on a supported page
2. Click "Save Now" to immediately save the current conversation
3. The popup shows the current status and save confirmation

### Managing Saved Data

1. Open the options page
2. View statistics and recent conversations
3. Delete individual conversations or clear all data
4. Export data if needed (FIDU Core integration provides centralized access)

## Troubleshooting

### FIDU Core Connection Issues

- Verify FIDU Core is running and accessible
- Check the API URL in settings
- Ensure authentication is properly configured
- Use the "Test Connection" button to verify connectivity

### Storage Issues

- Check browser storage permissions
- Clear browser data if IndexedDB becomes corrupted
- Verify sufficient disk space for local storage

### Domain Whitelist Issues

- Ensure domains are correctly formatted (e.g., `chatgpt.com`)
- Check that the domain matches the actual website URL
- Add subdomains if needed (e.g., `app.chatgpt.com`)

## Development

### File Structure

```
chat-page-saver/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (main logic)
├── content.js            # Content script (page interaction)
├── popup.html            # Popup interface
├── popup.js              # Popup logic
├── options.html          # Options page interface
├── options.js            # Options page logic
├── icons/                # Extension icons
└── README.md             # This file
```

### Key Classes

- **ChatPageSaver**: Main extension class handling saving logic
- **FiduCoreAPI**: API client for FIDU Core integration
- **OptionsManager**: Options page management
- **PopupManager**: Popup interface management

### Adding New Chatbots

1. Add the domain to the whitelist in `background.js`
2. Update `manifest.json` host permissions
3. Test the domain detection and saving functionality

## License

This extension is part of the FIDU project and follows the same licensing terms.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the FIDU Core documentation
- Open an issue in the project repository 