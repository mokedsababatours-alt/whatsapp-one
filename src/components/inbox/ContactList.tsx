"use client";

import { useState, useMemo } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContactListItem } from "./ContactListItem";
import type { Contact } from "@/types";

interface ContactListProps {
  /** Array of contacts to display */
  contacts: Contact[];
  /** Currently selected contact (by phone number) */
  selectedContact: Contact | null;
  /** Callback when a contact is selected */
  onSelectContact: (contact: Contact) => void;
}

/**
 * ContactList - Scrollable contact list with search functionality
 * Displays contacts sorted by last interaction, with search filtering
 */
export function ContactList({
  contacts,
  selectedContact,
  onSelectContact,
}: ContactListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate total unread count
  const totalUnread = useMemo(() => {
    return contacts.reduce((sum, c) => sum + c.unread_count, 0);
  }, [contacts]);

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    // First, filter by search query
    let result = contacts;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = contacts.filter((contact) => {
        const nameMatch = contact.profile_name?.toLowerCase().includes(query);
        const phoneMatch = contact.phone_number.toLowerCase().includes(query);
        return nameMatch || phoneMatch;
      });
    }

    // Sort by last_interaction_at descending (most recent first)
    return [...result].sort((a, b) => {
      const dateA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
      const dateB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [contacts, searchQuery]);

  return (
    <div className="flex h-full w-[350px] flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <h1 className="text-lg font-semibold text-slate-900">Inbox</h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {totalUnread} unread
        </span>
      </div>

      {/* Search - Sticky */}
      <div className="sticky top-0 z-10 bg-slate-50 p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white border-slate-200 focus-visible:ring-emerald-500"
          />
        </div>
      </div>

      {/* Contact List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredContacts.length > 0 ? (
            <div className="space-y-1">
              {filteredContacts.map((contact) => (
                <ContactListItem
                  key={contact.phone_number}
                  contact={contact}
                  isSelected={selectedContact?.phone_number === contact.phone_number}
                  onClick={onSelectContact}
                />
              ))}
            </div>
          ) : (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-200 p-4 mb-3">
                <Users className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">
                {searchQuery ? "No contacts found" : "No conversations yet"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery
                  ? "Try a different search term"
                  : "Incoming messages will appear here"}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
