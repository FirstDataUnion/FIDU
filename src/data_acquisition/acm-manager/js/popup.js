/**
 * ACM Manager - Popup Script
 * 
 * Responsible for:
 * - Displaying the status of the extension
 * - Showing basic statistics about captured ACMs
 * - Providing controls for managing the extension
 */

// Suppress connector errors that might be logged to the console
suppressConnectorErrors();

// DOM elements
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
const totalAcmsEl = document.getElementById('totalAcms');
const sessionAcmsEl = document.getElementById('sessionAcms');
const activeChatbotEl = document.getElementById('activeChatbot');
const viewAcmsBtnEl = document.getElementById('viewAcmsBtn');
const toggleCaptureBtnEl = document.getElementById('toggleCaptureBtn');
const exportBtnEl = document.getElementById('exportBtn');
const clearBtnEl = document.getElementById('clearBtn');
const optionsLinkEl = document.getElementById('optionsLink');

// State variables
let captureEnabled = true;
let sessionCount = 0;

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

function initializePopup() {
  // Load current state
  loadState();
  
  // Update statistics
  updateStatistics();
  
  // Add event listeners
  viewAcmsBtnEl.addEventListener('click', openAcmViewer);
  toggleCaptureBtnEl.addEventListener('click', toggleCapture);
  exportBtnEl.addEventListener('click', exportAcms);
  clearBtnEl.addEventListener('click', clearAllAcms);
  optionsLinkEl.addEventListener('click', openOptions);
}

// Load extension state
function loadState() {
  chrome.storage.local.get(['captureEnabled', 'sessionCount'], (result) => {
    captureEnabled = result.captureEnabled !== undefined ? result.captureEnabled : true;
    sessionCount = result.sessionCount || 0;
    
    updateCaptureToggleButton();
  });
}

// Update the statistics display
function updateStatistics() {
  // Get active tab to check if it's a supported chatbot
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;
    
    // Determine if the current page is a supported chatbot
    let activeChatbot = 'None';
    let isActivePage = false;
    
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
      activeChatbot = 'ChatGPT';
      isActivePage = true;
    } else if (url.includes('claude.ai')) {
      activeChatbot = 'Claude';
      isActivePage = true;
    } else if (url.includes('gemini.google.com')) {
      activeChatbot = 'Gemini';
      isActivePage = true;
    } else if (url.includes('poe.com')) {
      activeChatbot = 'Poe';
      isActivePage = true;
    } else if (url.includes('perplexity.ai')) {
      activeChatbot = 'Perplexity';
      isActivePage = true;
    }
    
    // Update active chatbot display
    activeChatbotEl.textContent = activeChatbot;
    
    // Update status based on active page and capture settings
    updateStatus(isActivePage);
  });
  
  // Get total ACM count from database
  chrome.runtime.sendMessage({ action: 'getACMs' }, (response) => {
    if (response && response.success) {
      totalAcmsEl.textContent = response.acms.length;
    } else {
      totalAcmsEl.textContent = 'Error';
      console.error('Error retrieving ACMs:', response.error);
    }
  });
  
  // Update session count
  sessionAcmsEl.textContent = sessionCount;
}

// Update the status display
function updateStatus(isActivePage) {
  if (!isActivePage) {
    statusEl.className = 'status inactive';
    statusTextEl.textContent = 'Not a supported chatbot page';
    return;
  }
  
  if (!captureEnabled) {
    statusEl.className = 'status inactive';
    statusTextEl.textContent = 'Capture is currently paused';
    return;
  }
  
  statusEl.className = 'status';
  statusTextEl.textContent = 'Actively capturing conversations';
}

// Update the capture toggle button
function updateCaptureToggleButton() {
  toggleCaptureBtnEl.textContent = captureEnabled ? 'Pause Capture' : 'Resume Capture';
}

// Handle capture toggle
function toggleCapture() {
  captureEnabled = !captureEnabled;
  
  // Update UI
  updateCaptureToggleButton();
  updateStatistics();
  
  // Save state
  chrome.storage.local.set({ captureEnabled });
  
  // Notify content script of the change
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    chrome.tabs.sendMessage(currentTab.id, { action: 'setCaptureEnabled', enabled: captureEnabled });
  });
}

// Open the ACM viewer page
function openAcmViewer() {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/viewer.html') });
}

// Export ACMs to a JSON file
function exportAcms() {
  chrome.runtime.sendMessage({ action: 'getACMs' }, (response) => {
    if (response && response.success) {
      const acmsData = response.acms;
      const exportData = {
        exportDate: new Date().toISOString(),
        acmsCount: acmsData.length,
        acms: acmsData
      };
      
      // Create a download for the JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and trigger it
      const a = document.createElement('a');
      a.href = url;
      a.download = `acm-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } else {
      alert('Error exporting ACMs: ' + (response.error || 'Unknown error'));
      console.error('Error exporting ACMs:', response.error);
    }
  });
}

// Clear all ACMs from the database
function clearAllAcms() {
  if (confirm('Are you sure you want to delete all ACMs? This cannot be undone.')) {
    chrome.runtime.sendMessage({ action: 'clearAllACMs' }, (response) => {
      if (response && response.success) {
        alert('All ACMs have been deleted');
        sessionCount = 0;
        chrome.storage.local.set({ sessionCount });
        updateStatistics();
      } else {
        alert('Error clearing ACMs: ' + (response.error || 'Unknown error'));
        console.error('Error clearing ACMs:', response.error);
      }
    });
  }
}

// Open the options page
function openOptions() {
  chrome.runtime.openOptionsPage();
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