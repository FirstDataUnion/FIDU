# Custom Hooks

This directory contains custom React hooks that encapsulate reusable logic and state management patterns for the FIDU Chat Lab application.

## Hook Categories

### 🔗 Redux Integration (`redux.ts`)

**Purpose**: Type-safe Redux integration hooks

**Hooks:**
- **`useAppDispatch`** - Typed dispatch hook for Redux actions
- **`useAppSelector`** - Typed selector hook for Redux state

**Usage:**
```typescript
const dispatch = useAppDispatch();
const { conversations } = useAppSelector(state => state.conversations);
```

### 💾 Storage Management (`useStorage.ts`)

**Purpose**: Unified interface to storage operations across different storage backends

**Key Features:**
- Automatic storage service initialization
- Storage mode detection (local/cloud)
- Online/offline status tracking
- Complete CRUD operations for all data types

**Return Interface:**
```typescript
interface UseStorageReturn {
  // Service state
  isInitialized: boolean;
  storageMode: string;
  isCloudMode: boolean;
  isLocalMode: boolean;
  isOnline: boolean;
  
  // Conversation operations
  createConversation: (profileId: string, conversation: Partial<Conversation>, messages: Message[]) => Promise<Conversation>;
  updateConversation: (conversation: Partial<Conversation>, messages: Message[]) => Promise<Conversation>;
  getConversations: (filters?: FilterOptions, page?: number, limit?: number) => Promise<any>;
  // ... more operations
  
  // API Key, Context, System Prompt operations
  // Sync operations
}
```

**Usage:**
```typescript
const {
  isInitialized,
  createConversation,
  getConversations,
  sync
} = useStorage();
```

### 🔍 Search & Filtering (`useDebouncedSearch.ts`)

**Purpose**: Debounced search functionality with loading states

**Key Features:**
- Configurable debounce delay (default: 300ms)
- Minimum search length requirement
- Loading state management
- Search suggestions support
- Immediate clear functionality

**Options:**
```typescript
interface UseDebouncedSearchOptions {
  delay?: number;        // Debounce delay in ms
  minLength?: number;    // Minimum query length
  onSearch?: (query: string) => void; // Search callback
}
```

**Usage:**
```typescript
const {
  searchQuery,
  debouncedQuery,
  isSearching,
  updateSearchQuery,
  clearSearch
} = useDebouncedSearch({
  delay: 500,
  minLength: 3,
  onSearch: handleSearch
});
```

### 📝 Text Input (`usePromptText.ts`)

**Purpose**: Advanced text input handling with debouncing and blur synchronization

**Key Features:**
- Immediate local updates for responsive UI
- Debounced external synchronization
- Blur-triggered immediate sync
- Programmatic value updates
- Automatic cleanup

**Options:**
```typescript
interface UsePromptTextOptions {
  initialValue?: string;
  debounceMs?: number;
  onDebouncedChange?: (value: string) => void;
}
```

**Usage:**
```typescript
const {
  value,
  debouncedValue,
  onChange,
  onBlur,
  setValue
} = usePromptText({
  initialValue: '',
  debounceMs: 300,
  onDebouncedChange: handlePromptChange
});
```

### 📊 Performance Monitoring (`usePerformanceMonitor.ts`)

**Purpose**: Development-only performance monitoring for React components

**Key Features:**
- ⚠️ **DEVELOPMENT ONLY** - Automatically disabled in production
- Render time tracking
- Performance threshold warnings
- Memory usage monitoring
- Console logging with configurable levels

**Options:**
```typescript
interface UsePerformanceMonitorOptions {
  componentName: string;
  enabled?: boolean;     // Defaults to DEV mode
  logToConsole?: boolean;
  threshold?: number;    // Performance threshold in ms (default: 16ms = 60fps)
}
```

**Usage:**
```typescript
const { startRender, endRender, metrics } = usePerformanceMonitor({
  componentName: 'ConversationList',
  threshold: 16 // 60fps threshold
});

// In component render
useEffect(() => {
  startRender();
  // ... component logic
  endRender();
}, []);
```

### 🔄 Lazy Loading (`useLazyLoad.ts`)

**Purpose**: Infinite scroll and pagination for large datasets

**Key Features:**
- Intersection Observer-based infinite scroll
- Configurable page sizes and thresholds
- Loading state management
- Manual page navigation
- Automatic cleanup

**Options:**
```typescript
interface UseLazyLoadOptions<T> {
  items: T[];
  pageSize?: number;     // Items per page (default: 20)
  threshold?: number;    // Distance from bottom to trigger load (default: 100px)
  onLoadMore?: (page: number, items: T[]) => void;
  enabled?: boolean;     // Enable/disable lazy loading
}
```

