# Pages Architecture

This directory contains the main page-level components that define the user interface and user flows for the FIDU Chat Lab application.

## Directory Structure

```
pages/
├── ConversationsPage.tsx      # Main conversations management page
├── ContextsPage.tsx          # Context management page
├── DataMigrationPage.tsx     # Data migration from old FIDU Vault
├── PromptLabPage.tsx         # AI prompt lab and conversation interface
├── SettingsPage.tsx          # Application settings and configuration
└── SystemPromptsPage.tsx     # System prompt management page
```

## Page Components

### 💬 Conversations Page (`ConversationsPage.tsx`)

**Purpose**: Central hub for managing and viewing conversations

**Key Features:**
- **Conversation List**: Virtualized list of all conversations
- **Search & Filtering**: Advanced filtering by platform, tags, date, and content
- **Conversation Viewer**: Detailed conversation display with message history
- **Context Integration**: Add conversations to contexts
- **Tag Management**: Organize conversations with tags
- **Bulk Operations**: Multi-conversation management

**User Flow:**
1. **Browse** conversations with filtering and search
2. **Select** conversation to view details
3. **Manage** tags and context associations
4. **Export** or **archive** conversations

**Key Components Used:**
- `ConversationViewer` - Main conversation display
- `ConversationCard` - Individual conversation cards
- `ConversationFilters` - Advanced filtering interface
- `ContextBuilder` - Context creation and management
- `TagManager` - Tag organization
- `VirtualList` - Performance-optimized conversation list

**State Management:**
- Redux integration for conversation data
- Local state for UI interactions
- Optimized selectors for performance

### 📚 Contexts Page (`ContextsPage.tsx`)

**Purpose**: Manage conversation contexts and knowledge bases

**Key Features:**
- **Context Management**: Create, edit, and delete contexts
- **Conversation Association**: Add conversations to contexts
- **Search & Filter**: Find contexts by title and content
- **Built-in Contexts**: Integration with system-provided contexts
- **Context Viewer**: Detailed context display and editing

**User Flow:**
1. **Browse** available contexts (built-in + custom)
2. **Create** new contexts for specific topics
3. **Edit** existing contexts to update information
4. **Associate** conversations with relevant contexts
5. **Use** contexts in prompt lab for enhanced AI responses

**Key Components Used:**
- `ContextCard` - Context display cards
- `ConversationSelectionList` - Add conversations to contexts

**State Management:**
- Redux integration for context data
- Local state for form management
- Optimized filtering and search

### 🚀 Prompt Lab Page (`PromptLabPage.tsx`)

**Purpose**: Interactive AI conversation interface with advanced prompt management

**Key Features:**
- **Multi-Model Support**: Switch between different AI models
- **System Prompt Selection**: Choose from built-in and custom system prompts
- **Context Integration**: Use contexts to enhance AI responses
- **Conversation Management**: Multiple concurrent conversations
- **Real-time Execution**: Live AI model interaction
- **Prompt History**: Recent prompts and conversation history

**User Flow:**
1. **Select** AI model and system prompt
2. **Choose** context for enhanced responses
3. **Compose** prompt with rich text editing
4. **Execute** prompt and receive AI response
5. **Manage** conversation history and save conversations

**Key Components Used:**
- `PromptInput` - Main prompt composition interface
- `ModelSelection` - AI model selection
- `SystemPromptModal` - System prompt selection
- `ContextSelectionModal` - Context selection
- `ConversationManager` - Multi-conversation management

**State Management:**
- Redux integration for prompts and conversations
- Local state for UI interactions
- Real-time execution state management

### ⚙️ Settings Page (`SettingsPage.tsx`)

**Purpose**: Application configuration and user preferences

**Key Features:**
- **Storage Mode Selection**: Choose between local and cloud storage
- **Theme Management**: Light, dark, and auto theme options
- **Data Management**: Clear cloud data and manage storage
- **Environment Detection**: Automatic deployment type detection
- **Storage Migration**: Tools for switching storage modes

**User Flow:**
1. **Configure** storage mode based on needs
2. **Set** theme preference for UI
3. **Manage** data and storage settings
4. **Clear** cloud data if needed
5. **Migrate** between storage modes

**Key Components Used:**
- `StorageModeSelector` - Storage mode configuration
- `StorageMigrationWizard` - Data migration tools

**State Management:**
- Redux integration for settings
- Local state for UI interactions
- Environment-based configuration

### 🧠 System Prompts Page (`SystemPromptsPage.tsx`)

**Purpose**: Manage AI system prompts and behaviors

**Key Features:**
- **Prompt Management**: Create, edit, and delete system prompts
- **Category Organization**: Organize prompts by categories
- **Built-in Prompts**: Integration with system-provided prompts
- **Search & Filter**: Find prompts by name and content
- **Prompt Preview**: Preview prompt content and behavior
- **Usage Tracking**: Track prompt usage and performance

