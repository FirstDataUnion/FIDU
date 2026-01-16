/**
 * Browser SQLite Database Manager
 * Manages SQLite databases in browser memory using sql.js
 */

import initSqlJs from 'sql.js';
import { encryptionService } from '../../encryption';

export interface DatabaseConfig {
  conversationsDbName: string;
  apiKeysDbName: string;
  enableEncryption?: boolean;
  workspaceId?: string;
  workspaceType?: 'personal' | 'shared';
}

export interface DataPacketRow {
  id: string;
  create_request_id: string;
  profile_id: string;
  user_id: string;
  create_timestamp: string;
  update_timestamp: string;
  tags: string; // JSON string
  data: string; // JSON string
  sync_status?: 'pending' | 'synced' | 'conflict'; // For granular change tracking
}

export interface DataPacketTagRow {
  data_packet_id: string;
  tag: string;
}

export interface DataPacketUpdateRow {
  request_id: string;
  data_packet_id: string;
  update_timestamp: string;
}

export interface APIKeyRow {
  id: string;
  provider: string;
  api_key: string;
  user_id: string;
  create_timestamp: string;
  update_timestamp: string;
  sync_status?: 'pending' | 'synced' | 'conflict'; // For granular change tracking
}

export class BrowserSQLiteManager {
  private SQL: any = null;
  private conversationsDb: any = null;
  private apiKeysDb: any = null;
  private initialized = false;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    // Config will be used for database names in future implementations
  }

  /**
   * Get workspace ID if this is a shared workspace, otherwise undefined
   * Used to determine which encryption key to use (workspace key vs personal key)
   * @returns string | undefined - Workspace ID if shared workspace, undefined otherwise
   */
  private getWorkspaceIdForEncryption(): string | undefined {
    if (this.config.workspaceType === 'shared' && this.config.workspaceId) {
      return this.config.workspaceId;
    }
    return undefined;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        throw new Error(
          'BrowserSQLiteManager can only be used in browser environment'
        );
      }

      // Initialize sql.js from local files (served from /public)
      // Vite's BASE_URL is configured in vite.config.ts (e.g., /fidu-chat-lab/)
      const basePath = import.meta.env.BASE_URL || '/';

      this.SQL = await initSqlJs({
        locateFile: (file: string) => {
          // WASM files are served from public directory
          return `${basePath}${file}`;
        },
      });

      // Create databases
      this.conversationsDb = new this.SQL.Database();
      this.apiKeysDb = new this.SQL.Database();

      // Initialize schemas
      await this.initializeConversationsSchema();
      await this.initializeAPIKeysSchema();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize browser SQLite databases:', error);
      throw error;
    }
  }

  private async initializeConversationsSchema(): Promise<void> {
    // Create data_packets table
    this.conversationsDb.exec(`
      CREATE TABLE IF NOT EXISTS data_packets (
        id TEXT PRIMARY KEY,
        create_request_id TEXT UNIQUE NOT NULL,
        profile_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        create_timestamp TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        tags TEXT,
        data TEXT NOT NULL,
        sync_status TEXT DEFAULT 'synced'
      )
    `);

    // Create data_packet_tags table for efficient tag querying
    this.conversationsDb.exec(`
      CREATE TABLE IF NOT EXISTS data_packet_tags (
        data_packet_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (data_packet_id, tag),
        FOREIGN KEY (data_packet_id) REFERENCES data_packets (id) ON DELETE CASCADE
      )
    `);

    // Create data_packet_updates table for idempotency tracking
    this.conversationsDb.exec(`
      CREATE TABLE IF NOT EXISTS data_packet_updates (
        request_id TEXT PRIMARY KEY,
        data_packet_id TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        FOREIGN KEY (data_packet_id) REFERENCES data_packets (id) ON DELETE CASCADE
      )
    `);

    // Create tombstones table to track deleted data packets
    // No foreign key constraint - the tombstone marks deleted resources that no longer exist in data_packets table
    this.conversationsDb.exec(`
      CREATE TABLE IF NOT EXISTS tombstones (
        data_packet_id TEXT PRIMARY KEY,
        deleted_at TEXT NOT NULL
      )
    `);

    // Create indexes for efficient querying
    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packets_profile_id
      ON data_packets(profile_id)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packets_create_timestamp
      ON data_packets(create_timestamp)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packets_update_timestamp
      ON data_packets(update_timestamp)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packet_tags_tag
      ON data_packet_tags(tag)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packet_tags_packet_id
      ON data_packet_tags(data_packet_id)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packet_updates_request_id
      ON data_packet_updates(request_id)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packets_sync_status
      ON data_packets(sync_status)
    `);
  }

  /**
   * Mark all imported data packets as synced (since they came from cloud)
   */
  private async markImportedDataPacketsAsSynced(): Promise<void> {
    const stmt = this.conversationsDb.prepare(`
      UPDATE data_packets SET sync_status = 'synced' WHERE sync_status = 'pending'
    `);

    const result = stmt.run();
    if (result.changes > 0) {
      console.log(
        `🔧 [BrowserSQLiteManager] Marked ${result.changes} imported data packets as synced`
      );
    }

    stmt.free();
  }

  /**
   * Ensure schema exists without affecting existing data (for imported databases)
   */
  private async ensureConversationsSchema(): Promise<void> {
    // Only create tables if they don't exist - this won't affect existing data
    this.conversationsDb.exec(`
      CREATE TABLE IF NOT EXISTS data_packets (
        id TEXT PRIMARY KEY,
        create_request_id TEXT UNIQUE NOT NULL,
        profile_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        create_timestamp TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        tags TEXT,
        data TEXT NOT NULL,
        sync_status TEXT DEFAULT 'synced'
      )
    `);

    this.conversationsDb.exec(`
      CREATE TABLE IF NOT EXISTS data_packet_tags (
        data_packet_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (data_packet_id, tag),
        FOREIGN KEY (data_packet_id) REFERENCES data_packets (id) ON DELETE CASCADE
      )
    `);

    this.conversationsDb.exec(`
      CREATE TABLE IF NOT EXISTS data_packet_updates (
        request_id TEXT PRIMARY KEY,
        data_packet_id TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        FOREIGN KEY (data_packet_id) REFERENCES data_packets (id) ON DELETE CASCADE
      )
    `);

    this.conversationsDb.exec(`
      CREATE TABLE IF NOT EXISTS tombstones (
        data_packet_id TEXT PRIMARY KEY,
        deleted_at TEXT NOT NULL
      )
    `);

    // Create indexes if they don't exist
    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packets_profile_id
      ON data_packets(profile_id)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packets_create_timestamp
      ON data_packets(create_timestamp)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packets_update_timestamp
      ON data_packets(update_timestamp)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packet_tags_tag
      ON data_packet_tags(tag)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packet_tags_packet_id
      ON data_packet_tags(data_packet_id)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packet_updates_request_id
      ON data_packet_updates(request_id)
    `);

    this.conversationsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_data_packets_sync_status
      ON data_packets(sync_status)
    `);
  }

  private async initializeAPIKeysSchema(): Promise<void> {
    // Create api_keys table
    this.apiKeysDb.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        api_key TEXT NOT NULL,
        user_id TEXT NOT NULL,
        create_timestamp TEXT NOT NULL,
        update_timestamp TEXT NOT NULL,
        sync_status TEXT DEFAULT 'synced',
        UNIQUE(provider, user_id)
      )
    `);
  }

  // Data Packet Operations
  async storeDataPacket(requestId: string, dataPacket: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    // Validate that dataPacket has a valid ID
    if (
      !dataPacket.id
      || typeof dataPacket.id !== 'string'
      || dataPacket.id.trim() === ''
    ) {
      throw new Error(
        `Invalid data packet ID: ${dataPacket.id}. Data packets must have a valid string ID.`
      );
    }

    const stmt = this.conversationsDb.prepare(`
      INSERT INTO data_packets (
        id, create_request_id, profile_id, user_id, create_timestamp, update_timestamp, tags, data, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Encrypt data if encryption is enabled
    let dataToStore: string;
    if (this.config.enableEncryption) {
      try {
        // Use workspace key for shared workspaces, personal key otherwise
        const workspaceId = this.getWorkspaceIdForEncryption();
        const encryptedResult = await encryptionService.encryptData(
          dataPacket.data || {},
          dataPacket.user_id,
          workspaceId
        );
        dataToStore = JSON.stringify({
          encrypted: true,
          data: encryptedResult.encryptedData,
          nonce: encryptedResult.nonce,
          tag: encryptedResult.tag,
        });
      } catch (error) {
        console.error('Failed to encrypt data packet:', error);
        throw new Error('Failed to encrypt data. Please try again.');
      }
    } else {
      dataToStore = JSON.stringify(dataPacket.data || {});
    }

    const tagsToStore = JSON.stringify(dataPacket.tags || []);

    // Helper to convert undefined to null for SQLite compatibility
    const nullIfUndefined = (value: any): any =>
      value === undefined ? null : value;

    try {
      stmt.run([
        dataPacket.id,
        requestId || null,
        nullIfUndefined(dataPacket.profile_id),
        nullIfUndefined(dataPacket.user_id),
        nullIfUndefined(dataPacket.create_timestamp),
        nullIfUndefined(dataPacket.update_timestamp),
        tagsToStore,
        dataToStore,
        'pending', // Mark as pending sync
      ]);

      // Sync tags to junction table
      if (dataPacket.tags && dataPacket.tags.length > 0) {
        await this.syncTagsToJunctionTable(dataPacket.id, dataPacket.tags);
      }

      return dataPacket;
    } catch (error) {
      console.error('Error storing packet:', error);
      // Handle idempotent requests (duplicate request_id)
      if (
        error instanceof Error
        && error.message.includes('UNIQUE constraint failed')
        && error.message.includes('create_request_id')
      ) {
        // Fetch existing packet
        return await this.getDataPacketByRequestId(requestId);
      }
      throw error;
    } finally {
      stmt.free();
    }
  }

  async updateDataPacket(requestId: string, dataPacket: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    // Validate that dataPacket has a valid ID
    if (
      !dataPacket.id
      || typeof dataPacket.id !== 'string'
      || dataPacket.id.trim() === ''
    ) {
      throw new Error(
        `Invalid data packet ID: ${dataPacket.id}. Data packets must have a valid string ID.`
      );
    }

    // Check if request already processed
    const updateCheck = this.conversationsDb.prepare(`
      SELECT * FROM data_packet_updates WHERE request_id = ?
    `);
    const existingUpdate = updateCheck.get([requestId]);
    updateCheck.free();

    // Check if existingUpdate actually has valid data (not just an empty object)
    const hasValidExistingUpdate =
      existingUpdate
      && existingUpdate.request_id
      && existingUpdate.data_packet_id
      && existingUpdate.update_timestamp;

    if (hasValidExistingUpdate) {
      // Request already processed, return existing packet
      return await this.getDataPacketById(dataPacket.id);
    }

    // Helper to convert undefined to null for SQLite compatibility
    const nullIfUndefined = (value: any): any =>
      value === undefined ? null : value;

    // Build update query dynamically
    const updateFields = ['update_timestamp = ?', 'sync_status = ?'];
    const params = [
      nullIfUndefined(dataPacket.update_timestamp) || new Date().toISOString(),
      'pending',
    ];

    if (dataPacket.tags !== undefined) {
      updateFields.push('tags = ?');
      params.push(JSON.stringify(dataPacket.tags));
    }

    if (dataPacket.data !== undefined) {
      updateFields.push('data = ?');
      // Encrypt data if encryption is enabled
      if (this.config.enableEncryption) {
        try {
          // Use workspace key for shared workspaces, personal key otherwise
          const workspaceId = this.getWorkspaceIdForEncryption();
          const encryptedResult = await encryptionService.encryptData(
            dataPacket.data,
            dataPacket.user_id,
            workspaceId
          );
          params.push(
            JSON.stringify({
              encrypted: true,
              data: encryptedResult.encryptedData,
              nonce: encryptedResult.nonce,
              tag: encryptedResult.tag,
            })
          );
        } catch (error) {
          console.error('Failed to encrypt data packet during update:', error);
          throw new Error('Failed to encrypt data. Please try again.');
        }
      } else {
        params.push(JSON.stringify(dataPacket.data));
      }
    }

    params.push(dataPacket.id);

    const updateStmt = this.conversationsDb.prepare(`
      UPDATE data_packets SET ${updateFields.join(', ')} WHERE id = ?
    `);

    try {
      const result = updateStmt.run(params);

      if (result.changes === 0) {
        throw new Error(`Data packet with ID ${dataPacket.id} not found`);
      }

      // Record the update
      const updateRecordStmt = this.conversationsDb.prepare(`
        INSERT INTO data_packet_updates (request_id, data_packet_id, update_timestamp)
        VALUES (?, ?, ?)
      `);

      // Ensure all values are defined before binding - convert undefined to null for SQLite
      updateRecordStmt.run([
        nullIfUndefined(requestId),
        nullIfUndefined(dataPacket.id),
        nullIfUndefined(dataPacket.update_timestamp)
          || new Date().toISOString(),
      ]);
      updateRecordStmt.free();

      // Sync tags if provided
      if (dataPacket.tags !== undefined) {
        if (dataPacket.tags.length > 0) {
          await this.syncTagsToJunctionTable(dataPacket.id, dataPacket.tags);
        } else {
          // Remove all tags
          const deleteTagsStmt = this.conversationsDb.prepare(`
            DELETE FROM data_packet_tags WHERE data_packet_id = ?
          `);
          deleteTagsStmt.run([dataPacket.id]);
          deleteTagsStmt.free();
        }
      }

      return await this.getDataPacketById(dataPacket.id);
    } finally {
      updateStmt.free();
    }
  }

  async getDataPacketById(id: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.conversationsDb.prepare(`
      SELECT * FROM data_packets WHERE id = ?
    `);

    try {
      const rawRow = stmt.get([id]);
      if (!rawRow) {
        throw new Error(`Data packet with ID ${id} not found`);
      }

      // Convert array to object with proper field names
      const rowObject = {
        id: rawRow[0],
        create_request_id: rawRow[1],
        profile_id: rawRow[2],
        user_id: rawRow[3],
        create_timestamp: rawRow[4],
        update_timestamp: rawRow[5],
        tags: rawRow[6],
        data: rawRow[7],
      };

      return await this.rowToDataPacket(rowObject);
    } finally {
      stmt.free();
    }
  }

  async getDataPacketByRequestId(requestId: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.conversationsDb.prepare(`
      SELECT * FROM data_packets WHERE create_request_id = ?
    `);

    try {
      const rawRow = stmt.get([requestId]);
      console.log(
        '🔍 [BrowserSQLiteManager] getDataPacketByRequestId raw row:',
        {
          requestId,
          rawRow,
          type: typeof rawRow,
          isArray: Array.isArray(rawRow),
        }
      );

      if (!rawRow) {
        throw new Error(`Data packet with request ID ${requestId} not found`);
      }

      // Convert array to object with proper field names
      const rowObject = {
        id: rawRow[0],
        create_request_id: rawRow[1],
        profile_id: rawRow[2],
        user_id: rawRow[3],
        create_timestamp: rawRow[4],
        update_timestamp: rawRow[5],
        tags: rawRow[6],
        data: rawRow[7],
      };

      console.log(
        '🔍 [BrowserSQLiteManager] getDataPacketByRequestId mapped object:',
        rowObject
      );

      const convertedPacket = await this.rowToDataPacket(rowObject);
      console.log(
        '🔍 [BrowserSQLiteManager] Converted packet:',
        convertedPacket
      );
      return convertedPacket;
    } finally {
      stmt.free();
    }
  }

  async listDataPackets(queryParams: any): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    // Build query dynamically
    let query = 'SELECT DISTINCT dp.* FROM data_packets dp';
    const params: any[] = [];

    // Add JOIN for tag filtering
    if (queryParams.tags && queryParams.tags.length > 0) {
      query += ' JOIN data_packet_tags dpt ON dp.id = dpt.data_packet_id';
    }

    // Add WHERE conditions
    const conditions: string[] = [];

    // Only filter by user_id if provided (personal workspaces)
    if (queryParams.user_id) {
      conditions.push('dp.user_id = ?');
      params.push(queryParams.user_id);
    }

    // Only filter by profile_id if provided (personal workspaces)
    if (queryParams.profile_id) {
      conditions.push('dp.profile_id = ?');
      params.push(queryParams.profile_id);
    }

    if (queryParams.from_timestamp) {
      conditions.push('dp.create_timestamp >= ?');
      params.push(queryParams.from_timestamp);
    }

    if (queryParams.to_timestamp) {
      conditions.push('dp.create_timestamp <= ?');
      params.push(queryParams.to_timestamp);
    }

    if (queryParams.tags && queryParams.tags.length > 0) {
      for (const tag of queryParams.tags) {
        conditions.push(
          'dp.id IN (SELECT data_packet_id FROM data_packet_tags WHERE tag = ?)'
        );
        params.push(tag);
      }
    }

    // Only add WHERE clause if we have conditions
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Add sorting
    const sortOrder = queryParams.sort_order === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY dp.create_timestamp ${sortOrder}`;

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(queryParams.limit || 50);
    params.push(queryParams.offset || 0);

    const stmt = this.conversationsDb.prepare(query);

    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        const rawRow = stmt.get();

        const rowObject = {
          id: rawRow[0],
          create_request_id: rawRow[1],
          profile_id: rawRow[2],
          user_id: rawRow[3],
          create_timestamp: rawRow[4],
          update_timestamp: rawRow[5],
          tags: rawRow[6],
          data: rawRow[7],
        };
        rows.push(rowObject);
      }
      return await Promise.all(
        rows.map((row: any) => this.rowToDataPacket(row))
      );
    } finally {
      stmt.free();
    }
  }

  async deleteDataPacket(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const deleteStmt = this.conversationsDb.prepare(`
      DELETE FROM data_packets WHERE id = ?
    `);

    try {
      const result = deleteStmt.run([id]);
      if (result.changes === 0) {
        throw new Error(`Data packet with ID ${id} not found`);
      }

      // After deleting the data packet, insert a tombstone record
      const tombstoneStmt = this.conversationsDb.prepare(`
        INSERT OR REPLACE INTO tombstones (data_packet_id, deleted_at)
        VALUES (?, ?)
      `);

      try {
        const deletedAt = new Date().toISOString();
        tombstoneStmt.run([id, deletedAt]);
      } finally {
        tombstoneStmt.free();
      }
    } finally {
      deleteStmt.free();
    }
  }

  // API Key Operations
  async storeAPIKey(apiKey: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.apiKeysDb.prepare(`
      INSERT INTO api_keys (id, provider, api_key, user_id, create_timestamp, update_timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Encrypt API key if encryption is enabled
    let encryptedApiKey: string;
    if (this.config.enableEncryption) {
      try {
        const encryptedResult = await encryptionService.encryptData(
          apiKey.api_key,
          apiKey.user_id
        );
        encryptedApiKey = JSON.stringify({
          encrypted: true,
          data: encryptedResult.encryptedData,
          nonce: encryptedResult.nonce,
          tag: encryptedResult.tag,
        });
      } catch (error) {
        console.error('Failed to encrypt API key:', error);
        throw new Error('Failed to encrypt API key. Please try again.');
      }
    } else {
      encryptedApiKey = apiKey.api_key;
    }

    try {
      stmt.run([
        apiKey.id,
        apiKey.provider,
        encryptedApiKey,
        apiKey.user_id,
        apiKey.create_timestamp,
        apiKey.update_timestamp,
      ]);

      return apiKey;
    } catch (error) {
      if (
        error instanceof Error
        && error.message.includes('UNIQUE constraint failed')
      ) {
        throw new Error(
          `API key already exists for provider ${apiKey.provider} and user ${apiKey.user_id}`
        );
      }
      throw error;
    } finally {
      stmt.free();
    }
  }

  async getAPIKeyByProvider(
    provider: string,
    userId: string
  ): Promise<any | null> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.apiKeysDb.prepare(`
      SELECT * FROM api_keys WHERE provider = ? AND user_id = ?
    `);

    try {
      const rawRow = stmt.get([provider, userId]);
      console.log(
        '🔍 [BrowserSQLiteManager] getAPIKeyByProvider raw row:',
        rawRow
      );

      // Check if no row was found (can be null, undefined, or empty array)
      if (!rawRow || (Array.isArray(rawRow) && rawRow.length === 0)) {
        console.log(
          '🔍 [BrowserSQLiteManager] No API key found for provider:',
          provider
        );
        return null;
      }

      // Convert array to object with proper field names
      // Column order: id, provider, api_key, user_id, create_timestamp, update_timestamp
      const rowObject = {
        id: rawRow[0],
        provider: rawRow[1],
        api_key: rawRow[2],
        user_id: rawRow[3],
        create_timestamp: rawRow[4],
        update_timestamp: rawRow[5],
      };

      console.log(
        '🔍 [BrowserSQLiteManager] getAPIKeyByProvider mapped object:',
        rowObject
      );
      return await this.rowToAPIKey(rowObject);
    } finally {
      stmt.free();
    }
  }

  async getAllAPIKeys(userId: string): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.apiKeysDb.prepare(`
      SELECT * FROM api_keys WHERE user_id = ? ORDER BY create_timestamp DESC
    `);

    try {
      stmt.bind([userId]);
      const rows = [];
      while (stmt.step()) {
        const rawRow = stmt.get();
        // Convert array to object with proper field names
        // Column order: id, provider, api_key, user_id, create_timestamp, update_timestamp
        const rowObject = {
          id: rawRow[0],
          provider: rawRow[1],
          api_key: rawRow[2],
          user_id: rawRow[3],
          create_timestamp: rawRow[4],
          update_timestamp: rawRow[5],
        };
        rows.push(rowObject);
      }
      console.log('🔍 [BrowserSQLiteManager] getAllAPIKeys mapped rows:', rows);
      return await Promise.all(rows.map((row: any) => this.rowToAPIKey(row)));
    } finally {
      stmt.free();
    }
  }

  async updateAPIKey(id: string, apiKey: string, userId: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    // Encrypt API key if encryption is enabled
    let encryptedApiKey: string;
    if (this.config.enableEncryption) {
      try {
        const encryptedResult = await encryptionService.encryptData(
          apiKey,
          userId
        );
        encryptedApiKey = JSON.stringify({
          encrypted: true,
          data: encryptedResult.encryptedData,
          nonce: encryptedResult.nonce,
          tag: encryptedResult.tag,
        });
      } catch (error) {
        console.error('Failed to encrypt API key:', error);
        throw new Error('Failed to encrypt API key. Please try again.');
      }
    } else {
      encryptedApiKey = apiKey;
    }

    const stmt = this.apiKeysDb.prepare(`
      UPDATE api_keys 
      SET api_key = ?, update_timestamp = ?, sync_status = 'pending'
      WHERE id = ?
    `);

    try {
      const updateTimestamp = new Date().toISOString();
      const result = stmt.run([encryptedApiKey, updateTimestamp, id]);
      if (result.changes === 0) {
        throw new Error(`API key with ID ${id} not found`);
      }

      // Return the updated API key
      return await this.getAPIKeyById(id);
    } finally {
      stmt.free();
    }
  }

  async getAPIKeyById(id: string): Promise<any | null> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.apiKeysDb.prepare(`
      SELECT * FROM api_keys WHERE id = ?
    `);

    try {
      const rawRow = stmt.get([id]);

      // Check if no row was found (can be null, undefined, or empty array)
      if (!rawRow || (Array.isArray(rawRow) && rawRow.length === 0)) {
        return null;
      }

      // Convert array to object with proper field names
      const rowObject = {
        id: rawRow[0],
        provider: rawRow[1],
        api_key: rawRow[2],
        user_id: rawRow[3],
        create_timestamp: rawRow[4],
        update_timestamp: rawRow[5],
      };

      return await this.rowToAPIKey(rowObject);
    } finally {
      stmt.free();
    }
  }

  async deleteAPIKey(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.apiKeysDb.prepare(`
      DELETE FROM api_keys WHERE id = ?
    `);

    try {
      const result = stmt.run([id]);
      if (result.changes === 0) {
        throw new Error(`API key with ID ${id} not found`);
      }
    } finally {
      stmt.free();
    }
  }

  // Helper methods
  private async syncTagsToJunctionTable(
    dataPacketId: string,
    tags: string[]
  ): Promise<void> {
    // Remove existing tags
    const deleteStmt = this.conversationsDb.prepare(`
      DELETE FROM data_packet_tags WHERE data_packet_id = ?
    `);
    deleteStmt.run([dataPacketId]);
    deleteStmt.free();

    // Insert new tags
    if (tags.length > 0) {
      const insertStmt = this.conversationsDb.prepare(`
        INSERT INTO data_packet_tags (data_packet_id, tag) VALUES (?, ?)
      `);

      for (const tag of tags) {
        insertStmt.run([dataPacketId, tag]);
      }

      insertStmt.free();
    }
  }

  private async rowToDataPacket(row: any): Promise<any> {
    // Handle both object format and array format from database
    let id, profile_id, user_id, create_timestamp, update_timestamp, tags, data;

    if (Array.isArray(row)) {
      // Array format: [id, profile_id, user_id, create_timestamp, update_timestamp, tags, data]
      [
        id,
        profile_id,
        user_id,
        create_timestamp,
        update_timestamp,
        tags,
        data,
      ] = row;
    } else {
      // Object format: {id: ..., profile_id: ..., ...}
      ({
        id,
        profile_id,
        user_id,
        create_timestamp,
        update_timestamp,
        tags,
        data,
      } = row);
    }

    let parsedTags = [];
    let parsedData = {};

    // Parse tags
    try {
      if (tags && typeof tags === 'string') {
        parsedTags = JSON.parse(tags);
      } else if (Array.isArray(tags)) {
        parsedTags = tags;
      }
    } catch (error) {
      console.warn('Failed to parse tags from row:', error);
      parsedTags = [];
    }

    // Parse data
    try {
      if (data && typeof data === 'string') {
        parsedData = JSON.parse(data);
      } else if (data) {
        parsedData = data;
      }

      // Decrypt data if encryption is enabled and data is encrypted
      if (
        this.config.enableEncryption
        && parsedData
        && typeof parsedData === 'object'
        && 'encrypted' in parsedData
        && parsedData.encrypted
      ) {
        try {
          const encryptedData = parsedData as {
            encrypted: boolean;
            data: string;
            nonce: string;
            tag: string;
          };
          // Use workspace key for shared workspaces, personal key otherwise
          const workspaceId = this.getWorkspaceIdForEncryption();
          const decryptedResult = await encryptionService.decryptData(
            encryptedData.data,
            encryptedData.nonce,
            encryptedData.tag,
            user_id,
            workspaceId
          );
          parsedData = decryptedResult.decryptedData;
        } catch (error) {
          console.error('Failed to decrypt data packet:', error);
          // Return empty data rather than throwing to prevent breaking the app
          parsedData = {};
        }
      }
    } catch (error) {
      console.warn('Failed to parse data from row:', error);
      parsedData = {};
    }

    return {
      id,
      profile_id,
      user_id,
      create_timestamp,
      update_timestamp,
      tags: parsedTags || [],
      data: parsedData || {},
    };
  }

  private async rowToAPIKey(row: any): Promise<any> {
    // Handle both object format and array format from database
    let id, provider, api_key, user_id, create_timestamp, update_timestamp;

    if (Array.isArray(row)) {
      // Array format: [id, provider, api_key, user_id, create_timestamp, update_timestamp]
      [id, provider, api_key, user_id, create_timestamp, update_timestamp] =
        row;
    } else {
      // Object format: {id: ..., provider: ..., ...}
      ({ id, provider, api_key, user_id, create_timestamp, update_timestamp } =
        row);
    }

    // Decrypt API key if encryption is enabled and key is encrypted
    let decryptedApiKey = api_key;
    if (
      this.config.enableEncryption
      && api_key
      && typeof api_key === 'string'
    ) {
      try {
        const parsedKey = JSON.parse(api_key);
        if (parsedKey && typeof parsedKey === 'object' && parsedKey.encrypted) {
          console.log(
            `🔓 [BrowserSQLiteManager] Decrypting API key for provider: ${provider}`
          );
          const decryptedResult = await encryptionService.decryptData(
            parsedKey.data,
            parsedKey.nonce,
            parsedKey.tag,
            user_id
          );
          decryptedApiKey = decryptedResult.decryptedData;
          const keyPreview = decryptedApiKey.substring(0, 10) + '...';
          console.log(
            `🔓 [BrowserSQLiteManager] API key decrypted successfully for ${provider}, preview: ${keyPreview}`
          );
        } else {
          console.log(
            `🔓 [BrowserSQLiteManager] API key for ${provider} is not encrypted, using as-is`
          );
        }
      } catch (error) {
        console.error(
          `❌ [BrowserSQLiteManager] Failed to decrypt API key for ${provider}:`,
          error
        );
        // Return empty string rather than throwing to prevent breaking the app
        decryptedApiKey = '';
      }
    } else {
      console.log(
        `🔓 [BrowserSQLiteManager] Encryption disabled or no key to decrypt for ${provider}`
      );
    }

    return {
      id,
      provider,
      api_key: decryptedApiKey,
      user_id,
      create_timestamp,
      update_timestamp,
    };
  }

  // Database export/import for sync
  async exportConversationsDB(): Promise<Uint8Array> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const exported = this.conversationsDb.export();
    // Ensure we always return a Uint8Array, even if database is empty
    if (!exported) {
      console.warn(
        'Conversations database export returned undefined, returning empty Uint8Array'
      );
      return new Uint8Array(0);
    }
    return exported;
  }

  async exportAPIKeysDB(): Promise<Uint8Array> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const exported = this.apiKeysDb.export();
    // Ensure we always return a Uint8Array, even if database is empty
    if (!exported) {
      console.warn(
        'API keys database export returned undefined, returning empty Uint8Array'
      );
      return new Uint8Array(0);
    }
    return exported;
  }

  /**
   * Extract a display title from data packet for naming conflict copies
   */
  private extractTitleFromDataPacket(dataJson: string): string {
    try {
      const data = JSON.parse(dataJson);
      // Handle encrypted data - can't extract title
      if (data.encrypted) {
        return 'Untitled';
      }
      // Try common title fields
      return (
        data.conversationTitle
        || data.context_title
        || data.title
        || data.system_prompt_name
        || data.name
        || 'Untitled'
      );
    } catch {
      return 'Untitled';
    }
  }

  /**
   * Generate a new UUID for forked records
   */
  private generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Add conflict metadata to a data packet's data field
   * Handles both encrypted and unencrypted data
   * @param userName - Name of the user whose local copy is being forked (for clear labeling in shared workspaces)
   * @param userId - User ID needed for re-encryption of encrypted data
   * @param isSharedWorkspace - If true, use "[username's copy]", otherwise use numbered suffix "(1)", "(2)", etc.
   * @param copyNumber - For personal workspaces, the number to use in the suffix
   */
  private async addConflictMetadata(
    dataJson: string,
    originalId: string,
    originalTitle: string,
    userName?: string,
    userId?: string,
    isSharedWorkspace: boolean = true,
    copyNumber: number = 1
  ): Promise<string> {
    try {
      const parsedData = JSON.parse(dataJson);

      // Create copy label - use username for shared workspaces, numbers for personal
      let copyLabel: string;
      let forkedByLabel: string;
      if (isSharedWorkspace) {
        const displayName = userName || 'Unknown user';
        copyLabel = `[${displayName}'s copy]`;
        forkedByLabel = displayName;
      } else {
        copyLabel = `(${copyNumber})`;
        forkedByLabel = 'local device';
      }

      // Handle encrypted data - decrypt, modify, re-encrypt
      if (parsedData.encrypted && userId) {
        try {
          const workspaceId = this.getWorkspaceIdForEncryption();
          const decryptedResult = await encryptionService.decryptData(
            parsedData.data,
            parsedData.nonce,
            parsedData.tag,
            userId,
            workspaceId
          );

          // Parse the decrypted data and add conflict metadata
          const decryptedData =
            typeof decryptedResult.decryptedData === 'string'
              ? JSON.parse(decryptedResult.decryptedData)
              : decryptedResult.decryptedData;

          // Add conflict metadata
          decryptedData._conflictMetadata = {
            isConflictCopy: true,
            forkedFrom: originalId,
            originalTitle: originalTitle,
            conflictTimestamp: new Date().toISOString(),
            forkedByUser: forkedByLabel,
          };

          // Append "[username's copy]" to title fields
          if (decryptedData.conversationTitle) {
            decryptedData.conversationTitle = `${decryptedData.conversationTitle} ${copyLabel}`;
          }
          if (decryptedData.context_title) {
            decryptedData.context_title = `${decryptedData.context_title} ${copyLabel}`;
          }
          if (decryptedData.title) {
            decryptedData.title = `${decryptedData.title} ${copyLabel}`;
          }
          if (decryptedData.system_prompt_name) {
            decryptedData.system_prompt_name = `${decryptedData.system_prompt_name} ${copyLabel}`;
          }
          if (decryptedData.name) {
            decryptedData.name = `${decryptedData.name} ${copyLabel}`;
          }

          // Re-encrypt the modified data
          const encryptedResult = await encryptionService.encryptData(
            decryptedData,
            userId,
            workspaceId
          );

          return JSON.stringify({
            encrypted: true,
            data: encryptedResult.encryptedData,
            nonce: encryptedResult.nonce,
            tag: encryptedResult.tag,
          });
        } catch (encryptError) {
          console.warn(
            '⚠️ [BrowserSQLiteManager] Failed to decrypt/re-encrypt for conflict labeling:',
            encryptError
          );
          // Fall through to return unmodified data
          return dataJson;
        }
      }

      // Handle unencrypted data
      const data = parsedData;

      // Add conflict metadata
      data._conflictMetadata = {
        isConflictCopy: true,
        forkedFrom: originalId,
        originalTitle: originalTitle,
        conflictTimestamp: new Date().toISOString(),
        forkedByUser: forkedByLabel,
      };

      // Append "[username's copy]" to title fields
      if (data.conversationTitle) {
        data.conversationTitle = `${data.conversationTitle} ${copyLabel}`;
      }
      if (data.context_title) {
        data.context_title = `${data.context_title} ${copyLabel}`;
      }
      if (data.title) {
        data.title = `${data.title} ${copyLabel}`;
      }
      if (data.system_prompt_name) {
        data.system_prompt_name = `${data.system_prompt_name} ${copyLabel}`;
      }
      if (data.name) {
        data.name = `${data.name} ${copyLabel}`;
      }

      return JSON.stringify(data);
    } catch {
      return dataJson;
    }
  }

  /**
   * Fork a local data packet when there's a conflict with remote
   * Creates a copy of the local version with appropriate suffix
   * @param userName - Name of the current user for clear labeling (shared workspaces)
   * @param isSharedWorkspace - If true, use "[username's copy]", otherwise use numbered suffix
   * @param copyNumber - For personal workspaces, the number to use in the suffix
   */
  private async forkLocalDataPacket(
    targetDb: any,
    localRow: any[],
    localTagsStmt: any,
    userName?: string,
    isSharedWorkspace: boolean = true,
    copyNumber: number = 1
  ): Promise<string> {
    const originalId = localRow[0];
    const userId = localRow[2]; // user_id needed for encryption
    const originalData = localRow[5];
    const originalTags = localRow[6];

    // Generate new ID for the forked copy
    const newId = this.generateUUID();
    const originalTitle = this.extractTitleFromDataPacket(originalData);

    // Create new data with conflict metadata
    // Pass userId for decryption/re-encryption of encrypted data
    const newData = await this.addConflictMetadata(
      originalData,
      originalId,
      originalTitle,
      userName,
      userId,
      isSharedWorkspace,
      copyNumber
    );

    // Create new request ID
    const newRequestId = `fork-${newId}`;

    // Insert the forked copy
    const insertStmt = targetDb.prepare(`
      INSERT INTO data_packets (
        id, create_request_id, profile_id, user_id, create_timestamp, update_timestamp, data, tags, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run([
      newId,
      newRequestId,
      localRow[1], // profile_id
      localRow[2], // user_id
      localRow[3], // create_timestamp
      new Date().toISOString(), // new update_timestamp for the fork
      newData,
      originalTags,
      'pending', // Mark as pending so it gets synced
    ]);
    insertStmt.free();

    // Copy tags to the forked record
    localTagsStmt.bind([originalId]);
    while (localTagsStmt.step()) {
      const tagRow = localTagsStmt.get();
      const insertTagStmt = targetDb.prepare(`
        INSERT OR IGNORE INTO data_packet_tags (data_packet_id, tag) 
        VALUES (?, ?)
      `);
      insertTagStmt.run([newId, tagRow[1]]);
      insertTagStmt.free();
    }
    localTagsStmt.reset();

    return newId;
  }

  // Helper method to migrate data packets from source DB to target DB with fork-on-conflict resolution
  private async migrateDataPackets(
    sourceDb: any,
    targetDb: any,
    lastSyncTimestamp?: string,
    currentUserName?: string,
    isSharedWorkspace: boolean = true
  ): Promise<{
    inserted: number;
    updated: number;
    forked: number;
    deleted: number;
  }> {
    sourceDb.exec(`
      CREATE TABLE IF NOT EXISTS tombstones (
        data_packet_id TEXT PRIMARY KEY,
        deleted_at TEXT NOT NULL
      )
    `);

    // Get all data packets from source database (remote/cloud)
    // Include create_request_id as it's required for insertion
    const sourceStmt = sourceDb.prepare(`
      SELECT id, create_request_id, profile_id, user_id, create_timestamp, update_timestamp, data, tags
      FROM data_packets 
      ORDER BY create_timestamp
    `);

    const sourceTagsStmt = sourceDb.prepare(`
      SELECT data_packet_id, tag 
      FROM data_packet_tags 
      WHERE data_packet_id = ?
    `);

    // Prepare statement to get local tags (for forking)
    const localTagsStmt = targetDb.prepare(`
      SELECT data_packet_id, tag 
      FROM data_packet_tags 
      WHERE data_packet_id = ?
    `);

    // Prepare statement to check for local tombstones
    const localTombstoneStmt = targetDb.prepare(`
      SELECT data_packet_id, deleted_at
      FROM tombstones
      WHERE data_packet_id = ?
    `);

    let sourceRow;
    let inserted = 0;
    let updated = 0;
    let forked = 0;
    let deleted = 0;

    // Parse lastSyncTimestamp - if null/undefined, we can't detect conflicts properly
    // In that case, just use timestamp comparison without conflict detection
    const hasValidLastSync = !!(lastSyncTimestamp && lastSyncTimestamp !== '');
    const lastSyncTime = hasValidLastSync
      ? new Date(lastSyncTimestamp).getTime()
      : 0;

    while (sourceStmt.step()) {
      sourceRow = sourceStmt.get();
      const packetId = sourceRow[0];
      const remoteUpdateTimestamp = sourceRow[5]; // index shifted due to create_request_id
      const remoteUpdateTime = new Date(remoteUpdateTimestamp).getTime();

      // Check if this packet already exists in target database (local)
      const existsStmt = targetDb.prepare(`
        SELECT profile_id, user_id, create_timestamp, update_timestamp, data, tags, sync_status
        FROM data_packets WHERE id = ? LIMIT 1
      `);
      existsStmt.bind([packetId]);
      const existsResult = existsStmt.step() ? existsStmt.get() : null;
      existsStmt.free();

      if (existsResult) {
        const localUpdateTimestamp = existsResult[3];
        const localUpdateTime = new Date(localUpdateTimestamp).getTime();
        const localSyncStatus = existsResult[6];

        // Check for true conflict: both sides modified since last sync
        // IMPORTANT: Only detect conflicts if we have a valid lastSyncTime
        // Without it, we can't know if changes are truly conflicting
        const remoteModifiedSinceSync =
          hasValidLastSync && remoteUpdateTime > lastSyncTime;
        const localModifiedSinceSync =
          hasValidLastSync
          && (localUpdateTime > lastSyncTime || localSyncStatus === 'pending');

        if (
          hasValidLastSync
          && remoteModifiedSinceSync
          && localModifiedSinceSync
          && remoteUpdateTime !== localUpdateTime
        ) {
          // TRUE CONFLICT: Both sides have changes
          // Fork the local version (create a copy), then update with remote
          const localRow = [packetId, ...existsResult.slice(0, 6)];
          // For personal workspaces, use the current fork count + 1 as the copy number
          await this.forkLocalDataPacket(
            targetDb,
            localRow,
            localTagsStmt,
            currentUserName,
            isSharedWorkspace,
            forked + 1
          );
          forked++;

          // Now update with remote version
          await this.updateDataPacketFromSource(
            targetDb,
            sourceRow,
            sourceTagsStmt
          );
          updated++;
        } else if (remoteUpdateTime > localUpdateTime) {
          // Remote is newer - update local (no conflict, just normal update)
          await this.updateDataPacketFromSource(
            targetDb,
            sourceRow,
            sourceTagsStmt
          );
          updated++;
        } else if (remoteUpdateTime < localUpdateTime) {
          // Local is newer - skip remote version (will be uploaded later)
          continue;
        } else {
          // Same timestamp - likely same content
          continue;
        }
      } else {
        // Packet doesn't exist locally - check if there's a tombstone
        localTombstoneStmt.bind([packetId]);
        const tombstoneResult = localTombstoneStmt.step()
          ? localTombstoneStmt.get()
          : null;
        localTombstoneStmt.reset();

        if (tombstoneResult) {
          // Tombstone exists - check if we should restore based on timestamps
          if (!hasValidLastSync || remoteUpdateTime > lastSyncTime) {
            await this.insertDataPacketFromSource(
              targetDb,
              sourceRow,
              sourceTagsStmt
            );
            const deleteTombstoneStmt = targetDb.prepare(`
              DELETE FROM tombstones WHERE data_packet_id = ?
            `);
            deleteTombstoneStmt.run([packetId]);
            deleteTombstoneStmt.free();
            inserted++;
          } else {
            // Remote is older than last sync so leave local copy deleted
            continue;
          }
        } else {
          // No tombstone - this is a new resource, insert it
          await this.insertDataPacketFromSource(
            targetDb,
            sourceRow,
            sourceTagsStmt
          );
          inserted++;
        }
      }
    }

    sourceStmt.free();
    sourceTagsStmt.free();
    localTagsStmt.free();
    localTombstoneStmt.free();

    // Step 2: Process remote tombstones AFTER processing all remote data packets
    const remoteTombstonesStmt = sourceDb.prepare(`
      SELECT data_packet_id, deleted_at
      FROM tombstones
      ORDER BY deleted_at
    `);

    // Prepare statements for checking local state
    const checkLocalTombstoneStmt = targetDb.prepare(`
      SELECT data_packet_id FROM tombstones WHERE data_packet_id = ?
    `);

    const checkLocalPacketStmt = targetDb.prepare(`
      SELECT update_timestamp FROM data_packets WHERE id = ?
    `);

    while (remoteTombstonesStmt.step()) {
      const tombstoneRow = remoteTombstonesStmt.get();
      const tombstoneId = tombstoneRow[0];

      // Check if local tombstone exists
      checkLocalTombstoneStmt.bind([tombstoneId]);
      const localTombstoneExists = checkLocalTombstoneStmt.step()
        ? true
        : false;
      checkLocalTombstoneStmt.reset();

      if (localTombstoneExists) {
        // Local tombstone exists (same ID) - do nothing (both sides deleted)
        continue;
      }

      // Check if local data packet exists
      checkLocalPacketStmt.bind([tombstoneId]);
      const localPacketResult = checkLocalPacketStmt.step()
        ? checkLocalPacketStmt.get()
        : null;
      checkLocalPacketStmt.reset();

      if (!localPacketResult) {
        // No local tombstone and no local data packet - insert the tombstone (propagate deletion)
        const insertTombstoneStmt = targetDb.prepare(`
          INSERT INTO tombstones (data_packet_id, deleted_at)
          VALUES (?, ?)
        `);
        insertTombstoneStmt.run([tombstoneRow[0], tombstoneRow[1]]);
        insertTombstoneStmt.free();
      } else {
        // Local data packet exists (same ID) - check timestamps
        const localUpdateTimestamp = localPacketResult[0];
        const localUpdateTime = new Date(localUpdateTimestamp).getTime();

        if (!hasValidLastSync) {
          // No lastSyncTime - default to keeping local packet (safety: keep data when in doubt)
          // Do nothing - keep the local packet, ignore remote tombstone
          continue;
        }

        if (localUpdateTime < lastSyncTime) {
          // Local packet was last updated before last sync - remote deletion wins
          // Delete local data packet and its tags first
          const deleteTagsStmt = targetDb.prepare(`
            DELETE FROM data_packet_tags WHERE data_packet_id = ?
          `);
          deleteTagsStmt.run([tombstoneId]);
          deleteTagsStmt.free();

          const deletePacketStmt = targetDb.prepare(`
            DELETE FROM data_packets WHERE id = ?
          `);
          deletePacketStmt.run([tombstoneId]);
          deletePacketStmt.free();

          // Then insert tombstone to maintain mutual exclusivity
          const insertTombstoneStmt = targetDb.prepare(`
            INSERT INTO tombstones (data_packet_id, deleted_at)
            VALUES (?, ?)
          `);
          insertTombstoneStmt.run([tombstoneRow[0], tombstoneRow[1]]);
          insertTombstoneStmt.free();
          deleted++;
        } else {
          // Local packet was updated after last sync - local changes win
          // Keep local data packet, ignore remote tombstone
          // Do nothing
        }
      }
    }

    remoteTombstonesStmt.free();
    checkLocalTombstoneStmt.free();
    checkLocalPacketStmt.free();

    return { inserted, updated, forked, deleted };
  }

  // Helper method to insert a data packet from source database
  // sourceRow indices: [0]=id, [1]=create_request_id, [2]=profile_id, [3]=user_id,
  //                    [4]=create_timestamp, [5]=update_timestamp, [6]=data, [7]=tags
  private async insertDataPacketFromSource(
    targetDb: any,
    sourceRow: any,
    sourceTagsStmt: any
  ): Promise<void> {
    const packetId = sourceRow[0];

    // Validate that the packet ID is valid before inserting
    if (!packetId || typeof packetId !== 'string' || packetId.trim() === '') {
      console.warn(
        '⚠️ [BrowserSQLiteManager] Skipping data packet with invalid ID during migration:',
        packetId
      );
      return;
    }

    // Insert data packet (including create_request_id which is required)
    const insertStmt = targetDb.prepare(`
      INSERT INTO data_packets (
        id, create_request_id, profile_id, user_id, create_timestamp, update_timestamp, data, tags, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run([
      sourceRow[0], // id
      sourceRow[1], // create_request_id
      sourceRow[2], // profile_id
      sourceRow[3], // user_id
      sourceRow[4], // create_timestamp
      sourceRow[5], // update_timestamp
      sourceRow[6], // data
      sourceRow[7], // tags
      'synced', // Mark as synced since it came from cloud
    ]);
    insertStmt.free();

    // Migrate tags
    sourceTagsStmt.bind([packetId]);
    while (sourceTagsStmt.step()) {
      const tagRow = sourceTagsStmt.get();
      const insertTagStmt = targetDb.prepare(`
        INSERT OR IGNORE INTO data_packet_tags (data_packet_id, tag) 
        VALUES (?, ?)
      `);
      insertTagStmt.run([packetId, tagRow[1]]);
      insertTagStmt.free();
    }
    sourceTagsStmt.reset();
  }

  // Helper method to update a data packet from source database
  // sourceRow indices: [0]=id, [1]=create_request_id, [2]=profile_id, [3]=user_id,
  //                    [4]=create_timestamp, [5]=update_timestamp, [6]=data, [7]=tags
  private async updateDataPacketFromSource(
    targetDb: any,
    sourceRow: any,
    sourceTagsStmt: any
  ): Promise<void> {
    const packetId = sourceRow[0];

    // Update data packet
    const updateStmt = targetDb.prepare(`
      UPDATE data_packets SET 
        profile_id = ?, user_id = ?, create_timestamp = ?, 
        update_timestamp = ?, data = ?, tags = ?, sync_status = ?
      WHERE id = ?
    `);

    updateStmt.run([
      sourceRow[2], // profile_id
      sourceRow[3], // user_id
      sourceRow[4], // create_timestamp
      sourceRow[5], // update_timestamp
      sourceRow[6], // data
      sourceRow[7], // tags
      'synced', // Mark as synced since it came from cloud
      packetId,
    ]);
    updateStmt.free();

    // Update tags - first remove existing tags
    const deleteTagsStmt = targetDb.prepare(`
      DELETE FROM data_packet_tags WHERE data_packet_id = ?
    `);
    deleteTagsStmt.run([packetId]);
    deleteTagsStmt.free();

    // Then add new tags
    sourceTagsStmt.bind([packetId]);
    while (sourceTagsStmt.step()) {
      const tagRow = sourceTagsStmt.get();
      const insertTagStmt = targetDb.prepare(`
        INSERT INTO data_packet_tags (data_packet_id, tag) 
        VALUES (?, ?)
      `);
      insertTagStmt.run([packetId, tagRow[1]]);
      insertTagStmt.free();
    }
    sourceTagsStmt.reset();
  }

  // Helper method to migrate API keys from source DB to target DB with timestamp-based conflict resolution
  private async migrateAPIKeys(sourceDb: any, targetDb: any): Promise<void> {
    // Get all API keys from source database
    const sourceStmt = sourceDb.prepare(`
      SELECT id, provider, api_key, user_id, create_timestamp, update_timestamp
      FROM api_keys 
      ORDER BY create_timestamp
    `);

    let sourceRow;
    let count = 0;
    let conflictsResolved = 0;

    while (sourceStmt.step()) {
      sourceRow = sourceStmt.get();
      const apiKeyId = sourceRow[0];
      const sourceUpdateTimestamp = sourceRow[5];

      // Check if this API key already exists in target database (by provider + user_id)
      const existsStmt = targetDb.prepare(
        'SELECT id, update_timestamp FROM api_keys WHERE provider = ? AND user_id = ? LIMIT 1'
      );
      existsStmt.bind([sourceRow[1], sourceRow[3]]);
      const existsResult = existsStmt.step() ? existsStmt.get() : null;
      existsStmt.free();

      if (existsResult) {
        const localUpdateTimestamp = existsResult[1];

        // Compare timestamps to resolve conflicts
        const sourceTime = new Date(sourceUpdateTimestamp).getTime();
        const localTime = new Date(localUpdateTimestamp).getTime();

        if (sourceTime > localTime) {
          // Source (cloud) version is newer - update local
          console.log(
            `Updating local API key ${apiKeyId} with newer cloud version`
          );
          const updateStmt = targetDb.prepare(`
            UPDATE api_keys SET 
              id = ?, api_key = ?, create_timestamp = ?, 
              update_timestamp = ?, sync_status = ?
            WHERE provider = ? AND user_id = ?
          `);

          updateStmt.run([
            sourceRow[0], // id
            sourceRow[2], // api_key
            sourceRow[4], // create_timestamp
            sourceRow[5], // update_timestamp
            'synced', // Mark as synced since it came from cloud
            sourceRow[1], // provider
            sourceRow[3], // user_id
          ]);
          updateStmt.free();
          conflictsResolved++;
        } else if (sourceTime < localTime) {
          // Local version is newer - skip cloud version
          console.log(
            `Keeping local API key ${apiKeyId} (newer than cloud version)`
          );
          continue;
        } else {
          // Same timestamp - could be same content or true conflict
          console.log(
            `Same timestamp for API key ${apiKeyId}, keeping local version`
          );
          continue;
        }
      } else {
        // API key doesn't exist locally - insert it
        const insertStmt = targetDb.prepare(`
          INSERT INTO api_keys (
            id, provider, api_key, user_id, create_timestamp, update_timestamp, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run([
          sourceRow[0], // id
          sourceRow[1], // provider
          sourceRow[2], // api_key
          sourceRow[3], // user_id
          sourceRow[4], // create_timestamp
          sourceRow[5], // update_timestamp
          'synced', // Mark as synced since it came from cloud
        ]);
        insertStmt.free();
        count++;
      }
    }

    sourceStmt.free();

    console.log(
      `API Keys migration complete: ${count} new keys inserted, ${conflictsResolved} conflicts resolved`
    );
  }

  /**
   * Import conversations database from remote, merging with local data
   * @param data - Remote database as Uint8Array
   * @param lastSyncTimestamp - When this device last synced (for conflict detection)
   * @param currentUserName - Name of current user for labeling conflict copies (e.g., "Raven's copy")
   * @param isSharedWorkspace - If true, use "[username's copy]" for conflicts; if false, use numbered suffix "(1)"
   * @returns Merge stats including number of conflicts forked
   */
  async importConversationsDB(
    data: Uint8Array,
    lastSyncTimestamp?: string,
    currentUserName?: string,
    isSharedWorkspace: boolean = true
  ): Promise<{ inserted: number; updated: number; forked: number } | void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    if (!data || data.length === 0) {
      return;
    }

    const tempDb = new this.SQL.Database(data);
    try {
      const countStmt = tempDb.prepare(
        'SELECT COUNT(*) as count FROM data_packets'
      );
      const countResult = countStmt.step() ? countStmt.get() : null;
      const hasData = countResult && countResult[0] > 0;
      countStmt.free();

      if (!hasData) {
        tempDb.close();
        return;
      }

      const localCountStmt = this.conversationsDb.prepare(
        'SELECT COUNT(*) as count FROM data_packets'
      );
      const localCountResult = localCountStmt.step()
        ? localCountStmt.get()
        : null;
      const localHasData = localCountResult && localCountResult[0] > 0;
      localCountStmt.free();

      if (localHasData) {
        // Merge remote into local with fork-on-conflict
        const mergeResult = await this.migrateDataPackets(
          tempDb,
          this.conversationsDb,
          lastSyncTimestamp,
          currentUserName,
          isSharedWorkspace
        );
        tempDb.close();
        return mergeResult;
      } else {
        this.conversationsDb.close();
        this.conversationsDb = new this.SQL.Database(data);
        // Don't reinitialize schema on imported database - it already has the correct schema
        // Only ensure the schema exists (CREATE TABLE IF NOT EXISTS is safe)
        await this.ensureConversationsSchema();

        // Fix sync status: imported data packets should be marked as 'synced' since they came from cloud
        await this.markImportedDataPacketsAsSynced();
        tempDb.close();
        return { inserted: 0, updated: 0, forked: 0 };
      }
    } catch (error) {
      console.error('Error processing Drive conversation database:', error);
      tempDb.close();
      throw error;
    }
  }

  async importAPIKeysDB(data: Uint8Array): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    if (!data || data.length === 0) {
      return;
    }

    const tempDb = new this.SQL.Database(data);
    try {
      const countStmt = tempDb.prepare(
        'SELECT COUNT(*) as count FROM api_keys'
      );
      const countResult = countStmt.step() ? countStmt.get() : null;
      const hasData = countResult && countResult[0] > 0;
      countStmt.free();

      if (!hasData) {
        tempDb.close();
        return;
      }

      const localCountStmt = this.apiKeysDb.prepare(
        'SELECT COUNT(*) as count FROM api_keys'
      );
      const localCountResult = localCountStmt.step()
        ? localCountStmt.get()
        : null;
      const localHasData = localCountResult && localCountResult[0] > 0;
      localCountStmt.free();

      if (localHasData) {
        await this.migrateAPIKeys(tempDb, this.apiKeysDb);
      } else {
        this.apiKeysDb.close();
        this.apiKeysDb = new this.SQL.Database(data);
        await this.initializeAPIKeysSchema();
      }

      tempDb.close();
    } catch (error) {
      console.error('Error processing Drive API keys database:', error);
      tempDb.close();
      throw error;
    }
  }

  // Granular change tracking methods

  /**
   * Get all data packets that need to be synced (have pending changes)
   */
  async getPendingDataPackets(): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.conversationsDb.prepare(`
      SELECT id, profile_id, user_id, create_timestamp, update_timestamp, tags, data
      FROM data_packets 
      WHERE sync_status = 'pending'
      ORDER BY update_timestamp
    `);

    const packets = [];
    while (stmt.step()) {
      const row = stmt.get();
      const packet = await this.rowToDataPacket(row);
      packets.push(packet);
    }
    stmt.free();

    return packets;
  }

  /**
   * Get all API keys that need to be synced (have pending changes)
   */
  async getPendingAPIKeys(): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.apiKeysDb.prepare(`
      SELECT id, provider, api_key, user_id, create_timestamp, update_timestamp
      FROM api_keys 
      WHERE sync_status = 'pending'
      ORDER BY update_timestamp
    `);

    const keys = [];
    while (stmt.step()) {
      const row = stmt.get();
      keys.push(await this.rowToAPIKey(row));
    }
    stmt.free();

    return keys;
  }

  /**
   * Mark data packets as synced after successful upload
   */
  async markDataPacketsAsSynced(packetIds: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    if (packetIds.length === 0) {
      console.log(
        '📝 [BrowserSQLiteManager] No data packets to mark as synced'
      );
      return;
    }

    console.log(
      `📝 [BrowserSQLiteManager] Marking ${packetIds.length} data packets as synced:`,
      packetIds
    );

    const placeholders = packetIds.map(() => '?').join(',');
    const stmt = this.conversationsDb.prepare(`
      UPDATE data_packets SET sync_status = 'synced' 
      WHERE id IN (${placeholders})
    `);

    const result = stmt.run(packetIds);
    console.log(
      `📝 [BrowserSQLiteManager] Updated ${result.changes} data packet records to synced status`
    );
    stmt.free();
  }

  /**
   * Mark API keys as synced after successful upload
   */
  async markAPIKeysAsSynced(keyIds: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    if (keyIds.length === 0) {
      console.log('📝 [BrowserSQLiteManager] No API keys to mark as synced');
      return;
    }

    console.log(
      `📝 [BrowserSQLiteManager] Marking ${keyIds.length} API keys as synced:`,
      keyIds
    );

    const placeholders = keyIds.map(() => '?').join(',');
    const stmt = this.apiKeysDb.prepare(`
      UPDATE api_keys SET sync_status = 'synced' 
      WHERE id IN (${placeholders})
    `);

    const result = stmt.run(keyIds);
    console.log(
      `📝 [BrowserSQLiteManager] Updated ${result.changes} API key records to synced status`
    );
    stmt.free();
  }

  /**
   * Check if there are any unsynced changes that could be lost
   */
  async hasUnsyncedChanges(): Promise<boolean> {
    if (!this.initialized) {
      console.log(
        '🔍 [BrowserSQLiteManager] Database not initialized - no unsynced changes'
      );
      return false;
    }

    const pendingCounts = await this.getPendingChangesCount();
    const hasUnsynced =
      pendingCounts.dataPackets > 0 || pendingCounts.apiKeys > 0;

    return hasUnsynced;
  }

  /**
   * Get count of pending changes for sync optimization
   */
  async getPendingChangesCount(): Promise<{
    dataPackets: number;
    apiKeys: number;
  }> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const dataPacketsStmt = this.conversationsDb.prepare(`
      SELECT COUNT(*) as count FROM data_packets WHERE sync_status = 'pending'
    `);
    const dataPacketsCount = dataPacketsStmt.step()
      ? dataPacketsStmt.get()[0]
      : 0;
    dataPacketsStmt.free();

    const apiKeysStmt = this.apiKeysDb.prepare(`
      SELECT COUNT(*) as count FROM api_keys WHERE sync_status = 'pending'
    `);
    const apiKeysCount = apiKeysStmt.step() ? apiKeysStmt.get()[0] : 0;
    apiKeysStmt.free();

    return {
      dataPackets: dataPacketsCount,
      apiKeys: apiKeysCount,
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  close(): void {
    if (this.conversationsDb) {
      this.conversationsDb.close();
    }
    if (this.apiKeysDb) {
      this.apiKeysDb.close();
    }
    this.initialized = false;
  }
}
