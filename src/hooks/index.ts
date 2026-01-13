// =============================================================================
// Custom React Hooks
// Central export point for all application hooks
// =============================================================================

// Real-time subscription hooks
export { useMessages, type UseMessagesReturn } from "./useMessages";
export { useContacts, type UseContactsReturn } from "./useContacts";
export { useAutomationLogs, type UseAutomationLogsReturn, type LogFilter } from "./useAutomationLogs";

// Utility hooks
export {
  useRealtimeStatus,
  type ConnectionStatus,
  type RealtimeStatusState,
} from "./useRealtimeStatus";
