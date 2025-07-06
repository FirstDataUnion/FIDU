// Content Script for Chatbot Conversation Saver
// This script is injected into whitelisted pages to retrieve HTML content

console.log('Chatbot Conversation Saver: Content script loaded');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getHTML') {
    try {
      const htmlContent = document.documentElement.outerHTML;
      sendResponse({ success: true, html: htmlContent });
    } catch (error) {
      console.error('Error getting HTML content:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
});

// Notify background script that content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' }); 