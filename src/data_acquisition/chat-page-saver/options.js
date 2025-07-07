// Options page JavaScript for Chatbot Conversation Saver

class OptionsManager {
  constructor() {
    this.whitelist = [];
    this.conversations = [];
    this.init();
  }

  async init() {
    console.log('OptionsManager init started');
    try {
      // Load current whitelist
      console.log('Loading whitelist...');
      await this.loadWhitelist();
      
      // Load conversations
      console.log('Loading conversations...');
      await this.loadConversations();
      
      // Load settings
      console.log('Loading settings...');
      await this.loadSettings();
      
      // Set up event listeners
      console.log('Setting up event listeners...');
      this.setupEventListeners();
      
      // Update UI
      console.log('Updating UI...');
      this.updateWhitelistUI();
      this.updateStatistics();
      this.updateConversationsUI();
      
      console.log('OptionsManager init completed successfully');
    } catch (error) {
      console.error('OptionsManager init failed:', error);
      this.showStatus('Failed to initialize options page: ' + error.message, 'error');
    }
  }

  async loadWhitelist() {
    try {
      const response = await this.sendMessage({ action: 'getWhitelist' });
      if (response.success) {
        this.whitelist = response.data;
      }
    } catch (error) {
      console.error('Failed to load whitelist:', error);
    }
  }

