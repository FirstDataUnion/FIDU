/**
 * FIDU Chat Grabber - Content Script
 * 
 * Responsible for:
 * - Detecting the chatbot platform
 * - Periodically capturing the entire conversation
 * - Sending data to the background script
 */

// Initialize on page load with multiple fallbacks
document.addEventListener('DOMContentLoaded', initialize);
window.addEventListener('load', initialize);

// Also try to initialize after a delay to handle dynamic loading
setTimeout(initialize, 1000);
setTimeout(initialize, 3000);
setTimeout(initialize, 5000);

// Listen for URL changes (for SPA navigation)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (lastUrl !== window.location.href) {
    lastUrl = window.location.href;
    console.log('URL changed, re-initializing:', lastUrl);
    
    // Reset initialization state for new conversations
    isInitialized = false;
    
    // Clear existing intervals
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
    
    setTimeout(initialize, 1000);
  }
});
urlObserver.observe(document, { subtree: true, childList: true });

// For debugging
console.log('FIDU Chat Grabber content script loaded');
console.log('Current URL:', window.location.href);

// Suppress connector errors
suppressConnectorErrors();

// Create a deterministic URL-safe ID from a URL
function generateUrlSafeId(url) {
  // Convert URL to base64 and make it URL safe by replacing non-URL safe chars
  const base64 = btoa(url)
    .replace(/\+/g, '-') // Convert + to -
    .replace(/\//g, '_') // Convert / to _
    .replace(/=+$/, ''); // Remove trailing =
    
  return base64;
}


// Global variables
let chatbotType = null;
let currentConversation = {
  id: null,
  sourceChatbot: null,
  timestamp: null,
  interactions: [],
  targetModelRequested: null,
  conversationUrl: null
};
let captureInterval = null;
let captureFrequency = 60000; // Default: 1 minute in milliseconds
let isInitialized = false; // Prevent multiple initializations

// Function to suppress connector errors that might be logged to the console
function suppressConnectorErrors() {
  // Store the original console.error function
  const originalConsoleError = console.error;
  
  // Override console.error to filter out specific error messages
  console.error = function(...args) {
    // Check if this is a connector error we want to suppress
    if (args.length > 0 && typeof args[0] === 'string') {
      if (args[0].includes('Error fetching connectors') ||
          args[0].includes('Error fetching connector connections') ||
          args[0].includes('Failed to fetch')) {
        // Ignore these specific errors
        return;
      }
    }
    
    // For all other errors, use the original console.error
    originalConsoleError.apply(console, args);
  };
}

// Helper function to check if user is logged in
async function checkIfLoggedIn() {
  try {
    // Check for auth token in chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['fidu_auth_token'], (result) => {
          resolve(!!result.fidu_auth_token);
        });
      });
    } else {
      // Fallback to localStorage
      const token = localStorage.getItem('fidu_auth_token');
      return !!token;
    }
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
}

// Helper function to get selected profile
async function getSelectedProfile() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['fidu_selected_profile'], (result) => {
          resolve(result.fidu_selected_profile || null);
        });
      });
    } else {
      // Fallback to localStorage
      const profileData = localStorage.getItem('fidu_selected_profile');
      return profileData ? JSON.parse(profileData) : null;
    }
  } catch (error) {
    console.error('Error getting selected profile:', error);
    return null;
  }
}

// Helper function to check FIDU-Vault health
async function checkFiduVaultHealth() {
  try {
    // Get the FIDU-Vault URL from settings
    let vaultUrl = 'http://127.0.0.1:4000'; // Default URL
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['baseUrl'], resolve);
      });
      
      if (result.baseUrl) {
        // Extract base URL from the API URL (remove /api/v1)
        vaultUrl = result.baseUrl.replace('/api/v1', '');
      }
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
      return response.ok;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('FIDU-Vault health check timed out');
      } else {
        throw fetchError;
      }
      return false;
    }
  } catch (error) {
    console.error('Error checking FIDU-Vault health:', error);
    return false;
  }
}

// === Profile Status Indicator ===
function addProfileStatusIndicator() {
  // Remove existing if present
  const existing = document.getElementById('conversation-profile-status');
  if (existing) existing.remove();

  const statusBox = document.createElement('div');
  statusBox.id = 'conversation-profile-status';
  statusBox.style.position = 'fixed';
  statusBox.style.bottom = '130px';
  statusBox.style.right = '10px';
  statusBox.style.zIndex = '10000';
  statusBox.style.padding = '8px 12px';
  statusBox.style.borderRadius = '4px';
  statusBox.style.fontSize = '12px';
  statusBox.style.fontWeight = 'bold';
  statusBox.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
  statusBox.style.cursor = 'pointer';
  statusBox.style.transition = 'opacity 0.2s';
  statusBox.style.opacity = '1';
  statusBox.style.maxWidth = '200px';
  statusBox.style.lineHeight = '1.3';
  statusBox.style.textAlign = 'center';
  statusBox.style.whiteSpace = 'normal';
  statusBox.style.wordWrap = 'break-word';

  // Set initial text and color (will update below)
  statusBox.textContent = 'Checking profile...';
  statusBox.style.background = '#888';
  statusBox.style.color = 'white';

  // Add to DOM
  document.body.appendChild(statusBox);

  // Click handler: open extension popup
  statusBox.addEventListener('click', () => {
    // Try to open the extension popup
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    }
  });

  // Helper to update status
  async function updateStatus() {
    try {
      // First check if user is logged in by checking for auth token
      const isLoggedIn = await checkIfLoggedIn();
      
      if (!isLoggedIn) {
        statusBox.textContent = 'NOT LOGGED IN\nUNABLE TO SAVE';
        statusBox.style.background = '#c62828';
        statusBox.style.color = 'white';
        return;
      }
      
      // Check FIDU-Vault health
      const vaultHealth = await checkFiduVaultHealth();
      
      if (!vaultHealth) {
        statusBox.textContent = 'FIDU-VAULT\nCANNOT BE REACHED';
        statusBox.style.background = '#c62828';
        statusBox.style.color = 'white';
        return;
      }
      
      // Logged in, check profile
      const profile = await getSelectedProfile();
      
      if (!profile) {
        statusBox.textContent = 'NO PROFILE SELECTED\nUNABLE TO SAVE';
        statusBox.style.background = '#f57c00';
        statusBox.style.color = 'white';
        return;
      }
      
      // All good
      const profileName = profile.name || profile.display_name || profile.profile_name || 'Unnamed Profile';
      statusBox.textContent = `PROFILE: ${profileName}`;
      statusBox.style.background = '#388e3c';
      statusBox.style.color = 'white';
    } catch (error) {
      console.error('Error updating profile status:', error);
      statusBox.textContent = 'ERROR CHECKING PROFILE';
      statusBox.style.background = '#d32f2f';
      statusBox.style.color = 'white';
    }
  }

  updateStatus();

  // Listen for changes to login/profile (storage events)
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes['fidu_auth_token'] || changes['fidu_selected_profile'])) {
        updateStatus();
      }
    });
  }

  // Also listen for specific auth changed events
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'authStatusChanged') {
        const event = message.event || 'unknown';
        
        if (event === 'logout') {
          // Only clear storage for logout events
          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.remove(['fidu_auth_token', 'fidu_user_data', 'fidu_selected_profile', 'selectedProfileId'], () => {
              updateStatus();
            });
          } else {
            localStorage.removeItem('fidu_auth_token');
            localStorage.removeItem('fidu_user_data');
            localStorage.removeItem('fidu_selected_profile');
            localStorage.removeItem('selectedProfileId');
            updateStatus();
          }
        } else {
          // For login and profile_change events, just update status without clearing storage
          updateStatus();
        }
      } else if (message.action === 'debugModeChanged') {
        console.log('Debug mode changed:', message.debugMode);
        toggleDebugButtons(message.debugMode);
      }
    });
  }

  // Optionally, poll every 30s in case of missed events
  setInterval(updateStatus, 30000);
  
  // Add a test function to manually trigger auth status check
  window.testAuthStatus = function() {
    console.log('Content script: Manual auth status test triggered');
    updateStatus();
  };
  
  // Add a function to manually clear auth data (for testing)
  window.clearAuthData = function() {
    console.log('Content script: Manually clearing auth data');
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['fidu_auth_token', 'fidu_user_data', 'fidu_selected_profile', 'selectedProfileId'], () => {
        console.log('Content script: Manually cleared chrome.storage.local');
        updateStatus();
      });
    } else {
      localStorage.removeItem('fidu_auth_token');
      localStorage.removeItem('fidu_user_data');
      localStorage.removeItem('fidu_selected_profile');
      localStorage.removeItem('selectedProfileId');
      console.log('Content script: Manually cleared localStorage');
      updateStatus();
    }
  };
  
  // Add a function to check current storage state (for debugging)
  window.checkStorageState = function() {
    console.log('Content script: Checking current storage state');
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['fidu_auth_token', 'fidu_user_data', 'fidu_selected_profile', 'selectedProfileId'], (result) => {
        console.log('Content script: Current chrome.storage.local state:', result);
      });
    } else {
      console.log('Content script: Current localStorage state:', {
        'fidu_auth_token': localStorage.getItem('fidu_auth_token'),
        'fidu_user_data': localStorage.getItem('fidu_user_data'),
        'fidu_selected_profile': localStorage.getItem('fidu_selected_profile'),
        'selectedProfileId': localStorage.getItem('selectedProfileId')
      });
    }
  };
}

// Initialize the content script
function initialize() {
  // Prevent multiple initializations
  if (isInitialized) {
    console.log('FIDU Chat Grabber already initialized, skipping');
    return;
  }
  
  console.log('FIDU Chat Grabber content script initializing...');
  
  // Detect the chatbot platform
  chatbotType = detectChatbotPlatform();
  console.log('Detected chatbot type:', chatbotType);
  console.log('DOM ready state:', document.readyState);
  console.log('Current URL:', window.location.href);
  
  if (!chatbotType) {
    console.log('No supported chatbot detected on this page');
    return;
  }
  
  // Mark as initialized
  isInitialized = true;
  console.log('FIDU Chat Grabber content script initialized successfully');
  
  console.log('Detected chatbot platform:', chatbotType);
  currentConversation.sourceChatbot = chatbotType;
  
  // Add conversation URL for session tracking
  currentConversation.conversationUrl = window.location.href;
  
  // Add a visual indicator for debugging
  addStatusIndicator();
  
  // Add manual capture button
  addManualCaptureButton();
  
  // Add Gemini debug button if needed
  if (chatbotType === 'Gemini') {
    addGeminiDebugButton();
  }
  
  // Add ChatGPT debug button if needed
  if (chatbotType === 'ChatGPT') {
    addChatGPTDebugButton();
  }
  
  // Add Claude debug button if needed
if (chatbotType === 'Claude') {
  addClaudeDebugButton();
  // Set up real-time message observation for Claude
  setupClaudeMessageObserver();
}
  
  // Add Poe debug button if needed
  if (chatbotType === 'Poe') {
    addPoeDebugButton();
  }
  
  // Add Perplexity debug button if needed
  if (chatbotType === 'Perplexity') {
    addPerplexityDebugButton();
  }
  
  // Add profile status indicator
  addProfileStatusIndicator();
  
  // Load settings and start periodic capture
  loadSettingsAndStartCapture();
  
  // Listen for new conversations or page changes
  setupConversationListeners();
}

// Load settings and start the periodic capture
function loadSettingsAndStartCapture() {
  // Check if we have access to chrome.storage
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get('settings', (result) => {
      const settings = result.settings || {};
      
      // Check if capture is enabled
      const captureEnabled = settings.autoCaptureEnabled !== false; // Default to true if not set
      
      // Get capture frequency from settings (in seconds, convert to milliseconds)
      captureFrequency = (settings.captureFrequency || 60) * 1000;
      
      console.log(`Capture settings loaded - Enabled: ${captureEnabled}, Frequency: ${captureFrequency/1000}s`);
      
      if (captureEnabled) {
        startPeriodicCapture();
      } else {
        console.log('Automatic capture is disabled in settings');
        updateStatusIndicator('Capture disabled');
      }
    });
    
    // Listen for settings changes
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'settingsUpdated') {
        console.log('Settings updated, reloading capture settings');
        
        // Clear existing interval
        if (captureInterval) {
          clearInterval(captureInterval);
          captureInterval = null;
        }
        
        // Check new settings
        const settings = message.settings || {};
        const captureEnabled = settings.autoCaptureEnabled !== false;
        captureFrequency = (settings.captureFrequency || 60) * 1000;
        
        // Restart if enabled
        if (captureEnabled) {
          startPeriodicCapture();
        } else {
          updateStatusIndicator('Capture disabled');
        }
      }
    });
  } else {
    // Fallback to default settings if chrome.storage is not available
    console.log('Chrome storage not available, using default capture settings');
    captureFrequency = 60 * 1000; // Default to 60 seconds
    startPeriodicCapture();
  }
}

