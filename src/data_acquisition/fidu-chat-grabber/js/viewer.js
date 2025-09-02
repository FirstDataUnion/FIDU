/**
 * Viewer Script for FIDU Chat Grabber Extension
 * 
 * This script handles:
 * - Loading and displaying conversations from the database
 * - Filtering and searching conversations
 * - Providing UI for viewing conversation details
 */

// === Utility Functions ===

// Safe HTML escaping function to prevent XSS
function escapeHtml(text) {
  if (text == null) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// === DOM Elements ===
const conversationListEl = document.getElementById('conversationList');
const searchInputEl = document.getElementById('searchInput');
const filterSelectEl = document.getElementById('filterSelect');
const conversationDetailEl = document.getElementById('conversationDetail');

// State
let allConversations = [];
let filteredConversations = [];
let selectedConversationId = null;

// Initialize viewer
document.addEventListener('DOMContentLoaded', () => {
  console.log('Viewer initialized');
  
  // Set up event listeners
  setupEventListeners();
  
  // Load all conversations
  loadConversations();
});

// Set up event listeners
function setupEventListeners() {
  // Search input
  searchInputEl.addEventListener('input', filterConversations);
  
  // Filter select
  filterSelectEl.addEventListener('change', filterConversations);
}

// Load conversations from the database
function loadConversations() {
  // Show loading state
  if (conversationListEl) {
    conversationListEl.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = 'Loading conversations...';
    conversationListEl.appendChild(loadingDiv);
  }
  
  chrome.runtime.sendMessage({ action: 'getConversations' }, (response) => {
    if (response && response.success) {
      allConversations = response.conversations;
      filteredConversations = [...allConversations];
      console.log('Loaded conversations:', allConversations);
      renderConversationList();
    } else {
      console.error('Error loading conversations:', response.error);
      conversationListEl.textContent = '';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error';
      errorDiv.textContent = 'Error loading conversations';
      conversationListEl.appendChild(errorDiv);
    }
  });
}

// Render the conversation list
function renderConversationList() {
  if (conversationListEl) {
    conversationListEl.textContent = '';
    
    if (filteredConversations.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.style.height = '200px';
      const emptyP = document.createElement('p');
      emptyP.textContent = 'No conversations found';
      emptyDiv.appendChild(emptyP);
      conversationListEl.appendChild(emptyDiv);
      return;
    }
    
    // Sort by timestamp (newest first)
    filteredConversations.sort((a, b) => new Date(b.create_timestamp || b.timestamp) - new Date(a.create_timestamp || a.timestamp));
    
    filteredConversations.forEach(conversation => {
      const conversationItem = document.createElement('div');
      conversationItem.className = 'conversation-item';
      if (conversation.id === selectedConversationId) {
        conversationItem.className += ' selected';
      }
      
      // Extract conversation data from the FIDU Vault format
      const conversationData = conversation.data || conversation;
      const interactions = conversationData.interactions || [];
      
      // Get first message content for preview
      let previewText = 'No messages';
      if (interactions && interactions.length > 0) {
        for (const interaction of interactions) {
          if (interaction.content && interaction.content.trim()) {
            previewText = interaction.content.substring(0, 100);
            if (previewText.length === 100) {
              previewText += '...';
            }
            break;
          }
        }
      }
      
      // Format timestamp
      const timestamp = new Date(conversation.create_timestamp || conversation.timestamp).toLocaleString();
      
      // Format URL for display
      let displayUrl = 'No URL';
      const conversationUrl = conversationData.conversationUrl;
      if (conversationUrl) {
        try {
          const url = new URL(conversationUrl);
          displayUrl = url.hostname + url.pathname;
        } catch (e) {
          // If URL parsing fails, show the original URL
          displayUrl = conversationUrl.length > 25 ?
            conversationUrl.substring(0, 25) + '...' :
            conversationUrl;
        }
      }
      
      // Get conversation title or use source chatbot as fallback
      const title = conversationData.conversationTitle || conversationData.sourceChatbot || 'Unknown';
      
      // Create conversation title
      const titleDiv = document.createElement('div');
      titleDiv.className = 'conversation-title';
      titleDiv.textContent = title;
      
      // Create conversation meta
      const metaDiv = document.createElement('div');
      metaDiv.className = 'conversation-meta';
      
      const timestampSpan = document.createElement('span');
      timestampSpan.className = 'timestamp';
      timestampSpan.textContent = timestamp;
      
      const messageCountSpan = document.createElement('span');
      messageCountSpan.className = 'message-count';
      messageCountSpan.textContent = `${interactions.length} messages`;
      
      metaDiv.appendChild(timestampSpan);
      metaDiv.appendChild(messageCountSpan);
      
      // Create conversation URL
      const urlDiv = document.createElement('div');
      urlDiv.className = 'conversation-url';
      urlDiv.textContent = displayUrl;
      
      // Create conversation preview
      const previewDiv = document.createElement('div');
      previewDiv.className = 'conversation-preview';
      previewDiv.textContent = previewText;
      
      // Append all elements
      conversationItem.appendChild(titleDiv);
      conversationItem.appendChild(metaDiv);
      conversationItem.appendChild(urlDiv);
      conversationItem.appendChild(previewDiv);
      
      conversationItem.addEventListener('click', () => {
        selectConversation(conversation.id);
      });
      
      conversationListEl.appendChild(conversationItem);
    });
  }
}

// Select a conversation
function selectConversation(conversationId) {
  selectedConversationId = conversationId;
  const conversation = allConversations.find(c => c.id === conversationId);
  
  if (conversation) {
    renderConversationDetail(conversation);
  }
  
  // Update selected state in list
  renderConversationList();
}

// Render conversation detail
function renderConversationDetail(conversation) {
  if (!conversationDetailEl) return;
  
  console.log('Rendering conversation detail:', conversation);
  
  // Extract conversation data from the FIDU Vault format
  const conversationData = conversation.data || conversation;
  const interactions = conversationData.interactions || [];
  
  console.log('Conversation data:', conversationData);
  console.log('Interactions:', interactions);
  
  const timestamp = new Date(conversation.create_timestamp || conversation.timestamp).toLocaleString();
  const title = conversationData.conversationTitle || conversationData.sourceChatbot || 'Unknown Chatbot';
  const sourceChatbot = conversationData.sourceChatbot || 'Unknown';
  const targetModel = conversationData.targetModelRequested || 'Unknown';
  const conversationUrl = conversationData.conversationUrl;
  const tags = conversation.tags || [];
  
  let detailHTML = `
    <div class="conversation-header">
      <h2>${escapeHtml(title)}</h2>
      <div class="conversation-meta">
        <span class="timestamp">${escapeHtml(timestamp)}</span>
        <span class="message-count">${escapeHtml(interactions.length.toString())} messages</span>
        <span class="source">${escapeHtml(sourceChatbot)}</span>
        <span class="model">${escapeHtml(targetModel)}</span>
      </div>
      ${conversationUrl ? `
        <div class="conversation-url">
          <a href="${escapeHtml(conversationUrl)}" target="_blank">
            ${escapeHtml(conversationUrl)}
          </a>
        </div>
      ` : ''}
      ${tags.length > 0 ? `
        <div class="conversation-tags">
          ${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
    <div class="conversation-messages">
  `;
  
  if (interactions && interactions.length > 0) {
    interactions.forEach(interaction => {
      const messageTime = new Date(interaction.timestamp).toLocaleTimeString();
      const messageClass = interaction.actor === 'user' ? 'user-message' : 'assistant-message';
      const actorDisplay = interaction.actor === 'user' ? 'You' : sourceChatbot;
      
      detailHTML += `
        <div class="message ${messageClass}">
          <div class="message-header">
            <span class="actor">${escapeHtml(actorDisplay)}</span>
            <span class="time">${escapeHtml(messageTime)}</span>
          </div>
          <div class="message-content">${escapeHtml(interaction.content)}</div>
        </div>
      `;
    });
  } else {
    detailHTML += '<div class="no-messages">No messages found</div>';
  }
  
  detailHTML += '</div>';
  
  // Clear the conversationDetail element and set the new content
  conversationDetailEl.innerHTML = detailHTML;
}

// Filter conversations
function filterConversations() {
  const searchTerm = searchInputEl.value.toLowerCase();
  const filterValue = filterSelectEl.value;
  
  filteredConversations = allConversations.filter(conversation => {
    // Extract conversation data from the FIDU Vault format
    const conversationData = conversation.data || conversation;
    const interactions = conversationData.interactions || [];
    
    // Search filter
    const matchesSearch = !searchTerm || 
      conversationData.sourceChatbot?.toLowerCase().includes(searchTerm) ||
      conversationData.conversationTitle?.toLowerCase().includes(searchTerm) ||
      conversationData.conversationUrl?.toLowerCase().includes(searchTerm) ||
      interactions.some(interaction => 
        interaction.content?.toLowerCase().includes(searchTerm)
      );
    
    // Filter by source
    const matchesFilter = !filterValue || conversationData.sourceChatbot === filterValue;
    
    return matchesSearch && matchesFilter;
  });
  
  renderConversationList();
} 