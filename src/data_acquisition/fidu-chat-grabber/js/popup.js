/**
 * Popup Script for FIDU Chat Grabber Extension
 * 
 * This script handles:
 * - Showing basic statistics about captured conversations
 * - Providing buttons to view, export, and clear conversations
 * - Managing extension settings
 * - FIDU SDK authentication integration
 */

// DOM elements
const statusEl = document.getElementById('status');
const viewConversationsBtnEl = document.getElementById('viewConversationsBtn');
const exportBtnEl = document.getElementById('exportBtn');
const settingsBtnEl = document.getElementById('settingsBtn');
const toggleAuthBtnEl = document.getElementById('toggleAuthBtn');
const baseUrlInputEl = document.getElementById('baseUrlInput');
const saveSettingsBtnEl = document.getElementById('saveSettingsBtn');
const resetSettingsBtnEl = document.getElementById('resetSettingsBtn');
const settingsStatusEl = document.getElementById('settingsStatus');

// Settings form elements
const debugModeEl = document.getElementById('debugMode');
const fiduIdentityUrlEl = document.getElementById('fiduIdentityUrl');
const autoCaptureEnabledEl = document.getElementById('autoCaptureEnabled');
const captureFrequencyEl = document.getElementById('captureFrequency');
const showCaptureIndicatorEl = document.getElementById('showCaptureIndicator');
const highlightCapturedMessagesEl = document.getElementById('highlightCapturedMessages');
const enableChatGPTEl = document.getElementById('enableChatGPT');
const enableClaudeEl = document.getElementById('enableClaude');
const enableBardEl = document.getElementById('enableBard');
const enablePoeEl = document.getElementById('enablePoe');
const enablePerplexityEl = document.getElementById('enablePerplexity');

// User info elements
const userInfoEl = document.getElementById('userInfo');
const userEmailEl = document.getElementById('userEmail');
const userNameEl = document.getElementById('userName');
const profileSectionEl = document.getElementById('profileSection');
const selectedProfileNameEl = document.getElementById('selectedProfileName');
const manageProfilesBtnEl = document.getElementById('manageProfilesBtn');

// FIDU Auth container
const fiduAuthContainerEl = document.getElementById('fiduAuthContainer');

// State
let isLoggedIn = false;
let selectedProfileId = null;
let profiles = [];
let currentUser = null;
let fiduInstance = null;

// Default settings
const defaultSettings = {
  // Debug settings
  debugMode: false,
  
  // Capture settings
  autoCaptureEnabled: true,
  showCaptureIndicator: true,
  highlightCapturedMessages: false,
  captureFrequency: 60,
  useFiduCore: true,
  
  // FIDU Identity Service settings (debug only)
  fiduIdentityUrl: '',
  
  // FIDU Vault settings (debug only)
  fiduCoreUrl: 'http://127.0.0.1:4000/api/v1',
  
  // Supported chatbots
  enabledChatbots: {
    'ChatGPT': true,
    'Claude': true,
    'Bard': true,
    'Poe': true,
    'Perplexity': true
  }
};

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup initialized');
  
  // Load settings and update UI
  loadSettings();
  updateUI();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load conversation count (will show 0 if not authenticated)
  loadConversationCount();
  
  // Initialize FIDU SDK
  initializeFiduSDK();
  
  // Check if user is already authenticated and load profiles
  checkAuthAndLoadProfiles();
});

