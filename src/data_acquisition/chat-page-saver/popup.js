// Popup JavaScript for Chatbot Conversation Saver

class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    try {
      // Set up event listeners
      this.setupEventListeners();
      
      // Check current page status
      await this.checkCurrentPage();
      
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.updateStatus('Error initializing popup', 'inactive');
    }
  }

  setupEventListeners() {
    // Save current page button
    document.getElementById('saveNow').addEventListener('click', () => {
      this.saveCurrentPage();
    });

    // Open options button
    document.getElementById('openOptions').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async checkCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url) {
        this.updateStatus('No active tab found', 'inactive');
        return;
      }

      // Check if current page is whitelisted
      const isWhitelisted = await this.isPageWhitelisted(tab.url);
      
      if (isWhitelisted) {
        this.updateStatus(`Active on ${tab.url}`, 'active');
      } else {
        this.updateStatus('Not a whitelisted chatbot page', 'inactive');
      }
      
    } catch (error) {
      console.error('Error checking current page:', error);
      this.updateStatus('Error checking page status', 'inactive');
    }
  }

  async isPageWhitelisted(url) {
    try {
      const response = await this.sendMessage({ action: 'getWhitelist' });
      if (response.success) {
        const whitelist = response.data;
        const urlObj = new URL(url);
        return whitelist.find(domain => urlObj.hostname.includes(domain));
      }
      return false;
    } catch (error) {
      console.error('Error checking whitelist:', error);
      return false;
    }
  }

  async saveCurrentPage() {
    try {
      const response = await this.sendMessage({ action: 'saveNow' });
      
      if (response.success) {
        this.updateStatus('Page saved successfully!', 'active');
        
        // Reset status after 2 seconds
        setTimeout(() => {
          this.checkCurrentPage();
        }, 2000);
      } else {
        this.updateStatus('Failed to save page: ' + response.error, 'inactive');
      }
    } catch (error) {
      console.error('Error saving page:', error);
      this.updateStatus('Error saving page', 'inactive');
    }
  }

  updateStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
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

// Initialize popup manager when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
}); 