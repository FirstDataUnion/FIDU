/**
 * Email allowlist utility for development environment
 * 
 * In development, restricts access to a predefined list of email addresses.
 * In production, allows all authenticated users.
 */

/**
 * Checks if an email is allowed to access the application.
 * 
 * @param email - The email address to check
 * @returns true if the email is allowed, false otherwise
 */
export function isEmailAllowed(email: string): boolean {
  // In production, allow all authenticated users
  const mode = import.meta.env.MODE;
  if (mode === 'production') {
    return true;
  }

  // In development, check against allowlist
  const allowedEmailsEnv = import.meta.env.VITE_ALLOWED_EMAILS;
  
  // If no allowlist is configured, allow all (fail open for development)
  if (!allowedEmailsEnv) {
    console.warn('VITE_ALLOWED_EMAILS not configured. Allowing all users in development.');
    return true;
  }

  // Parse comma-separated email list and trim whitespace
  const allowedEmails = allowedEmailsEnv
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter((email: string) => email.length > 0);

  // Check if the user's email is in the allowlist (case-insensitive)
  const normalizedEmail = email.trim().toLowerCase();
  return allowedEmails.includes(normalizedEmail);
}

/**
 * Gets the list of allowed emails for display purposes
 * 
 * @returns Array of allowed email addresses, or null if not applicable
 */
export function getAllowedEmails(): string[] | null {
  const mode = import.meta.env.MODE;
  if (mode === 'production') {
    return null;
  }

  const allowedEmailsEnv = import.meta.env.VITE_ALLOWED_EMAILS;
  if (!allowedEmailsEnv) {
    return null;
  }

  return allowedEmailsEnv
    .split(',')
    .map((email: string) => email.trim())
    .filter((email: string) => email.length > 0);
}

/**
 * Checks if email allowlist is enabled
 * 
 * @returns true if allowlist is enabled and configured
 */
export function isAllowlistEnabled(): boolean {
  const mode = import.meta.env.MODE;
  if (mode === 'production') {
    return false;
  }

  const allowedEmailsEnv = import.meta.env.VITE_ALLOWED_EMAILS;
  return !!allowedEmailsEnv;
}

