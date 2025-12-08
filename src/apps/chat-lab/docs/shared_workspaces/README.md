# Shared Workspaces

Shared workspaces enable team collaboration in ChatLab by allowing multiple users to share conversations, contexts, system prompts, and background agents through a shared Google Drive folder.

## Architecture Overview

### Core Concept

ChatLab uses a **"User Owned" model with `drive.file` OAuth scope**:

- **Workspace owner** creates a Google Drive folder and shares it with team members
- **All workspace files** (SQLite databases) are stored in this shared folder
- **Each user's app instance** accesses the shared folder directly (no backend proxy)
- **API keys are excluded** from shared workspaces for security (each user uses their own)

### Workspace Types

| Type | Storage Location | Data Sharing | API Keys |
|------|------------------|--------------|----------|
| **Personal** | Google Drive AppData (hidden) | Private | Synced |
| **Shared** | User-owned Drive folder | Team-wide | NOT synced (local only) |

### Key Design Decisions

1. **Switch-and-Reload Model**: Only one workspace is active at a time. Switching syncs the current workspace, closes connections, and reinitializes with the new workspace.

2. **Virtual Personal Workspace**: Personal workspace is virtual (`activeWorkspaceId = null`). Only shared workspaces are stored in the registry.

3. **Fork-on-Conflict Resolution**: When multiple users edit the same record, conflicts create labeled copies (e.g., `"[Alice's copy] Document Title"`) rather than losing data.

4. **Workspace-Specific Encryption**: Each shared workspace has its own encryption key, wrapped with each member's personal key.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WorkspacesPage                           │
│  (UI for listing, creating, switching workspaces)               │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ WorkspaceCreation   │ │ WorkspaceInvita │ │ WorkspaceRegistry   │
│ Service             │ │ tionService     │ │                     │
│ (creates new shared │ │ (accepts        │ │ (localStorage for   │
│  workspaces)        │ │  invitations)   │ │  workspace metadata)│
└─────────────────────┘ └─────────────────┘ └─────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       StorageService                            │
│  switchWorkspace() → sync → close adapter → reinitialize        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CloudStorageAdapter                          │
│  (one instance per active workspace)                            │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │
│ │ BrowserSQLite   │ │ GoogleDrive     │ │ SyncService         │ │
│ │ Manager         │ │ Service         │ │                     │ │
│ │ (in-memory DB)  │ │ (folder-scoped) │ │ (download-merge-    │ │
│ │                 │ │                 │ │  upload)            │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Key Services

### WorkspaceRegistry
**Location**: `src/services/workspace/WorkspaceRegistry.ts`

Manages workspace metadata in localStorage:
- `getWorkspaces()` - List all registered workspaces
- `setActiveWorkspace(id | null)` - Set active workspace (`null` = personal)
- `createSharedWorkspace()` - Create a new shared workspace entry
- `syncFromAPI()` - Sync workspace list from identity service

### WorkspaceCreationService
**Location**: `src/services/workspace/WorkspaceCreationService.ts`

Orchestrates shared workspace creation:
1. Check `drive.file` OAuth scope
2. Create/select Google Drive folder
3. Register workspace with identity service (validates member emails)
4. Create initial database files in folder
5. Share folder with members via Drive API
6. Switch to new workspace

### WorkspaceInvitationService
**Location**: `src/services/workspace/WorkspaceInvitationService.ts`

Handles invitation acceptance flow:
1. Verify `drive.file` scope
2. Grant app access via Google Picker (required for `drive.file` scope)
3. Accept invitation via identity service
4. Fetch workspace file IDs
5. Create local registry entry
6. Switch to workspace

### SyncService
**Location**: `src/services/storage/sync/SyncService.ts`

Handles synchronization with workspace-specific behavior:
- **Personal workspaces**: Sync both conversations DB and API keys DB
- **Shared workspaces**: Sync only conversations DB (API keys excluded)
- **Download-Merge-Upload**: Downloads remote, merges with local, uploads result
- **Conflict Resolution**: Passes `isSharedWorkspace` and `currentUserName` for proper conflict labeling

### BrowserSQLiteManager
**Location**: `src/services/storage/database/BrowserSQLiteManager.ts`

Key workspace-aware functionality:
- **Encryption**: Uses workspace key for shared workspaces, personal key otherwise
- **Conflict Resolution**: `migrateDataPackets()` implements fork-on-conflict
  - Shared: Creates `"[username's copy] Title"` copies
  - Personal: Creates `"Title (1)"`, `"Title (2)"` copies
- **Data Filtering**: Skips user_id/profile_id filtering for shared workspaces

