// =============================================================================
// Session Window Utilities
// Centralized session calculation for API routes and UI components
// =============================================================================

/**
 * Session window duration constants
 */
export const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const SESSION_WINDOW_HOURS = 24;

/**
 * Session status result from calculation
 */
export interface SessionStatus {
  isActive: boolean;
  timeRemaining: number | null; // milliseconds
  status: "active" | "expired";
  hoursRemaining?: number;
  minutesRemaining?: number;
}

/**
 * Calculate session status from last inbound message timestamp
 * WhatsApp Business API allows free-form messages within 24 hours of last customer message
 *
 * @param lastInboundAt - Timestamp of last inbound message (Date, ISO string, or null)
 * @returns SessionStatus object with calculated values
 */
export function calculateSessionStatus(
  lastInboundAt: Date | string | null | undefined
): SessionStatus {
  // Handle null/undefined - return expired
  if (!lastInboundAt) {
    return {
      isActive: false,
      timeRemaining: null,
      status: "expired",
    };
  }

  const lastInteraction =
    lastInboundAt instanceof Date ? lastInboundAt : new Date(lastInboundAt);

  // Validate date
  if (isNaN(lastInteraction.getTime())) {
    return {
      isActive: false,
      timeRemaining: null,
      status: "expired",
    };
  }

  const now = new Date();
  const elapsedMs = now.getTime() - lastInteraction.getTime();
  const remainingMs = SESSION_WINDOW_MS - elapsedMs;

  if (remainingMs <= 0) {
    return {
      isActive: false,
      timeRemaining: null,
      status: "expired",
    };
  }

  // Calculate hours and minutes remaining
  const hoursRemaining = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutesRemaining = Math.floor(
    (remainingMs % (60 * 60 * 1000)) / (60 * 1000)
  );

  return {
    isActive: true,
    timeRemaining: remainingMs,
    status: "active",
    hoursRemaining,
    minutesRemaining,
  };
}

/**
 * Simple boolean helper to check if session is active
 * Useful for API routes that only need a quick check
 *
 * @param lastInboundAt - Timestamp of last inbound message
 * @returns true if within 24-hour window, false otherwise
 */
export function isSessionActive(
  lastInboundAt: Date | string | null | undefined
): boolean {
  return calculateSessionStatus(lastInboundAt).isActive;
}

/**
 * Format milliseconds remaining into human-readable "Xh Ym" format
 *
 * @param ms - Milliseconds remaining
 * @returns Formatted string like "5h 30m" or "45m"
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) {
    return "0m";
  }

  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