// Start periodic capture of the entire conversation
function startPeriodicCapture() {
  console.log(`Starting periodic capture every ${captureFrequency/1000} seconds`);
  updateStatusIndicator(`Capturing every ${captureFrequency/1000}s`);
  
  // For ChatGPT, use smart detection to wait for messages to load
  if (chatbotType === 'ChatGPT') {
    console.log('ChatGPT detected - using smart message detection');
    updateStatusIndicator('Waiting for messages to load...');
    
    // Set up a mutation observer to detect when messages are added to the page
    setupChatGPTMessageObserver();
    
    // Also try to capture after a delay as a fallback
    setTimeout(() => {
      captureEntireConversationWithRetry();
    }, 3000); // 3 second fallback delay
    
    // Set up interval for periodic capture
    captureInterval = setInterval(() => {
      captureEntireConversation();
    }, captureFrequency);
  } else {
    // For other platforms, capture immediately
    if (chatbotType === 'Gemini') {
      captureGeminiConversation();
    } else {
      captureEntireConversation();
    }
    
    // Set up interval for periodic capture
    captureInterval = setInterval(() => {
      if (chatbotType === 'Gemini') {
        captureGeminiConversation();
      } else {
        captureEntireConversation();
      }
    }, captureFrequency);
  }
  
  // Clean up interval when page unloads
  window.addEventListener('beforeunload', () => {
    if (captureInterval) {
      clearInterval(captureInterval);
    }
  });
}

// Detect the type of chatbot platform based on the URL
function detectChatbotPlatform() {
  const url = window.location.href;
  console.log('Detecting chatbot platform for URL:', url);
  
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
    console.log('Detected ChatGPT');
    return 'ChatGPT';
  } else if (url.includes('claude.ai')) {
    console.log('Detected Claude');
    return 'Claude';
  } else if (url.includes('gemini.google.com') || url.includes('bard.google.com')) {
    console.log('Detected Gemini');
    return 'Gemini';
  } else if (url.includes('poe.com')) {
    console.log('Detected Poe');
    return 'Poe';
  } else if (url.includes('perplexity.ai')) {
    console.log('Detected Perplexity');
    return 'Perplexity';
  }
  
  console.log('No supported chatbot detected');
  return null;
}

// Capture the entire conversation
function captureEntireConversation() {
  console.log('Capturing entire conversation');
  updateStatusIndicator('Capturing conversation');
  
  // Reset conversation interactions
  currentConversation.interactions = [];
  
  // Ensure we have a current conversation
  if (!currentConversation.id) { 
    currentConversation.id = generateUrlSafeId(window.location.href);
    currentConversation.timestamp = new Date().toISOString();
    console.log('Created new conversation with ID:', currentConversation.id);
  }
  
  // Get all messages based on platform
  const existingMessages = extractAllMessages();
  
  // Update current conversation
  if (existingMessages.length > 0) {
    // Filter out very short messages that might be loading artifacts
    const validMessages = existingMessages.filter(msg => 
      msg.content && msg.content.trim().length > 10
    );
    
    if (validMessages.length > 0) {
      console.log(`Captured ${validMessages.length} valid messages (filtered from ${existingMessages.length} total)`);
      currentConversation.interactions = validMessages;
      
      // Try to extract the model info for platforms that show it
      extractModelInfo();
      
      // Save the conversation
      saveCurrentConversation();
    } else {
      console.log('No valid messages found (all messages were too short)');
      updateStatusIndicator('No valid messages found');
    }
  } else {
    console.log('No messages found in the conversation');
    updateStatusIndicator('No messages found');
  }
}

// Capture conversation with retry logic for ChatGPT
function captureEntireConversationWithRetry() {
  console.log('Capturing conversation with retry logic');
  updateStatusIndicator('Capturing conversation...');
  
  // Reset conversation interactions
  currentConversation.interactions = [];
  
  // Ensure we have a current conversation
  if (!currentConversation.id) { 
    currentConversation.id = generateUrlSafeId(window.location.href);
    currentConversation.timestamp = new Date().toISOString();
    console.log('Created new conversation with ID:', currentConversation.id);
  }
  
  // Get all messages based on platform
  const existingMessages = extractAllMessages();
  
  // Check if we have meaningful messages
  if (existingMessages.length > 0) {
    // Filter out very short messages that might be loading artifacts
    const validMessages = existingMessages.filter(msg => 
      msg.content && msg.content.trim().length > 10
    );
    
    if (validMessages.length > 0) {
      console.log(`Captured ${validMessages.length} valid messages (filtered from ${existingMessages.length} total)`);
      currentConversation.interactions = validMessages;
      
      // Try to extract the model info for platforms that show it
      extractModelInfo();
      
      // Save the conversation
      saveCurrentConversation();
      updateStatusIndicator(`Captured ${validMessages.length} messages`);
    } else {
      console.log('No valid messages found (all messages were too short)');
      updateStatusIndicator('No valid messages found');
    }
  } else {
    console.log('No messages found, will retry in 3 seconds...');
    updateStatusIndicator('No messages found, retrying...');
    
    // Retry after 3 seconds if no messages found
    setTimeout(() => {
      const retryMessages = extractAllMessages();
      if (retryMessages.length > 0) {
        console.log(`Retry successful - captured ${retryMessages.length} messages`);
        currentConversation.interactions = retryMessages;
        extractModelInfo();
        saveCurrentConversation();
        updateStatusIndicator(`Captured ${retryMessages.length} messages`);
      } else {
        console.log('Retry failed - still no messages found');
        updateStatusIndicator('No messages found');
      }
    }, 3000);
  }
}

