# Workspace Switching Implementation

This document describes the workspace switching infrastructure implemented to support future collaborative features in FIDU Chat Lab.

## Overview

We've implemented a "switch and reload" workspace model where only one workspace is active at a time. When users switch workspaces, the app:
1. Syncs any unsaved changes from the current workspace
2. Closes current database connections
3. Reinitializes storage with the new workspace configuration
4. Loads data from the new workspace

This approach prioritizes simplicity and speed to market while delivering core collaboration value.

## Architecture

### Core Components

#### 1. Workspace Types (`src/types/index.ts`)
```typescript
interface WorkspaceMetadata {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  driveFolderId?: string;  // undefined for AppData, folder ID for shared
  files?: {
    conversationsDbId?: string;
    apiKeysDbId?: string;
    metadataJsonId?: string;
  };
  role?: 'owner' | 'member';
  members?: Array<{ email: string; role: 'owner' | 'member' }>;
  createdAt: string;
  lastAccessed: string;
}
```

#### 2. Workspace Registry (`src/services/workspace/WorkspaceRegistry.ts`)
- Manages workspace metadata in localStorage
- Tracks active workspace
- Provides CRUD operations for workspaces
- Singleton service accessible via `getWorkspaceRegistry()`

**Key Methods:**
- `getWorkspaces()`: Get all registered workspaces
- `getActiveWorkspace()`: Get currently active workspace
- `setActiveWorkspace(id)`: Set active workspace
- `createPersonalWorkspace(userId, profileId, name)`: Create personal workspace
- `createSharedWorkspace(name, folderId, role)`: Create shared workspace
- `getOrCreatePersonalWorkspace(...)`: Get or create personal workspace

#### 3. Enhanced Storage Configuration (`src/services/storage/types.ts`)
```typescript
interface StorageConfig {
  mode: 'local' | 'cloud';
  baseURL?: string;
  userId?: string;
  workspaceId?: string;        // NEW: identifies active workspace
  workspaceType?: 'personal' | 'shared';  // NEW: affects Drive folder routing
  driveFolderId?: string;      // NEW: for shared workspaces (non-AppData)
}
```

#### 4. Google Drive Service Updates (`src/services/storage/drive/GoogleDriveService.ts`)
- Now accepts optional `driveFolderId` in constructor
- Automatically routes operations to AppData or custom folder
- `listFiles()` queries appropriate folder based on configuration
- `uploadFile()` uploads to configured folder

**Usage:**
```typescript
// AppData folder (personal workspace)
const appDataService = new GoogleDriveService(authService);

// Custom folder (shared workspace)
const sharedService = new GoogleDriveService(authService, 'folder-123');
```

#### 5. Storage Service Workspace Switching (`src/services/storage/StorageService.ts`)
- New `switchWorkspace(workspaceId)` method
- Handles sync before switch if there are unsaved changes
- Closes current adapter and reinitializes with new config
- Updates workspace registry

**Switching Flow:**
```typescript
async switchWorkspace(workspaceId: string) {
  // 1. Get workspace metadata
  const workspace = workspaceRegistry.getWorkspace(workspaceId);
  
  // 2. Sync current workspace if dirty
  if (unsyncedDataManager.hasUnsynced()) {
    await this.adapter.sync();
  }
  
  // 3. Close current adapter
  await this.adapter.close();
  
  // 4. Update config with workspace context
  this.config = {
    ...this.config,
    workspaceId: workspace.id,
    workspaceType: workspace.type,
    driveFolderId: workspace.driveFolderId,
  };
  
  // 5. Create new adapter and initialize
  this.adapter = createStorageAdapter(this.config);
  await this.adapter.initialize();
  
  // 6. Update registry
  workspaceRegistry.setActiveWorkspace(workspaceId);
}
```

#### 6. Redux State Management (`src/store/slices/unifiedStorageSlice.ts`)
- Extended state to include workspace information
- New thunks: `loadWorkspaces()`, `switchWorkspace(id)`
- New actions: `setActiveWorkspace()`, `setAvailableWorkspaces()`, `clearSwitchError()`

