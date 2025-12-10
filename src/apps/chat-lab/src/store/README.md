# Redux Store Architecture

This directory contains the Redux store configuration, slices, and selectors for the FIDU Chat Lab application's state management.

## Directory Structure

```
store/
├── index.ts                    # Store configuration and type definitions
├── slices/                     # Redux slices for different domains
│   ├── authSlice.ts           # Authentication and user management
│   ├── conversationsSlice.ts  # Conversation data and operations
│   ├── contextsSlice.ts       # Context management
│   ├── googleDriveAuthSlice.ts # Google Drive authentication
│   ├── promptLabSlice.ts      # Prompt lab functionality
│   ├── searchSlice.ts         # Global search state
│   ├── settingsSlice.ts       # Application settings
│   ├── systemPromptsSlice.ts  # System prompt management
│   ├── userFeatureFlagsSlice.ts   # User feature flag overrides
│   ├── systemFeatureFlagsSlice.ts # System feature flags from JSON
│   └── uiSlice.ts             # UI state and notifications
└── selectors/                  # Memoized selectors
    ├── conversationsSelectors.ts # Conversation-specific selectors
    └── featureFlagsSelectors.ts  # Feature flag helpers
```

## Store Configuration

### Core Setup (`index.ts`)

The store is configured using Redux Toolkit with the following features:

- **TypeScript Integration**: Fully typed with `RootState` and `AppDispatch`
- **Middleware**: Custom serializable check configuration
- **DevTools**: Redux DevTools integration for debugging
- **Type-safe Hooks**: `useAppDispatch` and `useAppSelector` with proper typing

```typescript
export const store = configureStore({
  reducer: {
    conversations: conversationsSlice,
    ui: uiSlice,
    settings: settingsSlice,
    contexts: contextsSlice,
    systemPrompts: systemPromptsSlice,
    promptLab: promptLabSlice,
    search: searchSlice,
    auth: authSlice,
    googleDriveAuth: googleDriveAuthSlice,
    systemFeatureFlags: systemFeatureFlagsSlice,
    userFeatureFlags: userFeatureFlagsSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});
```

## Redux Slices

### 🔐 Authentication (`authSlice.ts`)

**Purpose**: Manages user authentication, profiles, and session state

**State Structure:**
```typescript
interface AuthState {
  user: User | null;
  currentProfile: Profile | null;
  profiles: Profile[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}
```

**Key Actions:**
- **`initializeAuth`** - Initialize authentication state from localStorage
- **`login`** - User login with credentials
- **`register`** - User registration
- **`logout`** - Clear authentication state
- **`setCurrentProfile`** - Switch between user profiles
- **`createProfile`** - Create new user profile

**Async Thunks:**
- Token refresh handling
- Profile management
- Authentication persistence

### 💬 Conversations (`conversationsSlice.ts`)

**Purpose**: Manages conversation data, messages, and filtering

**State Structure:**
```typescript
interface ConversationsState {
  items: Conversation[];
  currentConversation: Conversation | null;
  currentMessages: Message[];
  loading: boolean;
  messagesLoading: boolean;
  error: string | null;
  filters: FilterOptions;
  pagination: PaginationState;
}
```

**Key Actions:**
- **`fetchConversations`** - Load conversations with filters
- **`fetchConversation`** - Load specific conversation
- **`fetchConversationMessages`** - Load messages for conversation
- **`saveConversation`** - Create or update conversation
- **`deleteConversation`** - Remove conversation
- **`setFilters`** - Update conversation filters
- **`clearFilters`** - Reset filters to default

**Async Thunks:**
- Paginated conversation loading
- Message fetching with caching
- Conversation CRUD operations

### 📚 Contexts (`contextsSlice.ts`)

**Purpose**: Manages conversation contexts and knowledge bases

**State Structure:**
```typescript
interface ContextsState {
  items: Context[];
  selectedContext: Context | null;
  loading: boolean;
  error: string | null;
}
```

**Key Actions:**
- **`fetchContexts`** - Load all contexts (built-in + user-created)
- **`createContext`** - Create new context
- **`updateContext`** - Update existing context
- **`deleteContext`** - Remove context
- **`addConversationToContext`** - Add conversation to context
- **`setSelectedContext`** - Select active context