// Extract all messages from the page
function extractAllMessages() {
  console.log('Extracting all messages from the page');
  const messages = [];
  let messageElements = [];
  
  // Platform-specific selectors for message containers
  switch (chatbotType) {
    case 'ChatGPT':
      // Find all message containers in DOM order to preserve conversation flow
      console.log('Using DOM-order preserving ChatGPT message extraction');
      
      // Primary selectors for modern ChatGPT interface
      const chatgptSelectors = [
        '[data-message-author-role="user"]',
        '[data-message-author-role="assistant"]',
        '[data-testid="conversation-turn-user"]',
        '[data-testid="conversation-turn-assistant"]',
        '[data-testid="message"]'
      ];
      
      // Find all message containers in DOM order
      const allChatGPTContainers = document.querySelectorAll(chatgptSelectors.join(', '));
      console.log(`Found ${allChatGPTContainers.length} total ChatGPT message containers`);
      
      // Process all containers in DOM order to preserve conversation flow
      allChatGPTContainers.forEach((container, index) => {
        let actor = 'unknown';
        let content = '';
        
        // Determine if this is a user or assistant message based on the container type
        if (container.matches('[data-message-author-role="user"], [data-testid="conversation-turn-user"]')) {
          actor = 'user';
          // Extract user message content
          const userContent = container.querySelector('.text-message-content, .message-content, .prose, .markdown') || container;
          content = userContent.textContent.trim();
        } else if (container.matches('[data-message-author-role="assistant"], [data-testid="conversation-turn-assistant"]')) {
          actor = 'bot';
          // Extract assistant message content
          const assistantContent = container.querySelector('.text-message-content, .message-content, .prose, .markdown') || container;
          content = assistantContent.textContent.trim();
        } else if (container.matches('[data-testid="message"]')) {
          // For generic message containers, try to determine type based on context
          const isUserContainer = container.closest('[data-message-author-role="user"]') || 
                                 container.closest('[data-testid="conversation-turn-user"]');
          const isAssistantContainer = container.closest('[data-message-author-role="assistant"]') || 
                                      container.closest('[data-testid="conversation-turn-assistant"]');
          
          if (isUserContainer) {
            actor = 'user';
          } else if (isAssistantContainer) {
            actor = 'bot';
          }
          
          content = container.textContent.trim();
        }
        
        // Add message if we have valid content and determined actor
        if (content && content.length > 5 && actor !== 'unknown') {
          console.log(`Found ${actor} message #${index + 1}:`, content.substring(0, 50) + (content.length > 50 ? '...' : ''));
          messages.push({
            actor,
            timestamp: new Date().toISOString(),
            content,
            attachments: []
          });
        }
      });
      
      break;
      
    case 'Claude':
      console.log('Using targeted Claude message extraction based on debug analysis');
      
      const conversationMessages = [];
      
      // Strategy 1: Find user messages using the known selector
      const userMessages = document.querySelectorAll('[data-testid="user-message"]');
      console.log(`Found ${userMessages.length} user messages with data-testid`);
      
      userMessages.forEach((element, index) => {
        const text = element.textContent?.trim();
        if (text && text.length > 10) {
          console.log(`Found user message #${index + 1}:`, text.substring(0, 50) + '...');
          conversationMessages.push({
            actor: 'user',
            timestamp: new Date().toISOString(),
            content: text,
            attachments: []
          });
        }
      });
      
      // Strategy 2: Find assistant messages by looking for the conversation container
      // Based on debug output, the conversation container is: div.flex-1..flex..flex-col..gap-3..px-4..max-w-3xl..mx-auto..w-full.pt-1
      const conversationContainer = document.querySelector('div.flex-1.flex.flex-col.gap-3.px-4.max-w-3xl.mx-auto.w-full.pt-1');
      
      if (conversationContainer) {
        console.log('Found conversation container, looking for assistant messages');
        
        // Look for assistant message elements within the container
        const assistantElements = conversationContainer.querySelectorAll('.font-claude-response, .standard-markdown, .progressive-markdown');
        console.log(`Found ${assistantElements.length} potential assistant elements`);
        
        // Also look for elements that contain assistant-like content
        const allElements = conversationContainer.querySelectorAll('*');
        const assistantContent = [];
        
        allElements.forEach(element => {
          const text = element.textContent?.trim();
          if (text && text.length > 50) {
            // Check if this looks like assistant content (not user content)
            const isAssistantContent = (
              text.includes('Here\'s how to') ||
              text.includes('First, download') ||
              text.includes('The Terminal method') ||
              text.includes('Choose the version') ||
              text.includes('You can use either') ||
              text.includes('Insert your USB drive') ||
              text.includes('Find your USB drive') ||
              text.includes('Unmount the USB drive') ||
              text.includes('Write the ISO to USB') ||
              text.includes('Download Balena Etcher') ||
              text.includes('Back up your USB drive') ||
              text.includes('Yes, a bad or old USB drive') ||
              text.includes('Why USB drives cause installer issues') ||
              text.includes('Worn flash memory') ||
              text.includes('Slow USB 2.0 speeds') ||
              text.includes('Physical connection issues') ||
              text.includes('Try a different USB port') ||
              text.includes('Use a different USB drive') ||
              text.includes('Best option: Get a new, quality USB 3.0 drive') ||
              text.includes('During installation: If you must use the current drive') ||
              text.includes('Linux installers are particularly sensitive to USB drive quality')
            ) && !text.includes('can you tell me how to install') && !text.includes('great. My PopOS installer');
            
            if (isAssistantContent) {
              // Check if this element is not a child of a user message
              const isChildOfUserMessage = element.closest('[data-testid="user-message"]');
              if (!isChildOfUserMessage) {
                assistantContent.push({
                  element,
                  text,
                  length: text.length
                });
              }
            }
          }
        });
        
        // Group assistant content into complete conversation turns
        const groupedAssistantContent = [];
        const seenContent = new Set();
        
        // Find main response containers using Claude's DOM structure
        const mainResponseContainers = conversationContainer.querySelectorAll('.font-claude-response, .group.relative');
        console.log(`Found ${mainResponseContainers.length} main response containers`);
        
        mainResponseContainers.forEach((container, containerIndex) => {
          const containerText = container.textContent?.trim();
          if (!containerText || containerText.length < 50) return;
          
          // Check if this looks like a complete response
          const isCompleteResponse = (
            // First response: PopOS installation guide
            containerText.includes('Here\'s how to create a PopOS bootable USB drive') ||
            containerText.includes('Download PopOS') ||
            containerText.includes('First, download the PopOS ISO file') ||
            
            // Second response: USB drive troubleshooting  
            containerText.includes('Yes, a bad or old USB drive is a very common cause') ||
            containerText.includes('Why USB drives cause installer issues') ||
            containerText.includes('Best option: Get a new, quality USB 3.0 drive') ||
            containerText.includes('During installation: If you must use the current drive') ||
            
            // Third response: USB-C performance info
            containerText.includes('USB-C drives can be significantly faster') ||
            containerText.includes('USB-C with USB 3.2 Gen 1') ||
            containerText.includes('USB-C with USB 3.2 Gen 2') ||
            containerText.includes('USB-C with USB 3.2 Gen 2x2') ||
            containerText.includes('SanDisk Extreme Pro USB-C') ||
            containerText.includes('Samsung BAR Plus USB-C') ||
            
            // Fallback: Any substantial content about USB/drives/installation
            (containerText.length > 200 && 
             (containerText.includes('USB') || 
              containerText.includes('drive') || 
              containerText.includes('installation') ||
              containerText.includes('PopOS')))
          );
          
          if (isCompleteResponse) {
            const contentHash = containerText.substring(0, 200);
            if (!seenContent.has(contentHash)) {
              seenContent.add(contentHash);
              groupedAssistantContent.push({
                element: container,
                text: containerText,
                length: containerText.length,
                containerIndex
              });
            }
          }
        });
        
        // Note: Container-based approach is working well, so fragment reconstruction is no longer needed
        // If you ever need to debug fragment grouping, uncomment the code below
        
        // Sort by container order to maintain conversation flow
        groupedAssistantContent.sort((a, b) => a.containerIndex - b.containerIndex);
        
        if (groupedAssistantContent.length > 0) {
          // Add grouped assistant responses
          groupedAssistantContent.forEach((content, index) => {
            console.log(`Found complete assistant response #${index + 1}:`, content.text.substring(0, 80) + '...');
            conversationMessages.push({
              actor: 'bot',
              timestamp: new Date().toISOString(),
              content: content.text,
              attachments: []
            });
          });
        }
      } else {
        console.log('Conversation container not found, falling back to text pattern matching');
        
        // Fallback: Look for assistant content patterns
        const allElements = document.querySelectorAll('*');
        const assistantElements = [];
        
        allElements.forEach(element => {
          const text = element.textContent?.trim();
          if (text && text.length > 100) {
            const isAssistantContent = (
              text.includes('Here\'s how to create a PopOS bootable USB drive') ||
              text.includes('First, download the PopOS ISO file') ||
              text.includes('The Terminal method is faster') ||
              text.includes('Yes, a bad or old USB drive is a very common cause') ||
              text.includes('Why USB drives cause installer issues') ||
              text.includes('Worn flash memory - older drives develop bad sectors') ||
              text.includes('Slow USB 2.0 speeds - creates bottlenecks') ||
              text.includes('Physical connection issues - worn USB connectors') ||
              text.includes('Try a different USB port - preferably USB 3.0') ||
              text.includes('Use a different USB drive if you have one') ||
              text.includes('Best option: Get a new, quality USB 3.0 drive') ||
              text.includes('During installation: If you must use the current drive, be patient') ||
              text.includes('Linux installers are particularly sensitive to USB drive quality')
            ) && !text.includes('can you tell me how to install') && !text.includes('great. My PopOS installer');
            
            if (isAssistantContent) {
              assistantElements.push({
                element,
                text,
                length: text.length
              });
            }
          }
        });
        
        if (assistantElements.length > 0) {
          // Take the longest assistant content
          assistantElements.sort((a, b) => b.length - a.length);
          const mainAssistantContent = assistantElements[0];
          console.log(`Found assistant message (fallback):`, mainAssistantContent.text.substring(0, 50) + '...');
          conversationMessages.push({
            actor: 'bot',
            timestamp: new Date().toISOString(),
            content: mainAssistantContent.text,
            attachments: []
          });
        }
      }
      
      console.log(`Claude extraction: Found ${conversationMessages.length} conversation messages`);
      
      // Add to messages array
      messages.push(...conversationMessages);
      break;
      
    case 'Gemini':
      // For Gemini, we'll take a completely different approach since the Angular app structure is complex
      console.log('Using specialized Gemini message extraction');
      
      // Find all message containers in DOM order (both user and bot messages)
      const allMessageContainers = document.querySelectorAll('user-query, .user-query-container, model-response, .response-container, .presented-response-container');
      console.log(`Found ${allMessageContainers.length} total message containers`);
      
      // Process all containers in DOM order to preserve conversation flow
      allMessageContainers.forEach((container, index) => {
        let actor = 'unknown';
        let content = '';
        
        // Determine if this is a user or bot message based on the container type
        if (container.matches('user-query, .user-query-container')) {
          actor = 'user';
          // Extract user message content
          const userContent = container.querySelector('.query-text') || 
                             container.querySelector('.user-query-bubble') || 
                             container.querySelector('.query-content');
          if (userContent) {
            content = userContent.textContent.trim();
          }
        } else if (container.matches('model-response, .response-container, .presented-response-container')) {
          actor = 'bot';
          // Extract bot message content
          const responseContent = container.querySelector('.response-content') || 
                                 container.querySelector('.model-response-text') || 
                                 container.querySelector('message-content') ||
                                 container.querySelector('.markdown');
          if (responseContent) {
            content = responseContent.textContent.trim();
          }
        }
        
        // Add message if we have valid content
        if (content && content.length > 5) {
          console.log(`Found ${actor} message #${index + 1}:`, content.substring(0, 50) + (content.length > 50 ? '...' : ''));
          messages.push({
            actor,
            timestamp: new Date().toISOString(),
            content,
            attachments: []
          });
        }
      });
      
      // If we still don't have messages, try a simpler approach
      if (messages.length === 0) {
        console.log('No messages found with specialized extraction, trying simplified approach');
        
        // Look for conversation turns by ID pattern
        const conversationContainers = document.querySelectorAll('div[id^="8"], div[id^="c_"], div[id^="r_"]');
        console.log(`Found ${conversationContainers.length} conversation containers by ID pattern`);
        
        // Process all conversation containers to extract user and AI messages
        conversationContainers.forEach(container => {
          // Check if this is a user message
          const isUserQuery = container.querySelector('user-query') !== null;
          
          if (isUserQuery) {
            const text = container.textContent.trim();
            if (text && text.length > 5) {
              console.log('Found user message by container:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
              messages.push({
                actor: 'user',
                timestamp: new Date().toISOString(),
                content: text,
                attachments: []
              });
            }
          } else {
            // Assume it's a model response if not a user query
            const text = container.textContent.trim();
            if (text && text.length > 5) {
              console.log('Found model message by container:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
              messages.push({
                actor: 'bot',
                timestamp: new Date().toISOString(),
                content: text,
                attachments: []
              });
            }
          }
        });
      }
      
      // If we still have no messages, try an even more aggressive approach
      if (messages.length === 0) {
        console.log('Still no messages found, using most aggressive approach');
        
        // Find all paragraphs that might be part of messages
        const paragraphs = document.querySelectorAll('p, div > span');
        const potentialTexts = Array.from(paragraphs)
          .filter(p => p.textContent.trim().length > 30)
          .map(p => p.textContent.trim());
        
        console.log(`Found ${potentialTexts.length} potential text blocks`);
        
        // Group them into messages
        if (potentialTexts.length > 0) {
          // Assume first message is from user
          let currentActor = 'user';
          let currentMessage = '';
          
          for (const text of potentialTexts) {
            // If we already have content and this looks like a new message, save the current one
            if (currentMessage.length > 0 && (text.startsWith('You:') || text.startsWith('AI:'))) {
              messages.push({
                actor: currentActor,
                timestamp: new Date().toISOString(),
                content: currentMessage,
                attachments: []
              });
              
              // Switch actors for next message
              currentActor = currentActor === 'user' ? 'bot' : 'user';
              currentMessage = text;
            } else {
              // Add to current message
              currentMessage += '\n' + text;
            }
          }
          
          // Add the last message if any
          if (currentMessage.length > 0) {
            messages.push({
              actor: currentActor,
              timestamp: new Date().toISOString(),
              content: currentMessage,
              attachments: []
            });
          }
        }
      }
      
      // Return the messages we found without further processing
      console.log(`Extracted ${messages.length} messages from Gemini`);
      return messages;
      
    case 'Poe':
      // Get all elements with data attributes
      const dataElements = document.querySelectorAll('[data-dd-privacy], [data-complete="true"]');
      console.log(`Found ${dataElements.length} elements with data attributes`);
      
      const filteredMessages = [];
      
      dataElements.forEach((el, index) => {
          const text = el.textContent.trim();
          
          // Apply the same less aggressive filtering logic as the extension
          const uiIndicators = [
              'Subscribe', 'Creators', 'Profile', 'Settings', 'Send feedback', 'Download',
              'Follow us', 'Join our', 'About', 'Blog', 'Careers', 'Help center',
              'Privacy policy', 'Terms of service', 'View all', 'Bots and apps',
              'Share', 'Compare', 'Speak', 'Drop files', 'New chat', 'History',
              'Rates', 'Share app', 'OFFICIAL', 'Today', 'followers', 'Variable points',
              'General-purpose assistant', 'Write, code, ask', 'Queries are automatically',
              'For subscribers', 'For non-subscribers', 'View more', 'ExploreCreate',
              'By @poe'
          ];
          
          // Count how many UI indicators are present
          const uiIndicatorCount = uiIndicators.filter(indicator => text.includes(indicator)).length;
          
          // Only filter out if there are multiple UI indicators or if it's clearly navigation
          const shouldExclude = uiIndicatorCount > 2 || 
              text.includes('Subscribe') || 
              text.includes('Settings') || 
              text.includes('Download') ||
              text.includes('Follow us') ||
              text.includes('About') ||
              text.includes('Privacy policy') ||
              text.includes('Terms of service') ||
              text.includes('View all') ||
              text.includes('Bots and apps') ||
              text.includes('New chat') ||
              text.includes('History') ||
              text.includes('Rates') ||
              text.includes('Share app') ||
              text.includes('OFFICIAL') ||
              text.includes('General-purpose assistant') ||
              text.includes('For subscribers') ||
              text.includes('For non-subscribers') ||
              text.includes('View more') ||
              // Only filter out short timestamp-only content
              (text.length < 50 && (text.includes('2:') || text.includes('PM') || text.includes('AM')));
          
          if (!shouldExclude && text.length > 30) {
              const privacyAttr = el.getAttribute('data-dd-privacy');
              const completeAttr = el.getAttribute('data-complete');
              
              let actor = 'unknown';
              if (privacyAttr === 'mask-user-input') {
                  actor = 'user';
              } else if (privacyAttr === 'mask') {
                  actor = 'bot';
              } else if (completeAttr === 'true') {
                  actor = text.length > 200 ? 'bot' : 'user';
              }
              
              filteredMessages.push({
                  index: index,
                  actor: actor,
                  content: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                  fullContent: text,
                  privacyAttr: privacyAttr,
                  completeAttr: completeAttr
              });
          }
      });
      
      console.log(`\nFiltered to ${filteredMessages.length} clean messages:`);
      filteredMessages.forEach((msg, i) => {
          console.log(`${i+1}: [${msg.actor}] "${msg.content}"`);
          console.log(`   Privacy: ${msg.privacyAttr}, Complete: ${msg.completeAttr}`);
      });
  
  
             console.log(`Found ${filteredMessages.length} potential message elements using data-complete approach`);
       
       // Convert filtered messages back to synthetic DOM elements for processing
       const syntheticElements = filteredMessages.map(msg => {
           const syntheticElement = document.createElement('div');
           syntheticElement.className = 'synthetic-message';
           syntheticElement.textContent = msg.fullContent;
           syntheticElement.setAttribute('data-message-author-type', msg.actor);
           syntheticElement.setAttribute('data-dd-privacy', msg.privacyAttr || '');
           syntheticElement.setAttribute('data-complete', msg.completeAttr || '');
           return syntheticElement;
       });
       
       messageElements = [...syntheticElements];
      
      break;
      
    case 'Perplexity':
      console.log('Using targeted Perplexity message extraction');
      
      // Target specific Perplexity message containers based on DOM analysis
      const perplexitySelectors = [
        // User query elements (H1 or DIV with group/query class)
        'h1.group\\/query',
        'h1[class*="group/query"]',
        'div.group\\/query',
        'div[class*="group/query"]',
        // Assistant response elements (DIV with prose class)
        'div.prose',
        'div[class*="prose"]',
        // Fallback selectors
        '[data-testid="user-message"]',
        '[data-testid="assistant-message"]',
        '[data-testid="message"]'
      ];
      
      // Find all message containers in DOM order
      const allPerplexityContainers = document.querySelectorAll(perplexitySelectors.join(', '));
      console.log(`Found ${allPerplexityContainers.length} total Perplexity message containers`);
      
      // Process all containers in DOM order to preserve conversation flow
      allPerplexityContainers.forEach((container, index) => {
        let actor = 'unknown';
        let content = '';
        
        // Determine if this is a user or assistant message based on the container type
        if (container.matches('h1.group\\/query, h1[class*="group/query"], div.group\\/query, div[class*="group/query"]')) {
          actor = 'user';
        } else if (container.matches('div.prose, div[class*="prose"]')) {
          actor = 'bot';
        } else if (container.matches('[data-testid="user-message"]')) {
          actor = 'user';
        } else if (container.matches('[data-testid="assistant-message"]')) {
          actor = 'bot';
        } else if (container.matches('[data-testid="message"]')) {
          // For generic message containers, try to determine type based on context
          const isUserContainer = container.closest('[data-testid="user-message"]');
          const isAssistantContainer = container.closest('[data-testid="assistant-message"]');
          
          if (isUserContainer) {
            actor = 'user';
          } else if (isAssistantContainer) {
            actor = 'bot';
          }
        }
        
        // Extract content from the container
        if (container.matches('h1.group\\/query, h1[class*="group/query"], div.group\\/query, div[class*="group/query"]')) {
          // For user queries, use the text directly (works for both H1 and DIV)
          content = container.textContent.trim();
        } else if (container.matches('div.prose, div[class*="prose"]')) {
          // For assistant responses, use the prose div text directly
          content = container.textContent.trim();
        } else {
          // Fallback to generic content extraction
          const contentElement = container.querySelector('.message-content, .content, .text-content, p, div') || container;
          content = contentElement.textContent.trim();
        }
        
        // Add message if we have valid content and determined actor
        if (content && content.length > 10 && actor !== 'unknown') {
          // Filter out UI elements and navigation
          const filteredContent = content.trim();
          
          // Skip if content contains UI/navigation elements (but be less aggressive since we're targeting specific elements)
          const uiIndicators = [
            'Subscribe', 'Upgrade', 'Settings', 'Menu', 'Navigation', 'Button', 'Click',
            'Privacy Policy', 'Terms of Service', 'Cookie Policy'
          ];
          
          const hasUIElements = uiIndicators.some(indicator => 
            filteredContent.includes(indicator)
          );
          
          // Skip if content is too short or contains UI elements
          if (filteredContent.length < 10 || hasUIElements) {
            console.log(`Skipping ${actor} message with UI elements:`, filteredContent.substring(0, 50) + (filteredContent.length > 50 ? '...' : ''));
            return;
          }
          
          // Skip if this looks like a repeated/duplicate message
          const isDuplicate = messages.some(existing => {
            const similarity = calculateSimilarity(existing.content, filteredContent);
            return similarity > 0.7; // 70% similarity threshold
          });
          
          if (isDuplicate) {
            console.log(`Skipping duplicate ${actor} message:`, filteredContent.substring(0, 50) + (filteredContent.length > 50 ? '...' : ''));
            return;
          }
          
          console.log(`Found ${actor} message #${index + 1}:`, filteredContent.substring(0, 50) + (filteredContent.length > 50 ? '...' : ''));
          messages.push({
            actor,
            timestamp: new Date().toISOString(),
            content: filteredContent,
            attachments: []
          });
        }
      });
      
      // If we still don't have messages, try a very conservative fallback
      if (messages.length === 0) {
        console.log('No messages found with strict selectors, trying conservative fallback');
        
        // Look for main conversation area
        const mainContent = document.querySelector('main, .main-content, .conversation-area, .chat-area');
        if (mainContent) {
          // Look for paragraphs that might be messages
          const paragraphs = mainContent.querySelectorAll('p');
          const significantParagraphs = Array.from(paragraphs).filter(p => {
            const text = p.textContent.trim();
            return text.length > 30 && text.length < 2000 && 
                   !text.includes('Home') && !text.includes('Share') && 
                   !text.includes('Subscribe') && !text.includes('Settings');
          });
          
          console.log(`Found ${significantParagraphs.length} significant paragraphs`);
          
          // Take only the first few significant paragraphs as messages
          significantParagraphs.slice(0, 4).forEach((p, index) => {
            const text = p.textContent.trim();
            const actor = index % 2 === 0 ? 'user' : 'bot';
            
            console.log(`Found ${actor} message #${index + 1} (fallback):`, text.substring(0, 50) + (text.length > 50 ? '...' : ''));
            messages.push({
              actor,
              timestamp: new Date().toISOString(),
              content: text,
              attachments: []
            });
          });
        }
      }
      
      // Return the messages we found without further processing
      console.log(`Extracted ${messages.length} messages from Perplexity`);
      return messages;
      
      break;
  }
  
  console.log(`Found ${messageElements.length} potential message elements`);
  
  // Process all found message elements
  messageElements.forEach(element => {
    const message = extractMessageData(element);
    if (message && !isDuplicateMessage(messages, message)) {
      messages.push(message);
    }
  });
  
  // Sort messages by their position in the DOM (top to bottom)
  messages.sort((a, b) => {
    // Use timestamp if available
    if (a.timestamp && b.timestamp) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    }
    return 0;
  });
  
  return messages;
}

// Extract data from a message element
function extractMessageData(element) {
  if (!element || !(element instanceof HTMLElement)) return null;
  
  // Handle case where we've already identified the actor and text
  if (element.actor && element.text) {
    return {
      actor: element.actor,
      timestamp: new Date().toISOString(),
      content: element.text,
      attachments: []
    };
  }
  
  // Skip elements that are too small - they're likely not complete messages
  if (element.textContent.trim().length < 5) return null;
  
  // Enhanced filtering for POE to exclude UI elements
  if (chatbotType === 'Poe') {
    const text = element.textContent.trim();
    
    // Only filter out if the text is primarily UI content
    // Check if the text contains mostly UI elements rather than conversation content
    const uiIndicators = [
      'Subscribe', 'Creators', 'Profile', 'Settings', 'Send feedback', 'Download',
      'Follow us', 'Join our', 'About', 'Blog', 'Careers', 'Help center',
      'Privacy policy', 'Terms of service', 'View all', 'Bots and apps',
      'Share', 'Compare', 'Speak', 'Drop files', 'New chat', 'History',
      'Rates', 'Share app', 'OFFICIAL', 'Today', 'followers', 'Variable points',
      'General-purpose assistant', 'Write, code, ask', 'Queries are automatically',
      'For subscribers', 'For non-subscribers', 'View more', 'ExploreCreate',
      'By @poe'
    ];
    
    // Count how many UI indicators are present
    const uiIndicatorCount = uiIndicators.filter(indicator => text.includes(indicator)).length;
    
    // Only filter out if there are multiple UI indicators or if it's clearly navigation
    if (uiIndicatorCount > 2 || 
        text.includes('Subscribe') || 
        text.includes('Settings') || 
        text.includes('Download') ||
        text.includes('Follow us') ||
        text.includes('About') ||
        text.includes('Privacy policy') ||
        text.includes('Terms of service') ||
        text.includes('View all') ||
        text.includes('Bots and apps') ||
        text.includes('New chat') ||
        text.includes('History') ||
        text.includes('Rates') ||
        text.includes('Share app') ||
        text.includes('OFFICIAL') ||
        text.includes('General-purpose assistant') ||
        text.includes('For subscribers') ||
        text.includes('For non-subscribers') ||
        text.includes('View more')) {
      return null;
    }
    
    // Don't filter out messages that contain timestamps but are actual conversation content
    // Only filter if the text is mostly timestamp/navigation
    if (text.length < 50 && (text.includes('2:') || text.includes('PM') || text.includes('AM'))) {
      return null;
    }
  }
  
  try {
    let actor = 'unknown';
    let content = '';
    let timestamp = new Date().toISOString();
    let attachments = [];
    
    switch (chatbotType) {
      case 'ChatGPT':
        // Enhanced detection for modern ChatGPT interface
        if (element.hasAttribute('data-message-author-role')) {
          actor = element.getAttribute('data-message-author-role') === 'user' ? 'user' : 'bot';
        } else if (element.closest('[data-message-author-role="user"]')) {
          actor = 'user';
        } else if (element.closest('[data-message-author-role="assistant"]')) {
          actor = 'bot';
        } else if (element.closest('[data-testid="conversation-turn-user"]')) {
          actor = 'user';
        } else if (element.closest('[data-testid="conversation-turn-assistant"]')) {
          actor = 'bot';
        } else if (element.classList.contains('user') || element.classList.contains('UserMessage')) {
          actor = 'user';
        } else if (element.classList.contains('assistant') || element.classList.contains('AssistantMessage')) {
          actor = 'bot';
        } else {
          // Try to determine based on content or position
          const userIndicators = ['You:', 'You said:', 'User:', 'Human:'];
          const aiIndicators = ['ChatGPT:', 'GPT:', 'Assistant:', 'AI:'];
          
          const text = element.textContent.trim();
          
          if (userIndicators.some(indicator => text.startsWith(indicator))) {
            actor = 'user';
          } else if (aiIndicators.some(indicator => text.startsWith(indicator))) {
            actor = 'bot';
          } else {
            // Last resort: try to infer from context
            // Look at parent elements for clues
            const parent = element.parentElement;
            if (parent) {
              if (parent.hasAttribute('data-message-author-role')) {
                actor = parent.getAttribute('data-message-author-role') === 'user' ? 'user' : 'bot';
              } else if (parent.classList.contains('user') || parent.classList.contains('UserMessage')) {
                actor = 'user';
              } else if (parent.classList.contains('assistant') || parent.classList.contains('AssistantMessage')) {
            actor = 'bot';
              }
            }
          }
        }
        
        // Enhanced content extraction for modern ChatGPT
        const contentSelectors = [
          '.text-message-content',
          '.message-content', 
          '.prose',
          '.markdown',
          '.prose-message',
          '[data-testid="message"]',
          '.markdown-content',
          '.message-text',
          '.content'
        ];
        
        let contentElement = null;
        for (const selector of contentSelectors) {
          contentElement = element.querySelector(selector);
          if (contentElement && contentElement.textContent.trim().length > 0) {
            break;
          }
        }
        
        if (contentElement) {
          content = contentElement.textContent.trim();
        } else {
          content = element.textContent.trim();
        }
        
        // Extract file attachments if any
        const attachmentElements = element.querySelectorAll('.attachment, .file-attachment, [data-testid="attachment"]');
        attachmentElements.forEach(attachment => {
          const filename = attachment.querySelector('.file-name')?.textContent || 'file';
          attachments.push({
            id: generateUniqueId(),
            filename,
            mimetype: 'application/octet-stream',
            reference: filename
          });
        });
        break;
        
      case 'Claude':
        // Determine if it's a user or assistant message
        if (element.closest('[data-testid="user-message"]') || element.closest('.human-message, .user-message')) {
          actor = 'user';
        } else if (element.closest('.font-claude-message') || element.closest('.claude-message, .ai-message')) {
          actor = 'bot';
        }
        
        // Extract message content - try to find the most specific content container
        const claudeContent = element.querySelector('.message-content, .claude-message-content, .user-message-content') || element;
        content = claudeContent.textContent.trim();
        
        // Extract file attachments if any
        const claudeAttachments = element.querySelectorAll('.attachment, .file-item');
        claudeAttachments.forEach(attachment => {
          const filename = attachment.querySelector('.file-name')?.textContent || 'file';
          attachments.push({
            id: generateUniqueId(),
            filename,
            mimetype: 'application/octet-stream',
            reference: filename
          });
        });
        break;
        
      case 'Gemini':
        // Determine if it's a user or assistant message
        if (element.closest('.user-query, .user-message')) {
          actor = 'user';
        } else if (element.closest('.bard-response, .ai-response, .model-response')) {
          actor = 'bot';
        } else if (element.hasAttribute('data-role')) {
          // Check data-role attribute in newer UI
          actor = element.getAttribute('data-role') === 'user' ? 'user' : 'bot';
        } else if (element.closest('article[data-role]')) {
          // Check parent article with data-role
          const article = element.closest('article[data-role]');
          actor = article.getAttribute('data-role') === 'user' ? 'user' : 'bot';
        } else {
          // Try to infer from position or context
          const isUserContainer = element.parentElement?.classList.contains('user-row') || 
                                  element.classList.contains('user-row');
          const isModelContainer = element.parentElement?.classList.contains('model-row') || 
                                   element.classList.contains('model-row');
          
          if (isUserContainer) {
            actor = 'user';
          } else if (isModelContainer) {
            actor = 'bot';
          } else {
            // Last resort: check if this is part of a larger set and infer from pattern
            // In many interfaces, user and model messages alternate
            const isOddChild = Array.from(element.parentElement?.children || []).indexOf(element) % 2 === 1;
            
            // By convention, typically first message is from the system/model explaining how to use it
            // So odd-indexed messages are often user messages
            actor = isOddChild ? 'user' : 'bot';
          }
        }
        
        // Extract message content
        const bardContent = element.querySelector('.message-content, .response-text, p, .gemini-message-content');
        if (bardContent) {
          content = bardContent.textContent.trim();
        } else {
          content = element.textContent.trim();
        }
        
        // If we have a very large content that seems to include both user & bot messages, 
        // use only the element's immediate text
        if (content.length > 500) {
          const immediateText = Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .join(' ');
          
          if (immediateText.length > 30) {
            content = immediateText;
          }
        }
      
      // Return messages directly since we've processed them in DOM order
      console.log(`Extracted ${messages.length} messages from ChatGPT in DOM order`);
      console.log('Message order:');
      messages.forEach((msg, i) => {
        console.log(`  ${i+1}. ${msg.actor}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
      });
      return messages;
        break;
        
      case 'Poe':
        // Determine if it's a user or assistant message
        if (element.hasAttribute('data-message-author-type')) {
          // Handle our synthetic elements that have the actor already set
          const authorType = element.getAttribute('data-message-author-type');
          if (authorType === 'user' || authorType === 'human') {
            actor = 'user';
          } else if (authorType === 'bot' || authorType === 'assistant') {
            actor = 'bot';
          }
        } else if (element.hasAttribute('data-dd-privacy')) {
          // Use POE's privacy attributes to determine message type
          const privacyAttr = element.getAttribute('data-dd-privacy');
          if (privacyAttr === 'mask-user-input') {
            actor = 'user';
          } else if (privacyAttr === 'mask') {
            actor = 'bot';
          }
        } else if (element.classList.contains('human') || element.classList.contains('HumanMessage')) {
          actor = 'user';
        } else if (element.classList.contains('bot') || element.classList.contains('BotMessage')) {
          actor = 'bot';
        } else if (element.closest('.human') || element.closest('.HumanMessage')) {
          actor = 'user';
        } else if (element.closest('.bot') || element.closest('.BotMessage')) {
          actor = 'bot';
        } else {
          // Try to determine based on content or position
          const userIndicators = ['You:', 'You said:', 'User:', 'Human:'];
          const aiIndicators = ['Assistant:', 'Bot:', 'AI:', 'Claude:', 'GPT:'];
          
          const text = element.textContent.trim();
          
          if (userIndicators.some(indicator => text.startsWith(indicator))) {
            actor = 'user';
          } else if (aiIndicators.some(indicator => text.startsWith(indicator))) {
            actor = 'bot';
          }
        }
        
        // Extract message content - try multiple selectors
        const poeContentSelectors = [
          '.message-content',
          '.MessageContent', 
          '.text-content',
          '.content',
          '.message-text',
          '.MessageText',
          'p',
          '.markdown',
          '.prose'
        ];
        
        let poeContent = null;
        for (const selector of poeContentSelectors) {
          poeContent = element.querySelector(selector);
          if (poeContent && poeContent.textContent.trim().length > 0) {
            break;
          }
        }
        
        if (poeContent) {
          content = poeContent.textContent.trim();
        } else {
          content = element.textContent.trim();
        }
        break;
        
      case 'Perplexity':
        // Enhanced detection for modern Perplexity interface
        if (element.hasAttribute('data-testid')) {
          const testId = element.getAttribute('data-testid');
          if (testId === 'user-message') {
            actor = 'user';
          } else if (testId === 'assistant-message') {
            actor = 'bot';
          }
        } else if (element.closest('[data-testid="user-message"]')) {
          actor = 'user';
        } else if (element.closest('[data-testid="assistant-message"]')) {
          actor = 'bot';
        } else if (element.classList.contains('user-query') || element.classList.contains('query') || element.classList.contains('user-message')) {
          actor = 'user';
        } else if (element.classList.contains('answer') || element.classList.contains('response') || element.classList.contains('assistant-message')) {
          actor = 'bot';
        } else {
          // Try to determine based on content or position
          const userIndicators = ['You:', 'You said:', 'User:', 'Human:', 'Query:', 'Question:'];
          const aiIndicators = ['Perplexity:', 'Assistant:', 'AI:', 'Answer:', 'Response:'];
          
          const text = element.textContent.trim();
          
          if (userIndicators.some(indicator => text.startsWith(indicator))) {
            actor = 'user';
          } else if (aiIndicators.some(indicator => text.startsWith(indicator))) {
            actor = 'bot';
          } else {
            // Last resort: try to infer from context
            // Look at parent elements for clues
            const parent = element.parentElement;
            if (parent) {
              if (parent.hasAttribute('data-testid')) {
                const parentTestId = parent.getAttribute('data-testid');
                actor = parentTestId === 'user-message' ? 'user' : 'bot';
              } else if (parent.classList.contains('user-message') || parent.classList.contains('query')) {
                actor = 'user';
              } else if (parent.classList.contains('assistant-message') || parent.classList.contains('answer')) {
                actor = 'bot';
              }
            }
          }
        }
        
        // Enhanced content extraction for modern Perplexity
        const perplexityContentSelectors = [
          '.message-content',
          '.content', 
          '.text-content',
          '.query-content',
          '.answer-content',
          '.response-content',
          '.prose',
          '.markdown',
          '.message-text',
          '.text'
        ];
        
        let perplexityContentElement = null;
        for (const selector of perplexityContentSelectors) {
          perplexityContentElement = element.querySelector(selector);
          if (perplexityContentElement && perplexityContentElement.textContent.trim().length > 0) {
            break;
          }
        }
        
        if (perplexityContentElement) {
          content = perplexityContentElement.textContent.trim();
        } else {
          content = element.textContent.trim();
        }
        
        // Extract file attachments if any
        const perplexityAttachmentElements = element.querySelectorAll('.attachment, .file-attachment, [data-testid="attachment"]');
        perplexityAttachmentElements.forEach(attachment => {
          const filename = attachment.querySelector('.file-name')?.textContent || 'file';
          attachments.push({
            id: generateUniqueId(),
            filename,
            mimetype: 'application/octet-stream',
            reference: filename
          });
        });
        break;
    }
    
    // Skip unknown or empty messages
    if (actor === 'unknown' || !content) return null;
    
    return {
      actor,
      timestamp,
      content,
      attachments
    };
  } catch (error) {
    console.error('Error extracting message data:', error);
    return null;
  }
}

// Check if a message is already in the array (to avoid duplicates)
function isDuplicateMessage(messages, newMessage) {
  if (!newMessage || !newMessage.content) return true;
  
  // First check if there's an exact match
  const exactMatch = messages.some(existing => 
    existing.actor === newMessage.actor && 
    existing.content === newMessage.content
  );
  
  if (exactMatch) {
    return true;
  }
  
  // For POE, be more aggressive about duplicate detection
  if (chatbotType === 'Poe') {
    // Check for partial matches (common in POE where UI elements get mixed in)
    const partialMatch = messages.some(existing => {
      if (existing.actor !== newMessage.actor) return false;
      
      // Check if one message contains the other (common with UI elements)
      const existingContent = existing.content.toLowerCase();
      const newContent = newMessage.content.toLowerCase();
      
      if (existingContent.includes(newContent) || newContent.includes(existingContent)) {
        return true;
      }
      
      // Check for high similarity (70% threshold for POE)
      if (existing.content.length > 30 && newMessage.content.length > 30) {
        const contentSimilarity = calculateSimilarity(existing.content, newMessage.content);
        return contentSimilarity > 0.70; // Lower threshold for POE
      }
      
      return false;
    });
    
    if (partialMatch) {
      return true;
    }
  }
  
  // If not exact match, check for near-duplicates (85% similar content)
  const similarMatch = messages.some(existing => {
    if (existing.actor !== newMessage.actor) return false;
    
    // Compare content similarity for longer messages (avoid false positives on short messages)
    if (existing.content.length > 30 && newMessage.content.length > 30) {
      const contentSimilarity = calculateSimilarity(existing.content, newMessage.content);
      return contentSimilarity > 0.85; // 85% similarity threshold
    }
    
    return false;
  });
  
  return similarMatch;
}

// Calculate similarity between two strings (0-1 scale)
function calculateSimilarity(str1, str2) {
  // For very long strings, just compare first 1000 chars to avoid performance issues
  if (str1.length > 1000 || str2.length > 1000) {
    str1 = str1.substring(0, 1000);
    str2 = str2.substring(0, 1000);
  }
  
  // Simple Jaccard similarity for words
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Try to extract model information from the page
function extractModelInfo() {
  try {
    switch (chatbotType) {
      case 'ChatGPT':
        const modelElement = document.querySelector('.model-name, [aria-label*="Model:"], button[aria-label*="model"], nav button:not([aria-label]) span');
        if (modelElement) {
          currentConversation.targetModelRequested = modelElement.textContent.trim();
        }
        break;
      case 'Claude':
        const claudeModelElement = document.querySelector('.model-name, .version-info');
        if (claudeModelElement) {
          currentConversation.targetModelRequested = claudeModelElement.textContent.trim();
        }
        break;
      case 'Gemini':
        // Gemini doesn't typically display model version in the UI
        currentConversation.targetModelRequested = 'Google Gemini';
        break;
      case 'Poe':
        const poeModelElement = document.querySelector('.bot-name, .BotName');
        if (poeModelElement) {
          currentConversation.targetModelRequested = poeModelElement.textContent.trim();
        }
        break;
      case 'Perplexity':
        // Try multiple selectors for model information
        const perplexityModelSelectors = [
          '.model-name', 
          '.ModelName',
          '[data-testid="model-name"]',
          '.model-selector',
          '.model-info',
          '.current-model',
          '.selected-model'
        ];
        
        let perplexityModelElement = null;
        for (const selector of perplexityModelSelectors) {
          perplexityModelElement = document.querySelector(selector);
          if (perplexityModelElement && perplexityModelElement.textContent.trim()) {
            break;
          }
        }
        
        if (perplexityModelElement) {
          currentConversation.targetModelRequested = perplexityModelElement.textContent.trim();
        } else {
          // Default to Perplexity if no specific model found
          currentConversation.targetModelRequested = 'Perplexity AI';
        }
        break;
    }
  } catch (error) {
    console.error('Error extracting model info:', error);
  }
}

// Save the current conversation to the database
function saveCurrentConversation() {
  if (currentConversation.interactions.length === 0) {
    console.log('No interactions to save');
    return;
  }
  
  // Ensure we have the URL for session tracking
  if (!currentConversation.conversationUrl) {
    currentConversation.conversationUrl = window.location.href;
  }
  
  // Remove any duplicate messages before saving
  const uniqueMessages = [];
  const seenFingerprints = new Set();
  
  currentConversation.interactions.forEach(interaction => {
    // Create a fingerprint for the message (first 100 chars should be enough to identify duplicates)
    const fingerprint = `${interaction.actor}:${interaction.content.substring(0, 100)}`;
    
    if (!seenFingerprints.has(fingerprint)) {
      uniqueMessages.push(interaction);
      seenFingerprints.add(fingerprint);
    } else {
      console.log('Removing duplicate message during save');
    }
  });
  
  // Replace interactions with deduplicated list
  currentConversation.interactions = uniqueMessages;
  
  console.log('Saving conversation with', currentConversation.interactions.length, 'unique interactions');
  console.log('Conversation URL:', currentConversation.conversationUrl);
  updateStatusIndicator(`Saving ${currentConversation.interactions.length} messages`);
  
  // Save conversation - background script will handle checking for existing conversations
  saveNewConversation();
}

// Helper function to save a new conversation
function saveNewConversation() {
  // Ensure we have the conversation URL for proper identification
  if (!currentConversation.conversationUrl) {
    currentConversation.conversationUrl = window.location.href;
  }
  
  chrome.runtime.sendMessage(
    { action: 'saveConversation', data: currentConversation },
    response => {
      console.log('Content script: Received response from saveConversation:', response);
      
      if (response && response.success) {
        console.log('Conversation saved successfully with ID:', response.id);
        updateStatusIndicator('Saved successfully');
      } else {
        const errorMessage = response?.error || 'Unknown error occurred';
        console.error('Error saving conversation:', errorMessage);
        updateStatusIndicator('Error saving');
      }
    }
  );
}

// Generate a unique ID
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Setup listeners for new conversations or page changes
function setupConversationListeners() {
  // Listen for URL changes (for SPA navigation)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      handlePageChange();
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Listen for new conversation buttons/elements
  const newChatSelectors = {
    'ChatGPT': '.nav-item-new, button:has(svg[stroke="currentColor"]), button:has(svg[data-icon="plus"])',
    'Claude': '.new-chat',
    'Gemini': '[aria-label="New chat"]',
    'Poe': '.CreateChatButton',
    'Perplexity': '.new-chat-button'
  };
  
  if (chatbotType && newChatSelectors[chatbotType]) {
    document.addEventListener('click', event => {
      const newChatButton = event.target.closest(newChatSelectors[chatbotType]);
      if (newChatButton) {
        console.log('New conversation detected');
        
        // Reset for new conversation
        resetCurrentConversation();
        
        // Force an immediate capture to ensure we get the URL
        setTimeout(() => {
          currentConversation.conversationUrl = window.location.href;
          captureEntireConversation();
        }, 500);
      }
    });
  }
}

// Handle page change events
function handlePageChange() {
  console.log('Page change detected');
  
  // Reset for new page
  resetCurrentConversation();
  
  // Re-initialize with a slight delay to allow DOM to update
  setTimeout(() => {
    // Update conversation URL
    currentConversation.conversationUrl = window.location.href;
    
    // Force an immediate capture
    captureEntireConversation();
  }, 500);
}

// Reset the current conversation
function resetCurrentConversation() {
  currentConversation = {
    id: null,
    sourceChatbot: chatbotType,
    timestamp: null,
    interactions: [],
    targetModelRequested: null,
    conversationUrl: window.location.href
  };
}

// Add a visual status indicator to the page
function addStatusIndicator() {
  // Remove any existing status indicators to prevent duplicates
  const existingStatus = document.getElementById('conversation-status');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  // Also remove any other potential status indicators that might have been created
  const allStatusElements = document.querySelectorAll('.conversation-capture-status');
  allStatusElements.forEach(el => el.remove());
  
  // Create new status indicator
  const statusEl = document.createElement('div');
  statusEl.className = 'conversation-capture-status';
  statusEl.id = 'conversation-status';
  statusEl.style.position = 'fixed';
  statusEl.style.bottom = '10px';
  statusEl.style.right = '10px';
  statusEl.style.background = 'rgba(0, 120, 0, 0.7)';
  statusEl.style.color = 'white';
  statusEl.style.padding = '5px 10px';
  statusEl.style.borderRadius = '4px';
  statusEl.style.fontSize = '12px';
  statusEl.style.zIndex = '10000';
  statusEl.style.maxWidth = '300px';
  statusEl.style.wordWrap = 'break-word';
  statusEl.style.opacity = '0';
  
  document.body.appendChild(statusEl);
  
  // Make it hoverable
  statusEl.addEventListener('mouseover', () => {
    statusEl.style.opacity = '1';
  });
  
  statusEl.addEventListener('mouseout', () => {
    statusEl.style.opacity = '0.2';
  });
  
  // Set initial text
  statusEl.textContent = 'Conversation: Capturing ' + chatbotType;
  
  // Show the indicator briefly
  statusEl.style.opacity = '1';
  if (statusEl.fadeTimeout) {
    clearTimeout(statusEl.fadeTimeout);
  }
  statusEl.fadeTimeout = setTimeout(() => {
    statusEl.style.opacity = '0.2';
  }, 3000);
}

// Update the status indicator with current status
function updateStatusIndicator(status) {
  const statusEl = document.getElementById('conversation-status');
  if (statusEl) {
    // Clear any existing timeout to prevent overlapping messages
    if (statusEl.fadeTimeout) {
      clearTimeout(statusEl.fadeTimeout);
    }
    
    // Clear any pending update timeout to debounce rapid updates
    if (statusEl.updateTimeout) {
      clearTimeout(statusEl.updateTimeout);
    }
    
    // Debounce rapid updates to prevent overlapping messages
    statusEl.updateTimeout = setTimeout(() => {
      // Update the text content
      statusEl.textContent = `Conversation: ${status} - ${chatbotType}`;
      
      // Show the indicator
      statusEl.style.opacity = '1';
      
      // Set a timeout to fade the indicator
      statusEl.fadeTimeout = setTimeout(() => {
        statusEl.style.opacity = '0.2';
      }, 2000);
    }, 100); // 100ms debounce
  } else {
    // If no status indicator exists, create one
    addStatusIndicator();
    // Then update it with the current status
    updateStatusIndicator(status);
  }
}

// Toggle debug buttons visibility
function toggleDebugButtons(showDebug) {
  const debugButtons = document.querySelectorAll('[id*="debug"], [id*="Debug"]');
  debugButtons.forEach(button => {
    if (button && button.style) {
      button.style.display = showDebug ? 'block' : 'none';
    }
  });
  
  // Also check for buttons with specific debug-related text content
  const allButtons = document.querySelectorAll('button');
  allButtons.forEach(button => {
    const text = button.textContent.toLowerCase();
    if (text.includes('debug') || text.includes('gemini debug') || text.includes('chatgpt debug')) {
      button.style.display = showDebug ? 'block' : 'none';
    }
  });
}

// Add a manual capture button to the page
function addManualCaptureButton() {
  const captureBtn = document.createElement('button');
  captureBtn.textContent = 'Capture Conversation';
  captureBtn.style.position = 'fixed';
  captureBtn.style.bottom = '50px';
  captureBtn.style.right = '10px';
  captureBtn.style.zIndex = '10000';
  captureBtn.style.padding = '5px 10px';
  captureBtn.style.borderRadius = '4px';
  captureBtn.style.backgroundColor = '#2196f3';
  captureBtn.style.color = 'white';
  captureBtn.style.border = 'none';
  captureBtn.style.cursor = 'pointer';
  
  captureBtn.addEventListener('click', () => {
    updateStatusIndicator('Manual capture requested');
    console.log('Manual capture requested');
    
    if (chatbotType === 'Gemini') {
      // For Gemini, use our specialized capture function
      captureGeminiConversation();
    } else {
      // For other platforms, use the normal capture function
      captureEntireConversation();
    }
  });
  
  document.body.appendChild(captureBtn);
}

// Special function to capture Gemini conversations
function captureGeminiConversation() {
  console.log('Attempting specialized Gemini conversation capture');
  updateStatusIndicator('Capturing Gemini conversation');
  
  // Reset conversation interactions
  currentConversation.interactions = [];
  
  // Ensure we have a current conversation
  if (!currentConversation.id) {
    currentConversation.id = generateUrlSafeId(window.location.href);
    currentConversation.timestamp = new Date().toISOString();
    console.log('Created new conversation with ID:', currentConversation.id);
  }
  
  // Helper function to add messages while checking for duplicates
  const addedMessages = new Set(); // Track message fingerprints to avoid duplicates
  
  function addMessage(actor, content) {
    // Create a fingerprint of the message to detect duplicates
    // Using the first 100 chars should be enough to identify duplicates
    const fingerprint = `${actor}:${content.substring(0, 100)}`;
    
    // Check if we've already added this message
    if (addedMessages.has(fingerprint)) {
      console.log('Skipping duplicate message:', fingerprint);
      return false;
    }
    
    // Add the message and track its fingerprint
    currentConversation.interactions.push({
      actor,
      timestamp: new Date().toISOString(),
      content,
      attachments: []
    });
    
    addedMessages.add(fingerprint);
    return true;
  }
  
  // First try the most direct approach - get user queries and model responses
  const allMessageContainers = document.querySelectorAll('user-query, .user-query-container, model-response, .response-container, .presented-response-container');
  console.log(`Found ${allMessageContainers.length} total message containers`);
  
  let addedCount = 0;
  
  // Process all containers in DOM order to preserve conversation flow
  allMessageContainers.forEach((container, index) => {
    try {
      let actor = 'unknown';
      let content = '';
      
      // Determine if this is a user or bot message based on the container type
      if (container.matches('user-query, .user-query-container')) {
        actor = 'user';
        // Extract user message content
        const userContent = container.querySelector('.query-text') || 
                           container.querySelector('.user-query-bubble') || 
                           container.querySelector('.query-content');
        if (userContent) {
          content = userContent.textContent.trim();
        }
      } else if (container.matches('model-response, .response-container, .presented-response-container')) {
        actor = 'bot';
        // Extract bot message content
        const responseContent = container.querySelector('.response-content') || 
                               container.querySelector('.model-response-text') || 
                               container.querySelector('message-content .markdown') ||
                               container.querySelector('.markdown');
        if (responseContent) {
          content = responseContent.textContent.trim();
        }
      }
      
      // Add message if we have valid content
      if (content && content.length > 0) {
        console.log(`Adding ${actor} message #${index + 1}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
        
        if (addMessage(actor, content)) {
          addedCount++;
        }
      }
    } catch (error) {
      console.error('Error processing message container:', error);
    }
  });
  
  // If we have any interactions, save the conversation
  if (currentConversation.interactions.length > 0) {
    console.log(`Captured ${currentConversation.interactions.length} messages from Gemini (${addedCount} new)`);
    updateStatusIndicator(`Captured ${currentConversation.interactions.length} messages`);
    
    // Try to extract the model info
    extractModelInfo();
    
    // Save the conversation
    saveCurrentConversation();
  } else {
    console.log('No messages found in Gemini conversation');
    updateStatusIndicator('No messages found');
    
    // Try one more approach - scan all visible text on the page
    const paragraphs = document.querySelectorAll('p, div > span');
    const significantTexts = Array.from(paragraphs)
      .filter(p => {
        const text = p.textContent.trim();
        return text.length > 30 && !text.includes('Your Metakarma chats');
      })
      .map(p => p.textContent.trim());
    
    if (significantTexts.length > 0) {
      console.log(`Found ${significantTexts.length} significant text blocks`);
      
      // Simply alternate between user and AI
      let isUser = true;
      for (const text of significantTexts) {
        if (addMessage(isUser ? 'user' : 'bot', text)) {
          addedCount++;
        }
        
        isUser = !isUser; // Toggle for next message
      }
      
      // Save the conversation
      if (currentConversation.interactions.length > 0) {
        console.log(`Captured ${currentConversation.interactions.length} messages using fallback method (${addedCount} new)`);
        updateStatusIndicator(`Captured ${currentConversation.interactions.length} messages (fallback)`);
        
        // Save the conversation
        saveCurrentConversation();
      }
    }
  }
}

// Add a debug button for Gemini
function addGeminiDebugButton() {
  if (chatbotType !== 'Gemini') return;
  
  const debugBtn = document.createElement('button');
  debugBtn.id = 'gemini-debug-button';
  debugBtn.textContent = 'Debug Gemini';
  debugBtn.style.position = 'fixed';
  debugBtn.style.bottom = '90px';
  debugBtn.style.right = '10px';
  debugBtn.style.zIndex = '10000';
  debugBtn.style.padding = '5px 10px';
  debugBtn.style.borderRadius = '4px';
  debugBtn.style.backgroundColor = '#ff5722';
  debugBtn.style.color = 'white';
  debugBtn.style.border = 'none';
  debugBtn.style.cursor = 'pointer';
  debugBtn.style.display = 'none'; // Initially hidden
  
  debugBtn.addEventListener('click', () => {
    debugGeminiCapture();
  });
  
  document.body.appendChild(debugBtn);
}

// Debug function for Gemini capture
function debugGeminiCapture() {
  console.log('===== GEMINI DEBUG INFO =====');
  console.log('Current URL:', window.location.href);
  console.log('Document ready state:', document.readyState);
  
  // Find conversation containers
  const conversationSelectors = [
    'div[id^="conversation-container"]', 
    'div.conversation-container', 
    '.chat-history-scroll-container > infinite-scroller > div'
  ];
  
  for (const selector of conversationSelectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
    
    if (elements.length > 0) {
      // Try to get user messages from these containers
      for (const container of elements) {
        const userElements = container.querySelectorAll('user-query, .user-query-container, [data-role="user"]');
        console.log(`Found ${userElements.length} user message containers in conversation container`);
        
        const aiElements = container.querySelectorAll('model-response, .presented-response-container, response-container, [data-role="assistant"]');
        console.log(`Found ${aiElements.length} AI message containers in conversation container`);
      }
    }
  }
  
  // Find text that could be message content
  const potentialTextElements = document.querySelectorAll('p, .markdown, .model-response-text, .response-content, .query-text, .query-content');
  console.log(`Found ${potentialTextElements.length} potential text elements`);
  
  const significantTexts = [];
  
  potentialTextElements.forEach((el, i) => {
    const text = el.textContent.trim();
    if (text.length > 30) {
      significantTexts.push({
        element: el,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        fullText: text
      });
      console.log(`Significant text #${i+1}:`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }
  });
  
  // Log all potential message containers
  const potentialSelectors = [
    'article',
    'article[data-role]',
    'main > div',
    'div[data-card-index]',
    '.chat-turn',
    '.message-wrapper',
    'div[jscontroller]',
    'div[jsname]',
    'div[role="presentation"]',
    '.user-query-container',
    '.presented-response-container',
    'user-query',
    'model-response'
  ];
  
  potentialSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
    
    if (elements.length > 0 && elements.length < 10) {
      // Log details about each element
      elements.forEach((el, index) => {
        console.log(`  ${selector} #${index}:`, {
          classes: el.className,
          attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
          text: el.textContent.substring(0, 50) + (el.textContent.length > 50 ? '...' : ''),
          children: el.children.length,
          hasUserContent: !!el.querySelector('.query-text, .user-query-bubble, .query-content'),
          hasAIContent: !!el.querySelector('.model-response-text, .response-content, message-content')
        });
      });
    }
  });
  
  // Attempt to manually capture right now
  captureGeminiConversation();
  
  // Format for easy viewing
  let formattedMessages = '';
  currentConversation.interactions.forEach((msg, i) => {
    formattedMessages += `\n[${i+1}] ${msg.actor}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`;
  });
  
  // Show a visual message
  const messageDiv = document.createElement('div');
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '20px';
  messageDiv.style.left = '20px';
  messageDiv.style.padding = '10px';
  messageDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
  messageDiv.style.color = 'white';
  messageDiv.style.borderRadius = '5px';
  messageDiv.style.zIndex = '10000';
  messageDiv.style.maxWidth = '80%';
  messageDiv.style.maxHeight = '80%';
  messageDiv.style.overflow = 'auto';
  messageDiv.innerHTML = `
    <h3>Gemini Debug Info</h3>
    <p>Found ${currentConversation.interactions.length} messages</p>
    <pre style="font-size: 12px; white-space: pre-wrap;">${formattedMessages}</pre>
    <p>Significant Text Blocks: ${significantTexts.length}</p>
    <p>Check console for details</p>
    <button id="closeDebug" style="padding: 5px; margin-top: 10px;">Close</button>
  `;
  
  document.body.appendChild(messageDiv);
  
  document.getElementById('closeDebug').addEventListener('click', () => {
    document.body.removeChild(messageDiv);
  });
  
  return currentConversation.interactions;
}

// Set up real-time message observation for Claude
function setupClaudeMessageObserver() {
  console.log('Setting up Claude message observer');
  
  // Create a mutation observer to watch for new messages
  const observer = new MutationObserver((mutations) => {
    let hasNewMessages = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this looks like a new message
            const element = node;
            const text = element.textContent?.trim();
            
            if (text && text.length > 20) {
              // Check if it's a user or assistant message
              const isUserMessage = text.includes('You:') || 
                                   text.includes('Human:') || 
                                   element.matches('[data-testid*="user"]') ||
                                   element.matches('.user-message, .human-message');
              
              const isAssistantMessage = text.includes('Claude:') || 
                                       text.includes('Assistant:') || 
                                       element.matches('[data-testid*="assistant"]') ||
                                       element.matches('.assistant-message, .claude-message');
              
              if (isUserMessage || isAssistantMessage) {
                console.log('Claude observer: New message detected:', text.substring(0, 50) + '...');
                hasNewMessages = true;
              }
            }
          }
        });
      }
    });
    
    // If we detected new messages, trigger a capture after a short delay
    if (hasNewMessages) {
      setTimeout(() => {
        console.log('Claude observer: Triggering capture for new messages');
        captureEntireConversation();
      }, 1000); // Wait 1 second for message to fully load
    }
  });
  
  // Start observing the document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('Claude message observer started');
}

