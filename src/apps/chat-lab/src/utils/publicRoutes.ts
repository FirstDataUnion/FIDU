/**
 * Utilities for handling public routes that don't require authentication
 */

// Routes that don't require authentication
export const PUBLIC_ROUTES = ['/privacy-policy', '/terms-of-use'];

/**
 * Check if a given pathname is a public route
 * @param pathname - The pathname to check (may include basename prefix)
 * @returns true if the route is public, false otherwise
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    // Match exact route or route with basename prefix
    return (
      pathname === route
      || pathname === `/fidu-chat-lab${route}`
      || pathname.endsWith(route)
      || pathname.endsWith(`${route}/`)
    );
  });
}