**Features:**
- Built-in contexts integration
- Conversation-context relationships
- Error handling with fallbacks

### 🔍 Search (`searchSlice.ts`)

**Purpose**: Global search functionality across the application

**State Structure:**
```typescript
interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  filters: {
    types: string[];
  };
  suggestions: string[];
}
```

**Key Actions:**
- **`setQuery`** - Update search query
- **`setResults`** - Set search results
- **`setLoading`** - Toggle loading state
- **`setFilters`** - Update search filters
- **`setSuggestions`** - Set search suggestions
- **`clearSearch`** - Reset search state

### ⚙️ Settings (`settingsSlice.ts`)

**Purpose**: Application configuration and user preferences

**State Structure:**
```typescript
interface SettingsState {
  storageMode: 'local' | 'cloud' | 'filesystem';
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  error: string | null;
}
```

**Key Actions:**
- **`updateStorageMode`** - Change storage backend
- **`updateTheme`** - Change UI theme
- **`updateLanguage`** - Change application language
- **`updateNotifications`** - Configure notification settings
- **`updatePrivacy`** - Update privacy preferences

### 🎨 UI State (`uiSlice.ts`)

**Purpose**: UI state management and notifications

**State Structure:**
```typescript
interface UIState {
  sidebarOpen: boolean;
  currentPage: string;
  notifications: Notification[];
  modals: {
    exportData: boolean;
    importData: boolean;
    settings: boolean;
    deleteConfirmation: boolean;
  };
  draggedItem: any;
}
```

**Key Actions:**
- **`toggleSidebar`** - Toggle sidebar visibility
- **`setCurrentPage`** - Track current page
- **`addNotification`** - Add system notification
- **`markNotificationRead`** - Mark notification as read
- **`removeNotification`** - Remove notification
- **`openModal`** / **`closeModal`** - Modal state management

### 🧠 System Prompts (`systemPromptsSlice.ts`)

**Purpose**: AI system prompt management

**State Structure:**
```typescript
interface SystemPromptsState {
  items: SystemPrompt[];
  loading: boolean;
  error: string | null;
}
```

**Key Actions:**
- **`fetchSystemPrompts`** - Load system prompts
- **`createSystemPrompt`** - Create new prompt
- **`updateSystemPrompt`** - Update existing prompt
- **`deleteSystemPrompt`** - Remove prompt

### 🚀 Prompt Lab (`promptLabSlice.ts`)

**Purpose**: Prompt lab functionality and conversation management

**State Structure:**
```typescript
interface PromptLabState {
  activeConversations: ConversationTab[];
  currentModel: string;
  systemPrompt: string;
  isLoading: boolean;
  error: string | null;
}
```

**Key Actions:**
- **`addConversation`** - Add new conversation tab
- **`removeConversation`** - Close conversation tab
- **`setActiveConversation`** - Switch active conversation
- **`updateSystemPrompt`** - Change system prompt
- **`setCurrentModel`** - Change AI model

### ☁️ Google Drive Auth (`googleDriveAuthSlice.ts`)

**Purpose**: Google Drive authentication and sync status

**State Structure:**
```typescript
interface GoogleDriveAuthState {
  isAuthenticated: boolean;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
}
```

**Key Actions:**
- **`authenticate`** - Authenticate with Google Drive
- **`disconnect`** - Disconnect from Google Drive
- **`updateSyncStatus`** - Update sync status
- **`setError`** - Set authentication error

### 🏁 System Feature Flags (`systemFeatureFlagsSlice.ts`)

**Purpose**: Loads `public/feature_flags.json` from the server and stores system-defined feature flags in Redux.

**State Structure:**
```typescript
interface SystemFeatureFlagsState {
  flags: FeatureFlagsMap | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}
```

**Key Actions & Thunks:**
- **`fetchSystemFeatureFlags`** – Fetch and hydrate system flags on start and every 15 minutes.
- **`hydrateSystemFeatureFlags`** – Allows manual hydration for tests or SSR scenarios.
- **`clearSystemFeatureFlagError`** – Reset network/validation errors.

### 🏁 User Feature Flags (`userFeatureFlagsSlice.ts`)