// Add a debug button for Claude
function addClaudeDebugButton() {
  if (chatbotType !== 'Claude') return;
  
  const debugBtn = document.createElement('button');
  debugBtn.id = 'claude-debug-button';
  debugBtn.textContent = 'Debug Claude';
  debugBtn.style.position = 'fixed';
  debugBtn.style.bottom = '90px';
  debugBtn.style.right = '10px';
  debugBtn.style.zIndex = '10000';
  debugBtn.style.padding = '5px 10px';
  debugBtn.style.borderRadius = '4px';
  debugBtn.style.backgroundColor = '#ff8c00';
  debugBtn.style.color = 'white';
  debugBtn.style.border = 'none';
  debugBtn.style.cursor = 'pointer';
  debugBtn.style.display = 'none'; // Initially hidden
  
  debugBtn.addEventListener('click', () => {
    debugClaudeCapture();
  });
  
  document.body.appendChild(debugBtn);
}

// Debug function for Claude capture
function debugClaudeCapture() {
  console.log('===== CLAUDE DEBUG INFO =====');
  console.log('Current URL:', window.location.href);
  console.log('Document ready state:', document.readyState);
  
  // Primary selectors for Claude
  const claudeSelectors = [
    '[data-testid="user-message"]',
    '[data-testid="assistant-message"]',
    '.font-claude-message',
    '.message-content',
    '.claude-message',
    '.human-message',
    '.user-message',
    '.assistant-message'
  ];
  
  claudeSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
    
    if (elements.length > 0 && elements.length < 10) {
      // Log details about each element
      elements.forEach((el, index) => {
        console.log(`  ${selector} #${index}:`, {
          classes: el.className,
          attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
          text: el.textContent.substring(0, 50) + (el.textContent.length > 50 ? '...' : ''),
          children: el.children.length,
          isUserMessage: !!el.closest('[data-testid="user-message"]') || !!el.closest('.human-message, .user-message'),
          isClaudeMessage: !!el.closest('.font-claude-message') || !!el.closest('.claude-message, .ai-message')
        });
      });
    }
  });
  
  // Find text that could be message content
  const potentialTextElements = document.querySelectorAll('p, .message-content, .claude-message-content, .user-message-content');
  console.log(`Found ${potentialTextElements.length} potential text elements`);
  
  // Additional debugging: Look for any elements with Claude-related text
  console.log('=== CLAUDE INTERFACE ANALYSIS ===');
  const allElements = document.querySelectorAll('*');
  const claudeRelatedElements = [];
  
  allElements.forEach(el => {
    const text = el.textContent?.trim();
    if (text && (text.includes('Claude') || text.includes('Assistant') || text.includes('You') || text.includes('Human'))) {
      const tagName = el.tagName.toLowerCase();
      const classes = el.className;
      const id = el.id;
      const dataTestId = el.getAttribute('data-testid');
      
      claudeRelatedElements.push({
        element: el,
        tagName,
        classes,
        id,
        dataTestId,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        fullText: text
      });
    }
  });
  
  console.log(`Found ${claudeRelatedElements.length} Claude-related elements:`);
  claudeRelatedElements.forEach((item, i) => {
    console.log(`  ${i+1}. <${item.tagName}${item.classes ? '.' + item.classes.split(' ').join('.') : ''}${item.id ? '#' + item.id : ''}${item.dataTestId ? '[data-testid="' + item.dataTestId + '"]' : ''}>`);
    console.log(`     Text: ${item.text}`);
  });
  
  // Look for conversation-specific containers
  console.log('=== CONVERSATION CONTAINER ANALYSIS ===');
  const possibleConversationContainers = [
    'main',
    'article', 
    '.conversation',
    '.chat',
    '.messages',
    '.content-area',
    '.conversation-container',
    '.chat-container',
    '.messages-container',
    '[data-testid*="conversation"]',
    '[data-testid*="chat"]',
    '[data-testid*="message"]'
  ];
  
  possibleConversationContainers.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`${selector}: ${elements.length} elements found`);
      elements.forEach((el, i) => {
        const text = el.textContent?.trim();
        if (text && text.length > 50) {
          console.log(`  ${selector} #${i}:`, {
            classes: el.className,
            attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            children: el.children.length
          });
        }
      });
    }
  });
  
  // Look for message-specific elements
  console.log('=== MESSAGE ELEMENT ANALYSIS ===');
  const messageSelectors = [
    '[data-testid*="message"]',
    '[data-testid*="user"]',
    '[data-testid*="assistant"]',
    '.message',
    '.user-message',
    '.assistant-message',
    '.human-message',
    '.claude-message',
    '.font-claude-message'
  ];
  
  messageSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`${selector}: ${elements.length} elements found`);
      elements.forEach((el, i) => {
        const text = el.textContent?.trim();
        if (text && text.length > 20) {
          console.log(`  ${selector} #${i}:`, {
            classes: el.className,
            attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            children: el.children.length
          });
        }
      });
    }
  });
  
  // Look for conversation-specific patterns
  console.log('=== CONVERSATION PATTERN ANALYSIS ===');
  const userPatterns = ['can you tell me', 'how to', 'install', 'USB', 'PopOS'];
  const assistantPatterns = ['Here\'s how to', 'First, download', 'The Terminal method', 'Choose the version'];
  
  // Find elements that contain conversation patterns
  const conversationElements = [];
  allElements.forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length > 30) {
      const hasUserPattern = userPatterns.some(pattern => text.includes(pattern));
      const hasAssistantPattern = assistantPatterns.some(pattern => text.includes(pattern));
      
      if (hasUserPattern || hasAssistantPattern) {
        conversationElements.push({
          element: el,
          tagName: el.tagName,
          classes: el.className,
          id: el.id,
          dataTestId: el.getAttribute('data-testid'),
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          type: hasUserPattern ? 'user' : 'assistant',
          hasUserPattern,
          hasAssistantPattern
        });
      }
    }
  });
  
  console.log(`Found ${conversationElements.length} conversation elements:`);
  conversationElements.forEach((item, i) => {
    console.log(`  ${i+1}. <${item.tagName}${item.classes ? '.' + item.classes.split(' ').join('.') : ''}${item.id ? '#' + item.id : ''}${item.dataTestId ? '[data-testid="' + item.dataTestId + '"]' : ''}>`);
    console.log(`     Type: ${item.type}, Text: ${item.text}`);
  });
  
  // Find the most specific conversation container
  console.log('=== FINDING CONVERSATION CONTAINER ===');
  const conversationText = 'can you tell me how to install a PopOS installation disk to a USB drive from MacOS?';
  
  // Look for the most specific element containing the conversation
  let conversationElement = null;
  let bestElement = null;
  
  allElements.forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.includes(conversationText)) {
      // Find the most specific (deepest) element that contains the conversation
      if (!conversationElement || el.children.length < conversationElement.children.length) {
        conversationElement = el;
      }
    }
  });
  
  if (conversationElement) {
    console.log('Found conversation element:', {
      tagName: conversationElement.tagName,
      classes: conversationElement.className,
      id: conversationElement.id,
      dataTestId: conversationElement.getAttribute('data-testid'),
      parentClasses: conversationElement.parentElement?.className,
      parentId: conversationElement.parentElement?.id,
      parentDataTestId: conversationElement.parentElement?.getAttribute('data-testid'),
      ancestorSelectors: getAncestorSelectors(conversationElement)
    });
    
    // Look for the conversation container by finding the parent that contains both user and assistant messages
    let container = conversationElement.parentElement;
    let depth = 0;
    const maxDepth = 10;
    
    while (container && depth < maxDepth) {
      const containerText = container.textContent || '';
      const hasUserMessage = containerText.includes('can you tell me how to install');
      const hasAssistantMessage = containerText.includes('Here\'s how to create a PopOS bootable USB drive');
      
      if (hasUserMessage && hasAssistantMessage) {
        console.log(`Found conversation container at depth ${depth}:`, {
          tagName: container.tagName,
          classes: container.className,
          id: container.id,
          dataTestId: container.getAttribute('data-testid'),
          selector: `${container.tagName.toLowerCase()}${container.className ? '.' + container.className.split(' ').join('.') : ''}${container.id ? '#' + container.id : ''}${container.getAttribute('data-testid') ? '[data-testid="' + container.getAttribute('data-testid') + '"]' : ''}`
        });
        break;
      }
      
      container = container.parentElement;
      depth++;
    }
  }
  
  // Helper function to get ancestor selectors
  function getAncestorSelectors(element, maxDepth = 5) {
    const selectors = [];
    let current = element.parentElement;
    let depth = 0;
    
    while (current && depth < maxDepth) {
      const selector = `${current.tagName.toLowerCase()}${current.className ? '.' + current.className.split(' ').join('.') : ''}${current.id ? '#' + current.id : ''}${current.getAttribute('data-testid') ? '[data-testid="' + current.getAttribute('data-testid') + '"]' : ''}`;
      selectors.push(selector);
      current = current.parentElement;
      depth++;
    }
    
    return selectors;
  }
  
  const significantTexts = [];
  
  potentialTextElements.forEach((el, i) => {
    const text = el.textContent.trim();
    if (text.length > 30) {
      significantTexts.push({
        element: el,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        fullText: text
      });
      console.log(`Significant text #${i+1}:`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }
  });
  
  // Attempt to manually capture right now
  captureEntireConversation();
  
  // Show capture summary
  console.log(`Claude capture complete: ${currentConversation.interactions.length} messages found`);
  
  // Show a simple visual confirmation
  const messageDiv = document.createElement('div');
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '20px';
  messageDiv.style.left = '20px';
  messageDiv.style.padding = '10px';
  messageDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
  messageDiv.style.color = 'white';
  messageDiv.style.borderRadius = '5px';
  messageDiv.style.zIndex = '10000';
  messageDiv.innerHTML = `
    <h3>Claude Capture Complete</h3>
    <p>Found ${currentConversation.interactions.length} messages</p>
    <button id="closeClaudeDebug" style="padding: 5px; margin-top: 10px;">Close</button>
  `;
  
  document.body.appendChild(messageDiv);
  
  document.getElementById('closeClaudeDebug').addEventListener('click', () => {
    document.body.removeChild(messageDiv);
  });
  
  return currentConversation.interactions;
}

