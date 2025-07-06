// Chatbot Conversation Saver - Background Service Worker
// Handles URL monitoring, periodic saving, and IndexedDB operations

class ChatbotConversationSaver {
  constructor() {
    this.dbName = 'ChatbotConversationsDB';
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
      
      console.log('ChatbotConversationSaver initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ChatbotConversationSaver:', error);
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

      // Save to IndexedDB (overwrite if exists)
      await this.saveToIndexedDB(conversationData);
      
      console.log(`Conversation saved: ${modelName} - ${tab.url}`);
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
const saver = new ChatbotConversationSaver();

// Handle messages from popup and options pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getConversations':
      saver.getConversations()
        .then(conversations => sendResponse({ success: true, data: conversations }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
      
    case 'deleteConversation':
      saver.deleteConversation(request.uniqueId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'clearAllConversations':
      saver.clearAllConversations()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'saveNow':
      saver.saveActiveConversation()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getWhitelist':
      sendResponse({ success: true, data: saver.whitelist });
      break;
      
    case 'updateWhitelist':
      saver.whitelist = request.whitelist;
      chrome.storage.sync.set({ whitelist: request.whitelist })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
}); 