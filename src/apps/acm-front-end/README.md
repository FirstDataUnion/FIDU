# ACM Manager Frontend

A React TypeScript frontend for managing AI Conversation Memories (ACM) that interfaces with the existing IndexedDB database from the ACM browser plugin.

## Features

- **Conversation Management**: View, search, and organize AI conversations from multiple platforms (ChatGPT, Claude, Gemini)
- **Memory Extraction**: Automatically extract and manually manage memories from conversations
- **Tagging System**: Organize conversations and memories with a flexible tagging system
- **Search & Filter**: Advanced search and filtering capabilities across all data
- **Data Export/Import**: Export and import conversation data in multiple formats
- **Responsive Design**: Modern Material-UI interface that works on desktop and mobile
- **Dark/Light Theme**: Automatic theme switching based on system preferences

## Technology Stack

- **React 19** - Modern React with latest features
- **TypeScript** - Type-safe development
- **Material-UI v5** - Modern component library
- **Redux Toolkit** - State management
- **React Router** - Client-side routing
- **IndexedDB** - Browser database (no Dexie.js dependency)
- **Vite** - Fast build tool and dev server

## Database Structure

The application interfaces with the existing `acm-manager-db` IndexedDB database with the following object stores:

- `conversations` - AI conversation metadata
- `messages` - Individual messages within conversations
- `memories` - Extracted memories and insights
- `tags` - Tagging system for organization
- `settings` - User preferences and configuration
- `attachments` - File attachments and media

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd acm-front-end
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Common components (Layout, etc.)
│   ├── conversations/  # Conversation-specific components
│   ├── memories/       # Memory-specific components
│   ├── search/         # Search components
│   └── settings/       # Settings components
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── services/           # Database and API services
├── store/              # Redux store and slices
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── App.tsx            # Main application component
```

## Key Components

### Database Service (`src/services/database.ts`)
- Handles all IndexedDB operations
- Provides CRUD operations for all data types
- Manages database schema and migrations

### Redux Store (`src/store/`)
- **conversationsSlice**: Manages conversation state
- **memoriesSlice**: Manages memory state
- **tagsSlice**: Manages tag state
- **settingsSlice**: Manages user settings
- **uiSlice**: Manages UI state (sidebar, modals, notifications)

### Custom Hooks
- **useDatabase**: Initializes and manages database connection
- **useAppDispatch/useAppSelector**: Typed Redux hooks

## Features in Development

- [ ] Advanced conversation viewer with message threading
- [ ] Memory extraction algorithms
- [ ] Drag-and-drop organization
- [ ] Real-time search with highlighting
- [ ] Data visualization and analytics
- [ ] Export to multiple formats (JSON, Markdown, CSV)
- [ ] Import from various sources
- [ ] Backup and sync capabilities

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

IndexedDB support is required for the application to function.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[License information to be added]

## Support

For issues and questions, please create an issue in the repository.
