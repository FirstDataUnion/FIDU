# Conversation Management Features

## Overview
The Prompt Lab now includes enhanced conversation management capabilities that allow users to maintain multiple active conversations simultaneously.

## Key Features

### 1. Multiple Conversation Windows
- **Multiple Active Conversations**: Users can now have multiple conversations open at the same time
- **Tab Management**: Conversations are managed as tabs that can be minimized or expanded
- **Persistent State**: Conversations remain open until explicitly closed or the browser is refreshed

### 2. Minimized Conversation Tabs
- **Right-Side Tabs**: Minimized conversations appear as small tabs on the right side of the screen
- **Visual Indicators**: Each tab shows the model being used and has an unread message counter
- **Hover Actions**: Hover over tabs to reveal minimize and close buttons
- **Rich Tooltips**: Detailed information including conversation title, model, and last message preview

### 3. Auto-Scrolling
- **New Message Auto-Scroll**: Automatically scrolls to the bottom when new messages arrive
- **Follow-up Auto-Scroll**: Scrolls to bottom when sending follow-up messages
- **Smooth Animation**: Uses smooth scrolling for better user experience
- **Message Animation**: New messages fade in with a subtle upward animation

### 4. Keyboard Shortcuts
- **Ctrl+W (or Cmd+W)**: Close the active conversation
- **Ctrl+M (or Cmd+M)**: Minimize the active conversation
- **Enter**: Send message (Shift+Enter for new line)

### 5. Enhanced UI Elements
- **Conversation Counter**: Header shows the number of open conversations
- **Model Indicators**: Clear display of which AI model is being used
- **Status Badges**: Visual indicators for conversation status and unread messages
- **Responsive Design**: Works on both desktop and mobile devices

## Usage

### Opening a New Conversation
1. Enter your prompt in the Prompt Lab
2. Select a model and context (optional)
3. Click "Execute" to start a new conversation
4. The conversation window will open on the right side

### Managing Multiple Conversations
1. **Minimize**: Click the minimize button (⊖), use Ctrl+M, or click outside the window
2. **Restore**: Click on a minimized tab to restore it
3. **Close**: Click the close button (×) or use Ctrl+W
4. **Switch**: Click between different conversation tabs

### Sending Follow-up Messages
1. Type your message in the input field at the bottom
2. Press Enter to send (or click the send button)
3. The conversation will automatically scroll to show new messages
4. Multiple conversations can receive messages simultaneously

## Technical Implementation

### Components
- **ConversationManager**: Manages multiple conversation tabs and their state
- **ConversationWindow**: Enhanced conversation display with auto-scrolling
- **PromptLabPage**: Updated to use the new conversation management system

### State Management
- **Conversation Tabs**: Array of conversation objects with minimized/active states
- **Message Handling**: Real-time updates with proper state synchronization
- **Auto-scrolling**: Uses refs and useEffect for smooth scrolling behavior
- **Smart Minimization**: Clicking outside conversation windows minimizes them instead of closing

### Performance Features
- **Lazy Rendering**: Only renders active conversations
- **Efficient Updates**: Minimal re-renders when updating conversation state
- **Memory Management**: Conversations are cleaned up when closed

## Browser Compatibility
- **Modern Browsers**: Full support for all features
- **Mobile Devices**: Responsive design with touch-friendly controls
- **Keyboard Navigation**: Full keyboard shortcut support
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Future Enhancements
- **Conversation Persistence**: Save conversations across browser sessions
- **Advanced Search**: Search within conversations and across multiple chats
- **Export Features**: Export conversations in various formats
- **Collaboration**: Share conversations with other users
- **Custom Themes**: Personalized conversation appearance
