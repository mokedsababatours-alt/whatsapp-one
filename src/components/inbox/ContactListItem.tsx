"use client";

import { cn } from "@/lib/utils";
import type { ContactListItemProps } from "@/types";

/**
 * Get initials from profile name or phone number
 */
function getInitials(profileName: string | null, phoneNumber: string): string {
  if (profileName) {
    const parts = profileName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return profileName.slice(0, 2).toUpperCase();
  }
  // Use last 2 digits of phone number
  return phoneNumber.slice(-2);
}

/**
 * Format timestamp to relative time (e.g., "2m", "1h", "3d")
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "";
  
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Check if session is active (within 24-hour window)
 */
function isSessionActive(lastInteractionAt: string | null): boolean {
  if (!lastInteractionAt) return false;
  
  const now = new Date();
  const lastInteraction = new Date(lastInteractionAt);
  const diffMs = now.getTime() - lastInteraction.getTime();
  const diffHours = diffMs / 3600000;
  
  return diffHours < 24;
}

/**
 * ContactListItem - Displays a single contact in the list
 * Shows avatar, name/phone, last message snippet, timestamp, and status badges
 */
export function ContactListItem({ contact, isSelected, onClick }: ContactListItemProps) {
  const initials = getInitials(contact.profile_name, contact.phone_number);
  const relativeTime = formatRelativeTime(contact.last_interaction_at);
  const hasActiveSession = isSessionActive(contact.last_interaction_at);
  const hasUnread = contact.unread_count > 0;

  // Display name: profile name or formatted phone
  const displayName = contact.profile_name || contact.phone_number;
  
  // Truncate display name if too long
  const truncatedName = displayName.length > 25 
    ? displayName.slice(0, 25) + "..." 
    : displayName;

  return (
    <button
      onClick={() => onClick(contact)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
        "hover:bg-slate-100",
        isSelected && "bg-emerald-50 hover:bg-emerald-50"
      )}
    >
      {/* Avatar with status badges */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center text-sm font-medium",
            isSelected
              ? "bg-emerald-200 text-emerald-800"
              : "bg-slate-200 text-slate-600"
          )}
        >
          {initials}
        </div>
        
        {/* Session status badge - bottom right of avatar */}
        <span
          className={cn(
            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white",
            hasActiveSession ? "bg-emerald-500" : "bg-slate-400"
          )}
          title={hasActiveSession ? "Session active" : "Session expired"}
        />
      </div>

      {/* Contact info - selectable for copy */}
      <div className="flex-1 min-w-0 select-text">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "font-medium truncate select-text",
              isSelected ? "text-emerald-900" : "text-slate-900"
            )}
          >
            {truncatedName}
          </span>
          
          {/* Timestamp */}
          {relativeTime && (
            <span className="text-xs text-slate-400 flex-shrink-0">
              {relativeTime}
            </span>
          )}
        </div>
        
        {/* Secondary line - phone if name exists, or placeholder text */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-sm text-slate-500 truncate select-text">
            {contact.profile_name ? contact.phone_number : "No messages yet"}
          </span>
          
          {/* Unread badge */}
          {hasUnread && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-medium flex items-center justify-center">
              {contact.unread_count > 9 ? "9+" : contact.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
