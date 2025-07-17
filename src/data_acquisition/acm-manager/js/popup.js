/**
 * ACM Manager - Popup Script
 * 
 * Responsible for:
 * - Displaying the status of the extension
 * - Showing basic statistics about captured ACMs
 * - Providing controls for managing the extension
 * - Handling user authentication
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

// Profile DOM elements
const profileSectionEl = document.getElementById('profileSection');
const selectedProfileNameEl = document.getElementById('selectedProfileName');
const manageProfilesBtnEl = document.getElementById('manageProfilesBtn');
const profileModalEl = document.getElementById('profileModal');
const closeProfileModalEl = document.getElementById('closeProfileModal');
const newProfileNameEl = document.getElementById('newProfileName');
const createProfileBtnEl = document.getElementById('createProfileBtn');
const createProfileErrorEl = document.getElementById('createProfileError');
const createProfileSuccessEl = document.getElementById('createProfileSuccess');
const profilesListEl = document.getElementById('profilesList');

// State variables
let captureEnabled = true;
let sessionCount = 0;
let userProfiles = [];
let selectedProfile = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

function initializePopup() {
  // Load current state
  loadState();
  
  // Check authentication status
  checkAuthenticationStatus();
  
  // Update statistics
  updateStatistics();
  
  // Add event listeners
  viewAcmsBtnEl.addEventListener('click', openAcmViewer);
  toggleCaptureBtnEl.addEventListener('click', toggleCapture);
  exportBtnEl.addEventListener('click', exportAcms);
  clearBtnEl.addEventListener('click', clearAllAcms);
  optionsLinkEl.addEventListener('click', openOptions);
  
  // Add profile management event listeners
  manageProfilesBtnEl.addEventListener('click', openProfileModal);
  closeProfileModalEl.addEventListener('click', closeProfileModal);
  createProfileBtnEl.addEventListener('click', handleCreateProfile);
  
  // Close modal when clicking outside
  profileModalEl.addEventListener('click', (e) => {
    if (e.target === profileModalEl) {
      closeProfileModal();
    }
  });
  
  // Event delegation for profile selection
  profilesListEl.addEventListener('click', handleProfileListClick);
}

// Authentication functions
async function checkAuthenticationStatus() {
  try {
    isAuthenticated = await authService.isAuthenticated();
    currentUser = await authService.getCurrentUser();
    
    if (isAuthenticated) {
      // Load profiles and selected profile
      await loadUserProfiles();
      await loadSelectedProfile();
      updateProfileUI();
    }
  } catch (error) {
    console.error('Error checking authentication status:', error);
    isAuthenticated = false;
    currentUser = null;
  }
}

// Listener to check Auth status after certain events
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'authStatusChanged') {
    updateProfileUI();
  }
});

function toggleAuthForm() {
  if (isAuthenticated) {
    // Logout
    handleLogout();
  } else {
    // Toggle between login and register forms
    if (loginFormEl.classList.contains('show')) {
      showRegisterForm();
    } else {
      showLoginForm();
    }
  }
}

function showLoginForm() {
  loginFormEl.classList.add('show');
  registerFormEl.classList.remove('show');
  clearAuthMessages();
}

function showRegisterForm() {
  registerFormEl.classList.add('show');
  loginFormEl.classList.remove('show');
  clearAuthMessages();
}

function clearAuthMessages() {
  loginErrorEl.textContent = '';
  registerErrorEl.textContent = '';
  registerSuccessEl.textContent = '';
}

async function handleLogin() {
  const email = loginEmailEl.value.trim();
  const password = loginPasswordEl.value;
  
  if (!email || !password) {
    loginErrorEl.textContent = 'Please enter both email and password';
    return;
  }
  
  try {
    loginBtnEl.disabled = true;
    loginBtnEl.textContent = 'Logging in...';
    
    const result = await authService.login(email, password);
    
    if (result.success) {
      isAuthenticated = true;
      currentUser = result.user;
      updateAuthUI();
      clearAuthMessages();
    } else {
      loginErrorEl.textContent = result.error || 'Login failed';
    }
  } catch (error) {
    console.error('Login error:', error);
    loginErrorEl.textContent = 'An error occurred during login';
  } finally {
    loginBtnEl.disabled = false;
    loginBtnEl.textContent = 'Login';
  }
}

async function handleRegister() {
  const email = registerEmailEl.value.trim();
  const password = registerPasswordEl.value;
  const firstName = registerFirstNameEl.value.trim();
  const lastName = registerLastNameEl.value.trim();
  
  if (!email || !password || !firstName || !lastName) {
    registerErrorEl.textContent = 'Please fill in all fields';
    return;
  }
  
  if (password.length < 6) {
    registerErrorEl.textContent = 'Password must be at least 6 characters long';
    return;
  }
  
  try {
    registerBtnEl.disabled = true;
    registerBtnEl.textContent = 'Registering...';
    
    const result = await authService.register(email, password, firstName, lastName);
    
    if (result.success) {
      registerSuccessEl.textContent = 'Registration successful! You can now login.';
      registerErrorEl.textContent = '';
      
      // Clear form
      registerEmailEl.value = '';
      registerPasswordEl.value = '';
      registerFirstNameEl.value = '';
      registerLastNameEl.value = '';
      
      // Switch to login form after a short delay
      setTimeout(() => {
        showLoginForm();
        loginEmailEl.value = email;
      }, 2000);
    } else {
      registerErrorEl.textContent = result.error || 'Registration failed';
      registerSuccessEl.textContent = '';
    }
  } catch (error) {
    console.error('Registration error:', error);
    registerErrorEl.textContent = 'An error occurred during registration';
    registerSuccessEl.textContent = '';
  } finally {
    registerBtnEl.disabled = false;
    registerBtnEl.textContent = 'Register';
  }
}

async function handleLogout() {
  try {
    const result = await authService.logout();
    if (result.success) {
      isAuthenticated = false;
      currentUser = null;
      userProfiles = [];
      selectedProfile = null;
      updateAuthUI();
    } else {
      console.error('Logout error:', result.error);
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Profile management functions
async function loadUserProfiles() {
  try {
    const result = await authService.getProfiles();
    if (result.success) {
      userProfiles = result.profiles.profiles;
    } else {
      console.error('Error loading profiles:', result.error);
      userProfiles = [];
    }
  } catch (error) {
    console.error('Error loading profiles:', error);
    userProfiles = [];
  }
}

async function loadSelectedProfile() {
  try {
    selectedProfile = await authService.getSelectedProfile();
  } catch (error) {
    console.error('Error loading selected profile:', error);
    selectedProfile = null;
  }
}

function updateProfileUI() {
  if (selectedProfile) {
    selectedProfileNameEl.textContent = selectedProfile.display_name;
  } else {
    selectedProfileNameEl.textContent = 'No profile selected';
  }
}

function openProfileModal() {
  profileModalEl.style.display = 'block';
  loadProfilesInModal();
}

function closeProfileModal() {
  profileModalEl.style.display = 'none';
  clearProfileModalMessages();
}

function clearProfileModalMessages() {
  createProfileErrorEl.textContent = '';
  createProfileSuccessEl.textContent = '';
  newProfileNameEl.value = '';
}

async function loadProfilesInModal() {
  try {
    // Reload profiles to get latest data
    await loadUserProfiles();
    
    if (userProfiles.length === 0) {
      profilesListEl.innerHTML = '<div class="no-profiles">No profiles found. Create your first profile above.</div>';
      return;
    }
    
    const profilesHtml = userProfiles.map(profile => {
      const isSelected = selectedProfile && selectedProfile.id === profile.id;
      const createDate = new Date(profile.created_at).toLocaleDateString();
      
      return `
        <div class="profile-item ${isSelected ? 'selected' : ''}" data-profile-id="${profile.id}">
          <div class="profile-item-info">
            <div class="profile-item-name">${profile.display_name}</div>
            <div class="profile-item-date">Created: ${createDate}</div>
          </div>
          <div class="profile-item-actions">
            ${!isSelected ? `<button class="select-profile-btn secondary" data-profile-id="${profile.id}">Select</button>` : '<span style="color: #2196f3; font-size: 11px;">Selected</span>'}
          </div>
        </div>
      `;
    }).join('');
    
    profilesListEl.innerHTML = profilesHtml;
  } catch (error) {
    console.error('Error loading profiles in modal:', error);
    profilesListEl.innerHTML = '<div class="error-message">Error loading profiles</div>';
  }
}

async function selectProfile(profileId) {
  try {
    const profile = userProfiles.find(p => p.id === profileId);
    if (profile) {
      await authService.setSelectedProfile(profile);
      selectedProfile = profile;
      updateProfileUI();
      closeProfileModal();
    }
  } catch (error) {
    console.error('Error selecting profile:', error);
  }
}

// Event delegation handler for profile list clicks
function handleProfileListClick(event) {
  // Check if the clicked element is a select profile button
  if (event.target.classList.contains('select-profile-btn')) {
    const profileId = event.target.getAttribute('data-profile-id');
    if (profileId) {
      selectProfile(profileId);
    }
  }
}

async function handleCreateProfile() {
  const name = newProfileNameEl.value.trim();
  
  if (!name) {
    createProfileErrorEl.textContent = 'Please enter a profile name';
    return;
  }
  
  try {
    createProfileBtnEl.disabled = true;
    createProfileBtnEl.textContent = 'Creating...';
    
    const result = await authService.createProfile(name);
    
    if (result.success) {
      createProfileSuccessEl.textContent = 'Profile created successfully!';
      createProfileErrorEl.textContent = '';
      newProfileNameEl.value = '';
      
      // Reload profiles and select the new one
      await loadUserProfiles();
      await selectProfile(result.profile.id);
      
      // Refresh the modal
      loadProfilesInModal();
    } else {
      createProfileErrorEl.textContent = result.error || 'Failed to create profile';
      createProfileSuccessEl.textContent = '';
    }
  } catch (error) {
    console.error('Create profile error:', error);
    createProfileErrorEl.textContent = 'An error occurred while creating the profile';
    createProfileSuccessEl.textContent = '';
  } finally {
    createProfileBtnEl.disabled = false;
    createProfileBtnEl.textContent = 'Create Profile';
  }
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
      totalAcmsEl.textContent = 0; //response.acms.length;
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

// Open options page
function openOptions() {
  chrome.runtime.openOptionsPage();
}

// Suppress connector errors
function suppressConnectorErrors() {
  // This function suppresses connector errors that might be logged to the console
  // It's a placeholder for now, but could be expanded if needed
} 