  async loadConversations() {
    try {
      const response = await this.sendMessage({ action: 'getConversations' });
      if (response.success) {
        this.conversations = response.data || [];
        // Sort by date (newest first)
        this.conversations.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get('settings');
      const settings = result.settings || this.getDefaultSettings();
      
      // Apply settings to form elements
      document.getElementById('useFiduCore').checked = settings.useFiduCore ?? false;
      document.getElementById('fiduCoreUrl').value = settings.fiduCoreUrl || 'http://127.0.0.1:4000/api/v1';
      document.getElementById('requireAuth').checked = settings.requireAuth ?? true;
      document.getElementById('autoLogin').checked = settings.autoLogin ?? false;
      document.getElementById('saveInterval').value = settings.saveInterval || 5;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  getDefaultSettings() {
    return {
      useFiduCore: true, // Default to FIDU Core
      fiduCoreUrl: 'http://127.0.0.1:4000/api/v1',
      requireAuth: true,
      autoLogin: false,
      saveInterval: 5
    };
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Add domain to whitelist
    const addDomainBtn = document.getElementById('addDomain');
    if (addDomainBtn) {
      addDomainBtn.addEventListener('click', () => {
        console.log('Add domain button clicked');
        this.addDomain();
      });
    } else {
      console.error('Add domain button not found');
    }

    // Enter key in domain input
    const newDomainInput = document.getElementById('newDomain');
    if (newDomainInput) {
      newDomainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          console.log('Enter key pressed in domain input');
          this.addDomain();
        }
      });
    } else {
      console.error('New domain input not found');
    }

    // Refresh conversations
    const refreshBtn = document.getElementById('refreshConversations');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        console.log('Refresh conversations button clicked');
        this.loadConversations().then(() => {
          this.updateConversationsUI();
          this.updateStatistics();
          this.showStatus('Conversations refreshed', 'success');
        });
      });
    } else {
      console.error('Refresh conversations button not found');
    }

    // Clear all conversations
    const clearAllBtn = document.getElementById('clearAllConversations');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        console.log('Clear all conversations button clicked');
        if (confirm('Are you sure you want to delete all saved conversations? This action cannot be undone.')) {
          this.clearAllConversations();
        }
      });
    } else {
      console.error('Clear all conversations button not found');
    }

    // Save settings
    const saveSettingsBtn = document.getElementById('saveSettings');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        console.log('Save settings button clicked');
        this.saveSettings();
      });
    } else {
      console.error('Save settings button not found');
    }

    // Test FIDU Core connection
    const testConnectionBtn = document.getElementById('testFiduCoreConnection');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', () => {
        console.log('Test FIDU Core connection button clicked');
        this.testFiduCoreConnection();
      });
    } else {
      console.error('Test FIDU Core connection button not found');
    }

    // Event delegation for remove domain buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-domain-btn')) {
        const domain = e.target.getAttribute('data-domain');
        if (domain) {
          this.removeDomain(domain);
        }
      }
      
      // Event delegation for delete conversation buttons
      if (e.target.classList.contains('delete-conversation-btn')) {
        const uniqueId = e.target.getAttribute('data-unique-id');
        if (uniqueId) {
          this.deleteConversation(uniqueId);
        }
      }
    });
  }

  async addDomain() {
    const input = document.getElementById('newDomain');
    const domain = input.value.trim().toLowerCase();
    
    if (!domain) {
      this.showStatus('Please enter a domain', 'error');
      return;
    }

    // Basic domain validation
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      this.showStatus('Please enter a valid domain (e.g., chatgpt.com)', 'error');
      return;
    }

    if (this.whitelist.includes(domain)) {
      this.showStatus('Domain already in whitelist', 'error');
      return;
    }

    try {
      const newWhitelist = [...this.whitelist, domain];
      const response = await this.sendMessage({ 
        action: 'updateWhitelist', 
        whitelist: newWhitelist 
      });
      
      if (response.success) {
        this.whitelist = newWhitelist;
        this.updateWhitelistUI();
        input.value = '';
        this.showStatus(`Domain "${domain}" added to whitelist`, 'success');
      } else {
        this.showStatus('Failed to add domain: ' + response.error, 'error');
      }
    } catch (error) {
      this.showStatus('Failed to add domain: ' + error.message, 'error');
    }
  }

  async removeDomain(domain) {
    try {
      const newWhitelist = this.whitelist.filter(d => d !== domain);
      const response = await this.sendMessage({ 
        action: 'updateWhitelist', 
        whitelist: newWhitelist 
      });
      
      if (response.success) {
        this.whitelist = newWhitelist;
        this.updateWhitelistUI();
        this.showStatus(`Domain "${domain}" removed from whitelist`, 'success');
      } else {
        this.showStatus('Failed to remove domain: ' + response.error, 'error');
      }
    } catch (error) {
      this.showStatus('Failed to remove domain: ' + error.message, 'error');
    }
  }

  async deleteConversation(uniqueId) {
    try {
      const response = await this.sendMessage({ 
        action: 'deleteConversation', 
        uniqueId 
      });
      
      if (response.success) {
        this.conversations = this.conversations.filter(c => c.uniqueId !== uniqueId);
        this.updateConversationsUI();
        this.updateStatistics();
        this.showStatus('Conversation deleted', 'success');
      } else {
        this.showStatus('Failed to delete conversation: ' + response.error, 'error');
      }
    } catch (error) {
      this.showStatus('Failed to delete conversation: ' + error.message, 'error');
    }
  }

  async clearAllConversations() {
    try {
      const response = await this.sendMessage({ action: 'clearAllConversations' });
      
      if (response.success) {
        this.conversations = [];
        this.updateConversationsUI();
        this.updateStatistics();
        this.showStatus('All conversations cleared', 'success');
      } else {
        this.showStatus('Failed to clear conversations: ' + response.error, 'error');
      }
    } catch (error) {
      this.showStatus('Failed to clear conversations: ' + error.message, 'error');
    }
  }

  async saveSettings() {
    const saveInterval = parseInt(document.getElementById('saveInterval').value);
    
    if (saveInterval < 1 || saveInterval > 60) {
      this.showStatus('Save interval must be between 1 and 60 minutes', 'error');
      return;
    }

    try {
      const settings = {
        useFiduCore: document.getElementById('useFiduCore').checked,
        fiduCoreUrl: document.getElementById('fiduCoreUrl').value.trim(),
        requireAuth: document.getElementById('requireAuth').checked,
        autoLogin: document.getElementById('autoLogin').checked,
        saveInterval: saveInterval
      };
      
      // Save to Chrome storage
      await chrome.storage.sync.set({ settings });
      
      // Notify background script of settings update
      const response = await this.sendMessage({ 
        action: 'settingsUpdated', 
        settings 
      });
      
      if (response.success) {
        this.showStatus('Settings saved successfully', 'success');
      } else {
        this.showStatus('Failed to save settings: ' + response.error, 'error');
      }
    } catch (error) {
      this.showStatus('Failed to save settings: ' + error.message, 'error');
    }
  }

  async testFiduCoreConnection() {
    console.log('testFiduCoreConnection method called');
    try {
      const fiduCoreUrl = document.getElementById('fiduCoreUrl').value.trim();
      console.log('FIDU Core URL:', fiduCoreUrl);
      
      if (!fiduCoreUrl) {
        console.log('No FIDU Core URL provided');
        this.showStatus('Please enter a FIDU Core API URL', 'error');
        return;
      }

      console.log('Showing testing status...');
      this.showStatus('Testing connection...', 'info');
      
      console.log('Making fetch request to:', `${fiduCoreUrl}/health`);
      const response = await fetch(`${fiduCoreUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      if (response.ok) {
        console.log('Connection successful');
        this.showStatus('Connection successful! FIDU Core is reachable.', 'success');
      } else {
        console.log('Connection failed with status:', response.status);
        this.showStatus(`Connection failed: HTTP ${response.status}`, 'error');
      }
    } catch (error) {
      console.error('Connection test error:', error);
      this.showStatus('Connection failed: ' + error.message, 'error');
    }
  }

  updateWhitelistUI() {
    const container = document.getElementById('whitelistItems');
    container.innerHTML = '';

    if (this.whitelist.length === 0) {
      container.innerHTML = '<p style="color: #666; font-style: italic;">No domains in whitelist</p>';
      return;
    }

    this.whitelist.forEach(domain => {
      const item = document.createElement('div');
      item.className = 'whitelist-item';
      item.innerHTML = `
        <span>${domain}</span>
        <button class="danger remove-domain-btn" data-domain="${domain}">Remove</button>
      `;
      container.appendChild(item);
    });
  }

  updateStatistics() {
    const totalConversations = this.conversations.length;
    const totalSize = this.calculateTotalSize();
    const lastSaved = this.getLastSavedTime();

    document.getElementById('totalConversations').textContent = totalConversations;
    document.getElementById('totalSize').textContent = totalSize.toFixed(2);
    document.getElementById('lastSaved').textContent = lastSaved;
  }

  calculateTotalSize() {
    return this.conversations.reduce((total, conv) => {
      // Estimate size: 2 bytes per character for UTF-16
      const size = (conv.htmlContent?.length || 0) * 2;
      return total + size;
    }, 0) / (1024 * 1024); // Convert to MB
  }

  getLastSavedTime() {
    if (this.conversations.length === 0) {
      return 'Never';
    }
    
    const lastSaved = new Date(this.conversations[0].dateTime);
    const now = new Date();
    const diffMs = now - lastSaved;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffMins / 1440);
      return `${diffDays}d ago`;
    }
  }

  updateConversationsUI() {
    const container = document.getElementById('conversationsList');
    
    if (this.conversations.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No conversations saved yet</div>';
      return;
    }

    container.innerHTML = '';
    
    // Show only the most recent 10 conversations
    const recentConversations = this.conversations.slice(0, 10);
    
    recentConversations.forEach(conversation => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      
      const title = conversation.title || 'Untitled Conversation';
      const date = new Date(conversation.dateTime).toLocaleDateString();
      const time = new Date(conversation.dateTime).toLocaleTimeString();
      const size = ((conversation.htmlContent?.length || 0) * 2 / 1024).toFixed(1); // KB
      
      item.innerHTML = `
        <div class="conversation-info">
          <div class="conversation-title">${title}</div>
          <div class="conversation-meta">
            ${conversation.modelName} • ${date} ${time} • ${size} KB
          </div>
        </div>
        <div class="conversation-actions">
          <button class="danger delete-conversation-btn" data-unique-id="${conversation.uniqueId}">Delete</button>
        </div>
      `;
      
      container.appendChild(item);
    });
    
    if (this.conversations.length > 10) {
      const moreItem = document.createElement('div');
      moreItem.style.textAlign = 'center';
      moreItem.style.padding = '10px';
      moreItem.style.color = '#666';
      moreItem.textContent = `... and ${this.conversations.length - 10} more conversations`;
      container.appendChild(moreItem);
    }
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

// Initialize options manager when page loads
let optionsManager;
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired');
  console.log('Creating OptionsManager instance...');
  optionsManager = new OptionsManager();
  console.log('OptionsManager instance created');
}); 