/**
 * FIDU Chat Grabber - Background Script
 * 
 * Responsible for:
 * - Handling messages from content scripts
 * - Managing API communication with FIDU Vault
 * - Managing storage operations
 */

class FiduCoreAPI {
  constructor() {
    this.baseUrl = 'http://127.0.0.1:4000/api/v1';
  }

  async getAuthToken() {
    // Use the refresh token service for automatic token refresh
    if (typeof refreshTokenService !== 'undefined') {
      try {
        return await refreshTokenService.getValidAccessToken();
      } catch (error) {
        console.error('Error getting valid access token:', error);
        return null;
      }
    }

    // Fallback to old method if refresh token service is not available
    return new Promise((resolve) => {
      chrome.storage.local.get(['fidu_auth_token'], (result) => {
        const token = result.fidu_auth_token || null;
        console.log('Background: Retrieved auth token:', token ? 'present' : 'null');
        resolve(token);
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

  async saveConversation(conversation) {
    console.log('Background: Saving conversation to FIDU Vault');
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please login first.');
      }

      const selectedProfileId = await this.getSelectedProfileId();
      if (!selectedProfileId) {
        throw new Error('Profile selection required. Please select a profile first.');
      }

      // Make a slightly nicer title for the conversation to show in the conversation lab.
      const title = conversation.interactions[0].content.substring(0, 40);

      // First, check if a conversation with this ID already exists
      const existingConversation = await this.getConversationById(conversation.id);
      
      if (existingConversation.success) {
        // Conversation exists, update it
        console.log('Background: Conversation already exists, updating with PUT request');
        return await this.updateExistingConversation(conversation, token, selectedProfileId, title);
      } else {
        // Conversation doesn't exist, create new one
        console.log('Background: Creating new conversation');
        // Generate a new ID for the new conversation
        const conversationId = this.generateUrlSafeId(conversation.conversationUrl);
        conversation.id = conversationId;
        return await this.createNewConversation(conversation, token, selectedProfileId, title);
      }
    } catch (error) {
      console.error('Error saving conversation to FIDU Vault:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

    async createNewConversation(conversation, token, selectedProfileId, title) {
    try {
      const requestId = conversation.id + Date.now();

      // Use the refresh token service for automatic token refresh
      if (typeof refreshTokenService !== 'undefined') {
        const authenticatedFetch = refreshTokenService.createAuthenticatedFetch();
        const response = await authenticatedFetch(`${this.baseUrl}/data-packets`, {
          method: 'POST',
          body: JSON.stringify({
            request_id: requestId,
            data_packet: {
              profile_id: selectedProfileId,
              id: conversation.id,
              tags: ["FIDU-CHAT-GRABBER", "Chat-Bot-Conversation"], 
              data: {
                conversationTitle: title,
                sourceChatbot: conversation.sourceChatbot,
                interactions: conversation.interactions,
                targetModelRequested: conversation.targetModelRequested,
                conversationUrl: conversation.conversationUrl
              }
            }
          })
        });

        const result = await response.json();
        console.log('Background: Create conversation response:', result);
        return {
          success: true,
          id: result.id || conversation.id,
          data: result
        };
      }

      // Fallback to old method if refresh token service is not available
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
            id: conversation.id,
            tags: ["FIDU-CHAT-GRABBER", "Chat-Bot-Conversation"], 
            data: {
              conversationTitle: title,
              sourceChatbot: conversation.sourceChatbot,
              interactions: conversation.interactions,
              targetModelRequested: conversation.targetModelRequested,
              conversationUrl: conversation.conversationUrl
            }
          }
        })
      });

      if (response.status === 401) {
        // Notify all content scripts about auth status change
        await notifyContentScriptsOfAuthChange();
        throw new Error('Authentication expired. Please login again.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Background: Create conversation response:', result);
      return {
        success: true,
        id: result.id || conversation.id,
        data: result
      };
    } catch (error) {
      console.error('Error creating new conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateExistingConversation(conversation, token, selectedProfileId, title) {
    try {
      console.log('Background: Updating existing conversation with current data');
      
      // Generate new request ID for the update
      const updateRequestId = conversation.id + Date.now() + '_update';

      // Prepare the complete data to replace existing data
      const newData = {
        conversationTitle: title,
        sourceChatbot: conversation.sourceChatbot,
        interactions: conversation.interactions,
        targetModelRequested: conversation.targetModelRequested,
        conversationUrl: conversation.conversationUrl
      };

      console.log('Background: Replacing conversation data with:', newData);

      // Use the refresh token service for automatic token refresh
      if (typeof refreshTokenService !== 'undefined') {
        const authenticatedFetch = refreshTokenService.createAuthenticatedFetch();
        const updateResponse = await authenticatedFetch(`${this.baseUrl}/data-packets/${conversation.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            request_id: updateRequestId,
            data_packet: {
              profile_id: selectedProfileId,
              id: conversation.id,
              tags: ["FIDU-CHAT-GRABBER", "Chat-Bot-Conversation"], 
              data: newData
            }
          })
        });

        const result = await updateResponse.json();
        return {
          success: true,
          id: result.id,
          data: result,
          updated: true
        };
      }

      // Fallback to old method if refresh token service is not available
      const updateResponse = await fetch(`${this.baseUrl}/data-packets/${conversation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          request_id: updateRequestId,
          data_packet: {
            profile_id: selectedProfileId,
            id: conversation.id,
            tags: ["FIDU-CHAT-GRABBER", "Chat-Bot-Conversation"], 
            data: newData
          }
        })
      });

      if (updateResponse.status === 401) {
        // Notify all content scripts about auth status change
        await notifyContentScriptsOfAuthChange();
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
      console.error('Error updating existing conversation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }



  async getConversationById(id) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required. Please login first.');
      }

      // Use the refresh token service for automatic token refresh
      if (typeof refreshTokenService !== 'undefined') {
        const authenticatedFetch = refreshTokenService.createAuthenticatedFetch();
        const response = await authenticatedFetch(`${this.baseUrl}/data-packets/${id}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        // Handle 404 as expected behavior - conversation doesn't exist
        if (response.status === 404) {
          return {
            success: false,
          };
        }

        const conversation = await response.json();
        
        if (!conversation) {
          console.log('Background: No conversations found with this ID');
          return {
            success: false,
            error: 'No conversation found with this ID'
          };
        } else {
          return {
            success: true,
            conversation: conversation
          };
        }
      }

      // Fallback to old method if refresh token service is not available
      const response = await fetch(`${this.baseUrl}/data-packets/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Notify all content scripts about auth status change
        await notifyContentScriptsOfAuthChange();
        throw new Error('Authentication expired. Please login again.');
      }

      // Handle 404 as expected behavior - conversation doesn't exist
      if (response.status === 404) {
        return {
          success: false,
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const conversation = await response.json();
      
      if (!conversation) {
        console.log('Background: No conversations found with this ID');
        return {
          success: false,
          error: 'No conversation found with this ID'
        };
      } else {
        return {
          success: true,
          conversation: conversation
        };
      }
    } catch (error) {
      console.error('Error getting conversation by ID from FIDU Vault:', error);
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

      let response;
      
      // Use the refresh token service for automatic token refresh
      if (typeof refreshTokenService !== 'undefined') {
        const authenticatedFetch = refreshTokenService.createAuthenticatedFetch();
        response = await authenticatedFetch(`${this.baseUrl}/data-packets`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
      } else {
        // Fallback to old method if refresh token service is not available
        response = await fetch(`${this.baseUrl}/data-packets`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          // Notify all content scripts about auth status change
          await notifyContentScriptsOfAuthChange();
          throw new Error('Authentication expired. Please login again.');
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Background: getAllConversations raw response:', result);
      
      // Handle different response formats
      let conversations = [];
      if (Array.isArray(result)) {
        conversations = result;
      } else if (result.data && Array.isArray(result.data)) {
        conversations = result.data;
      } else if (result.data && Array.isArray(result.data.data_packets)) {
        conversations = result.data.data_packets;
      } else {
        console.warn('Background: Unexpected response format for getAllConversations:', result);
        return {
          success: true,
          data: []
        };
      }
      
      // Transform conversations to expected format
      const transformedConversations = conversations.map(conv => {
        if (conv.data && conv.data.data) {
          // Preserve the original structure but also add flattened fields for backward compatibility
          return {
            id: conv.id,
            profile_id: conv.profile_id,
            create_timestamp: conv.create_timestamp,
            update_timestamp: conv.update_timestamp,
            tags: conv.tags || [],
            data: conv.data.data, // The actual conversation data
            // Flattened fields for backward compatibility
            sourceChatbot: conv.data.data.sourceChatbot,
            timestamp: conv.create_timestamp,
            conversationUrl: conv.data.data.conversationUrl,
            targetModelRequested: conv.data.data.targetModelRequested,
            interactions: conv.data.data.interactions
          };
        } else {
          return conv;
        }
      });
      
      return {
        success: true,
        data: transformedConversations
      };
    } catch (error) {
      console.error('Background: Error getting conversations from FIDU Vault:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  setBaseUrl(url) {
    this.baseUrl = url;
  }

  // Generate URL-safe ID (same as content script)
  generateUrlSafeId(url) {
    // Convert URL to base64 and make it URL safe by replacing non-URL safe chars
    const base64 = btoa(url)
      .replace(/\+/g, '-') // Convert + to -
      .replace(/\//g, '_') // Convert / to _
      .replace(/=+$/, ''); // Remove trailing =
      
    return base64;
  }
}

// Create a singleton instance
const fiduCoreAPI = new FiduCoreAPI();

// Initialize the extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('FIDU Chat Grabber installed');
  
  // Suppress connector errors
  suppressConnectorErrors();
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  // Handle ping for testing
  if (message.action === 'ping') {
    sendResponse({ success: true, message: 'pong' });
    return false;
  }
  
  // Handle messages that don't need settings
  if (message.action === 'getConversations') {
    handleGetConversations(message, sendResponse);
    return true;
  }
  
  if (message.action === 'clearAllConversations') {
    handleClearAllConversations(message, sendResponse);
    return true;
  }
  
  // Handle messages that need settings
  if (message.action === 'saveConversation') {
    handleSaveConversation(message, sendResponse);
    return true;
  }
  
  // Handle auth status change notifications from auth service
  if (message.action === 'authStatusChanged') {
    notifyContentScriptsOfAuthChange();
    sendResponse({ success: true });
    return true;
  }
  
  // Handle vault health checks
  if (message.action === 'checkVaultHealth') {
    handleVaultHealthCheck(message, sendResponse);
    return true;
  }
});

// Handle getting conversations
async function handleGetConversations(message, sendResponse) {
  try {
    console.log('Background: Handling getConversations request');
    
    // Check if we have a token first
    const token = await fiduCoreAPI.getAuthToken();
    if (!token) {
      console.log('Background: No auth token found, returning empty conversations');
      sendResponse({ success: true, conversations: [] });
      return;
    }
    
    const apiResult = await fiduCoreAPI.getAllConversations();
    if (apiResult.success) {
      const conversations = apiResult.data;
      console.log('Background: Retrieved conversations successfully:', conversations ? conversations.length : 0);
      sendResponse({ success: true, conversations });
    } else {
      console.log('Background: Failed to retrieve conversations:', apiResult.error);
      sendResponse({ success: false, error: apiResult.error });
    }
  } catch (error) {
    console.error('Background: Error retrieving conversations:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle clearing all conversations
async function handleClearAllConversations(message, sendResponse) {
  try {
    // This would need to be implemented based on your requirements
    // For now, just return success
    sendResponse({ success: true, message: 'All conversations cleared' });
  } catch (error) {
    console.error('Error clearing all conversations:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle saving conversation
async function handleSaveConversation(message, sendResponse) {
  try {
    // Get base URL from storage first
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['baseUrl'], resolve);
    });
    
    if (result.baseUrl) {
      fiduCoreAPI.setBaseUrl(result.baseUrl);
    }
    
    console.log('Background: Processing saveConversation message with data:', message.data);
    const saveResult = await fiduCoreAPI.saveConversation(message.data);
    console.log('Background: Conversation saved successfully:', saveResult);
    sendResponse(saveResult);
  } catch (error) {
    console.error('Background: Error saving conversation:', error);
    sendResponse({ success: false, error: error.message });
  }
}



// Suppress connector errors
function suppressConnectorErrors() {
  // This function can be used to suppress specific console errors if needed
  console.log('Background: Connector error suppression initialized');
}

// Helper function to notify all content scripts about authentication status changes
async function notifyContentScriptsOfAuthChange() {
  try {
    // Get all tabs that might have content scripts
    const tabs = await chrome.tabs.query({});
    
    // Send auth status change message to all tabs
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'authStatusChanged' });
      } catch (error) {
        // Ignore errors for tabs that don't have content scripts
      }
    }
  } catch (error) {
    console.error('Background: Error notifying content scripts of auth change:', error);
  }
}

// Handle vault health checks
async function handleVaultHealthCheck(message, sendResponse) {
  try {
    // Get the FIDU-Vault URL from settings
    let vaultUrl = 'http://127.0.0.1:4000'; // Default URL
    
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['baseUrl'], resolve);
    });
    
    if (result.baseUrl) {
      // Extract base URL from the API URL (remove /api/v1)
      vaultUrl = result.baseUrl.replace('/api/v1', '');
    }
    
    // Make health check request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await fetch(`${vaultUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      sendResponse({
        success: true,
        healthy: response.ok
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('Background: FIDU-Vault health check timed out');
      } else {
        console.error('Background: FIDU-Vault health check failed:', fetchError);
      }
      
      sendResponse({
        success: true,
        healthy: false
      });
    }
  } catch (error) {
    console.error('Background: Error checking FIDU-Vault health:', error);
    sendResponse({
      success: false,
      healthy: false,
      error: error.message
    });
  }
}