// Initialize FIDU SDK
function initializeFiduSDK() {
  // Get FIDU Identity Service URL from settings
  getFiduIdentityServiceUrl(function(fiduHost) {
    const fidu = new FIDUAuth({
      fiduHost: fiduHost,
      debug: true
    });
    fiduInstance = fidu;

    // Set up event handlers
    fidu.on('onAuthSuccess', async function(user, token, portalUrl) {
      console.log('User authenticated:', user);
      
      // Store token and user using authService
      if (typeof authService !== 'undefined' && authService.storeAuthData) {
        try {
          await authService.storeAuthData(token, user);
        } catch (e) {
          console.error('Failed to store auth data:', e);
        }
      } else {
        // Fallback to localStorage if authService is not available
        localStorage.setItem('fidu_auth_token', token);
        localStorage.setItem('fidu_user_data', JSON.stringify(user));
      }
      
      // Update state
      isLoggedIn = true;
      currentUser = user;
      
      // Hide the login widget
      if (fiduAuthContainerEl) fiduAuthContainerEl.style.display = 'none';
      
      // Show user info and profile section
      if (userInfoEl) userInfoEl.style.display = 'block';
      if (profileSectionEl) profileSectionEl.style.display = 'block';
      
      // Update user info fields
      if (userEmailEl) userEmailEl.textContent = user.email || '';
      if (userNameEl) userNameEl.textContent = (user.first_name || '') + ' ' + (user.last_name || '');
      
      // Load profiles and update UI
      loadProfiles();
      updateUI();
      
      // Update auth status UI to show logged in state
      updateAuthStatusUI(true, user);
      
      // Reload conversation count after authentication
      loadConversationCount();
      
      // Notify content scripts of auth status change
      notifyContentScriptsOfAuthChange('login');
    });

    fidu.on('onAuthError', function(error) {
      console.error('Auth error:', error);
      updateAuthStatusUI(false);
    });

    fidu.on('onLogout', function() {
      console.log('User logged out via FIDU SDK');
      
      // Update state immediately
      isLoggedIn = false;
      currentUser = null;
      profiles = [];
      selectedProfileId = null;
      
      // Update UI to show logged out state
      updateAuthStatusUI(false);
      updateUI();
      
      // Show login widget
      if (fiduAuthContainerEl) fiduAuthContainerEl.style.display = 'block';
      // Hide user info and profile section
      if (userInfoEl) userInfoEl.style.display = 'none';
      if (profileSectionEl) profileSectionEl.style.display = 'none';
      
      // Notify content scripts of logout
      notifyContentScriptsOfAuthChange('logout');
    });

    // Check if user is already authenticated
    fidu.init().then(function(isAuthenticated) {
      if (!isAuthenticated) {
        // Show login widget
        if (fiduAuthContainerEl) fiduAuthContainerEl.style.display = 'block';
        // Hide user info and profile section
        if (userInfoEl) userInfoEl.style.display = 'none';
        if (profileSectionEl) profileSectionEl.style.display = 'none';
        updateAuthStatusUI(false);
        fidu.showLoginWidget();
      } else {
        // Hide the login widget
        if (fiduAuthContainerEl) fiduAuthContainerEl.style.display = 'none';
        // Show user info and profile section
        if (userInfoEl) userInfoEl.style.display = 'block';
        if (profileSectionEl) profileSectionEl.style.display = 'block';
        
        // Get user data from storage
        getCurrentUserFromStorage().then(user => {
          currentUser = user;
          isLoggedIn = true;
          loadProfiles();
          updateUI();
          
          // Update auth status UI to show logged in state
          updateAuthStatusUI(true, user);
          
          // Reload conversation count after authentication
          loadConversationCount();
          
          // Notify content scripts of auth status change
          notifyContentScriptsOfAuthChange('login');
        });
      }
    });
  });
}

