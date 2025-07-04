import type { 
  Conversation, 
  Message, 
  Memory, 
  Tag, 
  UserSettings, 
  StoreNames,
  DatabaseStats,
  FilterOptions
} from '../types';
import { STORES } from '../types';

export class DatabaseService {
  private dbName = 'acm-manager-db';
  private version = 3; // Increment if we need to add new stores
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.upgradeDatabase(db);
      };
    });
  }

  private upgradeDatabase(db: IDBDatabase): void {
    // Create or upgrade object stores
    
    // Conversations store
    if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
      const conversationsStore = db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' });
      conversationsStore.createIndex('platform', 'platform', { unique: false });
      conversationsStore.createIndex('createdAt', 'createdAt', { unique: false });
      conversationsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      conversationsStore.createIndex('isArchived', 'isArchived', { unique: false });
      conversationsStore.createIndex('isFavorite', 'isFavorite', { unique: false });
      conversationsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      conversationsStore.createIndex('participants', 'participants', { unique: false, multiEntry: true });
    }

    // Messages store
    if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
      const messagesStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
      messagesStore.createIndex('conversationId', 'conversationId', { unique: false });
      messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
      messagesStore.createIndex('role', 'role', { unique: false });
      messagesStore.createIndex('platform', 'platform', { unique: false });
    }

    // Memories store
    if (!db.objectStoreNames.contains(STORES.MEMORIES)) {
      const memoriesStore = db.createObjectStore(STORES.MEMORIES, { keyPath: 'id' });
      memoriesStore.createIndex('type', 'type', { unique: false });
      memoriesStore.createIndex('importance', 'importance', { unique: false });
      memoriesStore.createIndex('createdAt', 'createdAt', { unique: false });
      memoriesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      memoriesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      memoriesStore.createIndex('conversationIds', 'conversationIds', { unique: false, multiEntry: true });
      memoriesStore.createIndex('isArchived', 'isArchived', { unique: false });
      memoriesStore.createIndex('source', 'source', { unique: false });
    }

    // Tags store
    if (!db.objectStoreNames.contains(STORES.TAGS)) {
      const tagsStore = db.createObjectStore(STORES.TAGS, { keyPath: 'id' });
      tagsStore.createIndex('name', 'name', { unique: true });
      tagsStore.createIndex('category', 'category', { unique: false });
      tagsStore.createIndex('usageCount', 'usageCount', { unique: false });
    }

    // Settings store
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
    }

    // Attachments store
    if (!db.objectStoreNames.contains(STORES.ATTACHMENTS)) {
      const attachmentsStore = db.createObjectStore(STORES.ATTACHMENTS, { keyPath: 'id' });
      attachmentsStore.createIndex('messageId', 'messageId', { unique: false });
      attachmentsStore.createIndex('type', 'type', { unique: false });
    }
  }

  private async transaction<T>(
    storeNames: StoreNames | StoreNames[],
    mode: IDBTransactionMode,
    operation: (stores: { [key: string]: IDBObjectStore }) => Promise<T> | T
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = this.db.transaction(stores, mode);
    
    const storeMap: { [key: string]: IDBObjectStore } = {};
    stores.forEach(storeName => {
      storeMap[storeName] = transaction.objectStore(storeName);
    });

    return operation(storeMap);
  }

  // Conversations CRUD
  async getConversations(filters?: FilterOptions): Promise<Conversation[]> {
    return this.transaction(STORES.CONVERSATIONS, 'readonly', async (stores) => {
      const store = stores[STORES.CONVERSATIONS];
      const conversations: Conversation[] = [];
      
      let cursor: IDBRequest;
      
      if (filters?.platforms?.length) {
        // Use platform index if filtering by platforms
        cursor = store.index('platform').openCursor();
      } else if (filters?.isArchived !== undefined) {
        cursor = store.index('isArchived').openCursor(IDBKeyRange.only(filters.isArchived));
      } else if (filters?.isFavorite !== undefined) {
        cursor = store.index('isFavorite').openCursor(IDBKeyRange.only(filters.isFavorite));
      } else {
        cursor = store.openCursor();
      }

      return new Promise((resolve, reject) => {
        cursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const conversation = cursor.value as Conversation;
            
            // Apply additional filters
            if (this.matchesFilters(conversation, filters)) {
              conversations.push(conversation);
            }
            cursor.continue();
          } else {
            // Apply sorting
            if (filters?.sortBy) {
              conversations.sort((a, b) => {
                const aVal = a[filters.sortBy as keyof Conversation];
                const bVal = b[filters.sortBy as keyof Conversation];
                const order = filters.sortOrder === 'desc' ? -1 : 1;
                
                // Handle undefined values
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1 * order;
                if (bVal == null) return -1 * order;
                
                if (aVal < bVal) return -1 * order;
                if (aVal > bVal) return 1 * order;
                return 0;
              });
            }
            
            resolve(conversations);
          }
        };
        cursor.onerror = () => reject(cursor.error);
      });
    });
  }

  private matchesFilters(conversation: Conversation, filters?: FilterOptions): boolean {
    if (!filters) return true;

    if (filters.platforms?.length && !filters.platforms.includes(conversation.platform)) {
      return false;
    }

    if (filters.tags?.length) {
      const hasMatchingTag = filters.tags.some(tag => conversation.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    if (filters.dateRange) {
      const createdAt = new Date(conversation.createdAt);
      if (createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) {
        return false;
      }
    }

    if (filters.messageCountRange) {
      if (conversation.messageCount < filters.messageCountRange.min || 
          conversation.messageCount > filters.messageCountRange.max) {
        return false;
      }
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchableText = `${conversation.title} ${conversation.lastMessage || ''}`.toLowerCase();
      if (!searchableText.includes(query)) {
        return false;
      }
    }

    return true;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.transaction(STORES.CONVERSATIONS, 'readonly', async (stores) => {
      const request = stores[STORES.CONVERSATIONS].get(id);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    return this.transaction(STORES.CONVERSATIONS, 'readwrite', async (stores) => {
      const request = stores[STORES.CONVERSATIONS].put(conversation);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async deleteConversation(id: string): Promise<void> {
    return this.transaction([STORES.CONVERSATIONS, STORES.MESSAGES], 'readwrite', async (stores) => {
      // Delete conversation
      const deleteConversation = stores[STORES.CONVERSATIONS].delete(id);
      
      // Delete associated messages
      const messagesIndex = stores[STORES.MESSAGES].index('conversationId');
      const messagesCursor = messagesIndex.openCursor(IDBKeyRange.only(id));
      
      const deletePromises: Promise<void>[] = [
        new Promise((resolve, reject) => {
          deleteConversation.onsuccess = () => resolve();
          deleteConversation.onerror = () => reject(deleteConversation.error);
        })
      ];

      deletePromises.push(
        new Promise((resolve, reject) => {
          messagesCursor.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          messagesCursor.onerror = () => reject(messagesCursor.error);
        })
      );

      await Promise.all(deletePromises);
    });
  }

  // Messages CRUD
  async getMessages(conversationId: string): Promise<Message[]> {
    console.log('DatabaseService.getMessages called with conversationId:', conversationId);
    return this.transaction(STORES.MESSAGES, 'readonly', async (stores) => {
      const index = stores[STORES.MESSAGES].index('conversationId');
      const request = index.getAll(IDBKeyRange.only(conversationId));
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const messages = request.result as Message[];
          console.log('DatabaseService.getMessages result:', messages);
          // Convert Date objects to ISO strings for Redux serialization
          const serializedMessages = messages.map(message => ({
            ...message,
            timestamp: message.timestamp instanceof Date 
              ? message.timestamp.toISOString() 
              : message.timestamp
          }));
          // Sort by timestamp
          serializedMessages.sort((a, b) => {
            const aTime = new Date(a.timestamp).getTime();
            const bTime = new Date(b.timestamp).getTime();
            return aTime - bTime;
          });
          resolve(serializedMessages);
        };
        request.onerror = () => {
          console.error('DatabaseService.getMessages error:', request.error);
          reject(request.error);
        };
      });
    });
  }

  async saveMessage(message: Message): Promise<void> {
    return this.transaction(STORES.MESSAGES, 'readwrite', async (stores) => {
      // Ensure timestamp is stored as Date object in database
      const messageToSave = {
        ...message,
        timestamp: message.timestamp instanceof Date 
          ? message.timestamp 
          : new Date(message.timestamp)
      };
      const request = stores[STORES.MESSAGES].put(messageToSave);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Memories CRUD
  async getMemories(filters?: { types?: string[]; importance?: string[]; tags?: string[]; searchQuery?: string }): Promise<Memory[]> {
    return this.transaction(STORES.MEMORIES, 'readonly', async (stores) => {
      const store = stores[STORES.MEMORIES];
      const memories: Memory[] = [];
      
      const cursor = store.openCursor();
      
      return new Promise((resolve, reject) => {
        cursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const memory = cursor.value as Memory;
            
            // Apply filters
            let matches = true;
            
            if (filters?.types?.length && !filters.types.includes(memory.type)) {
              matches = false;
            }
            
            if (filters?.importance?.length && !filters.importance.includes(memory.importance)) {
              matches = false;
            }
            
            if (filters?.tags?.length) {
              const hasMatchingTag = filters.tags.some(tag => memory.tags.includes(tag));
              if (!hasMatchingTag) matches = false;
            }
            
            if (filters?.searchQuery) {
              const query = filters.searchQuery.toLowerCase();
              const searchableText = `${memory.title} ${memory.content}`.toLowerCase();
              if (!searchableText.includes(query)) {
                matches = false;
              }
            }
            
            if (matches) {
              memories.push(memory);
            }
            
            cursor.continue();
          } else {
            // Sort by updated date (newest first)
            memories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            resolve(memories);
          }
        };
        cursor.onerror = () => reject(cursor.error);
      });
    });
  }

  async saveMemory(memory: Memory): Promise<void> {
    return this.transaction(STORES.MEMORIES, 'readwrite', async (stores) => {
      const request = stores[STORES.MEMORIES].put(memory);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async deleteMemory(id: string): Promise<void> {
    return this.transaction(STORES.MEMORIES, 'readwrite', async (stores) => {
      const request = stores[STORES.MEMORIES].delete(id);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Tags CRUD
  async getTags(): Promise<Tag[]> {
    return this.transaction(STORES.TAGS, 'readonly', async (stores) => {
      const request = stores[STORES.TAGS].getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const tags = request.result as Tag[];
          // Convert Date objects to ISO strings for Redux serialization
          const serializedTags = tags.map(tag => ({
            ...tag,
            createdAt: tag.createdAt instanceof Date 
              ? tag.createdAt.toISOString() 
              : tag.createdAt
          }));
          // Sort by usage count (most used first)
          serializedTags.sort((a, b) => b.usageCount - a.usageCount);
          resolve(serializedTags);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async saveTag(tag: Tag): Promise<void> {
    return this.transaction(STORES.TAGS, 'readwrite', async (stores) => {
      const request = stores[STORES.TAGS].put(tag);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async deleteTag(id: string): Promise<void> {
    return this.transaction(STORES.TAGS, 'readwrite', async (stores) => {
      const request = stores[STORES.TAGS].delete(id);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Settings CRUD
  async getSettings(): Promise<UserSettings | null> {
    return this.transaction(STORES.SETTINGS, 'readonly', async (stores) => {
      const request = stores[STORES.SETTINGS].get('default');
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    return this.transaction(STORES.SETTINGS, 'readwrite', async (stores) => {
      const request = stores[STORES.SETTINGS].put({ ...settings, id: 'default' });
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Database utilities
  async getDatabaseStats(): Promise<DatabaseStats> {
    return this.transaction(
      [STORES.CONVERSATIONS, STORES.MESSAGES, STORES.MEMORIES, STORES.TAGS], 
      'readonly', 
      async (stores) => {
        const promises = [
          this.countRecords(stores[STORES.CONVERSATIONS]),
          this.countRecords(stores[STORES.MESSAGES]),
          this.countRecords(stores[STORES.MEMORIES]),
          this.countRecords(stores[STORES.TAGS])
        ];

        const [totalConversations, totalMessages, totalMemories, totalTags] = await Promise.all(promises);

        // Get date range for conversations
        const conversationDates = await this.getConversationDateRange(stores[STORES.CONVERSATIONS]);

        return {
          totalConversations,
          totalMessages,
          totalMemories,
          totalTags,
          databaseSize: 0, // Would need additional implementation to calculate actual size
          oldestConversation: conversationDates.oldest,
          newestConversation: conversationDates.newest
        };
      }
    );
  }

  private async countRecords(store: IDBObjectStore): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getConversationDateRange(store: IDBObjectStore): Promise<{ oldest?: Date; newest?: Date }> {
    return new Promise((resolve, reject) => {
      let oldest: Date | undefined;
      let newest: Date | undefined;

      const cursor = store.openCursor();
      cursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const conversation = cursor.value as Conversation;
          const createdAt = new Date(conversation.createdAt);
          
          if (!oldest || createdAt < oldest) {
            oldest = createdAt;
          }
          if (!newest || createdAt > newest) {
            newest = createdAt;
          }
          
          cursor.continue();
        } else {
          resolve({ oldest, newest });
        }
      };
      cursor.onerror = () => reject(cursor.error);
    });
  }

  async clearAllData(): Promise<void> {
    return this.transaction(
      [STORES.CONVERSATIONS, STORES.MESSAGES, STORES.MEMORIES, STORES.TAGS, STORES.SETTINGS],
      'readwrite',
      async (stores) => {
        const promises = Object.values(stores).map(store => {
          return new Promise<void>((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        });

        await Promise.all(promises);
      }
    );
  }

  async exportData(): Promise<any> {
    const [conversations, messages, memories, tags, settings] = await Promise.all([
      this.getConversations(),
      this.getAllMessages(),
      this.getMemories(),
      this.getTags(),
      this.getSettings()
    ]);

    return {
      conversations,
      messages,
      memories,
      tags,
      settings,
      exportedAt: new Date(),
      version: this.version.toString()
    };
  }

  private async getAllMessages(): Promise<Message[]> {
    return this.transaction(STORES.MESSAGES, 'readonly', async (stores) => {
      const request = stores[STORES.MESSAGES].getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async importData(data: any): Promise<void> {
    await this.clearAllData();

    return this.transaction(
      [STORES.CONVERSATIONS, STORES.MESSAGES, STORES.MEMORIES, STORES.TAGS, STORES.SETTINGS],
      'readwrite',
      async (stores) => {
        const promises: Promise<void>[] = [];

        // Import conversations
        if (data.conversations) {
          data.conversations.forEach((conversation: Conversation) => {
            promises.push(
              new Promise((resolve, reject) => {
                const request = stores[STORES.CONVERSATIONS].put(conversation);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              })
            );
          });
        }

        // Import messages
        if (data.messages) {
          data.messages.forEach((message: Message) => {
            promises.push(
              new Promise((resolve, reject) => {
                const request = stores[STORES.MESSAGES].put(message);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              })
            );
          });
        }

        // Import memories
        if (data.memories) {
          data.memories.forEach((memory: Memory) => {
            promises.push(
              new Promise((resolve, reject) => {
                const request = stores[STORES.MEMORIES].put(memory);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              })
            );
          });
        }

        // Import tags
        if (data.tags) {
          data.tags.forEach((tag: Tag) => {
            promises.push(
              new Promise((resolve, reject) => {
                const request = stores[STORES.TAGS].put(tag);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              })
            );
          });
        }

        // Import settings
        if (data.settings) {
          promises.push(
            new Promise((resolve, reject) => {
              const request = stores[STORES.SETTINGS].put({ ...data.settings, id: 'default' });
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            })
          );
        }

        await Promise.all(promises);
      }
    );
  }
}

// Singleton instance
export const dbService = new DatabaseService(); 