**State Structure:**
```typescript
interface UnifiedStorageState {
  mode: 'local' | 'cloud';
  status: 'unconfigured' | 'configuring' | 'configured' | 'error';
  
  // NEW: Workspace state
  activeWorkspace: {
    id: string;
    name: string;
    type: 'personal' | 'shared';
    driveFolderId?: string;
  } | null;
  availableWorkspaces: Array<{
    id: string;
    name: string;
    type: 'personal' | 'shared';
    role?: 'owner' | 'member';
    lastAccessed?: string;
  }>;
  isSwitchingWorkspace: boolean;
  switchError: string | null;
  
  // Existing state...
  googleDrive: { ... };
  isLoading: boolean;
  error: string | null;
}
```

## Testing

Comprehensive test suites have been added:

### 1. WorkspaceRegistry Tests (`src/services/workspace/__tests__/WorkspaceRegistry.test.ts`)
- Initialization and persistence
- Workspace CRUD operations
- Active workspace management
- Personal and shared workspace creation
- Singleton behavior

### 2. Workspace Switching Tests (`src/services/storage/__tests__/WorkspaceSwitching.test.ts`)
- Successful workspace switching
- Sync before switch when dirty
- Error handling (workspace not found, sync failures)
- Config updates with workspace context
- Personal vs shared workspace handling

### 3. Google Drive Folder Tests (`src/services/storage/drive/__tests__/GoogleDriveService.folders.test.ts`)
- AppData folder operations (default)
- Custom folder operations
- Folder switching
- Error handling for custom folders

## Usage Examples

### Creating Workspaces

```typescript
import { getWorkspaceRegistry } from './services/workspace/WorkspaceRegistry';

const registry = getWorkspaceRegistry();

// Create personal workspace
const personalWorkspace = registry.createPersonalWorkspace(
  'user-123',
  'profile-456',
  'John Doe'
);

// Create shared workspace
const sharedWorkspace = registry.createSharedWorkspace(
  'Team Project',
  'drive-folder-id-123',
  'owner'
);
```

### Switching Workspaces

```typescript
import { useAppDispatch } from './hooks/redux';
import { switchWorkspace } from './store/slices/unifiedStorageSlice';

const dispatch = useAppDispatch();

// Switch to a workspace
await dispatch(switchWorkspace('workspace-id')).unwrap();

// After switch, components should refetch their data
dispatch(fetchConversations());
dispatch(fetchContexts());
```

### Loading Workspaces

```typescript
import { useAppDispatch, useAppSelector } from './hooks/redux';
import { loadWorkspaces } from './store/slices/unifiedStorageSlice';

const dispatch = useAppDispatch();
const { availableWorkspaces, activeWorkspace } = useAppSelector(
  state => state.unifiedStorage
);

// Load workspaces on mount
useEffect(() => {
  dispatch(loadWorkspaces());
}, [dispatch]);
```

## Future Work

### Immediate Next Steps (UI)
1. **Workspace Selector Component**: Dropdown in app header to switch workspaces
2. **Workspace Management Page**: Settings page to create/manage workspaces
3. **Workspace Initialization**: Auto-create personal workspace on first login (Shoudn't need this, just keep existing behaviour for "personal" workspace)

### Collaboration Features (Phase 2)
Choose one of two approaches:

#### Option A: Service-Managed (Backend Proxy)
- Backend creates/manages shared folders via service account
- Frontend proxies all Drive operations through backend
- Simpler OAuth (no `drive.file` scope needed)
- Centralized access control

#### Option B: User-Owned (`drive.file` scope)
- Users create/share folders directly in Drive
- App requests `drive.file` scope for shared folders
- No backend file proxying
- Native Drive sharing UX

### Additional Features
- Workspace invitations and member management
- Team encryption keys (for shared workspaces)
- Workspace-level settings and permissions
- Cross-workspace search (optional, future enhancement)

## Benefits of This Approach

✅ **Simplicity**: Reuses existing single-adapter architecture
✅ **Speed**: Significantly faster to implement than concurrent multi-workspace
✅ **Clarity**: Clear encryption boundaries (one workspace at a time)
✅ **Testability**: Easier to test and debug
✅ **Extensibility**: Can add concurrent multi-workspace later if needed

## Tradeoffs

❌ Can't view multiple workspaces simultaneously
❌ Switching has latency (~2-5 seconds)
❌ Background sync only works for active workspace
❌ Can't drag-drop between workspaces

These tradeoffs are acceptable for MVP as teams typically focus on one workspace at a time, and the switching pattern is familiar (like Git branches).

