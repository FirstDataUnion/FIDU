/**
 * Viewer Script for FIDU Chat Grabber Extension
 * 
 * This script handles:
 * - Loading and displaying conversations from the database
 * - Filtering and searching conversations
 * - Providing UI for viewing conversation details
 */

// DOM elements
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
    conversationListEl.innerHTML = '<div class="loading">Loading conversations...</div>';
  }
  
  chrome.runtime.sendMessage({ action: 'getConversations' }, (response) => {
    if (response && response.success) {
      allConversations = response.conversations;
      filteredConversations = [...allConversations];
      console.log('Loaded conversations:', allConversations);
      renderConversationList();
    } else {
      console.error('Error loading conversations:', response.error);
      conversationListEl.innerHTML = '<div class="error">Error loading conversations</div>';
    }
  });
}

// Render the conversation list
function renderConversationList() {
  if (conversationListEl) {
    conversationListEl.innerHTML = '';
    
    if (filteredConversations.length === 0) {
      conversationListEl.innerHTML = '<div class="empty-state" style="height: 200px;"><p>No conversations found</p></div>';
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
      
      conversationItem.innerHTML = `
        <div class="conversation-title">${title}</div>
        <div class="conversation-meta">
          <span class="timestamp">${timestamp}</span>
          <span class="message-count">${interactions.length} messages</span>
        </div>
        <div class="conversation-url">${displayUrl}</div>
        <div class="conversation-preview">${previewText}</div>
      `;
      
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
      <h2>${title}</h2>
      <div class="conversation-meta">
        <span class="timestamp">${timestamp}</span>
        <span class="message-count">${interactions.length} messages</span>
        <span class="source">${sourceChatbot}</span>
        <span class="model">${targetModel}</span>
      </div>
      ${conversationUrl ? `
        <div class="conversation-url">
          <a href="${conversationUrl}" target="_blank">
            ${conversationUrl}
          </a>
        </div>
      ` : ''}
      ${tags.length > 0 ? `
        <div class="conversation-tags">
          ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
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
            <span class="actor">${actorDisplay}</span>
            <span class="time">${messageTime}</span>
          </div>
          <div class="message-content">${interaction.content}</div>
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