// Get current user from storage
async function getCurrentUserFromStorage() {
  try {
    if (typeof authService !== 'undefined' && authService.getCurrentUser) {
      return await authService.getCurrentUser();
    } else {
      // Fallback to localStorage
      const userData = localStorage.getItem('fidu_user_data');
      return userData ? JSON.parse(userData) : null;
    }
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Update auth status UI
function updateAuthStatusUI(isAuthenticated, user) {
  if (isAuthenticated) {
    if (toggleAuthBtnEl) toggleAuthBtnEl.textContent = 'Logout';
    if (statusEl) {
      statusEl.textContent = 'Logged in';
      statusEl.style.color = '#4caf50';
    }
  } else {
    if (toggleAuthBtnEl) toggleAuthBtnEl.textContent = 'Login';
    if (statusEl) {
      statusEl.textContent = 'Not logged in';
      statusEl.style.color = '#f44336';
    }
  }
}

// Set up event listeners
function setupEventListeners() {
  // View conversations button
  viewConversationsBtnEl.addEventListener('click', openConversationViewer);
  
  // Export button
  exportBtnEl.addEventListener('click', exportConversations);
  
  // Settings button
  settingsBtnEl.addEventListener('click', toggleSettings);
  
  // Toggle auth button
  toggleAuthBtnEl.addEventListener('click', handleToggleAuth);
  
  // Profile management
  manageProfilesBtnEl.addEventListener('click', showProfileModal);
  
  // Profile selection
  // profileSelectEl.addEventListener('change', handleProfileChange); // Removed as per edit hint
  
  // Save settings button
  saveSettingsBtnEl.addEventListener('click', saveSettings);
  resetSettingsBtnEl.addEventListener('click', resetSettings);
  
  // Debug mode toggle
  debugModeEl.addEventListener('change', toggleDebugMode);
}

// Handle toggle auth button
function handleToggleAuth() {
  if (!fiduInstance) return;
  
  const isAuthenticated = toggleAuthBtnEl.textContent === 'Logout';
  
  if (isAuthenticated) {
    // Update status immediately to show logout in progress
    updateAuthStatusUI(false);
    
    // Logout
    fiduInstance.logout && fiduInstance.logout();
    handleLogout();
  } else {
    // Show login widget
    if (fiduAuthContainerEl) fiduAuthContainerEl.style.display = 'block';
    fiduInstance.showLoginWidget && fiduInstance.showLoginWidget();
  }
}

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(['baseUrl', 'selectedProfileId'], (result) => {
    if (result.baseUrl) {
      baseUrlInputEl.value = result.baseUrl;
    }
    
    if (result.selectedProfileId) {
      selectedProfileId = result.selectedProfileId;
    }
  });

  // Load settings from sync storage (like the old options page)
  chrome.storage.sync.get(['settings'], (result) => {
    if (result.settings) {
      // Merge with default settings
      Object.assign(defaultSettings, result.settings);
    }
    
    // Apply settings to UI
    updateSettingsUI();
  });
}

// Update UI based on current state
async function updateUI() {
  if (isLoggedIn) {
    // Show user info
    if (currentUser) {
      userInfoEl.style.display = 'block';
      userEmailEl.textContent = currentUser.email || '';
      userNameEl.textContent = currentUser.name || currentUser.first_name + ' ' + currentUser.last_name || '';
    }
    
    // Show profile section
    profileSectionEl.style.display = 'block';
    await updateProfileDisplay();
  } else {
    // Hide user info and profile section
    userInfoEl.style.display = 'none';
    profileSectionEl.style.display = 'none';
  }
}

// Handle logout
function handleLogout() {
  console.log('Handling logout');
  
  // Clear stored data
  if (typeof authService !== 'undefined' && authService.logout) {
    authService.logout();
  } else {
    // Fallback to localStorage
    localStorage.removeItem('fidu_auth_token');
    localStorage.removeItem('fidu_user_data');
    localStorage.removeItem('selectedProfileId');
  }
  
  // Update state
  isLoggedIn = false;
  selectedProfileId = null;
  currentUser = null;
  profiles = [];
  
  // Update UI immediately
  updateAuthStatusUI(false);
  updateUI();
  
  // Show login widget and hide user sections
  if (fiduAuthContainerEl) fiduAuthContainerEl.style.display = 'block';
  if (userInfoEl) userInfoEl.style.display = 'none';
  if (profileSectionEl) profileSectionEl.style.display = 'none';
  
  // Notify content scripts of auth status change
  notifyContentScriptsOfAuthChange('logout');
}

// Update profile display
async function updateProfileDisplay() {
  console.log('updateProfileDisplay called - selectedProfileId:', selectedProfileId, 'profiles count:', profiles.length);
  
  // If we don't have a selectedProfileId but we have profiles, try to get it from storage
  if (!selectedProfileId && profiles.length > 0) {
    try {
      if (typeof authService !== 'undefined' && authService.getSelectedProfile) {
        const selectedProfile = await authService.getSelectedProfile();
        selectedProfileId = selectedProfile ? selectedProfile.id : null;
        console.log('Got selected profile from authService:', selectedProfile);
      } else {
        // Fallback to localStorage
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(['selectedProfileId'], resolve);
        });
        selectedProfileId = result.selectedProfileId || localStorage.getItem('selectedProfileId');
        console.log('Got selected profile from storage:', selectedProfileId);
      }
    } catch (error) {
      console.error('Error getting selected profile from storage:', error);
    }
  }
  
  if (selectedProfileId && profiles.length > 0) {
    const selectedProfile = profiles.find(p => p.id === selectedProfileId);
    if (selectedProfile) {
      // Handle different possible profile name fields
      const profileName = selectedProfile.name || selectedProfile.display_name || selectedProfile.profile_name || 'Unnamed Profile';
      selectedProfileNameEl.textContent = profileName;
      console.log('Set profile name to:', profileName);
    } else {
      selectedProfileNameEl.textContent = 'Profile not found';
      console.log('Profile not found in profiles list');
    }
  } else if (profiles.length > 0) {
    // If no profile is selected but profiles are available, select the first one
    console.log('No profile selected, auto-selecting first profile');
    await autoSelectProfile();
    updateProfileDisplay();
  } else {
    selectedProfileNameEl.textContent = 'No profiles available';
    console.log('No profiles available');
  }
}

