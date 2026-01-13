import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Message } from "@/types";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Connection status for the subscription
 */
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * Return type for useMessages hook
 */
export interface UseMessagesReturn {
  /** Array of messages for the contact */
  messages: Message[];
  /** Whether messages are currently loading */
  isLoading: boolean;
  /** Error message if fetch/subscription failed */
  error: string | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Manually refetch messages */
  refetch: () => Promise<void>;
}

/**
 * useMessages - Real-time subscription hook for messages
 * 
 * Fetches initial messages for a contact and subscribes to real-time
 * INSERT and UPDATE events for new messages and status changes.
 * 
 * @param contactPhone - Phone number to filter messages by (null to disable)
 * @returns Messages state with loading, error, and connection status
 */
export function useMessages(contactPhone: string | null): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = getSupabaseBrowserClient();

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!contactPhone) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .eq("contact_phone", contactPhone)
        .order("created_at", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setMessages(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch messages";
      setError(errorMessage);
      console.error("useMessages fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [contactPhone, supabase]);

  // Handle INSERT event - new message
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<Message>) => {
    const newMessage = payload.new as Message;
    
    // Only add if it matches our contact filter
    if (newMessage.contact_phone === contactPhone) {
      setMessages((prev) => {
        // Check for duplicates by ID
        if (prev.some((m) => m.id === newMessage.id)) {
          return prev;
        }
        // Add and sort by created_at
        return [...prev, newMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }
  }, [contactPhone]);

  // Handle UPDATE event - status change
  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<Message>) => {
    const updatedMessage = payload.new as Message;
    
    setMessages((prev) =>
      prev.map((m) =>
        m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m
      )
    );
  }, []);

  // Set up subscription
  useEffect(() => {
    // Cleanup previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Reset state when contact changes
    setMessages([]);
    setError(null);

    if (!contactPhone) {
      setConnectionStatus("disconnected");
      return;
    }

    // Fetch initial data
    fetchMessages();

    // Create realtime channel with contact filter
    const channelName = `messages:${contactPhone}`;
    const channel = supabase
      .channel(channelName)
      .on<Message>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `contact_phone=eq.${contactPhone}`,
        },
        handleInsert
      )
      .on<Message>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `contact_phone=eq.${contactPhone}`,
        },
        handleUpdate
      );

    // Track connection status
    setConnectionStatus("connecting");

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

    // Cleanup on unmount or contact change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [contactPhone, supabase, fetchMessages, handleInsert, handleUpdate]);

  return {
    messages,
    isLoading,
    error,
    connectionStatus,
    refetch: fetchMessages,
  };
}
