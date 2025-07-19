/**
 * ACM Manager - Background Script
 * 
 * Responsible for:
 * - Initializing the database
 * - Handling messages from content scripts
 * - Managing storage operations
 */

class FiduCoreAPI {
  constructor() {
    this.baseUrl = 'http://127.0.0.1:4000/api/v1';
  }

  async getAuthToken() {
    try {
      const result = await chrome.storage.local.get(['fidu_auth_token']);
      return result.fidu_auth_token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  async getSelectedProfileId() {
    try {
      const result = await chrome.storage.local.get(['selectedProfileId']);
      return result.selectedProfileId || null;
    } catch (error) {
      console.error('Error getting selected profile ID:', error);
      return null;
    }
  }

  async saveACM(acm) {
    console.log('Background: Saving ACM to Fidu Core');
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

      // Generate deterministic IDs
      const requestId = acm.id+Date.now();

      // Make a slightly nicer title for the conversation to show in the ACM lab. 
      const title = acm.interactions[0].content.substring(0, 40);

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
            id: acm.id,
            tags: ["ACM", "ACM-Manager-Plugin", "ACM-Conversation"], 
            data: {
              conversationTitle: title,
              sourceChatbot: acm.sourceChatbot,
              interactions: acm.interactions,
              originalACMsUsed: acm.originalACMsUsed,
              targetModelRequested: acm.targetModelRequested,
              conversationUrl: acm.conversationUrl
            }
          }
        })
      });

      if (response.status === 401) {
        throw new Error('Authentication expired. Please login again.');
      }

      // Handle "already exists" error with PUT update
      if (response.status === 409) {
        console.log('Background: ACM already exists, updating with PUT request');
        return await this.updateExistingACM(acm, token, selectedProfileId, title);
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
      console.error('Error saving ACM to Fidu Core:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateExistingACM(acm, token, selectedProfileId, title) {
    try {
      console.log('Background: Updating existing ACM with current data');
      
      // Generate new request ID for the update
      const updateRequestId = acm.id + Date.now() + '_update';

      // Prepare the complete data to replace existing data
      const newData = {
        conversationTitle: title,
        sourceChatbot: acm.sourceChatbot,
        interactions: acm.interactions,
        originalACMsUsed: acm.originalACMsUsed,
        targetModelRequested: acm.targetModelRequested,
        conversationUrl: acm.conversationUrl
      };

      console.log('Background: Replacing ACM data with:', newData);

      // Perform PUT update with complete replacement
      const updateResponse = await fetch(`${this.baseUrl}/data-packets/${acm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          request_id: updateRequestId,
          data_packet: {
            profile_id: selectedProfileId,
            id: acm.id,
            tags: ["ACM", "ACM-Manager-Plugin", "ACM-Conversation"], 
            data: newData
          }
        })
      });

      if (updateResponse.status === 401) {
        throw new Error('Authentication expired. Please login again.');
      }

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.detail || `HTTP error! status: ${updateResponse.status}`);
      }

      const result = await updateResponse.json();
      return {
        success: true,
        id: result.id,
        data: result,
        updated: true
      };
    } catch (error) {
      console.error('Error updating existing ACM:', error);
      throw error;
    }
  }

  async deleteACM(id) {
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
      console.error('Error deleting ACM from Fidu Core:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getACMByUrl(url) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please login first.');
      }

      const response = await fetch(`${this.baseUrl}/data-packets/${url}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        throw new Error('Authentication expired. Please login again.');
      }

      if (response.status === 404) {
        console.log('No conversation found with URL:', url);
        return {
          success: false,
          error: 'No conversation found with URL: ' + url
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.data) {
        return {
          success: false,
          error: 'No data found in ACM response'
        };
      }
      return {
        success: true,
        data: {
          id: result.id,
          sourceChatbot: result.data.sourceChatbot,
          timestamp: result.create_timestamp,
          conversationUrl: result.data.conversationUrl,
          targetModelRequested: result.data.targetModelRequested,
          interactions: result.data.interactions,
          originalACMsUsed: result.content?.originalACMsUsed
        }
      };
    } catch (error) {
      console.error('Error getting ACM by URL from Fidu Core:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAllACMs() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please login first.');
      }

      const response = await fetch(`${this.baseUrl}/data-packets`, {
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
      if (!result.data) {
        return {
          success: false,
          error: 'No data found in ACM response'
        };
      }
      return {
        success: true,
        data: {
          id: result.id,
          sourceChatbot: result.data.sourceChatbot,
          timestamp: result.create_timestamp,
          conversationUrl: result.data.conversationUrl,
          targetModelRequested: result.data.targetModelRequested,
          interactions: result.data.interactions,
          originalACMsUsed: result.content?.originalACMsUsed
        }
      };
    } catch (error) {
      console.error('Error getting ACM from Fidu Core:', error);
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

// Create a singleton instance
const fiduCoreAPI = new FiduCoreAPI();

// Initialize the extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('ACM Manager installed');
  
  // Suppress connector errors
  suppressConnectorErrors();
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  // Handle messages that don't need settings
  if (message.action === 'getACMs') {
    handleGetACMs(message, sendResponse);
    return true;
  }
  
  if (message.action === 'clearAllACMs') {
    handleClearAllACMs(message, sendResponse);
    return true;
  }
  
  // For other messages, always use FIDU Core
  chrome.storage.sync.get('settings', async (result) => {
    console.log('Background: Using Fidu Core');

    if (message.action === 'saveACM') {
      try {
        const saveResult = await fiduCoreAPI.saveACM(message.data);
        console.log('ACM saved successfully:', saveResult);
        sendResponse({ success: true, id: saveResult.id || saveResult });
      } catch (error) {
        console.error('Error saving ACM:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    
    if (message.action === 'deleteACM') {
      try {
        const deleteResult = await fiduCoreAPI.deleteACM(message.id);
        sendResponse({ success: true, result: deleteResult });
      } catch (error) {
        console.error('Error deleting ACM:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    
    if (message.action === 'findConversationByUrl') {
      try {
        const findResult = await fiduCoreAPI.getACMByUrl(message.url);
        sendResponse({ success: true, result: findResult });
      } catch (error) {
        console.error('Error finding conversation by URL:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    
    if (message.action === 'settingsUpdated') {
      // Update Fidu Core API base URL if provided
      if (message.settings.fiduCoreApiUrl) {
        fiduCoreAPI.setBaseUrl(message.settings.fiduCoreApiUrl);
      }
      
      // Broadcast the settings update to all tabs with content scripts
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings: message.settings })
            .catch(error => {
              // Ignore errors for tabs where content script is not running
              console.log('Could not send settings update to tab:', tab.id);
            });
        });
      });
      
      sendResponse({ success: true });
      return true;
    }
  });
  
  return true; // Indicates we will send a response asynchronously
});

// Helper functions for message handling
async function handleGetACMs(message, sendResponse) {
  try {
    chrome.storage.sync.get('settings', async (settingsResult) => {
      const apiResult = await fiduCoreAPI.getAllACMs();
      const acms = apiResult.data;
      sendResponse({ success: true, acms });
    });
  } catch (error) {
    console.error('Error retrieving ACMs:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleClearAllACMs(message, sendResponse) {
  try {
    chrome.storage.sync.get('settings', async (settingsResult) => {
      // For Fidu Core, we might need to implement a bulk delete or get all and delete individually
      const clearResult = { success: true, message: 'Bulk delete not implemented for Fidu Core' };
      sendResponse({ success: true, result: clearResult });
    });
  } catch (error) {
    console.error('Error clearing all ACMs:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Database Functionality (No longer used - FIDU Core is now the default)
 */

// Database configuration
const DB_NAME = 'acm-manager-db';
const DB_VERSION = 1;
const STORES = {
  acms: 'acms',
  attachments: 'attachments',
  metadata: 'metadata'
};

// Initialize the IndexedDB database
function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = event => {
      console.error('Error opening database:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = event => {
      console.log('Database initialized successfully');
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.acms)) {
        const acmsStore = db.createObjectStore(STORES.acms, { keyPath: 'id' });
        acmsStore.createIndex('timestamp', 'timestamp', { unique: false });
        acmsStore.createIndex('sourceChatbot', 'sourceChatbot', { unique: false });
        acmsStore.createIndex('conversationUrl', 'conversationUrl', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.attachments)) {
        const attachmentsStore = db.createObjectStore(STORES.attachments, { keyPath: 'id' });
        attachmentsStore.createIndex('acmId', 'acmId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.metadata)) {
        db.createObjectStore(STORES.metadata, { keyPath: 'key' });
      }
      
      console.log('Database setup complete');
    };
  });
}

// Open a connection to the database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = event => {
      console.error('Error opening database:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
  });
}

// Generate a unique ID for new ACMs
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Save an ACM to the database
async function saveACMToDatabase(acmData) {
  try {
    console.log('Background: Saving ACM to database', acmData);
    
    // Make sure timestamp is set
    if (!acmData.timestamp) {
      acmData.timestamp = new Date().toISOString();
    }
    
    // Ensure we have URL tracking
    if (!acmData.conversationUrl) {
      console.log('Background: No conversation URL provided, using generic identifier');
      acmData.conversationUrl = `generic-${acmData.sourceChatbot}-${Date.now()}`;
    }

    // Ensure the ACM has a unique ID
    if (!acmData.id) {
      acmData.id = acmData.conversationUrl;
    }
    
    // Add current timestamp to each interaction if not present
    acmData.interactions.forEach(interaction => {
      if (!interaction.timestamp) {
        interaction.timestamp = new Date().toISOString();
      }
    });
    
    const db = await openDatabase();
    const transaction = db.transaction([STORES.acms, STORES.attachments], 'readwrite');
    const acmsStore = transaction.objectStore(STORES.acms);
    const attachmentsStore = transaction.objectStore(STORES.attachments);
    
    // Check if we're updating an existing conversation
    let isUpdate = false;
    try {
      const existingRequest = acmsStore.get(acmData.id);
      await new Promise((resolve, reject) => {
        existingRequest.onsuccess = () => resolve(existingRequest.result);
        existingRequest.onerror = (event) => reject(event.target.error);
      });
      
      if (existingRequest.result) {
        isUpdate = true;
        console.log('Background: Updating existing conversation:', acmData.id);
      }
    } catch (error) {
      console.log('Background: Error checking for existing conversation:', error);
      // Continue with save as new
    }
    
    // Process attachments if any
    const attachmentPromises = [];
    acmData.interactions.forEach(interaction => {
      if (interaction.attachments && interaction.attachments.length > 0) {
        interaction.attachments.forEach(attachment => {
          if (!attachment.id) {
            attachment.id = generateUniqueId();
          }
          attachment.acmId = acmData.id;
          
          const attachmentPromise = new Promise((resolve, reject) => {
            const attachmentRequest = attachmentsStore.add(attachment);
            attachmentRequest.onsuccess = () => resolve(attachment.id);
            attachmentRequest.onerror = event => reject(event.target.error);
          });
          
          attachmentPromises.push(attachmentPromise);
        });
      }
    });
    
    // Wait for all attachments to be saved
    await Promise.all(attachmentPromises);
    console.log('Background: Attachments saved successfully');
    
    // Save the ACM
    return new Promise((resolve, reject) => {
      let acmRequest;
      
      if (isUpdate) {
        // If updating, use put instead of add
        acmRequest = acmsStore.put(acmData);
      } else {
        acmRequest = acmsStore.add(acmData);
      }
      
      acmRequest.onsuccess = () => {
        console.log('Background: ACM saved with ID:', acmData.id, 'and', acmData.interactions.length, 'interactions');
        
        // Update session count
        chrome.storage.local.get(['sessionCount'], (result) => {
          const currentCount = result.sessionCount || 0;
          chrome.storage.local.set({ sessionCount: currentCount + 1 });
          console.log('Background: Updated session count to', currentCount + 1);
        });
        
        resolve(acmData.id);
      };
      
      acmRequest.onerror = event => {
        console.error('Background: Error saving ACM:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Background: Error in saveACMToDatabase:', error);
    throw error;
  }
}

// Retrieve ACMs from the database based on query parameters
async function getACMsFromDatabase(query = {}) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORES.acms], 'readonly');
    const acmsStore = transaction.objectStore(STORES.acms);
    
    // Get all ACMs and filter based on query
    return new Promise((resolve, reject) => {
      const acmsRequest = acmsStore.getAll();
      
      acmsRequest.onsuccess = () => {
        let acms = acmsRequest.result;
        
        // Apply filters if provided
        if (query.sourceChatbot) {
          acms = acms.filter(acm => acm.sourceChatbot === query.sourceChatbot);
        }
        
        if (query.fromDate) {
          const fromDate = new Date(query.fromDate).getTime();
          acms = acms.filter(acm => new Date(acm.timestamp).getTime() >= fromDate);
        }
        
        if (query.toDate) {
          const toDate = new Date(query.toDate).getTime();
          acms = acms.filter(acm => new Date(acm.timestamp).getTime() <= toDate);
        }
        
        // Sort by timestamp (newest first)
        acms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        resolve(acms);
      };
      
      acmsRequest.onerror = event => {
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Error in getACMsFromDatabase:', error);
    throw error;
  }
}

// Delete an ACM from the database
async function deleteACMFromDatabase(acmId) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORES.acms, STORES.attachments], 'readwrite');
    const acmsStore = transaction.objectStore(STORES.acms);
    const attachmentsStore = transaction.objectStore(STORES.attachments);
    
    // Delete the ACM
    const acmDeletePromise = new Promise((resolve, reject) => {
      const acmRequest = acmsStore.delete(acmId);
      acmRequest.onsuccess = () => resolve();
      acmRequest.onerror = event => reject(event.target.error);
    });
    
    // Delete associated attachments
    const attachmentsIndex = attachmentsStore.index('acmId');
    const attachmentsRequest = attachmentsIndex.getAll(acmId);
    
    const attachmentsDeletePromise = new Promise((resolve, reject) => {
      attachmentsRequest.onsuccess = () => {
        const attachments = attachmentsRequest.result;
        const deletePromises = attachments.map(attachment => 
          new Promise((resolveDelete, rejectDelete) => {
            const deleteRequest = attachmentsStore.delete(attachment.id);
            deleteRequest.onsuccess = () => resolveDelete();
            deleteRequest.onerror = event => rejectDelete(event.target.error);
          })
        );
        
        Promise.all(deletePromises)
          .then(() => resolve())
          .catch(error => reject(error));
      };
      
      attachmentsRequest.onerror = event => {
        reject(event.target.error);
      };
    });
    
    // Wait for both operations to complete
    await Promise.all([acmDeletePromise, attachmentsDeletePromise]);
    console.log('ACM and attachments deleted successfully:', acmId);
    return true;
  } catch (error) {
    console.error('Error in deleteACMFromDatabase:', error);
    throw error;
  }
}

// Clear all ACMs from the database
async function clearAllACMsFromDatabase() {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORES.acms, STORES.attachments], 'readwrite');
    const acmsStore = transaction.objectStore(STORES.acms);
    const attachmentsStore = transaction.objectStore(STORES.attachments);
    
    // Clear all ACMs
    const acmsClearPromise = new Promise((resolve, reject) => {
      const acmRequest = acmsStore.clear();
      acmRequest.onsuccess = () => resolve();
      acmRequest.onerror = event => reject(event.target.error);
    });
    
    // Clear all attachments
    const attachmentsClearPromise = new Promise((resolve, reject) => {
      const attachmentsRequest = attachmentsStore.clear();
      attachmentsRequest.onsuccess = () => resolve();
      attachmentsRequest.onerror = event => reject(event.target.error);
    });
    
    // Reset session counter
    chrome.storage.local.set({ sessionCount: 0 });
    
    // Wait for both operations to complete
    await Promise.all([acmsClearPromise, attachmentsClearPromise]);
    console.log('All ACMs and attachments cleared successfully');
    return true;
  } catch (error) {
    console.error('Error in clearAllACMsFromDatabase:', error);
    throw error;
  }
}

// Find a conversation by its URL
async function findConversationByUrl(url) {
  try {
    console.log('Background: Looking for conversation with URL:', url);
    
    // If URL is not provided, return null
    if (!url) {
      console.log('Background: No URL provided');
      return null;
    }
    
    const db = await openDatabase();
    const transaction = db.transaction([STORES.acms], 'readonly');
    const acmsStore = transaction.objectStore(STORES.acms);
    
    // Use the conversationUrl index to directly query by URL
    const urlIndex = acmsStore.index('conversationUrl');
    
    return new Promise((resolve, reject) => {
      const request = urlIndex.get(url);
      
      request.onsuccess = () => {
        const conversation = request.result;
        if (conversation) {
          console.log('Background: Found conversation with matching URL:', conversation.id);
          resolve(conversation);
        } else {
          console.log('Background: No conversation found with URL:', url);
          resolve(null);
        }
      };
      
      request.onerror = event => {
        console.error('Background: Error retrieving conversation by URL:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Background: Error in findConversationByUrl:', error);
    
    // Fallback to the original method if the index lookup fails
    console.log('Background: Falling back to full scan method');
    
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.acms], 'readonly');
      const acmsStore = transaction.objectStore(STORES.acms);
      
      // Get all ACMs and find the one with the matching URL
      return new Promise((resolve, reject) => {
        const acmsRequest = acmsStore.getAll();
        
        acmsRequest.onsuccess = () => {
          const acms = acmsRequest.result;
          const matchingAcm = acms.find(acm => acm.conversationUrl === url);
          
          if (matchingAcm) {
            console.log('Background: Found conversation with matching URL (fallback):', matchingAcm.id);
            resolve(matchingAcm);
          } else {
            console.log('Background: No conversation found with URL (fallback):', url);
            resolve(null);
          }
        };
        
        acmsRequest.onerror = event => {
          console.error('Background: Error retrieving ACMs (fallback):', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (fallbackError) {
      console.error('Background: Error in findConversationByUrl fallback:', fallbackError);
      throw fallbackError;
    }
  }
}

// Function to suppress connector errors that might be logged to the console
function suppressConnectorErrors() {
  // Store the original console.error function
  const originalConsoleError = console.error;
  
  // Override console.error to filter out specific error messages
  console.error = function(...args) {
    // Check if this is a connector error we want to suppress
    if (args.length > 0 && typeof args[0] === 'string') {
      if (args[0].includes('Error fetching connectors') ||
          args[0].includes('Error fetching connector connections')) {
        // Ignore these specific errors
        return;
      }
    }
    
    // For all other errors, use the original console.error
    originalConsoleError.apply(console, args);
  };
} 