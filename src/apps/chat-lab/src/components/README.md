# Components Architecture

This directory contains all React components for the FIDU Chat Lab application, organized by functional domain and responsibility.

## Directory Structure

```
components/
├── auth/                    # Authentication & user management
├── common/                  # Shared UI components
├── contexts/               # Context management components
├── conversations/          # Conversation handling components
├── Layout/                 # Application layout components
├── prompts/                # Prompt input and management
└── settings/               # Settings and configuration
```

## Component Categories

### 🔐 Authentication (`auth/`)

Components responsible for user authentication, profile management, and Google Drive integration.

**Key Components:**
- **`AuthWrapper.tsx`** - Main authentication wrapper that handles login flow
- **`FiduAuthLogin.tsx`** - Login/register forms for FIDU identity service
- **`GoogleDriveAuth.tsx`** - Google Drive authentication integration
- **`GoogleDriveAuthPrompt.tsx`** - UI prompts for Google Drive setup
- **`GoogleDriveStatus.tsx`** - Status indicator for Google Drive connection
- **`ProfileSelector.tsx`** - User profile selection interface
- **`SyncStatus.tsx`** - Data synchronization status display

**Design Principles:**
- Centralized authentication state management
- Graceful handling of authentication failures
- Clear user feedback for auth status
- Support for multiple authentication providers

### 🎨 Common Components (`common/`)

Reusable UI components used throughout the application.

**Key Components:**
- **`Layout.tsx`** - Main application layout with sidebar and navigation
- **`ErrorBoundary.tsx`** - Error boundary for graceful error handling
- **`PerformanceMonitor.tsx`** - Development-only performance monitoring
- **`StorageDirectoryBanner.tsx`** - Contextual banners for storage requirements
- **`UniversalSearch.tsx`** - Global search functionality
- **`UnsyncedDataIndicator.tsx`** - Visual indicator for unsynced data
- **`VirtualList.tsx`** - Virtualized list for large datasets
- **`CategoryFilter.tsx`** - Reusable category filtering component

**Design Principles:**
- Maximum reusability across different contexts
- Consistent styling and behavior
- Accessibility-first design
- Performance optimization (virtualization, memoization)

### 📚 Context Management (`contexts/`)

Components for managing conversation contexts and knowledge bases.

**Key Components:**
- **`ContextCard.tsx`** - Display card for individual contexts
- **`ConversationSelectionList.tsx`** - List for selecting conversations to add to contexts

**Design Principles:**
- Clear visual distinction between built-in and custom contexts
- Intuitive context management workflows
- Support for context hierarchies and relationships

### 💬 Conversations (`conversations/`)

Core components for conversation management, viewing, and interaction.

**Key Components:**
- **`ConversationManager.tsx`** - Tabbed interface for multiple conversations
- **`ConversationViewer.tsx`** - Main conversation display and interaction
- **`ConversationWindow.tsx`** - Individual conversation window component
- **`ConversationCard.tsx`** - Card display for conversation lists
- **`ConversationFilters.tsx`** - Filtering and search for conversations
- **`ContextBuilder.tsx`** - Interface for building conversation contexts
- **`TagManager.tsx`** - Tag management for conversations
- **`AddToContextDialog.tsx`** - Dialog for adding conversations to contexts

**Design Principles:**
- Multi-conversation support with tabbed interface
- Real-time conversation updates
- Efficient rendering for large conversation lists
- Flexible filtering and search capabilities

### 🏗️ Layout (`Layout/`)

Application structure and navigation components.

**Key Components:**
- **`Sidebar.tsx`** - Main navigation sidebar

**Design Principles:**
- Responsive design for different screen sizes
- Consistent navigation patterns
- Clear visual hierarchy

### ✍️ Prompts (`prompts/`)

Components for prompt input, management, and system prompt selection.

