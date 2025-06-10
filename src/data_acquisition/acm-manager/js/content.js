/**
 * ACM Manager - Content Script
 * 
 * Responsible for:
 * - Detecting the chatbot platform
 * - Periodically capturing the entire conversation
 * - Sending data to the background script
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', initialize);
window.addEventListener('load', initialize);

// For debugging
console.log('ACM Manager content script loaded');
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
  originalACMsUsed: [],
  targetModelRequested: null,
  conversationUrl: null
};
let captureInterval = null;
let captureFrequency = 60000; // Default: 1 minute in milliseconds

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

// Initialize the content script
function initialize() {
  console.log('ACM Manager content script initialized');
  
  // Detect the chatbot platform
  chatbotType = detectChatbotPlatform();
  console.log('Detected chatbot type:', chatbotType);
  console.log('DOM ready state:', document.readyState);
  console.log('Current URL:', window.location.href);
  
  if (!chatbotType) {
    console.log('No supported chatbot detected on this page');
    return;
  }
  
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
  
  // Load settings and start periodic capture
  loadSettingsAndStartCapture();
  
  // Listen for new conversations or page changes
  setupConversationListeners();
}

// Load settings and start the periodic capture
function loadSettingsAndStartCapture() {
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
}

// Start periodic capture of the entire conversation
function startPeriodicCapture() {
  console.log(`Starting periodic capture every ${captureFrequency/1000} seconds`);
  updateStatusIndicator(`Capturing every ${captureFrequency/1000}s`);
  
  // Capture immediately
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
  if (!currentConversation.id) { // TODO: Need to think about conversations IDs, maybe we should use the URL as the ID. 
    currentConversation.id = generateUrlSafeId(window.location.href);
    currentConversation.timestamp = new Date().toISOString();
    console.log('Created new conversation with ID:', currentConversation.id);
  }
  
  // Get all messages based on platform
  const existingMessages = extractAllMessages();
  
  // Update current conversation
  if (existingMessages.length > 0) {
    console.log(`Captured ${existingMessages.length} messages`);
    currentConversation.interactions = existingMessages;
    
    // Try to extract the model info for platforms that show it
    extractModelInfo();
    
    // Save the conversation
    saveCurrentConversation();
  } else {
    console.log('No messages found in the conversation');
    updateStatusIndicator('No messages found');
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
      // Try multiple selectors to find all messages
      const chatgptSelectors = [
        '[data-message-author-role="user"], [data-testid="conversation-turn-user"], [data-testid="conversation-turn-assistant"]',
        '.text-message, .message',
        '.prose'
      ];
      
      for (const selector of chatgptSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector "${selector}"`);
          messageElements = [...messageElements, ...elements];
        }
      }
      break;
      
    case 'Claude':
      messageElements = [
        ...document.querySelectorAll('.message-content, .message, .human-message, .claude-message, .assistant-message, .user-message')
      ];
      break;
      
    case 'Gemini':
      // For Gemini, we'll take a completely different approach since the Angular app structure is complex
      console.log('Using specialized Gemini message extraction');
      
      // Direct extraction of user queries
      const userQueries = document.querySelectorAll('user-query, .user-query-container');
      console.log(`Found ${userQueries.length} user query elements`);
      
      for (const userQuery of userQueries) {
        // Try to find the text content within user queries
        const userContent = userQuery.querySelector('.query-text') || 
                           userQuery.querySelector('.user-query-bubble') || 
                           userQuery.querySelector('.query-content');
        
        if (userContent) {
          const text = userContent.textContent.trim();
          if (text && text.length > 5) {
            console.log('Found user query:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
            messages.push({
              actor: 'user',
              timestamp: new Date().toISOString(),
              content: text,
              attachments: []
            });
          }
        }
      }
      
      // Direct extraction of model responses
      const modelResponses = document.querySelectorAll('model-response, .response-container, .presented-response-container');
      console.log(`Found ${modelResponses.length} model response elements`);
      
      for (const modelResponse of modelResponses) {
        // Try to find the text content within model responses
        const responseContent = modelResponse.querySelector('.response-content') || 
                               modelResponse.querySelector('.model-response-text') || 
                               modelResponse.querySelector('message-content') ||
                               modelResponse.querySelector('.markdown');
        
        if (responseContent) {
          const text = responseContent.textContent.trim();
          if (text && text.length > 5) {
            console.log('Found model response:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
            messages.push({
              actor: 'bot',
              timestamp: new Date().toISOString(),
              content: text,
              attachments: []
            });
          }
        }
      }
      
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
      messageElements = [
        ...document.querySelectorAll('.MessageItem, .ChatMessage, .message, .human, .bot')
      ];
      break;
      
    case 'Perplexity':
      messageElements = [
        ...document.querySelectorAll('.message, .conversation-message, .query, .answer, .query-response')
      ];
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
  
  try {
    let actor = 'unknown';
    let content = '';
    let timestamp = new Date().toISOString();
    let attachments = [];
    
    switch (chatbotType) {
      case 'ChatGPT':
        // Determine if it's a user or assistant message
        if (element.hasAttribute('data-message-author-role')) {
          actor = element.getAttribute('data-message-author-role') === 'user' ? 'user' : 'bot';
        } else if (element.classList.contains('user')) {
          actor = 'user';
        } else if (element.classList.contains('assistant')) {
          actor = 'bot';
        } else if (element.closest('[data-testid="conversation-turn-user"]')) {
          actor = 'user';
        } else if (element.closest('[data-testid="conversation-turn-assistant"]')) {
          actor = 'bot';
        } else {
          // Try to determine based on content or position
          const userIndicators = ['You:', 'You said:', 'User:'];
          const aiIndicators = ['ChatGPT:', 'GPT:', 'Assistant:'];
          
          const text = element.textContent.trim();
          
          if (userIndicators.some(indicator => text.startsWith(indicator))) {
            actor = 'user';
          } else if (aiIndicators.some(indicator => text.startsWith(indicator))) {
            actor = 'bot';
          }
        }
        
        // Extract message content
        const contentElement = element.querySelector('.text-message-content, .message-content, .prose, .markdown');
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
        if (element.closest('.human-message, .user-message')) {
          actor = 'user';
        } else if (element.closest('.claude-message, .ai-message')) {
          actor = 'bot';
        }
        
        // Extract message content
        content = element.textContent.trim();
        
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
        break;
        
      case 'Poe':
        // Determine if it's a user or assistant message
        if (element.hasAttribute('data-message-author-type')) {
          actor = element.getAttribute('data-message-author-type') === 'human' ? 'user' : 'bot';
        } else if (element.classList.contains('human')) {
          actor = 'user';
        } else if (element.classList.contains('bot')) {
          actor = 'bot';
        }
        
        // Extract message content
        const poeContent = element.querySelector('.message-content, .MessageContent');
        if (poeContent) {
          content = poeContent.textContent.trim();
        } else {
          content = element.textContent.trim();
        }
        break;
        
      case 'Perplexity':
        // Determine if it's a user or assistant message
        if (element.classList.contains('user-query') || element.classList.contains('query')) {
          actor = 'user';
        } else if (element.classList.contains('answer') || element.classList.contains('response')) {
          actor = 'bot';
        }
        
        // Extract message content
        const perplexityContent = element.querySelector('.content, .text-content');
        if (perplexityContent) {
          content = perplexityContent.textContent.trim();
        } else {
          content = element.textContent.trim();
        }
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
        const perplexityModelElement = document.querySelector('.model-name, .ModelName');
        if (perplexityModelElement) {
          currentConversation.targetModelRequested = perplexityModelElement.textContent.trim();
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
  
  // First check if we already have a conversation with this URL
  const expectedId = generateUrlSafeId(currentConversation.conversationUrl);
  chrome.runtime.sendMessage(
    { 
      action: 'findConversationByUrl', 
      url: expectedId
    },
    response => {
      if (response && response.success && response.conversation) {
        console.log('Found existing conversation with same URL, updating instead of creating new:', response.conversation);
        
        // Use the existing ID but update the content
        currentConversation.id = expectedId;
        
        // Delete the old version first
        chrome.runtime.sendMessage(
          { action: 'deleteACM', id: expectedId },
          deleteResponse => {
            if (deleteResponse && deleteResponse.success) {
              // Now save the updated version
              saveNewConversation();
            } else {
              console.error('Error deleting old conversation version:', deleteResponse?.error);
              // Still try to save the new version
              saveNewConversation();
            }
          }
        );
      } else {
        // No existing conversation with this URL, save as new
        saveNewConversation();
      }
    }
  );
}

// Helper function to save a new conversation
function saveNewConversation() {
  chrome.runtime.sendMessage(
    { action: 'saveACM', data: currentConversation },
    response => {
      if (response && response.success) {
        console.log('Conversation saved successfully with ID:', response.id);
        updateStatusIndicator('Saved successfully');
      } else {
        console.error('Error saving conversation:', response?.error);
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
    originalACMsUsed: [],
    targetModelRequested: null,
    conversationUrl: window.location.href
  };
}

// Add a visual status indicator to the page
function addStatusIndicator() {
  const statusEl = document.createElement('div');
  statusEl.className = 'acm-capture-status';
  statusEl.id = 'acm-status';
  statusEl.textContent = 'ACM: Capturing ' + chatbotType;
  statusEl.style.position = 'fixed';
  statusEl.style.bottom = '10px';
  statusEl.style.right = '10px';
  statusEl.style.background = 'rgba(0, 120, 0, 0.7)';
  statusEl.style.color = 'white';
  statusEl.style.padding = '5px 10px';
  statusEl.style.borderRadius = '4px';
  statusEl.style.fontSize = '12px';
  statusEl.style.zIndex = '10000';
  
  document.body.appendChild(statusEl);
  
  // Show the indicator briefly
  statusEl.style.opacity = '1';
  setTimeout(() => {
    statusEl.style.opacity = '0.2';
  }, 3000);
  
  // Make it hoverable
  statusEl.addEventListener('mouseover', () => {
    statusEl.style.opacity = '1';
  });
  
  statusEl.addEventListener('mouseout', () => {
    statusEl.style.opacity = '0.2';
  });
}

// Update the status indicator with current status
function updateStatusIndicator(status) {
  const statusEl = document.getElementById('acm-status');
  if (statusEl) {
    statusEl.textContent = `ACM: ${status} - ${chatbotType}`;
    statusEl.style.opacity = '1';
    setTimeout(() => {
      statusEl.style.opacity = '0.2';
    }, 2000);
  }
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
  const userQueries = document.querySelectorAll('user-query, .user-query-container');
  console.log(`Found ${userQueries.length} user query elements`);
  
  let addedCount = 0;
  
  for (const userQuery of userQueries) {
    try {
      // Extract the content from the deepest text containers
      const queryContent = userQuery.querySelector('.query-text') || 
                         userQuery.querySelector('.user-query-bubble') || 
                         userQuery.querySelector('.query-content');
      
      if (queryContent) {
        const text = queryContent.textContent.trim();
        if (text && text.length > 0) {
          console.log(`Adding user query: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
          
          if (addMessage('user', text)) {
            addedCount++;
          }
        }
      }
    } catch (error) {
      console.error('Error processing user query:', error);
    }
  }
  
  const modelResponses = document.querySelectorAll('model-response, .response-container, .presented-response-container');
  console.log(`Found ${modelResponses.length} model response elements`);
  
  for (const modelResponse of modelResponses) {
    try {
      // Extract the content from the deepest text containers
      const responseContent = modelResponse.querySelector('.response-content') || 
                            modelResponse.querySelector('.model-response-text') || 
                            modelResponse.querySelector('message-content .markdown') ||
                            modelResponse.querySelector('.markdown');
      
      if (responseContent) {
        const text = responseContent.textContent.trim();
        if (text && text.length > 0) {
          console.log(`Adding model response: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
          
          if (addMessage('bot', text)) {
            addedCount++;
          }
        }
      }
    } catch (error) {
      console.error('Error processing model response:', error);
    }
  }
  
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