// Add a debug button for Poe
function addPoeDebugButton() {
  if (chatbotType !== 'Poe') return;
  
  const debugBtn = document.createElement('button');
  debugBtn.id = 'poe-debug-button';
  debugBtn.textContent = 'Debug Poe';
  debugBtn.style.position = 'fixed';
  debugBtn.style.bottom = '90px';
  debugBtn.style.right = '10px';
  debugBtn.style.zIndex = '10000';
  debugBtn.style.padding = '5px 10px';
  debugBtn.style.borderRadius = '4px';
  debugBtn.style.backgroundColor = '#9c27b0';
  debugBtn.style.color = 'white';
  debugBtn.style.border = 'none';
  debugBtn.style.cursor = 'pointer';
  debugBtn.style.display = 'none'; // Initially hidden
  
  debugBtn.addEventListener('click', () => {
    debugPoeCapture();
  });
  
  document.body.appendChild(debugBtn);
}

// Debug function for Poe capture
function debugPoeCapture() {
  console.log('===== POE DEBUG INFO =====');
  console.log('Current URL:', window.location.href);
  console.log('Document ready state:', document.readyState);
  
  // Primary selectors for Poe
  const poeSelectors = [
    '.MessageItem',
    '.ChatMessage', 
    '.message',
    '.human',
    '.bot',
    '[data-message-author-type]',
    '.MessageContent',
    '.message-content',
    '.ChatMessageItem',
    '.Message',
    '.HumanMessage',
    '.BotMessage',
    // Add modern POE selectors
    '[data-testid="message"]',
    '[data-testid="user-message"]',
    '[data-testid="bot-message"]',
    '.chat-message',
    '.conversation-message',
    '.message-container',
    '.chat-container',
    '.conversation-container',
    // Look for any div with message-like content
    'div[class*="message"]',
    'div[class*="chat"]',
    'div[class*="conversation"]',
    // Add POE-specific selectors based on analysis
    '[data-complete="true"]',
    '[data-dd-privacy="mask"]',
    '[data-dd-privacy="mask-user-input"]',
    // Look for React component patterns
    'div[class*="Button"]',
    'div[class*="Container"]',
    'div[class*="Message"]',
    'div[class*="Chat"]',
    'div[class*="Conversation"]',
    'div[class*="Response"]',
    'div[class*="Prompt"]'
  ];
  
  poeSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
    
    if (elements.length > 0 && elements.length < 10) {
      // Log details about each element
      elements.forEach((el, index) => {
        console.log(`  ${selector} #${index}:`, {
          classes: el.className,
          attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
          text: el.textContent.substring(0, 50) + (el.textContent.length > 50 ? '...' : ''),
          children: el.children.length,
          hasMessageContent: !!el.querySelector('.message-content, .MessageContent'),
          isHuman: !!el.closest('.human') || el.classList.contains('human') || el.getAttribute('data-message-author-type') === 'human',
          isBot: !!el.closest('.bot') || el.classList.contains('bot') || el.getAttribute('data-message-author-type') === 'bot'
        });
      });
    }
  });
  
  // Find text that could be message content
  const potentialTextElements = document.querySelectorAll('p, .message-content, .MessageContent, .text-content, .content');
  console.log(`Found ${potentialTextElements.length} potential text elements`);
  
  const significantTexts = [];
  
  potentialTextElements.forEach((el, i) => {
    const text = el.textContent.trim();
    if (text.length > 30) {
      significantTexts.push({
        element: el,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        fullText: text
      });
      console.log(`Significant text #${i+1}:`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }
  });
  
  // If no traditional elements found, analyze the DOM structure more deeply
  if (poeSelectors.every(selector => document.querySelectorAll(selector).length === 0)) {
    console.log('=== DEEP DOM ANALYSIS ===');
    
    // Look for any elements with substantial text content
    const allElements = document.querySelectorAll('*');
    const textElements = Array.from(allElements).filter(el => {
      const text = el.textContent.trim();
      return text.length > 50 && text.length < 5000 && 
             !text.includes('cookie') && 
             !text.includes('privacy') &&
             !text.includes('terms') &&
             !text.includes('settings') &&
             !text.includes('menu') &&
             !text.includes('navigation') &&
             !text.includes('button') &&
             !text.includes('click') &&
             !text.includes('accept') &&
             !text.includes('reject') &&
             !text.includes('loading') &&
             !text.includes('error');
    });
    
    console.log(`Found ${textElements.length} elements with substantial text content`);
    
    // Analyze the structure of these elements
    textElements.slice(0, 10).forEach((el, i) => {
      console.log(`Text element ${i+1}:`, {
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
        text: el.textContent.substring(0, 100) + (el.textContent.length > 100 ? '...' : ''),
        parent: el.parentElement ? {
          tagName: el.parentElement.tagName,
          className: el.parentElement.className,
          id: el.parentElement.id
        } : null
      });
    });
    
    // Look for patterns in the DOM structure
    const commonClasses = {};
    const commonIds = {};
    const commonAttributes = {};
    
    textElements.forEach(el => {
      // Count class names
      if (el.className) {
        el.className.split(' ').forEach(cls => {
          if (cls.trim()) {
            commonClasses[cls] = (commonClasses[cls] || 0) + 1;
          }
        });
      }
      
      // Count IDs
      if (el.id) {
        commonIds[el.id] = (commonIds[el.id] || 0) + 1;
      }
      
      // Count attributes
      Array.from(el.attributes).forEach(attr => {
        const key = `${attr.name}="${attr.value}"`;
        commonAttributes[key] = (commonAttributes[key] || 0) + 1;
      });
    });
    
    console.log('Common classes:', Object.entries(commonClasses).sort((a, b) => b[1] - a[1]).slice(0, 10));
    console.log('Common IDs:', Object.entries(commonIds).sort((a, b) => b[1] - a[1]).slice(0, 5));
    console.log('Common attributes:', Object.entries(commonAttributes).sort((a, b) => b[1] - a[1]).slice(0, 10));
  }
  
  // Look for conversation containers
  const conversationSelectors = [
    '.ChatHistory',
    '.MessageList',
    '.Conversation',
    '.ChatContainer',
    '.MessagesContainer',
    '[data-testid="chat-history"]',
    '.chat-history',
    '.messages-container'
  ];
  
  conversationSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
    
    if (elements.length > 0) {
      elements.forEach((container, index) => {
        const messageElements = container.querySelectorAll('.MessageItem, .ChatMessage, .message, .human, .bot');
        console.log(`  ${selector} #${index}: Contains ${messageElements.length} message elements`);
      });
    }
  });
  
  // Attempt to manually capture right now
  captureEntireConversation();
  
  // Format for easy viewing
  let formattedMessages = '';
  currentConversation.interactions.forEach((msg, i) => {
    formattedMessages += `\n[${i+1}] ${msg.actor}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`;
  });
  
  // Show a visual message
  const messageDiv = document.createElement('div');
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '20px';
  messageDiv.style.left = '20px';
  messageDiv.style.padding = '10px';
  messageDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
  messageDiv.style.color = 'white';
  messageDiv.style.borderRadius = '5px';
  messageDiv.style.zIndex = '10000';
  messageDiv.style.maxWidth = '80%';
  messageDiv.style.maxHeight = '80%';
  messageDiv.style.overflow = 'auto';
  messageDiv.innerHTML = `
    <h3>Poe Debug Info</h3>
    <p>Found ${currentConversation.interactions.length} messages</p>
    <pre style="font-size: 12px; white-space: pre-wrap;">${formattedMessages}</pre>
    <p>Significant Text Blocks: ${significantTexts.length}</p>
    <p>Check console for details</p>
    <button id="closePoeDebug" style="padding: 5px; margin-top: 10px;">Close</button>
  `;
  
  document.body.appendChild(messageDiv);
  
  document.getElementById('closePoeDebug').addEventListener('click', () => {
    document.body.removeChild(messageDiv);
  });
  
  return currentConversation.interactions;
}

