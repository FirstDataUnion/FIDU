/**
 * ACM Manager - Viewer Script
 * 
 * Responsible for:
 * - Loading and displaying ACMs from the database
 * - Filtering and searching ACMs
 * - Providing UI for viewing ACM details
 */

// Suppress connector errors that might be logged to the console
suppressConnectorErrors();

// DOM elements
const sourceFilterEl = document.getElementById('sourceFilter');
const dateFromFilterEl = document.getElementById('dateFromFilter');
const dateToFilterEl = document.getElementById('dateToFilter');
const applyFiltersBtnEl = document.getElementById('applyFiltersBtn');
const clearFiltersBtnEl = document.getElementById('clearFiltersBtn');
const searchInputEl = document.getElementById('searchInput');
const acmListEl = document.getElementById('acmList');
const conversationViewEl = document.getElementById('conversationView');

// State variables
let allAcms = [];
let filteredAcms = [];
let selectedAcmId = null;
let currentFilters = {
  source: '',
  dateFrom: '',
  dateTo: '',
  searchText: ''
};

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

// Initialize the viewer
document.addEventListener('DOMContentLoaded', () => {
  // Load all ACMs
  loadAcms();
  
  // Add event listeners
  applyFiltersBtnEl.addEventListener('click', applyFilters);
  clearFiltersBtnEl.addEventListener('click', clearFilters);
  searchInputEl.addEventListener('input', handleSearch);
});

// Load ACMs from the database
function loadAcms() {
  chrome.runtime.sendMessage({ action: 'getACMs' }, (response) => {
    if (response && response.success) {
      allAcms = response.acms;
      filteredAcms = [...allAcms];
      renderAcmList();
    } else {
      showError('Error loading conversations: ' + (response.error || 'Unknown error'));
    }
  });
}

// Render the ACM list
function renderAcmList() {
  // Clear the list
  acmListEl.innerHTML = '';
  
  if (filteredAcms.length === 0) {
    acmListEl.innerHTML = '<div class="empty-state" style="height: 200px;"><p>No conversations found</p></div>';
    return;
  }
  
  // Sort by date (newest first)
  filteredAcms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Create list items
  filteredAcms.forEach(acm => {
    const acmItem = document.createElement('div');
    acmItem.className = 'acm-item';
    if (acm.id === selectedAcmId) {
      acmItem.className += ' selected';
    }
    
    // Get the first user message for the title
    let title = 'Conversation';
    for (const interaction of acm.interactions) {
      if (interaction.actor === 'user') {
        title = interaction.content;
        break;
      }
    }
    
    // Truncate title if needed
    if (title.length > 50) {
      title = title.substring(0, 50) + '...';
    }
    
    // Truncate URL for display
    let displayUrl = '';
    if (acm.conversationUrl) {
      // Try to extract just the path part of the URL
      try {
        const url = new URL(acm.conversationUrl);
        displayUrl = url.pathname.length > 25 ? 
          url.pathname.substring(0, 25) + '...' : 
          url.pathname;
      } catch (e) {
        // If URL parsing fails, just use the original with truncation
        displayUrl = acm.conversationUrl.length > 25 ? 
          acm.conversationUrl.substring(0, 25) + '...' : 
          acm.conversationUrl;
      }
    }
    
    const date = new Date(acm.timestamp).toLocaleString();
    
    acmItem.innerHTML = `
      <div class="acm-title">${title}</div>
      <div class="acm-meta">
        <span>${acm.sourceChatbot}</span>
        <span>${date}</span>
      </div>
      <div class="acm-url">${displayUrl}</div>
    `;
    
    acmItem.addEventListener('click', () => {
      selectAcm(acm.id);
    });
    
    acmListEl.appendChild(acmItem);
  });
}

// Select an ACM to display
function selectAcm(acmId) {
  selectedAcmId = acmId;
  
  // Update list selection
  const selectedItems = document.querySelectorAll('.acm-item.selected');
  selectedItems.forEach(item => item.classList.remove('selected'));
  
  const acmItems = document.querySelectorAll('.acm-item');
  acmItems.forEach(item => {
    if (item.querySelector('.acm-title').textContent === filteredAcms.find(acm => acm.id === acmId).interactions.find(i => i.actor === 'user')?.content) {
      item.classList.add('selected');
    }
  });
  
  // Get the selected ACM
  const selectedAcm = filteredAcms.find(acm => acm.id === acmId);
  
  // Render the ACM detail view
  renderAcmDetail(selectedAcm);
}

