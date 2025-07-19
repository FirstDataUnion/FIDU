/**
 * FIDU Configuration Utility
 * 
 * Provides configuration utilities for FIDU Identity Service URLs
 * and other FIDU-related settings that can be used across the extension.
 */

// Default production URL
const DEFAULT_FIDU_IDENTITY_URL = 'https://identity.firstdataunion.org';

/**
 * Get the FIDU Identity Service URL from Chrome storage
 * @param {function} callback - Callback function that receives the URL as parameter
 */
function getFiduIdentityServiceUrl(callback) {
  chrome.storage.sync.get('settings', (result) => {
    const settings = result.settings || {};
    const customUrl = settings.fiduIdentityUrl || '';
    
    // If custom URL is provided and not empty, use it; otherwise use production
    const url = customUrl.trim() || DEFAULT_FIDU_IDENTITY_URL;
    
    callback(url);
  });
}

/**
 * Set the FIDU Identity Service URL
 * @param {string} url - The custom URL to set
 * @param {function} callback - Optional callback function
 */
function setFiduIdentityServiceUrl(url, callback = null) {
  chrome.storage.sync.get('settings', (result) => {
    const settings = result.settings || {};
    settings.fiduIdentityUrl = url;
    
    chrome.storage.sync.set({ settings }, () => {
      if (callback) callback();
    });
  });
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getFiduIdentityServiceUrl,
    setFiduIdentityServiceUrl,
    DEFAULT_FIDU_IDENTITY_URL
  };
} 