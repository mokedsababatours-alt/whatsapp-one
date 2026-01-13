import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Contact } from "@/types";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

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
  /** Whether contacts are currently loading */
  isLoading: boolean;
  /** Error message if fetch/subscription failed */
  error: string | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Manually refetch contacts */
  refetch: () => Promise<void>;
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

/**
 * useContacts - Real-time subscription hook for contacts
 * 
 * Fetches initial contacts and subscribes to real-time INSERT and UPDATE
 * events for new contacts and changes to unread_count/last_interaction.
 * 
 * @returns Contacts state with loading, error, and connection status
 */
export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = getSupabaseBrowserClient();

  // Fetch initial contacts
  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("contacts")
        .select("*")
        .order("last_interaction_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setContacts(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch contacts";
      setError(errorMessage);
      console.error("useContacts fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

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

    // Track connection status
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnectionStatus("connected");
      } else if (status === "CLOSED") {
        setConnectionStatus("disconnected");
      } else if (status === "CHANNEL_ERROR") {
        setConnectionStatus("error");
        setError("Realtime connection error");
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

  return {
    contacts,
    isLoading,
    error,
    connectionStatus,
    refetch: fetchContacts,
  };
}
