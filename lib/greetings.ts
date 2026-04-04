/**
 * Greeting and time utilities for professional header
 */

/**
 * Get greeting based on time of day
 */
export function getTimeBasedGreeting(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();

  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Get full greeting with username
 */
export function getGreeting(username: string): string {
  const greeting = getTimeBasedGreeting();
  const greetingText = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  };

  return `${greetingText[greeting]}, ${username}`;
}

/**
 * Format current date as "Monday, April 4, 2026"
 */
export function formatDate(): string {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}
