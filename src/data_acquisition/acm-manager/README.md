# ACM Manager - AI Conversation Manager

A Chrome extension for capturing, organizing, and managing conversations with AI chatbots like Gemini, ChatGPT, Claude, and others.

## Features

- Automatically captures conversations from supported AI platforms
- Organizes conversations by URL to prevent duplication
- Provides a clean interface for viewing and managing captured conversations
- Supports manual and periodic capture of conversations
- Specialized capture mechanisms for different chatbot platforms

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked" and select the extension directory
5. The ACM Manager icon should appear in your Chrome toolbar

## Usage

1. Navigate to a supported AI chatbot (Gemini, ChatGPT, Claude, etc.)
2. Have a conversation as you normally would
3. The extension will automatically capture the conversation
4. Click on the ACM Manager icon in the toolbar to view captured conversations
5. Use the manual capture button (bottom right of the page) if automatic capture fails

## Development

This extension uses:
- JavaScript for core functionality
- IndexedDB for local storage of conversations
- Chrome Extension Manifest V3

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 