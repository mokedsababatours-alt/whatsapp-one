"use client";

import { useState, useEffect } from "react";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateSessionStatus, formatTimeRemaining } from "@/lib/session";

interface SessionTimerProps {
  lastInteractionAt: string | null;
}

/**
 * SessionTimer - Displays session window countdown with auto-refresh
 *
 * Shows time remaining in the 24-hour WhatsApp session window.
 * Auto-refreshes every 60 seconds to keep countdown accurate.
 * Matches existing styling: emerald pill for active, amber pill for expired.
 */
export function SessionTimer({ lastInteractionAt }: SessionTimerProps) {
  const [sessionStatus, setSessionStatus] = useState(() =>
    calculateSessionStatus(lastInteractionAt)
  );

  // Recalculate when prop changes
  useEffect(() => {
    setSessionStatus(calculateSessionStatus(lastInteractionAt));
  }, [lastInteractionAt]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionStatus(calculateSessionStatus(lastInteractionAt));
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [lastInteractionAt]);

  const timeText =
    sessionStatus.isActive && sessionStatus.timeRemaining
      ? `${formatTimeRemaining(sessionStatus.timeRemaining)} remaining`
      : "Window Closed";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        sessionStatus.isActive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      )}
    >
      {sessionStatus.isActive ? (
        <>
          <Clock className="h-4 w-4" />
          <span>{timeText}</span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4" />
          <span>Window Closed</span>
        </>
      )}
    </div>
  );
}
