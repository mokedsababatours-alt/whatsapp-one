import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Connection status for realtime subscriptions
 */
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * Return type for useRealtimeStatus hook
 */
export interface RealtimeStatusState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Error message if connection failed */
  error: string | null;
  /** Whether the subscription is connected and receiving events */
  isConnected: boolean;
  /** Whether currently attempting to connect */
  isConnecting: boolean;
}

/**
 * useRealtimeStatus - Track connection state for a Supabase realtime channel
 * 
 * @param channel - The Supabase RealtimeChannel to monitor
 * @returns Connection status state object
 */
export function useRealtimeStatus(channel: RealtimeChannel | null): RealtimeStatusState {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  // Reconnect with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (!channel) return;
    
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setStatus("error");
      setError("Max reconnection attempts reached");
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);

    reconnectTimeoutRef.current = setTimeout(() => {
      setStatus("connecting");
      channel.subscribe();
    }, delay);
  }, [channel]);

  useEffect(() => {
    if (!channel) {
      setStatus("disconnected");
      return;
    }

    // Set up channel event listeners
    const handleSubscribed = () => {
      setStatus("connected");
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    const handleClosed = () => {
      setStatus("disconnected");
      attemptReconnect();
    };

    const handleError = (err: Error) => {
      setStatus("error");
      setError(err.message || "Connection error");
      attemptReconnect();
    };

    // Listen to channel state changes
    channel.on("system", { event: "subscribed" } as never, handleSubscribed);
    channel.on("system", { event: "closed" } as never, handleClosed);
    channel.on("system", { event: "error" } as never, handleError);

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [channel, attemptReconnect]);

  return {
    status,
    error,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
  };
}
