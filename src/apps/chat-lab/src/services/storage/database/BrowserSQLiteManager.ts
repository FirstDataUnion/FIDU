/**
 * Browser SQLite Database Manager
 * Manages SQLite databases in browser memory using sql.js
 */

import initSqlJs from 'sql.js';

export interface DatabaseConfig {
  conversationsDbName: string;
  apiKeysDbName: string;
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
}

export class BrowserSQLiteManager {
  private SQL: any = null;
  private conversationsDb: any = null;
  private apiKeysDb: any = null;
  private initialized = false;

  constructor(_config: DatabaseConfig) {
    // Config will be used for database names in future implementations
    console.log('Initializing browser SQLite databases');
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize sql.js
      this.SQL = await initSqlJs({
        // You can load the wasm file from a CDN or serve it locally
        locateFile: (file: string) => {
          // For now, we'll use the default location
          // In production, you might want to serve this from your own CDN
          return `https://sql.js.org/dist/${file}`;
        }
      });

      // Create databases
      this.conversationsDb = new this.SQL.Database();
      this.apiKeysDb = new this.SQL.Database();

      // Initialize schemas
      await this.initializeConversationsSchema();
      await this.initializeAPIKeysSchema();

      this.initialized = true;
      console.log('Browser SQLite databases initialized successfully');
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
        data TEXT NOT NULL
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
        UNIQUE(provider, user_id)
      )
    `);
  }

  // Data Packet Operations
  async storeDataPacket(requestId: string, dataPacket: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.conversationsDb.prepare(`
      INSERT INTO data_packets (
        id, create_request_id, profile_id, user_id, create_timestamp, update_timestamp, tags, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run([
        dataPacket.id,
        requestId,
        dataPacket.profile_id,
        dataPacket.user_id,
        dataPacket.create_timestamp,
        dataPacket.update_timestamp,
        JSON.stringify(dataPacket.tags || []),
        JSON.stringify(dataPacket.data || {})
      ]);

      // Sync tags to junction table
      if (dataPacket.tags && dataPacket.tags.length > 0) {
        await this.syncTagsToJunctionTable(dataPacket.id, dataPacket.tags);
      }

      return dataPacket;
    } catch (error) {
      // Handle idempotent requests (duplicate request_id)
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed') && error.message.includes('create_request_id')) {
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

    // Check if request already processed
    const updateCheck = this.conversationsDb.prepare(`
      SELECT * FROM data_packet_updates WHERE request_id = ?
    `);
    const existingUpdate = updateCheck.get([requestId]);
    updateCheck.free();

    if (existingUpdate) {
      // Request already processed, return existing packet
      return await this.getDataPacketById(dataPacket.id);
    }

    // Build update query dynamically
    const updateFields = ['update_timestamp = ?'];
    const params = [dataPacket.update_timestamp || new Date().toISOString()];

    if (dataPacket.tags !== undefined) {
      updateFields.push('tags = ?');
      params.push(JSON.stringify(dataPacket.tags));
    }

    if (dataPacket.data !== undefined) {
      updateFields.push('data = ?');
      params.push(JSON.stringify(dataPacket.data));
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
      updateRecordStmt.run([requestId, dataPacket.id, dataPacket.update_timestamp || new Date().toISOString()]);
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
      const row = stmt.get([id]);
      if (!row) {
        throw new Error(`Data packet with ID ${id} not found`);
      }

      return this.rowToDataPacket(row);
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
      const row = stmt.get([requestId]);
      if (!row) {
        throw new Error(`Data packet with request ID ${requestId} not found`);
      }

      return this.rowToDataPacket(row);
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
    const conditions = ['dp.user_id = ?'];
    params.push(queryParams.user_id);

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
        conditions.push('dp.id IN (SELECT data_packet_id FROM data_packet_tags WHERE tag = ?)');
        params.push(tag);
      }
    }

    query += ' WHERE ' + conditions.join(' AND ');

    // Add sorting
    const sortOrder = queryParams.sort_order === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY dp.create_timestamp ${sortOrder}`;

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(queryParams.limit || 50);
    params.push(queryParams.offset || 0);

    const stmt = this.conversationsDb.prepare(query);

    try {
      const rows = stmt.all(params);
      return rows.map((row: any) => this.rowToDataPacket(row));
    } finally {
      stmt.free();
    }
  }

  async deleteDataPacket(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.conversationsDb.prepare(`
      DELETE FROM data_packets WHERE id = ?
    `);

    try {
      const result = stmt.run([id]);
      if (result.changes === 0) {
        throw new Error(`Data packet with ID ${id} not found`);
      }
    } finally {
      stmt.free();
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

    try {
      stmt.run([
        apiKey.id,
        apiKey.provider,
        apiKey.api_key,
        apiKey.user_id,
        apiKey.create_timestamp,
        apiKey.update_timestamp
      ]);

      return apiKey;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`API key already exists for provider ${apiKey.provider} and user ${apiKey.user_id}`);
      }
      throw error;
    } finally {
      stmt.free();
    }
  }

  async getAPIKeyByProvider(provider: string, userId: string): Promise<any | null> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    const stmt = this.apiKeysDb.prepare(`
      SELECT * FROM api_keys WHERE provider = ? AND user_id = ?
    `);

    try {
      const row = stmt.get([provider, userId]);
      return row ? this.rowToAPIKey(row) : null;
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
      const rows = stmt.all([userId]);
      return rows.map((row: any) => this.rowToAPIKey(row));
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
  private async syncTagsToJunctionTable(dataPacketId: string, tags: string[]): Promise<void> {
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

  private rowToDataPacket(row: any): any {
    return {
      id: row.id,
      profile_id: row.profile_id,
      user_id: row.user_id,
      create_timestamp: row.create_timestamp,
      update_timestamp: row.update_timestamp,
      tags: row.tags ? JSON.parse(row.tags) : [],
      data: row.data ? JSON.parse(row.data) : {}
    };
  }

  private rowToAPIKey(row: any): any {
    return {
      id: row.id,
      provider: row.provider,
      api_key: row.api_key,
      user_id: row.user_id,
      create_timestamp: row.create_timestamp,
      update_timestamp: row.update_timestamp
    };
  }

  // Database export/import for sync
  async exportConversationsDB(): Promise<Uint8Array> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }
    return this.conversationsDb.export();
  }

  async exportAPIKeysDB(): Promise<Uint8Array> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }
    return this.apiKeysDb.export();
  }

  async importConversationsDB(data: Uint8Array): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }
    this.conversationsDb.close();
    this.conversationsDb = new this.SQL.Database(data);
    await this.initializeConversationsSchema();
  }

  async importAPIKeysDB(data: Uint8Array): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }
    this.apiKeysDb.close();
    this.apiKeysDb = new this.SQL.Database(data);
    await this.initializeAPIKeysSchema();
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
