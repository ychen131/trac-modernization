/**
 * Utility functions for displaying user information
 */

/**
 * Format a user identifier for display.
 * For now, this handles Clerk user IDs and email addresses.
 * In the future, this can be enhanced to look up actual user names.
 */
export function formatUserForDisplay(userId: string): string {
  if (!userId) {
    return 'Unassigned';
  }

  // If it's an email address, show it as-is
  if (userId.includes('@')) {
    return userId;
  }

  // If it's a Clerk user ID (starts with 'user_'), show a shortened version
  if (userId.startsWith('user_')) {
    return `User ${userId.slice(-8)}`; // Show last 8 characters
  }

  // For other user IDs, show a generic format
  return `User ${userId.slice(-8) || userId}`;
}

/**
 * Get a short identifier for a user (useful for compact displays)
 */
export function getShortUserId(userId: string): string {
  if (!userId) {
    return 'N/A';
  }

  if (userId.includes('@')) {
    return userId.split('@')[0]; // Show part before @
  }

  if (userId.startsWith('user_')) {
    return userId.slice(-6); // Show last 6 characters
  }

  return userId.slice(-6) || userId;
} 