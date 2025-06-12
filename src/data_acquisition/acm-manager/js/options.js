/**
 * ACM Manager - Options Script
 * 
 * Responsible for:
 * - Loading user preferences
 * - Saving user preferences
 * - Handling options page interactions
 */

// Suppress connector errors that might be logged to the console
suppressConnectorErrors();

// Default settings
const defaultSettings = {
  // Capture settings
  autoCaptureEnabled: true,
  showCaptureIndicator: true,
  highlightCapturedMessages: false,
  captureFrequency: 60, // Default capture frequency in seconds
  useFiduCore: false, // Default to not using Fidu Core backend
  
  // Supported chatbots
  enabledChatbots: {
    'ChatGPT': true,
    'Claude': true,
    'Gemini': true,
    'Poe': true,
    'Perplexity': true
  },
  
  // Storage settings
  maxStorageSize: 50, // MB
  autoExportEnabled: false,
  dataCleanupPolicy: 'oldest'
};

// Initialize options page
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const autoCaptureEnabledEl = document.getElementById('autoCaptureEnabled');
  const showCaptureIndicatorEl = document.getElementById('showCaptureIndicator');
  const highlightCapturedMessagesEl = document.getElementById('highlightCapturedMessages');
  const captureFrequencyEl = document.getElementById('captureFrequency');
  const useFiduCoreEl = document.getElementById('useFiduCore');

  const enableChatGPTEl = document.getElementById('enableChatGPT');
  const enableClaudeEl = document.getElementById('enableClaude');
  const enableBardEl = document.getElementById('enableBard');
  const enablePoeEl = document.getElementById('enablePoe');
  const enablePerplexityEl = document.getElementById('enablePerplexity');

  const maxStorageSizeEl = document.getElementById('maxStorageSize');
  const autoExportEnabledEl = document.getElementById('autoExportEnabled');
  const dataCleanupPolicyEl = document.getElementById('dataCleanupPolicy');

  const resetButtonEl = document.getElementById('resetButton');
  const saveButtonEl = document.getElementById('saveButton');
  const statusMessageEl = document.getElementById('statusMessage');

  // Load saved settings
  loadSettings();
  
  // Add event listeners
  saveButtonEl.addEventListener('click', saveSettings);
  resetButtonEl.addEventListener('click', resetSettings);

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get('settings', (result) => {
      const settings = result.settings || defaultSettings;
      
      // Apply settings to form elements
      autoCaptureEnabledEl.checked = settings.autoCaptureEnabled;
      showCaptureIndicatorEl.checked = settings.showCaptureIndicator;
      highlightCapturedMessagesEl.checked = settings.highlightCapturedMessages;
      captureFrequencyEl.value = settings.captureFrequency || 60;
      useFiduCoreEl.checked = settings.useFiduCore ?? false;
      
      enableChatGPTEl.checked = settings.enabledChatbots?.ChatGPT ?? true;
      enableClaudeEl.checked = settings.enabledChatbots?.Claude ?? true;
      enableBardEl.checked = settings.enabledChatbots?.Bard ?? true;
      enablePoeEl.checked = settings.enabledChatbots?.Poe ?? true;
      enablePerplexityEl.checked = settings.enabledChatbots?.Perplexity ?? true;
      
      maxStorageSizeEl.value = settings.maxStorageSize || 50;
      autoExportEnabledEl.checked = settings.autoExportEnabled;
      dataCleanupPolicyEl.value = settings.dataCleanupPolicy || 'oldest';
    });
  }

  // Save settings to storage
  function saveSettings() {
    const settings = {
      // Capture settings
      autoCaptureEnabled: autoCaptureEnabledEl.checked,
      showCaptureIndicator: showCaptureIndicatorEl.checked,
      highlightCapturedMessages: highlightCapturedMessagesEl.checked,
      captureFrequency: parseInt(captureFrequencyEl.value, 10) || 60,
      useFiduCore: useFiduCoreEl.checked,
      
      // Supported chatbots
      enabledChatbots: {
        'ChatGPT': enableChatGPTEl.checked,
        'Claude': enableClaudeEl.checked,
        'Bard': enableBardEl.checked,
        'Poe': enablePoeEl.checked,
        'Perplexity': enablePerplexityEl.checked
      },
      
      // Storage settings
      maxStorageSize: parseInt(maxStorageSizeEl.value, 10) || 50,
      autoExportEnabled: autoExportEnabledEl.checked,
      dataCleanupPolicy: dataCleanupPolicyEl.value
    };
    
    // Save to Chrome storage
    chrome.storage.sync.set({ settings }, () => {
      // Show success message
      statusMessageEl.textContent = 'Settings saved successfully!';
      statusMessageEl.classList.remove('error');
      statusMessageEl.style.display = 'block';
      
      // Notify other extension components of changes
      chrome.runtime.sendMessage({ action: 'settingsUpdated', settings });
      
      // Hide message after a delay
      setTimeout(() => {
        statusMessageEl.style.display = 'none';
      }, 3000);
    });
  }

  // Reset settings to defaults
  function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to their default values?')) {
      // Apply default settings to form elements
      autoCaptureEnabledEl.checked = defaultSettings.autoCaptureEnabled;
      showCaptureIndicatorEl.checked = defaultSettings.showCaptureIndicator;
      highlightCapturedMessagesEl.checked = defaultSettings.highlightCapturedMessages;
      captureFrequencyEl.value = defaultSettings.captureFrequency;
      useFiduCoreEl.checked = defaultSettings.useFiduCore;
      
      enableChatGPTEl.checked = defaultSettings.enabledChatbots.ChatGPT;
      enableClaudeEl.checked = defaultSettings.enabledChatbots.Claude;
      enableBardEl.checked = defaultSettings.enabledChatbots.Bard;
      enablePoeEl.checked = defaultSettings.enabledChatbots.Poe;
      enablePerplexityEl.checked = defaultSettings.enabledChatbots.Perplexity;
      
      maxStorageSizeEl.value = defaultSettings.maxStorageSize;
      autoExportEnabledEl.checked = defaultSettings.autoExportEnabled;
      dataCleanupPolicyEl.value = defaultSettings.dataCleanupPolicy;
      
      // Save defaults to storage
      saveSettings();
      
      // Show reset message
      statusMessageEl.textContent = 'Settings reset to defaults!';
      statusMessageEl.classList.remove('error');
      statusMessageEl.style.display = 'block';
      
      // Hide message after a delay
      setTimeout(() => {
        statusMessageEl.style.display = 'none';
      }, 3000);
    }
  }
});

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