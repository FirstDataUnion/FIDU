/**
 * Mock for BrowserSQLiteManager
 * Used in Jest tests to avoid import.meta issues
 */

export interface DatabaseConfig {
  conversationsDbName: string;
  apiKeysDbName: string;
  enableEncryption?: boolean;
}

export interface DataPacketRow {
  id: string;
  create_request_id: string;
  user_id: string;
  conversation_id: string;
  platform: string;
  encrypted_data: string;
  created_at: number;
}

export interface APIKeyRow {
  id: string;
  provider: string;
  encrypted_key: string;
  create_timestamp: string;
  update_timestamp: string;
}

export class BrowserSQLiteManager {
  private initialized = false;
  private mockConversations: DataPacketRow[] = [];
  private mockAPIKeys: APIKeyRow[] = [];

  constructor(_config: DatabaseConfig) {
    // Mock constructor
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Conversation methods
  async saveDataPacket(packet: DataPacketRow): Promise<void> {
    this.mockConversations.push(packet);
  }

  async getDataPackets(userId: string): Promise<DataPacketRow[]> {
    return this.mockConversations.filter(p => p.user_id === userId);
  }

  async getDataPacketsByConversationId(
    conversationId: string
  ): Promise<DataPacketRow[]> {
    return this.mockConversations.filter(
      p => p.conversation_id === conversationId
    );
  }

  async deleteDataPacket(id: string): Promise<void> {
    this.mockConversations = this.mockConversations.filter(p => p.id !== id);
  }

  async deleteDataPacketsByConversationId(
    conversationId: string
  ): Promise<void> {
    this.mockConversations = this.mockConversations.filter(
      p => p.conversation_id !== conversationId
    );
  }

  async clearAllDataPackets(): Promise<void> {
    this.mockConversations = [];
  }

  // API Key methods
  async saveAPIKey(key: APIKeyRow): Promise<void> {
    const existingIndex = this.mockAPIKeys.findIndex(k => k.id === key.id);
    if (existingIndex >= 0) {
      this.mockAPIKeys[existingIndex] = key;
    } else {
      this.mockAPIKeys.push(key);
    }
  }

  async getAPIKey(provider: string): Promise<APIKeyRow | null> {
    return this.mockAPIKeys.find(k => k.provider === provider) || null;
  }

  async getAllAPIKeys(): Promise<APIKeyRow[]> {
    return [...this.mockAPIKeys];
  }

  async deleteAPIKey(provider: string): Promise<void> {
    this.mockAPIKeys = this.mockAPIKeys.filter(k => k.provider !== provider);
  }

  async clearAllAPIKeys(): Promise<void> {
    this.mockAPIKeys = [];
  }

  // Export methods
  async exportConversationsDatabase(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async exportAPIKeysDatabase(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  // Import methods
  async importConversationsDatabase(_data: ArrayBuffer): Promise<void> {
    // Mock implementation
  }

  async importAPIKeysDatabase(_data: ArrayBuffer): Promise<void> {
    // Mock implementation
  }

  // Database operations
  async performDatabaseMaintenance(): Promise<void> {
    // Mock implementation
  }

  // Test helpers
  _setMockConversations(conversations: DataPacketRow[]): void {
    this.mockConversations = conversations;
  }

  _setMockAPIKeys(keys: APIKeyRow[]): void {
    this.mockAPIKeys = keys;
  }
}