// Check if user is authenticated and load profiles
async function checkAuthAndLoadProfiles() {
  try {
    if (typeof authService !== 'undefined' && authService.isAuthenticated) {
      const isAuthenticated = await authService.isAuthenticated();
      if (isAuthenticated) {
        // User is authenticated, load profiles
        await loadProfiles();
        updateUI();
        
        // Update auth status UI to show logged in state
        updateAuthStatusUI(true);
        
        // Reload conversation count after authentication
        loadConversationCount();
        
        // Notify content scripts of auth status change
        notifyContentScriptsOfAuthChange();
      }
    } else {
      // Fallback: check if we have stored auth data
      const token = await getAuthToken();
      if (token) {
        await loadProfiles();
        updateUI();
        
        // Update auth status UI to show logged in state
        updateAuthStatusUI(true);
        
        // Reload conversation count after authentication
        loadConversationCount();
        
        // Notify content scripts of auth status change
        notifyContentScriptsOfAuthChange();
      }
    }
  } catch (error) {
    console.error('Error checking auth and loading profiles:', error);
  }
}

// Show profile management modal
async function showProfileModal() {
  // First, try to load fresh profiles from the API
  try {
    await loadProfiles();
  } catch (error) {
    console.error('Error loading profiles for modal:', error);
  }
  
  if (profiles.length === 0) {
    alert('No profiles available. Please create a profile first.');
    return;
  }
  
  // Create modal HTML without inline event handlers
  const modalHTML = `
    <div id="profileModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    ">
      <div style="
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
        max-height: 80%;
        overflow-y: auto;
      ">
        <h3 style="margin: 0 0 15px 0; font-size: 16px;">Select Profile</h3>
        <div id="profileList" style="margin-bottom: 15px;">
          ${profiles.map(profile => {
            const profileName = profile.name || profile.display_name || profile.profile_name || 'Unnamed Profile';
            return `
            <div class="profile-item" data-profile-id="${profile.id}" style="
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
              margin-bottom: 8px;
              cursor: pointer;
              background: ${profile.id === selectedProfileId ? '#e3f2fd' : 'white'};
            ">
              <div style="font-weight: 500;">${profileName}</div>
              <div style="font-size: 12px; color: #666;">ID: ${profile.id}</div>
              ${profile.id === selectedProfileId ? '<div style="font-size: 12px; color: #2196f3;">✓ Currently Selected</div>' : ''}
            </div>
          `;
          }).join('')}
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancelProfileModal" style="
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
          ">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Set up event listeners using event delegation
  const modal = document.getElementById('profileModal');
  
  // Handle profile selection
  modal.addEventListener('click', function(e) {
    const profileItem = e.target.closest('.profile-item');
    if (profileItem) {
      const profileId = profileItem.dataset.profileId;
      selectProfile(profileId);
      closeProfileModal();
    }
  });
  
  // Handle cancel button
  const cancelBtn = document.getElementById('cancelProfileModal');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeProfileModal);
  }
  
  // Handle clicking outside modal to close
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeProfileModal();
    }
  });
}

// Close profile modal
function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) {
    modal.remove();
  }
}

// Load profiles from API
async function loadProfiles() {
  try {
    if (typeof authService !== 'undefined' && authService.getProfiles) {
      const result = await authService.getProfiles();
      if (result.success) {
        // Handle different possible response formats
        if (Array.isArray(result.profiles)) {
          profiles = result.profiles;
        } else if (result.profiles && Array.isArray(result.profiles.profiles)) {
          profiles = result.profiles.profiles;
        } else if (result.profiles && Array.isArray(result.profiles.data)) {
          profiles = result.profiles.data;
        } else {
          console.warn('Unexpected profiles response format:', result.profiles);
          profiles = [];
        }
      } else {
        console.error('Error loading profiles:', result.error);
        return;
      }
    }
    
    // Auto-select profile: first available or last selected
    await autoSelectProfile();
    
    await updateProfileDisplay();
  } catch (error) {
    console.error('Error loading profiles:', error);
  }
}

// Auto-select profile logic
async function autoSelectProfile() {
  if (profiles.length === 0) {
    selectedProfileId = null;
    return;
  }
  
  // First, try to get the last selected profile from storage
  let lastSelectedProfileId = null;
  try {
    if (typeof authService !== 'undefined' && authService.getSelectedProfile) {
      const selectedProfile = await authService.getSelectedProfile();
      lastSelectedProfileId = selectedProfile ? selectedProfile.id : null;
    } else {
      // Fallback to localStorage
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['selectedProfileId'], resolve);
      });
      lastSelectedProfileId = result.selectedProfileId || localStorage.getItem('selectedProfileId');
    }
  } catch (error) {
    console.error('Error getting last selected profile:', error);
  }
  
  // Check if the last selected profile still exists in the current profiles list
  if (lastSelectedProfileId && profiles.find(p => p.id === lastSelectedProfileId)) {
    selectedProfileId = lastSelectedProfileId;
  } else {
    // If not, select the first available profile
    selectedProfileId = profiles[0].id;
  }
  
  // Store the selected profile
  await setSelectedProfile(selectedProfileId);
  
  console.log('Auto-selected profile ID:', selectedProfileId);
}

// Set selected profile
async function setSelectedProfile(profileId) {
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;
  
  selectedProfileId = profileId;
  
  try {
    if (typeof authService !== 'undefined' && authService.setSelectedProfile) {
      await authService.setSelectedProfile(profile);
    } else {
      // Fallback to localStorage
      await new Promise((resolve) => {
        chrome.storage.local.set({ selectedProfileId }, resolve);
      });
      localStorage.setItem('selectedProfileId', selectedProfileId);
    }
  } catch (error) {
    console.error('Error setting selected profile:', error);
  }
}

// Handle profile selection from manage profiles modal
async function selectProfile(profileId) {
  await setSelectedProfile(profileId);
  await updateProfileDisplay();
  
  // Notify content scripts of profile change
  notifyContentScriptsOfAuthChange();
}

// Notify content scripts of authentication/profile status changes
function notifyContentScriptsOfAuthChange(event = 'login') {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
        try {
          chrome.tabs.sendMessage(tab.id, { action: 'authStatusChanged', event: event });
        } catch (error) {
          // Ignore errors for tabs that don't have content scripts
        }
      });
    });
  }
}

// Notify content scripts of debug mode changes
function notifyContentScriptsOfDebugModeChange(isDebugMode) {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({}, function(tabs) {
      tabs.forEach(function(tab) {
        try {
          chrome.tabs.sendMessage(tab.id, { action: 'debugModeChanged', debugMode: isDebugMode });
        } catch (error) {
          // Ignore errors for tabs that don't have content scripts
        }
      });
    });
  }
}

// Get auth token from storage
function getAuthToken() {
  return new Promise((resolve) => {
    if (typeof authService !== 'undefined' && authService.getToken) {
      authService.getToken().then(resolve);
    } else {
      // Fallback to localStorage
      chrome.storage.local.get(['fidu_auth_token'], (result) => {
        resolve(result.fidu_auth_token || localStorage.getItem('fidu_auth_token') || null);
      });
    }
  });
}

// Handle profile change // Removed as per edit hint
function handleProfileChange() {
  // selectedProfileId = profileSelectEl.value; // Removed as per edit hint
  
  // if (typeof authService !== 'undefined' && authService.setSelectedProfile) { // Removed as per edit hint
  //   const selectedProfile = profiles.find(p => p.id === selectedProfileId); // Removed as per edit hint
  //   if (selectedProfile) { // Removed as per edit hint
  //     authService.setSelectedProfile(selectedProfile); // Removed as per edit hint
  //   } // Removed as per edit hint
  // } else { // Removed as per edit hint
  //   // Fallback to localStorage // Removed as per edit hint
  //   chrome.storage.local.set({ selectedProfileId }); // Removed as per edit hint
  //   localStorage.setItem('selectedProfileId', selectedProfileId); // Removed as per edit hint
  // } // Removed as per edit hint
  
  // updateProfileDisplay(); // Removed as per edit hint
}

// Toggle settings visibility
function toggleSettings() {
  const settingsSection = document.getElementById('settingsSection');
  settingsSection.style.display = settingsSection.style.display === 'none' ? 'block' : 'none';
}

// Toggle debug mode visibility
function toggleDebugMode() {
  const debugOnlyElements = document.querySelectorAll('.debug-only');
  const isDebugMode = debugModeEl.checked;
  
  debugOnlyElements.forEach(element => {
    element.style.display = isDebugMode ? 'block' : 'none';
  });
  
  // Also hide/show debug buttons in content scripts
  notifyContentScriptsOfDebugModeChange(isDebugMode);
}

// Update settings UI based on defaultSettings
function updateSettingsUI() {
  debugModeEl.checked = defaultSettings.debugMode;
  fiduIdentityUrlEl.value = defaultSettings.fiduIdentityUrl;
  autoCaptureEnabledEl.checked = defaultSettings.autoCaptureEnabled;
  captureFrequencyEl.value = defaultSettings.captureFrequency;
  showCaptureIndicatorEl.checked = defaultSettings.showCaptureIndicator;
  highlightCapturedMessagesEl.checked = defaultSettings.highlightCapturedMessages;
  enableChatGPTEl.checked = defaultSettings.enabledChatbots.ChatGPT;
  enableClaudeEl.checked = defaultSettings.enabledChatbots.Claude;
  enableBardEl.checked = defaultSettings.enabledChatbots.Bard;
  enablePoeEl.checked = defaultSettings.enabledChatbots.Poe;
  enablePerplexityEl.checked = defaultSettings.enabledChatbots.Perplexity;
  
  // Update baseUrl input if it's empty
  if (!baseUrlInputEl.value) {
    baseUrlInputEl.value = defaultSettings.fiduCoreUrl;
  }
  
  // Apply debug mode visibility
  toggleDebugMode();
}

// Save settings to storage
function saveSettings() {
  const settings = {
    // Debug settings
    debugMode: debugModeEl.checked,
    
    // Capture settings
    autoCaptureEnabled: autoCaptureEnabledEl.checked,
    showCaptureIndicator: showCaptureIndicatorEl.checked,
    highlightCapturedMessages: highlightCapturedMessagesEl.checked,
    captureFrequency: parseInt(captureFrequencyEl.value, 10) || 60,
    useFiduCore: true,
    
    // FIDU Identity Service settings (debug only)
    fiduIdentityUrl: fiduIdentityUrlEl.value.trim(),
    
    // FIDU Vault settings (debug only)
    fiduCoreUrl: baseUrlInputEl.value.trim() || 'http://127.0.0.1:4000/api/v1',
    
    // Supported chatbots
    enabledChatbots: {
      'ChatGPT': enableChatGPTEl.checked,
      'Claude': enableClaudeEl.checked,
      'Bard': enableBardEl.checked,
      'Poe': enablePoeEl.checked,
      'Perplexity': enablePerplexityEl.checked
    }
  };

  // Save to sync storage (like the old options page)
  chrome.storage.sync.set({ settings }, () => {
    // Also save baseUrl to local storage for backward compatibility
    chrome.storage.local.set({ baseUrl: baseUrlInputEl.value.trim() });
    
    // Show success message
    if (settingsStatusEl) {
      settingsStatusEl.textContent = 'Settings saved successfully!';
      settingsStatusEl.className = 'status-message success';
      settingsStatusEl.style.display = 'block';
    }
    
    // Notify other extension components of changes
    chrome.runtime.sendMessage({ action: 'settingsUpdated', settings });
    
    // Hide message after a delay
    setTimeout(() => {
      if (settingsStatusEl) {
        settingsStatusEl.style.display = 'none';
      }
    }, 3000);
  });
}

// Reset settings to default
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to their default values?')) {
    // Reset to default settings
    chrome.storage.sync.set({ settings: defaultSettings }, () => {
      // Also reset baseUrl in local storage
      chrome.storage.local.set({ baseUrl: defaultSettings.fiduCoreUrl });
      
      // Update UI
      updateSettingsUI();
      
      // Show reset message
      if (settingsStatusEl) {
        settingsStatusEl.textContent = 'Settings reset to defaults!';
        settingsStatusEl.className = 'status-message success';
        settingsStatusEl.style.display = 'block';
      }
      
      // Notify other extension components of changes
      chrome.runtime.sendMessage({ action: 'settingsUpdated', settings: defaultSettings });
      
      // Hide message after a delay
      setTimeout(() => {
        if (settingsStatusEl) {
          settingsStatusEl.style.display = 'none';
        }
      }, 3000);
    });
  }
}

// Load conversation count
function loadConversationCount() {
  // Function kept for compatibility but stats display removed
}

// Open the conversation viewer page
function openConversationViewer() {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/viewer.html') });
}

// Export conversations to a JSON file
function exportConversations() {
  chrome.runtime.sendMessage({ action: 'getConversations' }, (response) => {
    if (response && response.success) {
      const conversationsData = response.conversations;
      
      const exportData = {
        exportDate: new Date().toISOString(),
        conversationsCount: conversationsData.length,
        conversations: conversationsData
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      
      console.log('Conversations exported successfully');
    } else {
      alert('Error exporting conversations: ' + (response.error || 'Unknown error'));
      console.error('Error exporting conversations:', response.error);
    }
  });
}

 