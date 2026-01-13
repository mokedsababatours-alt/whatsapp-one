"use client";

import type { ConversationHeaderProps } from "@/types";
import { SessionTimer } from "./SessionTimer";

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
  return phoneNumber.slice(-2);
}

/**
 * ConversationHeader - Displays contact info and session timer
 *
 * Shows contact avatar with initials, name, phone number, and session window status.
 * Uses SessionTimer component for countdown display.
 */
export function ConversationHeader({
  contact,
  onContactClick,
}: ConversationHeaderProps) {
  const initials = getInitials(contact.profile_name, contact.phone_number);
  const displayName = contact.profile_name || contact.phone_number;

  return (
    <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6 bg-white">
      {/* Left side - Contact info */}
      <button
        onClick={onContactClick}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center text-sm font-medium text-emerald-800">
          {initials}
        </div>

        {/* Name and phone */}
        <div className="text-left">
          <h2 className="font-semibold text-slate-900">{displayName}</h2>
          {contact.profile_name && (
            <p className="text-sm text-slate-500">{contact.phone_number}</p>
          )}
        </div>
      </button>

      {/* Right side - Session timer */}
      <SessionTimer lastInteractionAt={contact.last_interaction_at} />
    </div>
  );
}
