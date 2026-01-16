/**
 * Input validation and sanitization utilities
 * Provides comprehensive validation for user inputs to prevent injection attacks
 */

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
export function sanitizeString(
  input: string,
  maxLength: number = 1000
): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove null bytes and control characters
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

  // HTML escape to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Validate and sanitize API key format
 */
export function validateApiKey(apiKey: string): string {
  if (typeof apiKey !== 'string') {
    throw new Error('API key must be a string');
  }

  // Remove whitespace
  const trimmed = apiKey.trim();

  // Basic validation - most API keys are base64-like
  if (!/^[a-zA-Z0-9\-_=]+$/.test(trimmed)) {
    throw new Error(
      'Invalid API key format (only letters, numbers, hyphen, underscore, equals allowed)'
    );
  }

  // Length validation
  if (trimmed.length < 10 || trimmed.length > 1000) {
    throw new Error('API key length must be between 10 and 1000 characters');
  }

  return trimmed;
}

/**
 * Validate and sanitize provider name
 */
export function validateProviderName(provider: string): string {
  if (typeof provider !== 'string') {
    throw new Error('Provider name must be a string');
  }

  const sanitized = sanitizeString(provider, 50);

  // Only allow letters, numbers, spaces, underscore, hyphen
  if (!/^[a-zA-Z0-9\s_-]+$/.test(sanitized)) {
    throw new Error(
      'Invalid provider name (only letters, numbers, spaces, underscore, hyphen allowed)'
    );
  }

  return sanitized;
}

/**
 * Validate and sanitize conversation title
 */
export function validateConversationTitle(title: string): string {
  if (typeof title !== 'string') {
    throw new Error('Title must be a string');
  }

  const sanitized = sanitizeString(title, 200);

  if (sanitized.length < 1) {
    throw new Error('Title cannot be empty');
  }

  return sanitized;
}

/**
 * Validate and sanitize search query
 */
export function validateSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    throw new Error('Search query must be a string');
  }

  const sanitized = sanitizeString(query, 500);

  // Remove potentially dangerous characters for search
  return sanitized.replace(/[<>'"]/g, '');
}

/**
 * Validate and sanitize JSON data
 */
export function validateJsonData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Data must be an object');
  }

  // Check size limit (rough estimate)
  const jsonString = JSON.stringify(data);
  if (jsonString.length > 1000000) {
    // 1MB limit
    throw new Error('Data too large (max 1MB)');
  }

  // Recursively sanitize object
  return sanitizeObject(data);
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item =>
      typeof item === 'string'
        ? sanitizeString(item)
        : typeof item === 'object' && item !== null
          ? sanitizeObject(item)
          : item
    );
  }

  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key, 100);
      sanitized[sanitizedKey] =
        typeof value === 'string'
          ? sanitizeString(value)
          : typeof value === 'object' && value !== null
            ? sanitizeObject(value)
            : value;
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate form data before submission
 */
export function validateFormData(
  data: Record<string, any>
): Record<string, any> {
  const validated: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    try {
      if (typeof value === 'string') {
        validated[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        validated[key] = validateJsonData(value);
      } else {
        validated[key] = value;
      }
    } catch (error) {
      throw new Error(
        `Validation failed for field '${key}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return validated;
}
