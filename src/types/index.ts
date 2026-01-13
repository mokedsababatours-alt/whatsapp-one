// =============================================================================
// Type Exports
// Central export point for all application types
// =============================================================================

// Database types and enums
export type {
  // Enums
  MessageDirection,
  MessageType,
  MessageStatus,
  SessionStatus,
  AutomationStatus,
  // Table interfaces
  Contact,
  Message,
  AutomationLog,
  // Insert/Update types
  ContactInsert,
  ContactUpdate,
  MessageInsert,
  MessageUpdate,
  AutomationLogInsert,
  // Supabase types
  Json,
  Database,
} from "./database";

// UI types
export type {
  // Component props
  ContactListItemProps,
  MessageBubbleProps,
  ConversationHeaderProps,
  MessageComposerProps,
  AutomationLogItemProps,
  // State types
  LoadingState,
  ErrorState,
  InboxSelectionState,
  AsyncState,
  PaginationState,
  FilterState,
  RealtimeState,
  // View state types
  InboxViewState,
  ActivityViewState,
} from "./ui";
