import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AutomationLog } from "@/types";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// =============================================================================
// Types
// =============================================================================

/**
 * Filter options for automation logs
 */
export type LogFilter = "all" | "success" | "failed";

/**
 * Connection status for the subscription
 */
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * Return type for useAutomationLogs hook
 */
export interface UseAutomationLogsReturn {
  /** Array of automation logs (most recent first) */
  logs: AutomationLog[];
  /** Whether logs are currently loading */
  isLoading: boolean;
  /** Error message if fetch/subscription failed */
  error: string | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Current filter value */
  filter: LogFilter;
  /** Set filter value */
  setFilter: (filter: LogFilter) => void;
  /** Manually refetch logs */
  refetch: () => Promise<void>;
}

/**
 * Maximum number of logs to fetch
 */
const MAX_LOGS = 50;

/**
 * useAutomationLogs - Real-time subscription hook for automation logs
 * 
 * Fetches initial logs and subscribes to real-time INSERT events
 * for live updates. Supports filtering by status.
 * 
 * @returns Automation logs state with loading, error, and connection status
 */
export function useAutomationLogs(): UseAutomationLogsReturn {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [filter, setFilter] = useState<LogFilter>("all");
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = getSupabaseBrowserClient();

  // Fetch initial logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("automation_logs")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(MAX_LOGS);

      // Apply filter if not "all"
      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setLogs(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch automation logs";
      setError(errorMessage);
      console.error("useAutomationLogs fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, filter]);

  // Handle INSERT event - new log entry
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<AutomationLog>) => {
    const newLog = payload.new as AutomationLog;
    
    // Only add if it matches our current filter
    if (filter !== "all" && newLog.status !== filter) {
      return;
    }
    
    setLogs((prev) => {
      // Check for duplicates by ID
      if (prev.some((log) => log.id === newLog.id)) {
        return prev;
      }
      // Add at the beginning (most recent first) and limit to MAX_LOGS
      return [newLog, ...prev].slice(0, MAX_LOGS);
    });
  }, [filter]);

  // Set up subscription on mount
  useEffect(() => {
    // Cleanup previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Fetch initial data
    fetchLogs();

    // Create realtime channel for automation_logs
    const channel = supabase
      .channel("automation_logs:all")
      .on<AutomationLog>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "automation_logs",
        },
        handleInsert
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

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [supabase, fetchLogs, handleInsert]);

  // Refetch when filter changes
  useEffect(() => {
    fetchLogs();
  }, [filter, fetchLogs]);

  return {
    logs,
    isLoading,
    error,
    connectionStatus,
    filter,
    setFilter,
    refetch: fetchLogs,
  };
}
