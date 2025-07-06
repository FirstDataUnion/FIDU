# Chatbot Conversation Saver Chrome Extension

A Chrome extension that automatically saves HTML content from chatbot conversation pages to IndexedDB for later structured post-processing.

## Features

- **Automatic Detection**: Monitors active tabs and detects whitelisted chatbot domains
- **Periodic Saving**: Saves conversations every 5 minutes (configurable) using Chrome alarms
- **Overwrite Protection**: Updates existing conversations instead of creating duplicates
- **IndexedDB Storage**: Uses IndexedDB for efficient, structured data storage
- **Configurable Whitelist**: Easy management of supported domains through options page
- **Rich Metadata**: Captures URL, model name, timestamps, and full HTML content
- **User Interface**: Options page for management and popup for quick actions

## Supported Platforms

The extension comes pre-configured with support for:
- ChatGPT (chatgpt.com)
- Claude (claude.ai)
- Google Gemini (gemini.google.com)
- Google Bard (bard.google.com)
- Bing Chat (bing.com)
- Perplexity (perplexity.ai)

Additional domains can be added through the options page.

## Installation

### Method 1: Load as Unpacked Extension (Development)

1. **Download/Clone the Extension**
   ```bash
   # Navigate to the extension directory
   cd src/data_acquisition/chrome-extension
   ```

2. **Open Chrome Extensions Page**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chrome-extension` directory
   - The extension should now appear in your extensions list

4. **Grant Permissions**
   - Click on the extension icon to grant necessary permissions
   - The extension will request access to active tabs and storage

### Method 2: Create Icons (Optional)

The extension references icon files that need to be created:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

You can create simple placeholder icons or use any image editor to create appropriate icons.

## Usage

### Basic Operation

1. **Automatic Saving**: Once installed, the extension automatically monitors your browsing
2. **Visit Chatbot Pages**: Navigate to any whitelisted chatbot platform
3. **Conversations Saved**: The extension will automatically save the page content every 5 minutes
4. **Manual Save**: Click the extension icon and use "Save Current Page" for immediate saving

### Managing Settings

1. **Open Options**: Click the extension icon and select "Options" or right-click the extension and choose "Options"
2. **Whitelist Management**: Add or remove domains from the whitelist
3. **View Conversations**: See all saved conversations with metadata
4. **Adjust Settings**: Change the save interval (1-60 minutes)

### Data Management

- **View Saved Data**: Use the options page to see all saved conversations
- **Delete Individual**: Remove specific conversations from the options page
- **Clear All**: Use the "Clear All" button to remove all saved data
- **Export Data**: Access IndexedDB directly through Chrome DevTools for data export

## Technical Details

### Data Structure

Each saved conversation includes:
```javascript
{
  uniqueId: "hash_url_hash_timestamp", // Primary key
  modelName: "chatgpt.com",            // Matched whitelist domain
  date: "2024-01-15",                  // YYYY-MM-DD format
  time: "14:30:25",                    // HH:MM:SS format
  dateTime: "2024-01-15T14:30:25.123Z", // ISO timestamp
  url: "https://chatgpt.com/chat/abc",  // Full URL
  htmlContent: "<!DOCTYPE html>...",    // Complete HTML
  title: "ChatGPT",                    // Page title
  lastSaved: "2024-01-15T14:30:25.123Z" // Last save timestamp
}
```

### IndexedDB Schema

- **Database**: `ChatbotConversationsDB`
- **Object Store**: `conversations`
- **Primary Key**: `uniqueId`
- **Indexes**:
  - `url` (unique) - For finding existing conversations
  - `modelName` - For filtering by chatbot platform
  - `date` - For date-based queries
  - `dateTime` - For chronological sorting

### File Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (main logic)
├── content.js            # Content script for HTML extraction
├── options.html          # Options page UI
├── options.js            # Options page logic
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## Development

### Key Components

1. **Background Service Worker** (`background.js`)
   - Handles URL monitoring and tab updates
   - Manages IndexedDB operations
   - Controls periodic saving via Chrome alarms
   - Processes messages from popup and options pages

2. **Content Script** (`content.js`)
   - Injected into whitelisted pages
   - Extracts HTML content from the DOM
   - Communicates with background script

3. **Options Page** (`options.html` + `options.js`)
   - Manages domain whitelist
   - Displays saved conversations
   - Provides data management tools
   - Shows usage statistics

4. **Popup** (`popup.html` + `popup.js`)
   - Quick access to extension features
   - Shows current page status
   - Manual save functionality

### Debugging

1. **Background Script Logs**: Open `chrome://extensions/`, find the extension, click "service worker" link
2. **Content Script Logs**: Use Chrome DevTools on the target page
3. **Options Page**: Use DevTools on the options page
4. **IndexedDB Inspection**: Use Chrome DevTools → Application → Storage → IndexedDB

### Common Issues

1. **Extension Not Working**: Check if permissions are granted
2. **No Data Saved**: Verify the page URL matches whitelist domains
3. **Permission Errors**: Ensure all required permissions are enabled
4. **IndexedDB Errors**: Check browser storage settings and available space

## Data Export and Post-Processing

### Accessing Saved Data

1. **Through Options Page**: View and manage conversations directly
2. **Via Chrome DevTools**:
   - Open DevTools (F12)
   - Go to Application → Storage → IndexedDB
   - Navigate to `ChatbotConversationsDB` → `conversations`
   - Export data as needed

3. **Programmatic Access**: Use the extension's message API:
   ```javascript
   chrome.runtime.sendMessage({ action: 'getConversations' }, (response) => {
     if (response.success) {
       console.log(response.data); // Array of conversation objects
     }
   });
   ```

### Post-Processing Considerations

- **HTML Parsing**: Use libraries like Cheerio or JSDOM for structured parsing
- **Content Extraction**: Focus on conversation content, ignore UI elements
- **Data Cleaning**: Remove scripts, styles, and unnecessary markup
- **Storage Management**: Monitor IndexedDB size and implement cleanup strategies

## Security and Privacy

- **Local Storage**: All data is stored locally in IndexedDB
- **No External Communication**: The extension doesn't send data to external servers
- **Permission Scope**: Only requests necessary permissions for functionality
- **Data Control**: Users have full control over saved data through the options page

## Contributing

To extend the extension:

1. **Add New Domains**: Update the whitelist in `background.js` or use the options page
2. **Modify Save Logic**: Edit the `saveConversation` method in `background.js`
3. **Enhance UI**: Modify HTML/CSS in options and popup files
4. **Add Features**: Extend the message handling in `background.js`

## License

This extension is provided as-is for educational and research purposes. Users are responsible for complying with the terms of service of the chatbot platforms they use. 