**User Flow:**
1. **Browse** available system prompts
2. **Create** custom prompts for specific use cases
3. **Edit** existing prompts to refine behavior
4. **Organize** prompts with categories and tags
5. **Use** prompts in prompt lab for AI interactions

**Key Components Used:**
- `SystemPromptModal` - Prompt creation and editing
- `CategoryFilter` - Prompt categorization

**State Management:**
- Redux integration for system prompts
- Local state for form management
- Optimized filtering and search

### 📦 Data Migration Page (`DataMigrationPage.tsx`)

**Purpose**: Migrate data from old FIDU Vault database format

**Key Features:**
- **File Upload**: Drag-and-drop SQLite database upload
- **Data Validation**: Validate database structure and content
- **Step-by-Step Process**: Guided migration with progress tracking
- **Error Handling**: Comprehensive error reporting and recovery
- **Data Transformation**: Convert old format to new structure
- **Storage Integration**: Import to current storage mode

**User Flow:**
1. **Upload** old FIDU Vault database file
2. **Validate** database structure and content
3. **Review** migration plan and data mapping
4. **Execute** migration with progress tracking
5. **Verify** migrated data and resolve any issues

**Key Components Used:**
- `MigrationService` - Core migration logic
- File upload with drag-and-drop support

**State Management:**
- Local state for migration process
- Progress tracking and error handling
- Integration with storage services

## Design Patterns

### 1. Page-Level Architecture
- **Single Responsibility**: Each page handles one primary user flow
- **Component Composition**: Pages compose smaller components
- **State Management**: Redux for global state, local state for UI
- **Performance Optimization**: Memoization and virtualization

### 2. User Experience Patterns
- **Progressive Disclosure**: Show information progressively
- **Contextual Actions**: Actions available based on current state
- **Error Boundaries**: Graceful error handling and recovery
- **Loading States**: Clear feedback during async operations

### 3. Data Flow Patterns
- **Redux Integration**: Consistent state management
- **Optimistic Updates**: Immediate UI feedback
- **Error Handling**: Comprehensive error states
- **Caching**: Efficient data loading and caching

### 4. Navigation Patterns
- **Breadcrumb Navigation**: Clear navigation context
- **Modal Workflows**: Focused task completion
- **Tabbed Interfaces**: Multi-conversation management
- **Deep Linking**: Direct access to specific content

## Performance Considerations

### Optimization Strategies

1. **Virtualization**: Virtual lists for large datasets
2. **Memoization**: React.memo and useMemo for expensive calculations
3. **Lazy Loading**: Load data on demand
4. **Debouncing**: Debounce user input for search and filtering
5. **Caching**: Cache frequently accessed data

### Memory Management

1. **Component Cleanup**: Proper cleanup of subscriptions and timers
2. **State Optimization**: Minimize unnecessary state updates
3. **Event Handling**: Efficient event listener management
4. **Resource Management**: Proper resource disposal

## Accessibility Features

### WCAG Compliance

1. **Keyboard Navigation**: Full keyboard accessibility
2. **Screen Reader Support**: Proper ARIA labels and descriptions
3. **Color Contrast**: Sufficient contrast ratios
4. **Focus Management**: Clear focus indicators and management

### User Experience

1. **Error Messages**: Clear, actionable error messages
2. **Loading States**: Informative loading indicators
3. **Success Feedback**: Confirmation of successful actions
4. **Help Text**: Contextual help and guidance

## Testing Strategy

### Page Testing

1. **Unit Tests**: Test individual page logic
2. **Integration Tests**: Test page-component interactions
3. **User Flow Tests**: Test complete user workflows
4. **Accessibility Tests**: Test accessibility compliance

### Test Structure

```typescript
describe('PageName', () => {
  it('should render correctly', () => {
    // Test basic rendering
  });
  
  it('should handle user interactions', () => {
    // Test user interactions
  });
  
  it('should manage state correctly', () => {
    // Test state management
  });
});
```

## Future Enhancements

### Planned Improvements

1. **Offline Support**: Enhanced offline capabilities
2. **Real-time Updates**: WebSocket integration for live updates
3. **Advanced Search**: Full-text search across all content
4. **Export/Import**: Enhanced data export and import capabilities

### Architecture Evolution

1. **Micro-frontend**: Consider splitting into smaller applications
2. **Progressive Web App**: Enhanced PWA capabilities
3. **Mobile Optimization**: Mobile-specific interfaces
4. **Performance Monitoring**: Enhanced performance tracking

## Contributing

When working with pages:

1. Follow established patterns and conventions
2. Use TypeScript for all page components
3. Add appropriate tests for new functionality
4. Consider accessibility implications
5. Optimize for performance
6. Document complex user flows

## Resources

- [React Router Documentation](https://reactrouter.com/)
- [Material-UI Components](https://mui.com/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Performance Best Practices](https://react.dev/learn/render-and-commit)
