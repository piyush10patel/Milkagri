/**
 * Client-side formatting utilities for route display.
 */

/**
 * Formats a coordinate value (latitude or longitude) with at least 6 decimal places.
 */
export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

/**
 * Formats a distance in meters to a human-readable string in kilometers.
 * Example: 1500 → "1.5 km"
 */
export function formatDistance(meters: number): string {
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Formats a duration in seconds to a human-readable string.
 * - >= 3600 seconds: "Xh Ym"
 * - < 3600 seconds: "Ym"
 * - 0 seconds: "0m"
 */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