**Purpose**: Stores user overrides for feature flags, allowing users to customize their experience by enabling or disabling user-configurable features. Combined with system flags via selectors.

**State Structure:**
```typescript
interface UserFeatureFlagsState {
  userOverrides: UserFeatureFlagOverrides; // Partial<Record<FeatureFlagKey, boolean>>
  loading: boolean;
  error: string | null;
}
```

**Key Actions:**
- **`setUserOverride({ key, value })`** – Set a user override for a specific flag. Takes an object with `key: FeatureFlagKey` and `value` that can be:
  - `true` – Enable the feature (only applies to `user_configurable` flags)
  - `false` – Disable the feature (only applies to `user_configurable` flags)
  - `null` – Remove override and use the system `default_enabled` value
- **`clearAllUserOverrides()`** – Reset all user overrides.
- **`loadUserOverrides(overrides)`** – Bulk load user overrides.
- **`clearUserFeatureFlagError()`** – Reset errors.

**Selectors & Hooks:**
- **`selectIsFeatureFlagEnabled(state, key)`** – Resolves dependencies and combines system flags with user overrides before reporting a flag as enabled.
- **`selectSystemFeatureFlags(state)`** – Get system flags directly.
- **`selectUserFeatureFlagOverrides(state)`** – Get user overrides directly.
- **`selectFeatureFlags(state)`** – Get combined system + user flags.
- **`selectUserFeatureFlagsState(state)`** – Get raw user feature flags state.
- **`useFeatureFlag(key)`** – Hook wrapper that enforces the `FeatureFlagKey` union at compile time.

**Utilities:**
- **`resolveFlagEnabled(flags, key)`** – Resolve flag enabled state with dependency checking (exported for page use).
- **`combineSystemFlagsWithOverrides(systemFlags, userOverrides)`** – Combine system flags with user overrides (exported for page use).

**User Configuration:**
- User overrides are persisted to localStorage (`fidu-chat-lab-feature-flag-overrides`).
- Only `enabled` flags with `user_configurable: true` in the system flags can be overridden by users.
- When a user override is set to `null` (or not set), the system uses the `default_enabled` value from the feature flag definition.

**Adding or Updating Flags:**
1. Edit [`src/apps/chat-lab/public/feature_flags.json`](../../public/feature_flags.json). The TypeScript union is inferred directly from this file, so typos will not compile.
2. Set `user_configurable: true` if you want users to override the flag, and `default_enabled` to set the default state for new users.
3. Keep `depends_on` limited to other valid keys; cycles disable all flags in the loop.
4. Run `npm test -- featureFlags` (or the full suite) to revalidate the payload and selectors.
5. Gate UI with `useFeatureFlag('flag_name')` or the selector instead of hard-coded booleans.

## Selectors (`selectors/`)

### Conversation Selectors (`conversationsSelectors.ts`)

**Purpose**: Memoized selectors for conversation data and derived state

**Key Selectors:**
- **`selectConversations`** - All conversations
- **`selectConversationsLoading`** - Loading state
- **`selectConversationsError`** - Error state
- **`selectCurrentConversation`** - Active conversation
- **`selectCurrentMessages`** - Messages for active conversation
- **`selectConversationsFilters`** - Current filters
- **`selectFilteredConversations`** - Filtered conversations
- **`selectSortedConversations`** - Sorted conversations
- **`selectAllTags`** - All unique tags
- **`selectAllPlatforms`** - All unique platforms
- **`selectConversationStats`** - Conversation statistics
- **`selectPaginatedConversations`** - Paginated results

**Performance Features:**
- Memoized calculations using `createSelector`
- Efficient filtering and sorting
- Derived data computation
- Pagination support

### Feature Flag Selectors (`featureFlagsSelectors.ts`)

Provide dependency-aware helpers (`selectIsFeatureFlagEnabled`, etc.) for components and hooks. These helpers ensure a missing fetch or a disabled dependency always reads as `false`, preventing mismatched UI states.

## Design Patterns

### 1. Slice Organization
- **Domain-based**: Each slice manages a specific domain
- **Normalized State**: Efficient data structure for relationships
- **Immutable Updates**: Using Immer for safe state mutations

