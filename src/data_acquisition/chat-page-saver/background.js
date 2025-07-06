// Chat Page Saver - Background Service Worker
// Handles URL monitoring, periodic saving, and IndexedDB operations

class FiduCoreAPI {
  constructor() {
    this.baseUrl = 'http://127.0.0.1:4000/api/v1';
  }

  async getAuthToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['authToken'], (result) => {
        resolve(result.authToken || null);
      });
    });
  }

  async getSelectedProfileId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['selectedProfileId'], (result) => {
        resolve(result.selectedProfileId || null);
      });
    });
  }

  async saveConversation(conversationData) {
    console.log('Background: Saving conversation to Fidu Core');
    try {
      // Get authentication token
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please login first.');
      }

      // Get selected profile ID
      const selectedProfileId = await this.getSelectedProfileId();
      if (!selectedProfileId) {
        throw new Error('No profile selected. Please select a profile in the extension popup.');
      }

      // Generate deterministic request ID
      const requestId = conversationData.uniqueId + conversationData.dateTime;

      const response = await fetch(`${this.baseUrl}/data-packets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          request_id: requestId,
          data_packet: {
            profile_id: selectedProfileId,
            id: conversationData.uniqueId,
            tags: ["Chat-Page-Saver", "Conversation", conversationData.modelName], 
            data: {
              conversationTitle: conversationData.title || 'Untitled Conversation',
              modelName: conversationData.modelName,
              url: conversationData.url,
              date: conversationData.date,
              time: conversationData.time,
              dateTime: conversationData.dateTime,
              htmlContent: conversationData.htmlContent,
              lastSaved: conversationData.lastSaved
            }
          }
        })
      });

      if (response.status === 401) {
        throw new Error('Authentication expired. Please login again.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        id: result.id,
        data: result
      };
    } catch (error) {
      console.error('Error saving conversation to Fidu Core:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAllConversations() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please login first.');
      }

      const response = await fetch(`${this.baseUrl}/data-packets?tags=Chat-Page-Saver`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        throw new Error('Authentication expired. Please login again.');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error getting conversations from Fidu Core:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteConversation(id) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please login first.');
      }

      const response = await fetch(`${this.baseUrl}/data-packets/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        throw new Error('Authentication expired. Please login again.');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting conversation from Fidu Core:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  setBaseUrl(url) {
    this.baseUrl = url;
  }
}

class ChatPageSaver {
  constructor() {
    this.dbName = 'ChatPageSaverDB';
    this.dbVersion = 1;
    this.storeName = 'conversations';
    this.saveInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.db = null;
    this.whitelist = [
      'chatgpt.com',
      'claude.ai', 
      'gemini.google.com',
      'bard.google.com',
      'bing.com',
      'perplexity.ai'
    ];
    
    // Initialize FIDU Core API
    this.fiduCoreAPI = new FiduCoreAPI();
    
    this.init();
  }

  async init() {
    try {
      // Load whitelist from storage
      await this.loadWhitelist();
      
      // Initialize IndexedDB
      await this.initDatabase();
      
      // Set up alarm for periodic saving
      await this.setupAlarm();
      
      // Listen for tab updates
      chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
      
      // Listen for alarm events
      chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
      
      // Listen for storage changes (whitelist updates)
      chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));
      
      // Listen for messages from popup and options
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
      
      console.log('ChatPageSaver initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ChatPageSaver:', error);
    }
  }

  async loadWhitelist() {
    try {
      const result = await chrome.storage.sync.get(['whitelist']);
      if (result.whitelist) {
        this.whitelist = result.whitelist;
      } else {
        // Save default whitelist
        await chrome.storage.sync.set({ whitelist: this.whitelist });
      }
    } catch (error) {
      console.error('Failed to load whitelist:', error);
    }
  }

  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB opened successfully');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create conversations object store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'uniqueId' });
          
          // Create indexes for efficient querying
          store.createIndex('url', 'url', { unique: true });
          store.createIndex('modelName', 'modelName', { unique: false });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('dateTime', 'dateTime', { unique: false });
          
          console.log('IndexedDB schema created successfully');
        }
      };
    });
  }

  async setupAlarm() {
    try {
      // Clear existing alarms
      await chrome.alarms.clearAll();
      
      // Create new alarm for periodic saving
      await chrome.alarms.create('saveConversation', {
        delayInMinutes: this.saveInterval / (60 * 1000),
        periodInMinutes: this.saveInterval / (60 * 1000)
      });
      
      console.log('Alarm set up for periodic saving');
    } catch (error) {
      console.error('Failed to set up alarm:', error);
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    // Only process if the tab is complete and has a URL
    if (changeInfo.status === 'complete' && tab.url) {
      await this.checkAndSaveConversation(tab);
    }
  }

  async handleAlarm(alarm) {
    if (alarm.name === 'saveConversation') {
      await this.saveActiveConversation();
    }
  }

  async handleStorageChange(changes, namespace) {
    if (namespace === 'sync' && changes.whitelist) {
      this.whitelist = changes.whitelist.newValue || this.whitelist;
      console.log('Whitelist updated:', this.whitelist);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('Background script received message:', message);
    
    // Check if we should use Fidu Core
    chrome.storage.sync.get('settings', async (result) => {
      const useFiduCore = result.settings?.useFiduCore ?? false;
      
      if (useFiduCore) {
        console.log('Background: Using Fidu Core');
      } else {
        console.log('Background: Using IndexedDB');
      }

      if (message.action === 'getConversations') {
        try {
          let conversations;
          if (useFiduCore) {
            const result = await this.fiduCoreAPI.getAllConversations();
            if (result.success) {
              conversations = result.data.map(item => ({
                uniqueId: item.id,
                modelName: item.data.modelName,
                date: item.data.date,
                time: item.data.time,
                dateTime: item.data.dateTime,
                url: item.data.url,
                title: item.data.conversationTitle,
                lastSaved: item.data.lastSaved
              }));
            } else {
              throw new Error(result.error);
            }
          } else {
            conversations = await this.getConversations();
          }
          sendResponse({ success: true, conversations });
        } catch (error) {
          console.error('Error retrieving conversations:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }
      
      if (message.action === 'deleteConversation') {
        try {
          let result;
          if (useFiduCore) {
            result = await this.fiduCoreAPI.deleteConversation(message.uniqueId);
          } else {
            result = await this.deleteConversation(message.uniqueId);
          }
          sendResponse({ success: true, result });
        } catch (error) {
          console.error('Error deleting conversation:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }
      
      if (message.action === 'clearAllConversations') {
        try {
          let result;
          if (useFiduCore) {
            // For Fidu Core, we might need to implement a bulk delete or get all and delete individually
            result = { success: true, message: 'Bulk delete not implemented for Fidu Core' };
          } else {
            result = await this.clearAllConversations();
          }
          sendResponse({ success: true, result });
        } catch (error) {
          console.error('Error clearing all conversations:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }
      
      if (message.action === 'settingsUpdated') {
        // Update Fidu Core API base URL if provided
        if (message.settings.fiduCoreUrl) {
          this.fiduCoreAPI.setBaseUrl(message.settings.fiduCoreUrl);
        }
        
        sendResponse({ success: true });
        return true;
      }

      if (message.action === 'getWhitelist') {
        try {
          sendResponse({ success: true, data: this.whitelist });
        } catch (error) {
          console.error('Error getting whitelist:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }

      if (message.action === 'updateWhitelist') {
        try {
          this.whitelist = message.whitelist;
          await chrome.storage.sync.set({ whitelist: this.whitelist });
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error updating whitelist:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }

      if (message.action === 'saveNow') {
        try {
          await this.saveActiveConversation();
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error saving active conversation:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true;
      }
    });
    
    return true; // Indicates we will send a response asynchronously
  }

  async checkAndSaveConversation(tab) {
    try {
      const matchedDomain = this.isWhitelistedDomain(tab.url);
      if (matchedDomain) {
        console.log(`Whitelisted domain detected: ${matchedDomain}`);
        await this.saveConversation(tab, matchedDomain);
      }
    } catch (error) {
      console.error('Error checking/saving conversation:', error);
    }
  }

  isWhitelistedDomain(url) {
    const urlObj = new URL(url);
    return this.whitelist.find(domain => urlObj.hostname.includes(domain));
  }

  async saveActiveConversation() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const matchedDomain = this.isWhitelistedDomain(tab.url);
        if (matchedDomain) {
          await this.saveConversation(tab, matchedDomain);
        }
      }
    } catch (error) {
      console.error('Error saving active conversation:', error);
    }
  }

  async saveConversation(tab, modelName) {
    try {
      // Get HTML content from the tab
      const htmlContent = await this.getTabHTML(tab.id);
      
      if (!htmlContent) {
        console.warn('No HTML content retrieved from tab');
        return;
      }

      // Generate unique ID and metadata
      const now = new Date();
      const uniqueId = this.generateUniqueId(tab.url, now);
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
      const dateTime = now.toISOString();

      const conversationData = {
        uniqueId,
        modelName,
        date,
        time,
        dateTime,
        url: tab.url,
        htmlContent,
        title: tab.title || '',
        lastSaved: dateTime
      };

      // Check if we should use Fidu Core
      chrome.storage.sync.get('settings', async (result) => {
        const useFiduCore = result.settings?.useFiduCore ?? false;
        
        if (useFiduCore) {
          console.log('Background: Saving to Fidu Core');
          try {
            const result = await this.fiduCoreAPI.saveConversation(conversationData);
            if (result.success) {
              console.log(`Conversation saved to Fidu Core: ${modelName} - ${tab.url}`);
            } else {
              console.error('Failed to save to Fidu Core:', result.error);
              // Fallback to IndexedDB if Fidu Core fails
              await this.saveToIndexedDB(conversationData);
              console.log(`Conversation saved to IndexedDB (fallback): ${modelName} - ${tab.url}`);
            }
          } catch (error) {
            console.error('Error saving to Fidu Core:', error);
            // Fallback to IndexedDB if Fidu Core fails
            await this.saveToIndexedDB(conversationData);
            console.log(`Conversation saved to IndexedDB (fallback): ${modelName} - ${tab.url}`);
          }
        } else {
          // Save to IndexedDB (overwrite if exists)
          await this.saveToIndexedDB(conversationData);
          console.log(`Conversation saved to IndexedDB: ${modelName} - ${tab.url}`);
        }
      });
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  async getTabHTML(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.documentElement.outerHTML
      });
      
      return results[0]?.result || null;
    } catch (error) {
      console.error('Error getting tab HTML:', error);
      return null;
    }
  }

  generateUniqueId(url, timestamp) {
    // Create a hash-like unique ID from URL and timestamp
    const urlHash = this.simpleHash(url);
    const timeHash = this.simpleHash(timestamp.toISOString());
    return `${urlHash}_${timeHash}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  async saveToIndexedDB(data) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Use put to overwrite existing record with same uniqueId
      const request = store.put(data);
      
      request.onsuccess = () => {
        console.log('Conversation saved to IndexedDB:', data.uniqueId);
        resolve();
      };
      
      request.onerror = () => {
        console.error('Failed to save to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  // Utility methods for external access
  async getConversations() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async deleteConversation(uniqueId) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(uniqueId);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async clearAllConversations() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Initialize the extension when the service worker starts
const saver = new ChatPageSaver(); 