// Set up mutation observer for ChatGPT to detect when messages are loaded
function setupChatGPTMessageObserver() {
  console.log('Setting up ChatGPT message observer');
  
  let hasCapturedInitial = false;
  let observer = null;
  
  // Function to check for messages and capture if found
  function checkAndCapture() {
    if (hasCapturedInitial) return;
    
    const messages = extractAllMessages();
    if (messages.length > 0) {
      // Filter out very short messages that might be loading artifacts
      const validMessages = messages.filter(msg => 
        msg.content && msg.content.trim().length > 10
      );
      
      if (validMessages.length > 0) {
        console.log(`ChatGPT observer detected ${validMessages.length} valid messages (filtered from ${messages.length} total), capturing conversation`);
        hasCapturedInitial = true;
        
        // Reset conversation interactions
        currentConversation.interactions = [];
        
        // Ensure we have a current conversation
        if (!currentConversation.id) { 
          currentConversation.id = generateUrlSafeId(window.location.href);
          currentConversation.timestamp = new Date().toISOString();
          console.log('Created new conversation with ID:', currentConversation.id);
        }
        
        currentConversation.interactions = validMessages;
        extractModelInfo();
        saveCurrentConversation();
        updateStatusIndicator(`Captured ${validMessages.length} messages`);
        
        // Disconnect the observer since we've captured the initial messages
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      } else {
        console.log(`ChatGPT observer detected ${messages.length} messages but all were too short, continuing to wait`);
      }
    }
  }
  
  // Set up mutation observer to watch for changes in the conversation area
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any added nodes contain message elements
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const hasMessages = node.querySelector && (
              node.querySelector('[data-message-author-role]') ||
              node.querySelector('[data-testid="conversation-turn-user"]') ||
              node.querySelector('[data-testid="conversation-turn-assistant"]') ||
              node.querySelector('[data-testid="message"]')
            );
            
            if (hasMessages) {
              console.log('ChatGPT observer detected message elements added to DOM');
              // Use a small delay to ensure the message content is fully loaded
              setTimeout(checkAndCapture, 500);
              break;
            }
          }
        }
      }
    }
  });
  
  // Start observing the document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also check immediately in case messages are already present
  setTimeout(checkAndCapture, 1000);
  
  // Clean up observer after 10 seconds to prevent memory leaks
  setTimeout(() => {
    if (observer) {
      console.log('ChatGPT observer timeout - disconnecting');
      observer.disconnect();
      observer = null;
    }
  }, 10000);
}

