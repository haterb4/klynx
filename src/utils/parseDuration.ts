/**
 * Parse a human-readable duration string into milliseconds.
 * Supports formats like "15m", "1h", "30s", etc.
 * @param duration The duration string.
 * @returns The duration in milliseconds.
 */
export function parseDuration(duration: string): number {
    const durationRegex = /^(\d+)(s|m|h|d)$/; // Regex to match the duration format
    const match = duration.match(durationRegex);
  
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }
  
    const value = parseInt(match[1], 10);  // Extract the numeric part
    const unit = match[2];  // Extract the unit (s, m, h, d)
  
    // Convert the value to milliseconds based on the unit
    switch (unit) {
      case 's':
        return value * 1000; // seconds to milliseconds
      case 'm':
        return value * 1000 * 60; // minutes to milliseconds
      case 'h':
        return value * 1000 * 60 * 60; // hours to milliseconds
      case 'd':
        return value * 1000 * 60 * 60 * 24; // days to milliseconds
      default:
        throw new Error(`Unknown duration unit: ${unit}`);
    }
  }