// Render ACM detail view
function renderAcmDetail(acm) {
  if (!acm) {
    conversationViewEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>Select a conversation from the list to view its details</p>
      </div>
    `;
    return;
  }
  
  const date = new Date(acm.timestamp).toLocaleString();
  
  // Create the conversation header
  let conversationHtml = `
    <div class="conversation-header">
      <h2 class="conversation-title">Conversation from ${acm.sourceChatbot}</h2>
      <div class="conversation-actions">
        <button id="exportBtn" class="small">Export</button>
        <button id="deleteBtn" class="small secondary">Delete</button>
      </div>
    </div>
    
    <div class="conversation-meta">
      <div class="meta-item">
        <span>Date:</span>
        <strong>${date}</strong>
      </div>
      <div class="meta-item">
        <span>Source:</span>
        <strong>${acm.sourceChatbot}</strong>
      </div>
      <div class="meta-item">
        <span>Model:</span>
        <strong>${acm.targetModelRequested || 'Unknown'}</strong>
      </div>
      <div class="meta-item">
        <span>Session URL:</span>
        <strong>${acm.conversationUrl || 'Not available'}</strong>
      </div>
    </div>
    
    <div class="messages-container">
  `;
  
  // Add messages
  acm.interactions.forEach(interaction => {
    const messageTime = new Date(interaction.timestamp).toLocaleTimeString();
    
    conversationHtml += `
      <div class="message ${interaction.actor}">
        <div class="message-header">
          <span>${interaction.actor === 'user' ? 'You' : 'AI'}</span>
          <span>${messageTime}</span>
        </div>
        <div class="message-content">${interaction.content}</div>
    `;
    
    // Add attachments if any
    if (interaction.attachments && interaction.attachments.length > 0) {
      interaction.attachments.forEach(attachment => {
        conversationHtml += `
          <div class="attachment">
            <span>📎 File: ${attachment.filename}</span>
          </div>
        `;
      });
    }
    
    conversationHtml += `</div>`;
  });
  
  conversationHtml += `</div>`;
  
  conversationViewEl.innerHTML = conversationHtml;
  
  // Add event listeners for actions
  document.getElementById('exportBtn').addEventListener('click', () => exportAcm(acm));
  document.getElementById('deleteBtn').addEventListener('click', () => deleteAcm(acm.id));
}

// Apply filters to the ACM list
function applyFilters() {
  currentFilters = {
    source: sourceFilterEl.value,
    dateFrom: dateFromFilterEl.value,
    dateTo: dateToFilterEl.value,
    searchText: searchInputEl.value.toLowerCase()
  };
  
  filterAcms();
}

// Clear all filters
function clearFilters() {
  sourceFilterEl.value = '';
  dateFromFilterEl.value = '';
  dateToFilterEl.value = '';
  searchInputEl.value = '';
  
  currentFilters = {
    source: '',
    dateFrom: '',
    dateTo: '',
    searchText: ''
  };
  
  filterAcms();
}

// Handle search input
function handleSearch() {
  currentFilters.searchText = searchInputEl.value.toLowerCase();
  filterAcms();
}

// Filter ACMs based on current filters
function filterAcms() {
  filteredAcms = allAcms.filter(acm => {
    // Filter by source
    if (currentFilters.source && acm.sourceChatbot !== currentFilters.source) {
      return false;
    }
    
    // Filter by date range
    if (currentFilters.dateFrom) {
      const fromDate = new Date(currentFilters.dateFrom);
      const acmDate = new Date(acm.timestamp);
      if (acmDate < fromDate) {
        return false;
      }
    }
    
    if (currentFilters.dateTo) {
      const toDate = new Date(currentFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of the day
      const acmDate = new Date(acm.timestamp);
      if (acmDate > toDate) {
        return false;
      }
    }
    
    // Filter by search text
    if (currentFilters.searchText) {
      // Search in conversation content and URL
      const textFound = acm.interactions.some(interaction => 
        interaction.content.toLowerCase().includes(currentFilters.searchText)
      );
      
      const urlFound = acm.conversationUrl && 
        acm.conversationUrl.toLowerCase().includes(currentFilters.searchText);
      
      if (!textFound && !urlFound) {
        return false;
      }
    }
    
    return true;
  });
  
  // Re-render the list
  renderAcmList();
  
  // If the selected ACM is not in the filtered list, clear the detail view
  if (selectedAcmId && !filteredAcms.some(acm => acm.id === selectedAcmId)) {
    selectedAcmId = null;
    renderAcmDetail(null);
  }
}

// Export a single ACM
function exportAcm(acm) {
  const exportData = {
    exportDate: new Date().toISOString(),
    acm: acm
  };
  
  // Create a download for the JSON file
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create a download link and trigger it
  const a = document.createElement('a');
  a.href = url;
  a.download = `acm-${acm.id}-export.json`;
  document.body.appendChild(a);
  a.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Delete an ACM
function deleteAcm(acmId) {
  if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
    chrome.runtime.sendMessage({ action: 'deleteACM', id: acmId }, (response) => {
      if (response && response.success) {
        // Remove the ACM from the lists
        allAcms = allAcms.filter(acm => acm.id !== acmId);
        filterAcms();
        
        // Clear detail view if it was showing the deleted ACM
        if (selectedAcmId === acmId) {
          selectedAcmId = null;
          renderAcmDetail(null);
        }
      } else {
        showError('Error deleting conversation: ' + (response.error || 'Unknown error'));
      }
    });
  }
}

// Show an error message
function showError(message) {
  console.error(message);
  alert(message);
} 