### EncryptionService
**Location**: `src/services/encryption/EncryptionService.ts`

Workspace encryption key management:
- `getWorkspaceEncryptionKey()` - Fetch and unwrap workspace key
- `unwrapKey()` - Decrypt workspace key using personal key
- Keys cached in memory with 10-minute TTL
- Cache cleared on workspace switch

## Data Filtering

### Personal Workspaces
- Filters by `user_id` AND `profile_id`
- Users see only their own data
- Supports multiple profiles

### Shared Workspaces
- **No filtering** by user_id or profile_id
- All team members see all data
- Uses workspace-level profile ID: `workspace-{id}-default`
- Still stores `user_id` for attribution (who created what)

## Google Drive Permissions

### OAuth Scopes Required
- `drive.appdata` - Access hidden AppData folder (personal workspace)
- `drive.file` - Access files explicitly granted via Picker (shared workspaces)
- `userinfo.email` - Get user's email

### Why `drive.file` Scope?
- **Security**: App only accesses files user explicitly grants
- **User Control**: Users can see exactly what the app accesses
- **No Full Access**: Unlike `drive`, doesn't access all user files

### Picker Requirement
With `drive.file` scope, the app cannot access shared folders automatically. Users must:
1. Accept the Drive folder share (from Google Drive)
2. Select the folder in Google Picker (grants app permission)

## Conflict Resolution

### Detection
A conflict occurs when both local and remote have changed since last sync:
- Compares `update_timestamp` against `lastSyncTimestamp`
- Also considers `sync_status = 'pending'` as local modification

### Resolution Strategy: Fork-on-Conflict
1. **Create copy** of local version with conflict label
2. **Update original** with remote version
3. **User decides** which version to keep

### Conflict Labels
- **Shared workspaces**: `"[Alice's copy] Document Title"`
- **Personal workspaces**: `"Document Title (1)"`, `"Document Title (2)"`

### Metadata Added to Copies
```json
{
  "_conflictMetadata": {
    "isConflictCopy": true,
    "forkedFrom": "original-record-id",
    "originalTitle": "Document Title",
    "conflictTimestamp": "2024-01-15T12:00:00Z",
    "forkedByUser": "alice"
  }
}
```

## Security Considerations

### API Keys
- **Never synced** in shared workspaces
- Each user maintains their own API keys locally
- Prevents accidental key sharing

### Encryption Keys
- Each workspace has its own AES-256-GCM key
- Key is wrapped (encrypted) with each member's personal key
- Server handles key generation and wrapping
- Unwrapped keys cached in memory only (never persisted)

### Member Validation
- Identity service validates all members before workspace creation
- Members must have connected Google Drive accounts
- Google emails are verified for Drive sharing

## Files

### Database Files (Per Workspace)
| File | Purpose | Shared Workspaces |
|------|---------|-------------------|
| `fidu_conversations_v1.db` | Conversations, contexts, prompts, agents | ✅ Synced |
| `workspace-metadata.json` | Workspace metadata | ✅ Synced |
| `fidu_api_keys_v1.db` | API keys | ❌ NOT synced |

### Constants
File name constants are defined in `src/constants/workspaceFiles.ts`.

## Testing

### Test Files
| File | Coverage |
|------|----------|
| `WorkspaceRegistry.test.ts` | Registry CRUD, persistence |
| `WorkspaceSwitching.test.ts` | StorageService switching |
| `WorkspaceCreationService.test.ts` | Validation, progress, errors |
| `WorkspaceInvitationService.test.ts` | Invitation flow |
| `SyncService.test.ts` | Sync behavior for personal/shared |
| `BrowserSQLiteManager.conflict.test.ts` | Conflict resolution |

### Running Tests
```bash
cd src/apps/chat-lab
npx jest --testPathPattern="workspace|conflict" --no-coverage
```

## Extending the Feature

### Adding New Data Types
1. Add to `data_packets` table with appropriate tags
2. Update `CloudStorageAdapter` methods to handle workspace filtering
3. Ensure encryption uses `getWorkspaceIdForEncryption()`

### Adding Member Management
- `addMembers()` and `removeMember()` APIs exist
- Need UI in `ManageMembersDialog.tsx`
- Handle Drive permission updates when removing members

### Adding Key Rotation
- Server supports `rotateEncryptionKey()` API
- Need UI for workspace owners
- Must re-encrypt all data with new key

## Known Limitations

1. **No offline support** for shared workspaces (requires sync)
2. **No real-time collaboration** (sync-based, not live)
3. **Picker required** for each device accepting invitations
4. **Single active workspace** (can't view multiple simultaneously)

