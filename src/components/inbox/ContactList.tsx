"use client";

import { useState, useMemo, useRef, useEffect, type KeyboardEvent } from "react";
import { Search, Users, MessageSquarePlus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactListItem } from "./ContactListItem";
import { normalizePhoneToE164 } from "@/lib/phone";
import type { Contact } from "@/types";
import type { ContactFilter } from "@/app/api/contacts/list/route";

interface ContactListProps {
  /** Array of contacts to display */
  contacts: Contact[];
  /** Currently selected contact (by phone number) */
  selectedContact: Contact | null;
  /** Callback when a contact is selected */
  onSelectContact: (contact: Contact) => void;
  /** Callback when starting a new chat by phone number */
  onStartNewChat?: (phoneNumber: string) => Promise<boolean> | boolean;
  /** Current filter */
  filter: ContactFilter;
  /** Callback to change filter */
  onFilterChange: (filter: ContactFilter) => void;
  /** Whether there are more contacts to load */
  hasMore: boolean;
  /** Callback to load more contacts */
  onLoadMore: () => void;
  /** Whether more contacts are currently loading */
  isLoadingMore: boolean;
}

/**
 * ContactList - Scrollable contact list with search functionality
 * Displays contacts sorted by last interaction, with search filtering
 */
export function ContactList({
  contacts,
  selectedContact,
  onSelectContact,
  onStartNewChat,
  filter,
  onFilterChange,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: ContactListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  
  const normalizedSearch = useMemo(
    () => normalizePhoneToE164(searchQuery),
    [searchQuery]
  );
  const searchDigitsCount = useMemo(
    () => searchQuery.replace(/\D/g, "").length,
    [searchQuery]
  );

  // Intersection observer for infinite scroll
  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger || !hasMore || isLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0.1,
      }
    );

    observer.observe(trigger);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

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
        const phoneMatch =
          contact.phone_number.toLowerCase().includes(query) ||
          (normalizedSearch ? contact.phone_number === normalizedSearch : false);
        return nameMatch || phoneMatch;
      });
    }

    // Sort by last_interaction_at descending (most recent first)
    return [...result].sort((a, b) => {
      const dateA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
      const dateB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [contacts, searchQuery, normalizedSearch]);

  const canStartNewChat = useMemo(() => {
    if (!normalizedSearch) {
      return false;
    }
    if (searchDigitsCount < 9) {
      return false;
    }
    return !contacts.some((contact) => contact.phone_number === normalizedSearch);
  }, [contacts, normalizedSearch, searchDigitsCount]);

  const handleSelect = (contact: Contact) => {
    onSelectContact(contact);
    setSearchQuery("");
  };

  const handleStartNewChat = async () => {
    if (!normalizedSearch) {
      return;
    }

    const result = await onStartNewChat?.(normalizedSearch);
    if (result) {
      setSearchQuery("");
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !normalizedSearch) {
      return;
    }

    const matchedContact = contacts.find(
      (contact) => contact.phone_number === normalizedSearch
    );

    if (matchedContact) {
      event.preventDefault();
      handleSelect(matchedContact);
      return;
    }

    if (canStartNewChat) {
      event.preventDefault();
      void handleStartNewChat();
    }
  };

  return (
    <div className="flex h-full w-[350px] flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <h1 className="text-lg font-semibold text-slate-900">Inbox</h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {totalUnread} unread
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 px-3 pt-3 pb-2">
        <Tabs defaultValue="all" value={filter} onValueChange={(value) => onFilterChange(value as ContactFilter)}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">
              Manual
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
            onKeyDown={handleSearchKeyDown}
            className="pl-9 bg-white border-slate-200 focus-visible:ring-emerald-500"
          />
        </div>
      </div>

      {/* Contact List */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-2">
          {canStartNewChat && normalizedSearch && (
            <button
              type="button"
              onClick={handleStartNewChat}
              className="mb-3 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left transition hover:bg-emerald-100"
            >
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">
                    Start chat
                  </p>
                  <p className="text-xs text-emerald-700">{normalizedSearch}</p>
                </div>
              </div>
            </button>
          )}
          {filteredContacts.length > 0 ? (
            <>
              <div className="space-y-1">
                {filteredContacts.map((contact) => (
                  <ContactListItem
                    key={contact.phone_number}
                    contact={contact}
                    isSelected={selectedContact?.phone_number === contact.phone_number}
                    onClick={handleSelect}
                  />
                ))}
              </div>
              
              {/* Infinite scroll trigger */}
              {hasMore && (
                <div ref={loadMoreTriggerRef} className="py-4 text-center">
                  {isLoadingMore && (
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading more...</span>
                    </div>
                  )}
                </div>
              )}
            </>
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
