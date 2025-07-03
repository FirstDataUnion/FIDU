/**
 * Utility functions for conversation-related operations
 */

/**
 * Get the color associated with a platform
 */
export const getPlatformColor = (platform: string): string => {
  switch (platform.toLowerCase()) {
    case 'chatgpt': return '#00A67E';
    case 'claude': return '#FF6B35';
    case 'gemini': return '#4285F4';
    default: return '#666';
  }
};

/**
 * Get the color associated with a role
 */
export const getRoleColor = (role: string): string => {
  switch (role.toLowerCase()) {
    case 'user': return '#1976d2';
    case 'assistant': return '#388e3c';
    case 'system': return '#f57c00';
    default: return '#666';
  }
};

/**
 * Get the icon for a role
 */
export const getRoleIcon = (role: string): string => {
  switch (role.toLowerCase()) {
    case 'user': return '👤';
    case 'assistant': return '🤖';
    case 'system': return '⚙️';
    default: return '💬';
  }
};

/**
 * Get a color for a tag (generates consistent colors based on tag name)
 */
export const getTagColor = (tagName: string): string => {
  const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
    '#ff5722', '#795548', '#9e9e9e', '#607d8b'
  ];
  
  // Generate a hash from the tag name to get consistent colors
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    const char = tagName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Format a date for display
 */
export const formatDate = (date: Date): string => {
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minutes ago`;
    }
    return `${Math.floor(diffInHours)} hours ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Format a timestamp for display
 */
export const formatTimestamp = (timestamp: Date | string): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}; 