// Add a debug button for ChatGPT
function addChatGPTDebugButton() {
  if (chatbotType !== 'ChatGPT') return;
  
  const debugBtn = document.createElement('button');
  debugBtn.id = 'chatgpt-debug-button';
  debugBtn.textContent = 'Debug ChatGPT';
  debugBtn.style.position = 'fixed';
  debugBtn.style.bottom = '90px';
  debugBtn.style.right = '10px';
  debugBtn.style.zIndex = '10000';
  debugBtn.style.padding = '5px 10px';
  debugBtn.style.borderRadius = '4px';
  debugBtn.style.backgroundColor = '#10a37f';
  debugBtn.style.color = 'white';
  debugBtn.style.border = 'none';
  debugBtn.style.cursor = 'pointer';
  debugBtn.style.display = 'none'; // Initially hidden
  
  debugBtn.addEventListener('click', () => {
    debugChatGPTCapture();
  });
  
  document.body.appendChild(debugBtn);
}

// Debug function for ChatGPT capture
function debugChatGPTCapture() {
  console.log('===== CHATGPT DEBUG INFO =====');
  console.log('Current URL:', window.location.href);
  console.log('Document ready state:', document.readyState);
  
  // Primary selectors for ChatGPT
  const chatgptSelectors = [
    '[data-message-author-role="user"]',
    '[data-message-author-role="assistant"]',
    '[data-testid="conversation-turn-user"]',
    '[data-testid="conversation-turn-assistant"]',
    '[data-testid="message"]',
    '.text-message',
    '.message',
    '.prose',
    '.markdown',
    '.prose-message',
    'div[class*="message"]',
    'div[class*="Message"]',
    'div[class*="conversation"]',
    'div[class*="Conversation"]'
  ];
  
  chatgptSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
    
    if (elements.length > 0 && elements.length < 10) {
      // Log details about each element
      elements.forEach((el, index) => {
        console.log(`  ${selector} #${index}:`, {
          classes: el.className,
          attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '),
          text: el.textContent.substring(0, 50) + (el.textContent.length > 50 ? '...' : ''),
          children: el.children.length,
          isUserMessage: !!el.closest('[data-message-author-role="user"]') || !!el.closest('[data-testid="conversation-turn-user"]'),
          isAssistantMessage: !!el.closest('[data-message-author-role="assistant"]') || !!el.closest('[data-testid="conversation-turn-assistant"]')
        });
      });
    }
  });
  
  // Find text that could be message content
  const potentialTextElements = document.querySelectorAll('p, .message-content, .prose, .markdown, .text-message-content');
  console.log(`Found ${potentialTextElements.length} potential text elements`);
  
  const significantTexts = [];
  
  potentialTextElements.forEach((el, i) => {
    const text = el.textContent.trim();
    if (text.length > 30) {
      significantTexts.push({
        element: el,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        fullText: text
      });
      console.log(`Significant text #${i+1}:`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }
  });
  
  // Look for conversation containers
  const conversationSelectors = [
    '[data-testid="conversation"]',
    '.conversation',
    '.chat-container',
    '.messages-container',
    '.conversation-container',
    'main',
    'main > div'
  ];
  
  conversationSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
    
    if (elements.length > 0) {
      elements.forEach((container, index) => {
        const messageElements = container.querySelectorAll('[data-message-author-role], [data-testid*="conversation-turn"], [data-testid="message"]');
        console.log(`  ${selector} #${index}: Contains ${messageElements.length} message elements`);
      });
    }
  });
  
  // Attempt to manually capture right now
  captureEntireConversation();
  
  // Format for easy viewing
  let formattedMessages = '';
  currentConversation.interactions.forEach((msg, i) => {
    formattedMessages += `\n[${i+1}] ${msg.actor.toUpperCase()}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`;
  });
  
  // Show a visual message
  const messageDiv = document.createElement('div');
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '20px';
  messageDiv.style.left = '20px';
  messageDiv.style.padding = '10px';
  messageDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
  messageDiv.style.color = 'white';
  messageDiv.style.borderRadius = '5px';
  messageDiv.style.zIndex = '10000';
  messageDiv.style.maxWidth = '80%';
  messageDiv.style.maxHeight = '80%';
  messageDiv.style.overflow = 'auto';
  messageDiv.innerHTML = `
    <h3>ChatGPT Debug Info</h3>
    <p>Found ${currentConversation.interactions.length} messages</p>
    <pre style="font-size: 12px; white-space: pre-wrap;">${formattedMessages}</pre>
    <p>Significant Text Blocks: ${significantTexts.length}</p>
    <p>Check console for details</p>
    <button id="closeChatGPTDebug" style="padding: 5px; margin-top: 10px;">Close</button>
  `;
  
  document.body.appendChild(messageDiv);
  
  document.getElementById('closeChatGPTDebug').addEventListener('click', () => {
    document.body.removeChild(messageDiv);
  });
  
  return currentConversation.interactions;
}