**Key Components:**
- **`PromptInput.tsx`** - Main prompt input interface
- **`PromptStack.tsx`** - Stack-based prompt management
- **`SystemPromptModal.tsx`** - Modal for selecting system prompts
- **`ModelSelection.tsx`** - AI model selection interface
- **`ModelSelectionModal.tsx`** - Modal for model selection
- **`ContextSelectionModal.tsx`** - Modal for context selection
- **`RecentPrompts.tsx`** - Recent prompts history

**Design Principles:**
- Intuitive prompt composition workflows
- Support for multiple AI models
- Context-aware prompt suggestions
- Efficient prompt history management

### ⚙️ Settings (`settings/`)

Configuration and settings management components.

**Key Components:**
- **`StorageModeSelector.tsx`** - Storage mode selection (local/cloud/filesystem)
- **`FileSystemDirectoryManager.tsx`** - File system directory management
- **`StorageMigrationWizard.tsx`** - Data migration between storage modes
- **`DirectoryPickerButton.tsx`** - Directory selection interface
- **`DirectoryPathDisplay.tsx`** - Display of selected directory path
- **`ClearDirectoryButton.tsx`** - Clear directory selection
- **`PermissionStatusIndicator.tsx`** - Permission status display

**Design Principles:**
- Clear storage mode explanations
- Intuitive migration workflows
- Comprehensive error handling
- User-friendly permission management

## Design Patterns

### 1. Component Composition
- Components are designed to be composable and reusable
- Props interfaces are well-defined with TypeScript
- Clear separation of concerns between components

### 2. State Management
- Redux for global state (conversations, auth, settings)
- Local state for component-specific data
- Custom hooks for shared logic

### 3. Performance Optimization
- `React.memo()` for expensive components
- Virtualization for large lists
- Lazy loading for non-critical components
- Debounced user inputs

### 4. Error Handling
- Error boundaries for graceful failure
- Comprehensive error states in components
- User-friendly error messages

### 5. Accessibility
- Semantic HTML structure
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader compatibility

## Component Guidelines

### Creating New Components

1. **Location**: Place components in the appropriate subdirectory based on their primary function
2. **Naming**: Use PascalCase for component files and exports
3. **Props**: Define clear TypeScript interfaces for all props
4. **Styling**: Use Material-UI components and sx prop for styling
5. **Testing**: Include comprehensive tests in `__tests__/` subdirectories

### Component Structure

```typescript
import React from 'react';
import { /* Material-UI imports */ } from '@mui/material';
import type { /* Type imports */ } from '../types';

interface ComponentProps {
  // Clear prop definitions
}

export const ComponentName: React.FC<ComponentProps> = React.memo(({
  // Destructured props
}) => {
  // Component logic
  
  return (
    // JSX
  );
});

ComponentName.displayName = 'ComponentName';
```

### Performance Considerations

- Use `React.memo()` for components that receive stable props
- Implement `useCallback()` for event handlers passed to child components
- Use `useMemo()` for expensive calculations
- Consider virtualization for large lists
- Implement lazy loading for non-critical components

### Testing Strategy

- Unit tests for individual components
- Integration tests for component interactions
- Accessibility tests for user interactions
- Visual regression tests for UI consistency

## Future Enhancements

### Planned Improvements

1. **Component Library**: Extract common components into a shared library
2. **Storybook Integration**: Add Storybook for component documentation
3. **Design System**: Implement a comprehensive design system
4. **Animation System**: Add consistent animations and transitions
5. **Mobile Optimization**: Enhanced mobile-specific components

### Architecture Evolution

1. **Micro-frontend Architecture**: Consider splitting into smaller applications
2. **Component Versioning**: Implement component versioning for breaking changes
3. **Performance Monitoring**: Enhanced performance tracking
4. **Accessibility Audit**: Regular accessibility compliance checks

## Contributing

When adding new components:

1. Follow the established patterns and conventions
2. Include comprehensive TypeScript types
3. Add appropriate tests
4. Update this documentation
5. Consider accessibility implications
6. Optimize for performance

## Resources

- [Material-UI Documentation](https://mui.com/)
- [React Best Practices](https://react.dev/learn)
- [TypeScript React Patterns](https://react-typescript-cheatsheet.netlify.app/)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
