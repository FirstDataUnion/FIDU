# Storage Architecture

This directory contains the storage abstraction layer for FIDU Chat Lab, providing a unified interface for data persistence across different storage backends.

## High-Level Design

The storage system uses an **Adapter Pattern** to provide a consistent interface while supporting multiple storage backends. The architecture consists of:

- **StorageService**: Manages the active storage adapter and handles initialization
- **UnifiedStorageService**: Provides a singleton interface for the rest of the application
- **Storage Adapters**: Implement the `StorageAdapter` interface for specific storage backends
- **Storage Factory**: Creates appropriate adapters based on configuration

## Operating Modes

### 1. Local Mode (`local`)
- **Purpose**: Operating with local FIDU Vault instance in desktop app mode
- **Backend**: Connects to local FIDU Vault API at `http://127.0.0.1:4000/api/v1`
- **Use Case**: Desktop all mode
- **Data Location**: Local FIDU Vault database

### 2. Cloud Mode (`cloud`)
Cloud mode uses Google Drive for storage:

#### Google Drive Storage (`cloud` → Google Drive)
- **Purpose**: Cloud-based storage with Google Drive integration
- **Backend**: Google Drive API with local caching for performance
- **Use Case**: Multi-device access, cloud backup, collaboration
- **Data Location**: Google Drive files with local IndexedDB cache
- **Features**: 
  - Automatic sync across devices
  - Offline capability with local caching
  - Google Drive authentication required

## Key Components

### Storage Adapters
Each adapter implements the `StorageAdapter` interface and handles:
- **Conversations**: CRUD operations for chat conversations
- **API Keys**: Secure storage of provider API keys
- **Contexts**: Conversation context and knowledge base management
- **System Prompts**: AI behavior and personality definitions
- **Sync Operations**: Data synchronization and consistency

### Adapter Implementations
- **LocalStorageAdapter**: Connects to local FIDU Vault API
- **CloudStorageAdapter**: Google Drive integration with local caching

### Supporting Services
- **GoogleDriveService**: Handles Google Drive API interactions
- **BrowserSQLiteManager**: In-memory SQLite database management
- **SyncService**: Handles data synchronization between local and cloud storage

## User Experience Features

### Storage Mode Switching
- **Runtime Switching**: Users can change storage modes without restart
- **Data Migration**: Tools available for moving data between storage modes
- **Settings Persistence**: Storage mode preference saved in localStorage

## Browser Compatibility

### Google Drive API
- **Requirements**: Modern browsers with JavaScript enabled
- **Authentication**: OAuth 2.0 flow for Google Drive access

## Development Guidelines

### Adding New Storage Backends
1. Implement the `StorageAdapter` interface
2. Add the new adapter to `StorageFactory`
3. Update `StorageMode` enum in `types.ts`
4. Add appropriate error handling and user messaging

### Testing Storage Operations
- Use the `UnifiedStorageService` for consistent testing
- Mock adapters for unit tests
- Test storage mode switching scenarios
- Verify error handling for network failures

### Performance Considerations
- **Local Caching**: Cloud adapters use local caching for performance
- **Lazy Loading**: Data loaded on-demand to reduce memory usage
- **Batch Operations**: Multiple operations batched where possible
- **Error Recovery**: Graceful handling of network and permission issues

## Security Considerations

### API Key Storage
- API keys encrypted and stored securely
- No API keys logged or exposed in error messages
- Secure key rotation support

### Google Drive Integration
- OAuth 2.0 authentication required
- Minimal permissions requested
- User can revoke access at any time

## Future Enhancements

### Planned Features
- **Additional Cloud Providers**: AWS S3, Dropbox, OneDrive support
- **Encryption**: End-to-end encryption for sensitive data
- **Conflict Resolution**: Better handling of concurrent edits
- **Backup/Restore**: Automated backup and restore capabilities

### Architecture Improvements
- **Plugin System**: Extensible adapter system for third-party storage
- **Performance Monitoring**: Metrics for storage operation performance
- **Advanced Caching**: More sophisticated caching strategies
- **Offline Support**: Enhanced offline capabilities across all adapters
