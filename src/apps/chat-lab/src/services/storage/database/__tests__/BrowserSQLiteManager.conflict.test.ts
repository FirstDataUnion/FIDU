/**
 * Tests for BrowserSQLiteManager conflict resolution logic
 * Tests the migrateDataPackets fork-on-conflict functionality
 * 
 * Note: These tests focus on the conflict detection and metadata logic
 * without importing the actual BrowserSQLiteManager (which has import.meta issues in Jest)
 */

// Mock crypto.randomUUID
const mockRandomUUID = jest.fn();
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: mockRandomUUID,
  },
});

/**
 * Pure function implementations extracted from BrowserSQLiteManager
 * for testing without the full module import
 */

function extractTitleFromDataPacket(dataJson: string): string {
  try {
    const data = JSON.parse(dataJson);
    // Handle encrypted data - can't extract title
    if (data.encrypted) {
      return 'Untitled';
    }
    // Try common title fields
    return data.conversationTitle || 
           data.context_title || 
           data.title ||
           data.system_prompt_name || 
           data.name || 
           'Untitled';
  } catch {
    return 'Untitled';
  }
}

function addConflictMetadata(
  dataJson: string, 
  originalId: string, 
  originalTitle: string,
  userName?: string,
  isSharedWorkspace: boolean = true,
  copyNumber: number = 1
): string {
  try {
    const parsedData = JSON.parse(dataJson);
    
    // Handle encrypted data - return as-is (can't modify encrypted content without re-encryption)
    if (parsedData.encrypted) {
      return dataJson;
    }
    
    // Determine the copy label based on workspace type
    const forkedByLabel = userName || 'You';
    const copyLabel = isSharedWorkspace 
      ? `[${forkedByLabel}'s copy]`
      : `(${copyNumber})`;
    
    // Handle unencrypted data
    const data = parsedData;
    
    // Add conflict metadata
    data._conflictMetadata = {
      isConflictCopy: true,
      forkedFrom: originalId,
      originalTitle: originalTitle,
      conflictTimestamp: new Date().toISOString(),
      forkedByUser: forkedByLabel
    };
    
    // Append "[username's copy]" or "(N)" to title fields
    if (data.conversationTitle) {
      data.conversationTitle = isSharedWorkspace 
        ? `${data.conversationTitle} ${copyLabel}`
        : `${data.conversationTitle} ${copyLabel}`;
    }
    if (data.context_title) {
      data.context_title = `${copyLabel} ${data.context_title}`;
    }
    if (data.title) {
      data.title = isSharedWorkspace
        ? `${copyLabel} ${data.title}`
        : `${data.title} ${copyLabel}`;
    }
    if (data.system_prompt_name) {
      data.system_prompt_name = `${copyLabel} ${data.system_prompt_name}`;
    }
    if (data.name) {
      data.name = `${copyLabel} ${data.name}`;
    }
    
    return JSON.stringify(data);
  } catch {
    return dataJson;
  }
}

/**
 * Determine if a conflict exists between local and remote changes
 */
function detectConflict(
  remoteUpdateTimestamp: string,
  localUpdateTimestamp: string,
  lastSyncTimestamp: string | null,
  localSyncStatus?: string
): { isConflict: boolean; shouldUpdate: boolean; shouldSkip: boolean } {
  const hasValidLastSync = !!(lastSyncTimestamp && lastSyncTimestamp !== '');
  const lastSyncTime = hasValidLastSync ? new Date(lastSyncTimestamp).getTime() : 0;
  
  const remoteUpdateTime = new Date(remoteUpdateTimestamp).getTime();
  const localUpdateTime = new Date(localUpdateTimestamp).getTime();
  
  const remoteModifiedSinceSync = hasValidLastSync && remoteUpdateTime > lastSyncTime;
  const localModifiedSinceSync = hasValidLastSync && (localUpdateTime > lastSyncTime || localSyncStatus === 'pending');
  
  // TRUE CONFLICT: Both sides have changes since last sync
  if (hasValidLastSync && remoteModifiedSinceSync && localModifiedSinceSync && remoteUpdateTime !== localUpdateTime) {
    return { isConflict: true, shouldUpdate: true, shouldSkip: false };
  }
  
  // Remote is newer - update local
  if (remoteUpdateTime > localUpdateTime) {
    return { isConflict: false, shouldUpdate: true, shouldSkip: false };
  }
  
  // Local is newer or same - skip
  return { isConflict: false, shouldUpdate: false, shouldSkip: true };
}