### 2. Async Thunks
- **Error Handling**: Consistent error handling patterns
- **Loading States**: Proper loading state management
- **Optimistic Updates**: Immediate UI updates with rollback on error

### 3. Selector Optimization
- **Memoization**: `createSelector` for expensive calculations
- **Composition**: Composable selectors for complex queries
- **Derived State**: Computed values from base state

### 4. Type Safety
- **TypeScript Integration**: Fully typed state and actions
- **Type-safe Hooks**: Custom hooks with proper typing
- **Interface Definitions**: Clear state structure definitions

### 5. Error Handling
- **Centralized Errors**: Error state in each slice
- **User-friendly Messages**: Clear error messages for users
- **Recovery Actions**: Actions to clear errors and retry

## State Management Guidelines

### Creating New Slices

1. **Define State Interface**: Clear TypeScript interface for state
2. **Initial State**: Provide sensible defaults
3. **Reducers**: Pure functions for state updates
4. **Async Thunks**: For side effects and API calls
5. **Selectors**: Memoized selectors for derived state

### Slice Structure Template

```typescript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface SliceState {
  // State definition
}

const initialState: SliceState = {
  // Initial values
};

// Async thunks
export const fetchData = createAsyncThunk(
  'slice/fetchData',
  async (params: any, { rejectWithValue }) => {
    try {
      // API call
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const slice = createSlice({
  name: 'slice',
  initialState,
  reducers: {
    // Synchronous actions
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchData.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { /* actions */ } = slice.actions;
export default slice.reducer;
```

### Selector Best Practices

1. **Memoization**: Always use `createSelector` for derived state
2. **Composition**: Build complex selectors from simpler ones
3. **Performance**: Avoid expensive calculations in selectors
4. **Naming**: Use descriptive names with `select` prefix

```typescript
// Base selectors
const selectBaseState = (state: RootState) => state.slice;

// Memoized selectors
export const selectFilteredData = createSelector(
  [selectBaseState],
  (state) => state.items.filter(/* filter logic */)
);

// Composed selectors
export const selectProcessedData = createSelector(
  [selectFilteredData],
  (filteredData) => filteredData.map(/* processing logic */)
);
```

## Performance Considerations

### Optimization Strategies

1. **Memoized Selectors**: Prevent unnecessary re-renders
2. **Normalized State**: Efficient data structure for relationships
3. **Pagination**: Load data in chunks to improve performance
4. **Caching**: Cache API responses in state
5. **Debouncing**: Debounce user input for search/filtering

### Memory Management

1. **Cleanup**: Clear unused data from state
2. **Limits**: Set reasonable limits for arrays (e.g., notifications)
3. **Garbage Collection**: Remove references to deleted items

## Testing Strategy

### Slice Testing

1. **Unit Tests**: Test individual reducers and actions
2. **Async Thunk Tests**: Test async operations with mocked APIs
3. **Selector Tests**: Test memoized selectors with different inputs
4. **Integration Tests**: Test slice interactions

### Test Structure

```typescript
describe('slice', () => {
  it('should handle action', () => {
    const initialState = { /* initial state */ };
    const action = { type: 'slice/action', payload: 'data' };
    const newState = slice.reducer(initialState, action);
    expect(newState).toEqual(/* expected state */);
  });
});
```

## Future Enhancements

### Planned Improvements

1. **Persistence**: Add Redux Persist for state persistence
2. **Middleware**: Custom middleware for logging and analytics
3. **DevTools**: Enhanced Redux DevTools integration
4. **Performance**: Further optimization of selectors and state structure

### Architecture Evolution

1. **RTK Query**: Consider RTK Query for API state management
2. **State Normalization**: Implement more sophisticated normalization
3. **Middleware Chain**: Add custom middleware for cross-cutting concerns
4. **State Validation**: Add runtime state validation

## Contributing

When working with the store:

1. Follow established patterns and conventions
2. Use TypeScript for all state and actions
3. Add appropriate tests for new functionality
4. Update selectors when adding new state
5. Consider performance implications
6. Document complex state logic

## Resources

- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [Redux Best Practices](https://redux.js.org/style-guide/style-guide)
- [Reselect Documentation](https://github.com/reduxjs/reselect)
- [Redux Testing](https://redux.js.org/usage/writing-tests)