**Usage:**
```typescript
const {
  paginatedItems,
  currentPage,
  isLoading,
  hasMore,
  loadMore,
  loadingRef
} = useLazyLoad({
  items: conversations,
  pageSize: 20,
  threshold: 100,
  onLoadMore: handleLoadMore
});

// Render loading indicator
<div ref={loadingRef}>
  {isLoading && <CircularProgress />}
</div>
```

### 🎯 Conversation Optimization (`useConversationOptimization.ts`)

**Purpose**: High-performance conversation filtering, sorting, and searching

**Key Features:**
- Memoized expensive calculations
- Change detection to avoid unnecessary recalculations
- Multi-criteria filtering (search, platform, tags, archived status)
- Flexible sorting options
- Conversation grouping by platform/tags
- Search scoring algorithm
- Performance statistics

**Options:**
```typescript
interface UseConversationOptimizationOptions {
  conversations: Conversation[];
  searchQuery: string;
  selectedPlatforms: string[];
  selectedTags: string[];
  showArchived: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
```

**Usage:**
```typescript
const {
  allTags,
  allPlatforms,
  filteredConversations,
  sortedConversations,
  conversationsByPlatform,
  conversationsByTag,
  stats,
  searchConversations
} = useConversationOptimization({
  conversations,
  searchQuery,
  selectedPlatforms,
  selectedTags,
  showArchived,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});
```

## Design Patterns

### 1. Memoization Strategy
- **`useMemo()`** for expensive calculations
- **`useCallback()`** for stable function references
- **`useRef()`** for persistent values across renders

### 2. Effect Management
- Cleanup functions for timers and observers
- Dependency arrays optimized for performance
- Conditional effect execution

### 3. State Synchronization
- Local state for immediate UI updates
- Debounced external synchronization
- Blur-triggered immediate sync

### 4. Error Handling
- Graceful degradation for service failures
- Console error logging with context
- Fallback values for critical operations

### 5. Performance Optimization
- Change detection to avoid unnecessary work
- Intersection Observer for efficient scrolling
- Development-only performance monitoring

## Hook Guidelines

### Creating New Hooks

1. **Naming**: Use `use` prefix followed by descriptive name
2. **Single Responsibility**: Each hook should have one clear purpose
3. **TypeScript**: Provide comprehensive type definitions
4. **Documentation**: Include JSDoc comments for complex logic
5. **Testing**: Include comprehensive tests in `__tests__/` directory

### Hook Structure Template

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react';

interface UseHookNameOptions {
  // Define options interface
}

interface UseHookNameReturn {
  // Define return interface
}

/**
 * Hook description and usage examples
 * 
 * @param options - Configuration options
 * @returns Hook return object
 */
export const useHookName = ({
  // Destructured options with defaults
}: UseHookNameOptions = {}): UseHookNameReturn => {
  // Hook implementation
  
  return {
    // Return object
  };
};
```

### Performance Considerations

- **Memoization**: Use `useMemo()` for expensive calculations
- **Callback Stability**: Use `useCallback()` for functions passed to child components
- **Effect Dependencies**: Optimize dependency arrays to prevent unnecessary re-runs
- **Cleanup**: Always clean up timers, observers, and subscriptions
- **Conditional Execution**: Use conditional logic to avoid unnecessary work

### Testing Strategy

- **Unit Tests**: Test individual hook logic
- **Integration Tests**: Test hook interactions with components
- **Edge Cases**: Test error conditions and boundary cases
- **Performance Tests**: Verify performance characteristics

## Common Patterns

### Debouncing User Input
```typescript
const useDebouncedValue = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
};
```

### Conditional Effect Execution
```typescript
useEffect(() => {
  if (!enabled) return;
  
  // Effect logic
}, [enabled, /* other dependencies */]);
```

### Stable Callback References
```typescript
const handleClick = useCallback((id: string) => {
  // Handle click
}, [/* dependencies */]);
```

## Future Enhancements

### Planned Improvements

1. **Hook Composition**: Create higher-order hooks for common patterns
2. **Performance Profiling**: Enhanced performance monitoring hooks
3. **Error Boundaries**: Hook-based error boundary management
4. **Caching Layer**: Intelligent caching hooks for API data
5. **Real-time Updates**: WebSocket integration hooks

### Architecture Evolution

1. **Hook Library**: Extract reusable hooks into shared library
2. **Type Safety**: Enhanced TypeScript integration
3. **Testing Framework**: Specialized testing utilities for hooks
4. **Documentation**: Interactive hook documentation with examples

## Contributing

When adding new hooks:

1. Follow the established patterns and conventions
2. Include comprehensive TypeScript types
3. Add appropriate tests
4. Update this documentation
5. Consider performance implications
6. Include usage examples

## Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [Custom Hooks Patterns](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Hook Testing Guide](https://testing-library.com/docs/react-hooks-testing-library/)
- [Performance Optimization](https://react.dev/learn/render-and-commit)
