import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Contact } from "@/types";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { ContactFilter } from "@/app/api/contacts/list/route";

/**
 * Connection status for the subscription
 */
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * Return type for useContacts hook
 */
export interface UseContactsReturn {
  /** Array of contacts sorted by last_interaction_at descending */
  contacts: Contact[];
  /** Whether initial contacts are loading */
  isLoading: boolean;
  /** Whether more contacts are being loaded (pagination) */
  isLoadingMore: boolean;
  /** Whether there are more contacts to load */
  hasMore: boolean;
  /** Error message if initial fetch failed (hard error - no data) */
  error: string | null;
  /** Error message if realtime subscription failed (soft error - have cached data) */
  realtimeError: string | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Manually refetch contacts */
  refetch: () => Promise<void>;
  /** Load more contacts (for infinite scroll) */
  loadMore: () => Promise<void>;
  /** Set the filter for contacts */
  setFilter: (filter: ContactFilter) => void;
  /** Current filter */
  filter: ContactFilter;
}

/**
 * Sort contacts by last_interaction_at descending (most recent first)
 */
function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    const dateA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
    const dateB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
    return dateB - dateA;
  });
}

const PAGE_SIZE = 15;

/**
 * useContacts - Real-time subscription hook for contacts with pagination
 * 
 * Fetches paginated contacts and subscribes to real-time INSERT and UPDATE
 * events for new contacts and changes to unread_count/last_interaction.
 * 
 * @returns Contacts state with loading, error, pagination, and filter support
 */
export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [offset, setOffset] = useState(0);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = getSupabaseBrowserClient();

  // Fetch contacts page from API
  const fetchContactsPage = useCallback(async (currentOffset: number, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: currentOffset.toString(),
        filter: filter,
      });

      const response = await fetch(`/api/contacts/list?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch contacts");
      }

      const data = await response.json();

      setContacts((prev) => reset ? data.contacts : [...prev, ...data.contacts]);
      setHasMore(data.hasMore);
      setOffset(currentOffset + PAGE_SIZE);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch contacts";
      if (reset) {
        setError(errorMessage);
      }
      console.error("useContacts fetch error:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filter]);

  // Initial fetch and filter changes
  const fetchContacts = useCallback(async () => {
    setOffset(0);
    await fetchContactsPage(0, true);
  }, [fetchContactsPage]);

  // Load more contacts (infinite scroll)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }
    await fetchContactsPage(offset, false);
  }, [offset, hasMore, isLoadingMore, fetchContactsPage]);

  // Handle INSERT event - new contact
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<Contact>) => {
    const newContact = payload.new as Contact;
    
    setContacts((prev) => {
      // Check for duplicates by phone_number
      if (prev.some((c) => c.phone_number === newContact.phone_number)) {
        return prev;
      }
      // Add and re-sort
      return sortContacts([...prev, newContact]);
    });
  }, []);

  // Handle UPDATE event - contact updated (unread_count, last_interaction_at, etc.)
  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<Contact>) => {
    const updatedContact = payload.new as Contact;
    
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.phone_number === updatedContact.phone_number
          ? { ...c, ...updatedContact }
          : c
      );
      // Re-sort after update since last_interaction_at may have changed
      return sortContacts(updated);
    });
  }, []);

  // Set up subscription on mount
  useEffect(() => {
    // Fetch initial data
    fetchContacts();

    // Create realtime channel for all contacts
    const channel = supabase
      .channel("contacts:all")
      .on<Contact>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contacts",
        },
        handleInsert
      )
      .on<Contact>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "contacts",
        },
        handleUpdate
      );

    // Track connection status (realtime error is soft - we have cached data)
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnectionStatus("connected");
        setRealtimeError(null);
      } else if (status === "CLOSED") {
        setConnectionStatus("disconnected");
        setRealtimeError("Realtime connection closed");
      } else if (status === "CHANNEL_ERROR") {
        setConnectionStatus("error");
        setRealtimeError("Realtime connection error");
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, fetchContacts, handleInsert, handleUpdate]);

  // Refetch when filter changes
  useEffect(() => {
    if (!isLoading) {
      fetchContacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Polling fallback when realtime is disconnected - refetch every 30s to stay live
  useEffect(() => {
    if (connectionStatus !== "error" && connectionStatus !== "disconnected") {
      return;
    }
    if (contacts.length === 0) {
      return; // No cached data, don't poll (initial load or hard error)
    }
    const intervalId = setInterval(() => {
      fetchContacts();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [connectionStatus, contacts.length, fetchContacts]);

  return {
    contacts,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    realtimeError,
    connectionStatus,
    refetch: fetchContacts,
    loadMore,
    setFilter,
    filter,
  };
}
