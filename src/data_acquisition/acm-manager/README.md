# ACM Manager - AI Conversation Manager

A Chrome extension for capturing, organizing, and managing conversations with AI chatbots like Gemini, ChatGPT, Claude, and others.

## Features

- Automatically captures conversations from supported AI platforms
- Organizes conversations by URL to prevent duplication
- Provides a clean interface for viewing and managing captured conversations
- Supports manual and periodic capture of conversations
- Specialized capture mechanisms for different chatbot platforms
- **NEW**: User authentication with FIDU Core backend
- **NEW**: Secure token-based authentication
- **NEW**: User registration and login system
- **NEW**: Profile management and selection
- **NEW**: Automatic profile assignment to data packets

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked" and select the extension directory
5. The ACM Manager icon should appear in your Chrome toolbar

## Usage

### Basic Usage

1. Navigate to a supported AI chatbot (Gemini, ChatGPT, Claude, etc.)
2. Have a conversation as you normally would
3. The extension will automatically capture the conversation
4. Click on the ACM Manager icon in the toolbar to view captured conversations
5. Use the manual capture button (bottom right of the page) if automatic capture fails

### Authentication (FIDU Core Backend)

To use the FIDU Core backend with authentication:

1. **Configure Identity Service**: Go to the extension options and set the FIDU Identity Service URL:
   - Leave empty to use production: `https://identity.firstdataunion.org` (default)
   - Enter a custom URL for development or testing environments
2. **Enable FIDU Core**: Go to the extension options and check "Use FIDU Core Backend"
3. **Configure Server URL**: Set the FIDU Core server URL (default: `http://127.0.0.1:4000/api/v1`)
4. **Register/Login**: Click the ACM Manager icon and use the authentication section to:
   - Register a new account with email, password, first name, and last name
   - Login with your existing credentials
4. **Select a Profile**: After logging in, you'll see a profile section where you can:
   - Click "Manage" to open the profile management modal
   - Create new profiles with custom names
   - Select an existing profile to use for data packets
5. **Automatic Authentication**: Once logged in and a profile is selected, all API calls to FIDU Core will include your authentication token and profile ID

### Authentication Features

- **Secure Token Storage**: Authentication tokens are stored securely in Chrome's local storage
- **Automatic Token Refresh**: Tokens are validated on each request
- **Session Management**: Logout functionality to clear stored credentials
- **Error Handling**: Clear error messages for authentication failures
- **Auto-login Option**: Configure automatic login on extension startup

### Profile Management Features

- **Profile Creation**: Create multiple profiles with custom names
- **Profile Selection**: Choose which profile to use for data packet submission
- **Profile Management Modal**: Easy-to-use interface for managing profiles
- **Automatic Profile Assignment**: Selected profile ID is automatically included in all data packets
- **Profile Persistence**: Selected profile is remembered across browser sessions

## Configuration

### Extension Options

Access the options page by:
- Right-clicking the extension icon and selecting "Options"
- Or clicking the "Options" link in the popup

#### Capture Settings
- **Automatically capture conversations**: Enable/disable automatic capture
- **Capture Frequency**: Set how often to capture (10-300 seconds)
- **Show capture indicator**: Display visual feedback on the page
- **Highlight captured messages**: Mark captured messages in the UI

#### FIDU Identity Service Settings
- **Identity Service URL**: Enter a custom URL for the FIDU Identity Service
  - Leave empty to use production: `https://identity.firstdataunion.org` (default)
  - Enter a custom URL for development or testing environments
- **Current URL**: Shows the effective URL that will be used (read-only)

#### FIDU Core Settings
- **FIDU Core Server URL**: Configure the backend server address
- **Use FIDU Core Backend**: Enable/disable backend integration
- **Require Authentication**: Force authentication for all backend requests
- **Auto-login on startup**: Automatically authenticate when extension loads

#### Supported Chatbots
- Enable/disable capture for specific platforms:
  - ChatGPT
  - Claude
  - Google Gemini
  - Poe
  - Perplexity

#### Storage Settings
- **Maximum storage size**: Set local storage limit (1-500 MB)
- **Auto-export**: Automatically export when storage limit is reached
- **Data cleanup policy**: Choose how to handle storage overflow

## Development

This extension uses:
- JavaScript for core functionality
- IndexedDB for local storage of conversations
- Chrome Extension Manifest V3
- JWT-based authentication for FIDU Core integration

### Authentication Flow

1. **Registration**: User creates account with email/password
2. **Login**: User authenticates and receives JWT token
3. **Token Storage**: Token stored securely in Chrome storage
4. **API Calls**: All FIDU Core requests include Authorization header
5. **Token Validation**: Automatic validation and error handling
6. **Logout**: Clear stored credentials and invalidate session

### File Structure

```
acm-manager/
├── manifest.json          # Extension configuration
├── js/
│   ├── auth.js           # Authentication service
│   ├── background.js     # Background script
│   ├── content.js        # Content script
│   ├── fidu-config.js    # FIDU configuration utilities
│   ├── fidu-sdk.js       # FIDU SDK integration
│   ├── fidu-auth-init.js # FIDU authentication initialization
│   ├── popup.js          # Popup script
│   └── options.js        # Options script
├── pages/
│   ├── popup.html        # Popup UI
│   ├── options.html      # Options UI
│   └── viewer.html       # ACM viewer
├── css/
│   └── content.css       # Content script styles
└── test_*.html           # Test files for development
```

## Security

- Passwords are never stored locally
- JWT tokens are stored securely in Chrome's local storage
- All API communication uses HTTPS (when available)
- Authentication tokens are validated on each request
- Automatic logout on authentication errors

## Troubleshooting

### Authentication Issues

1. **"Authentication required" error**: Make sure you're logged in via the popup
2. **"Authentication expired" error**: Logout and login again
3. **Server connection errors**: Check the FIDU Core server URL in options
4. **Registration fails**: Ensure all fields are filled and password is at least 6 characters

### Profile Issues

1. **"No profile selected" error**: Click "Manage" in the profile section and select a profile
2. **Profile creation fails**: Ensure the profile name is not empty and try again
3. **Profiles not loading**: Check your internet connection and try refreshing the modal
4. **Profile selection not saving**: Try logging out and back in, then reselect your profile

### General Issues

1. **Extension not capturing**: Check if the current site is supported
2. **Storage errors**: Clear some data or increase storage limit
3. **Performance issues**: Reduce capture frequency in options

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 