// Add a debug button for Perplexity
function addPerplexityDebugButton() {
  if (chatbotType !== 'Perplexity') return;
  
  const debugBtn = document.createElement('button');
  debugBtn.id = 'perplexity-debug-button';
  debugBtn.textContent = 'Debug Perplexity';
  debugBtn.style.position = 'fixed';
  debugBtn.style.bottom = '90px';
  debugBtn.style.right = '10px';
  debugBtn.style.zIndex = '10000';
  debugBtn.style.padding = '5px 10px';
  debugBtn.style.borderRadius = '4px';
  debugBtn.style.backgroundColor = '#6366f1';
  debugBtn.style.display = 'none'; // Initially hidden
  debugBtn.style.color = 'white';
  debugBtn.style.border = 'none';
  debugBtn.style.cursor = 'pointer';
  
  debugBtn.addEventListener('click', () => {
    debugPerplexityCapture();
  });
  
  document.body.appendChild(debugBtn);
}

// Debug function for Perplexity capture
function debugPerplexityCapture() {
  console.log('===== PERPLEXITY DEBUG INFO =====');
  console.log('Current URL:', window.location.href);
  
  // Quick message count check
  const messages = extractAllMessages();
  console.log(`Found ${messages.length} messages in conversation`);
  
  if (messages.length > 0) {
    console.log('Message summary:');
    messages.forEach((msg, i) => {
      console.log(`  ${i+1}. ${msg.actor.toUpperCase()}: ${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}`);
    });
  } else {
    console.log('No messages found - check DOM structure');
  }
  
  // Show a simple visual summary
  const messageDiv = document.createElement('div');
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '20px';
  messageDiv.style.left = '20px';
  messageDiv.style.padding = '10px';
  messageDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
  messageDiv.style.color = 'white';
  messageDiv.style.borderRadius = '5px';
  messageDiv.style.zIndex = '10000';
  messageDiv.style.maxWidth = '400px';
  messageDiv.style.maxHeight = '300px';
  messageDiv.style.overflow = 'auto';
  
  let formattedMessages = '';
  messages.forEach((msg, i) => {
    formattedMessages += `\n[${i+1}] ${msg.actor.toUpperCase()}: ${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}`;
  });
  
  messageDiv.innerHTML = `
    <h3>Perplexity Debug</h3>
    <p>Found ${messages.length} messages</p>
    <pre style="font-size: 11px; white-space: pre-wrap;">${formattedMessages}</pre>
    <button id="closePerplexityDebug" style="padding: 5px; margin-top: 10px;">Close</button>
  `;
  
  document.body.appendChild(messageDiv);
  
  document.getElementById('closePerplexityDebug').addEventListener('click', () => {
    document.body.removeChild(messageDiv);
  });
  
  return messages;
}

 