describe('BrowserSQLiteManager - Conflict Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let uuidCounter = 0;
    mockRandomUUID.mockImplementation(() => `mock-uuid-${++uuidCounter}`);
  });

  describe('extractTitleFromDataPacket', () => {
    it('should extract conversationTitle', () => {
      const data = JSON.stringify({ conversationTitle: 'My Conversation' });
      const result = extractTitleFromDataPacket(data);
      expect(result).toBe('My Conversation');
    });

    it('should extract context_title', () => {
      const data = JSON.stringify({ context_title: 'My Context' });
      const result = extractTitleFromDataPacket(data);
      expect(result).toBe('My Context');
    });

    it('should extract title field', () => {
      const data = JSON.stringify({ title: 'Generic Title' });
      const result = extractTitleFromDataPacket(data);
      expect(result).toBe('Generic Title');
    });

    it('should extract system_prompt_name', () => {
      const data = JSON.stringify({ system_prompt_name: 'My Prompt' });
      const result = extractTitleFromDataPacket(data);
      expect(result).toBe('My Prompt');
    });

    it('should extract name field', () => {
      const data = JSON.stringify({ name: 'Agent Name' });
      const result = extractTitleFromDataPacket(data);
      expect(result).toBe('Agent Name');
    });

    it('should return Untitled for encrypted data', () => {
      const data = JSON.stringify({ encrypted: true, data: 'xxx' });
      const result = extractTitleFromDataPacket(data);
      expect(result).toBe('Untitled');
    });

    it('should return Untitled for invalid JSON', () => {
      const result = extractTitleFromDataPacket('not-json');
      expect(result).toBe('Untitled');
    });

    it('should return Untitled for data without title fields', () => {
      const data = JSON.stringify({ otherField: 'value' });
      const result = extractTitleFromDataPacket(data);
      expect(result).toBe('Untitled');
    });

    it('should prioritize conversationTitle over other fields', () => {
      const data = JSON.stringify({ 
        conversationTitle: 'Conversation', 
        title: 'Title',
        name: 'Name'
      });
      const result = extractTitleFromDataPacket(data);
      expect(result).toBe('Conversation');
    });
  });

  describe('addConflictMetadata', () => {
    it('should add conflict metadata and rename title for shared workspace', () => {
      const originalData = JSON.stringify({
        conversationTitle: 'Original Title',
        messages: [],
      });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'Original Title',
        'John Doe',
        true, // isSharedWorkspace
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed.conversationTitle).toBe("Original Title [John Doe's copy]");
      expect(parsed._conflictMetadata).toEqual({
        isConflictCopy: true,
        forkedFrom: 'original-id',
        originalTitle: 'Original Title',
        conflictTimestamp: expect.any(String),
        forkedByUser: 'John Doe',
      });
    });

    it('should use numbered suffix for personal workspace', () => {
      const originalData = JSON.stringify({
        conversationTitle: 'Original Title',
        messages: [],
      });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'Original Title',
        'John Doe',
        false, // isSharedWorkspace = false (personal)
        3 // copyNumber
      );

      const parsed = JSON.parse(result);
      expect(parsed.conversationTitle).toBe('Original Title (3)');
    });

    it('should use "You" for unnamed user in shared workspace', () => {
      const originalData = JSON.stringify({
        title: 'My Item',
      });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'My Item',
        undefined, // no userName
        true, // isSharedWorkspace
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed.title).toBe("[You's copy] My Item");
      expect(parsed._conflictMetadata.forkedByUser).toBe('You');
    });

    it('should handle context_title field', () => {
      const originalData = JSON.stringify({
        context_title: 'My Context',
        body: 'Context body',
      });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'My Context',
        'Alice',
        true,
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed.context_title).toBe("[Alice's copy] My Context");
    });

    it('should handle system_prompt_name field', () => {
      const originalData = JSON.stringify({
        system_prompt_name: 'My Prompt',
        content: 'Prompt content',
      });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'My Prompt',
        'Bob',
        true,
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed.system_prompt_name).toBe("[Bob's copy] My Prompt");
    });

    it('should handle name field (background agents)', () => {
      const originalData = JSON.stringify({
        name: 'My Agent',
        config: {},
      });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'My Agent',
        'Carol',
        true,
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("[Carol's copy] My Agent");
    });

    it('should return original data on JSON parse error', () => {
      const invalidData = 'not-valid-json';

      const result = addConflictMetadata(
        invalidData,
        'original-id',
        'Title',
        'User',
        true,
        1
      );

      expect(result).toBe(invalidData);
    });

    it('should not modify encrypted data', () => {
      const encryptedData = JSON.stringify({
        encrypted: true,
        data: 'base64-encrypted-content',
        nonce: 'nonce-value',
      });

      const result = addConflictMetadata(
        encryptedData,
        'original-id',
        'Title',
        'User',
        true,
        1
      );

      expect(result).toBe(encryptedData);
    });
  });

  describe('detectConflict', () => {
    it('should detect conflict when both local and remote modified since last sync', () => {
      const lastSyncTimestamp = '2024-01-15T12:00:00.000Z';
      const localUpdateTimestamp = '2024-01-16T10:00:00.000Z';
      const remoteUpdateTimestamp = '2024-01-16T14:00:00.000Z';

      const result = detectConflict(
        remoteUpdateTimestamp,
        localUpdateTimestamp,
        lastSyncTimestamp
      );

      expect(result.isConflict).toBe(true);
      expect(result.shouldUpdate).toBe(true);
    });

    it('should NOT detect conflict when only remote modified since last sync', () => {
      const lastSyncTimestamp = '2024-01-15T12:00:00.000Z';
      const localUpdateTimestamp = '2024-01-14T10:00:00.000Z'; // Before last sync
      const remoteUpdateTimestamp = '2024-01-16T14:00:00.000Z';

      const result = detectConflict(
        remoteUpdateTimestamp,
        localUpdateTimestamp,
        lastSyncTimestamp
      );

      expect(result.isConflict).toBe(false);
      expect(result.shouldUpdate).toBe(true); // Remote is newer
    });

    it('should skip when only local modified since last sync', () => {
      const lastSyncTimestamp = '2024-01-15T12:00:00.000Z';
      const localUpdateTimestamp = '2024-01-16T10:00:00.000Z';
      const remoteUpdateTimestamp = '2024-01-14T14:00:00.000Z'; // Before last sync

      const result = detectConflict(
        remoteUpdateTimestamp,
        localUpdateTimestamp,
        lastSyncTimestamp
      );

      expect(result.isConflict).toBe(false);
      expect(result.shouldUpdate).toBe(false);
      expect(result.shouldSkip).toBe(true);
    });

    it('should skip when timestamps are equal', () => {
      const lastSyncTimestamp = '2024-01-15T12:00:00.000Z';
      const timestamp = '2024-01-16T14:00:00.000Z';

      const result = detectConflict(
        timestamp,
        timestamp,
        lastSyncTimestamp
      );

      expect(result.isConflict).toBe(false);
      expect(result.shouldSkip).toBe(true);
    });

    it('should NOT detect conflict without valid lastSyncTimestamp', () => {
      const localUpdateTimestamp = '2024-01-16T10:00:00.000Z';
      const remoteUpdateTimestamp = '2024-01-16T14:00:00.000Z';

      const result = detectConflict(
        remoteUpdateTimestamp,
        localUpdateTimestamp,
        null
      );

      // Without lastSyncTimestamp, just compare timestamps directly
      expect(result.isConflict).toBe(false);
      expect(result.shouldUpdate).toBe(true); // Remote is newer
    });

    it('should consider pending sync_status as local modification', () => {
      const lastSyncTimestamp = '2024-01-15T12:00:00.000Z';
      const localUpdateTimestamp = '2024-01-14T10:00:00.000Z'; // Before last sync
      const remoteUpdateTimestamp = '2024-01-16T14:00:00.000Z';

      const result = detectConflict(
        remoteUpdateTimestamp,
        localUpdateTimestamp,
        lastSyncTimestamp,
        'pending' // Local has pending changes
      );

      // Pending status means local was modified, so this IS a conflict
      expect(result.isConflict).toBe(true);
    });

    it('should update when remote is newer and no conflict', () => {
      const lastSyncTimestamp = '2024-01-15T12:00:00.000Z';
      const localUpdateTimestamp = '2024-01-15T11:00:00.000Z'; // Before last sync
      const remoteUpdateTimestamp = '2024-01-16T14:00:00.000Z';

      const result = detectConflict(
        remoteUpdateTimestamp,
        localUpdateTimestamp,
        lastSyncTimestamp,
        'synced'
      );

      expect(result.isConflict).toBe(false);
      expect(result.shouldUpdate).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all original data fields when adding conflict metadata', () => {
      const originalData = JSON.stringify({
        conversationTitle: 'Test',
        messages: [{ id: 'msg-1', content: 'Hello' }],
        platform: 'openai',
        customField: 'preserved',
      });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'Test',
        'User',
        true,
        1
      );

      const parsed = JSON.parse(result);
      
      // All original fields should be preserved
      expect(parsed.messages).toEqual([{ id: 'msg-1', content: 'Hello' }]);
      expect(parsed.platform).toBe('openai');
      expect(parsed.customField).toBe('preserved');
      
      // Plus the conflict metadata
      expect(parsed._conflictMetadata).toBeDefined();
    });

    it('should handle data with no title fields gracefully', () => {
      const originalData = JSON.stringify({
        someData: 'value',
        nestedObject: { key: 'value' },
      });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'Untitled',
        'User',
        true,
        1
      );

      const parsed = JSON.parse(result);
      
      // Original data preserved
      expect(parsed.someData).toBe('value');
      expect(parsed.nestedObject).toEqual({ key: 'value' });
      
      // Conflict metadata added
      expect(parsed._conflictMetadata.isConflictCopy).toBe(true);
    });
  });

  describe('Copy Numbering for Personal Workspaces', () => {
    it('should use incrementing copy numbers', () => {
      const originalData = JSON.stringify({ title: 'Document' });

      const result1 = addConflictMetadata(originalData, 'id-1', 'Document', 'User', false, 1);
      const result2 = addConflictMetadata(originalData, 'id-1', 'Document', 'User', false, 2);
      const result3 = addConflictMetadata(originalData, 'id-1', 'Document', 'User', false, 3);

      expect(JSON.parse(result1).title).toBe('Document (1)');
      expect(JSON.parse(result2).title).toBe('Document (2)');
      expect(JSON.parse(result3).title).toBe('Document (3)');
    });
  });

  describe('User Attribution for Shared Workspaces', () => {
    it('should include user name in shared workspace copies', () => {
      const data = JSON.stringify({ title: 'Shared Doc' });

      const aliceResult = addConflictMetadata(data, 'id-1', 'Shared Doc', 'Alice Smith', true, 1);
      const bobResult = addConflictMetadata(data, 'id-1', 'Shared Doc', 'Bob Jones', true, 1);

      expect(JSON.parse(aliceResult).title).toBe("[Alice Smith's copy] Shared Doc");
      expect(JSON.parse(bobResult).title).toBe("[Bob Jones's copy] Shared Doc");

      expect(JSON.parse(aliceResult)._conflictMetadata.forkedByUser).toBe('Alice Smith');
      expect(JSON.parse(bobResult)._conflictMetadata.forkedByUser).toBe('Bob Jones');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data object', () => {
      const originalData = JSON.stringify({});

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'Untitled',
        'User',
        true,
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed._conflictMetadata).toBeDefined();
      expect(parsed._conflictMetadata.isConflictCopy).toBe(true);
    });

    it('should handle very long title fields', () => {
      const longTitle = 'A'.repeat(1000);
      const originalData = JSON.stringify({ title: longTitle });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        longTitle,
        'User',
        true,
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed.title).toContain("[User's copy]");
      expect(parsed.title).toContain(longTitle);
    });

    it('should handle special characters in user name', () => {
      const originalData = JSON.stringify({ title: 'Test' });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        'Test',
        "O'Brien",
        true,
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed.title).toBe("[O'Brien's copy] Test");
    });

    it('should handle unicode characters in title', () => {
      const originalData = JSON.stringify({ title: '日本語タイトル 🎉' });

      const result = addConflictMetadata(
        originalData,
        'original-id',
        '日本語タイトル 🎉',
        'User',
        true,
        1
      );

      const parsed = JSON.parse(result);
      expect(parsed.title).toBe("[User's copy] 日本語タイトル 🎉");
    });
  });
});
