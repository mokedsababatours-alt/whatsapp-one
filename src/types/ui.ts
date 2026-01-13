// =============================================================================
// UI Type Definitions
// Component props and UI state types
// =============================================================================

import type { Contact, Message, MessageType, SessionStatus } from "./database";

// =============================================================================
// Component Props
// =============================================================================

/**
 * Props for contact list item in the sidebar
 */
export interface ContactListItemProps {
  /** Contact data */
  contact: Contact;
  /** Whether this contact is currently selected */
  isSelected: boolean;
  /** Click handler for selecting the contact */
  onClick: (contact: Contact) => void;
}

/**
 * Props for message bubble component
 */
export interface MessageBubbleProps {
  /** Message data */
  message: Message;
  /** Whether to show the timestamp */
  showTimestamp?: boolean;
  /** Whether to show the delivery status indicator */
  showStatus?: boolean;
  /** Whether this is the first message in a group (affects styling) */
  isFirstInGroup?: boolean;
  /** Whether this is the last message in a group (affects styling) */
  isLastInGroup?: boolean;
}

/**
 * Props for conversation header component
 * Session status is now calculated internally by SessionTimer component
 */
export interface ConversationHeaderProps {
  /** Contact information */
  contact: Contact;
  /** Handler for opening contact details */
  onContactClick?: () => void;
  /** Handler for refreshing the conversation */
  onRefresh?: () => void;
}

/**
 * Props for message composer component
 */
export interface MessageComposerProps {
  /** Whether the 24-hour session is active */
  isSessionActive: boolean;
  /** Whether a message is currently being sent */
  isSending: boolean;
  /** Handler for sending a text message */
  onSendText: (text: string) => void;
  /** Handler for sending media */
  onSendMedia?: (file: File, type: MessageType) => void;
  /** Handler for sending a template (when session is expired) */
  onSendTemplate?: () => void;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Props for automation log item component
 */
export interface AutomationLogItemProps {
  /** Log data */
  log: {
    id: string;
    workflow_name: string;
    contact_phone: string | null;
    status: "success" | "failed";
    error_detail: string | null;
    cost_estimate: number | null;
    executed_at: string;
  };
  /** Click handler for viewing details */
  onClick?: () => void;
}

// =============================================================================
// UI State Types
// =============================================================================

/**
 * Loading state for async operations
 */
export interface LoadingState {
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether initial load has completed */
  isInitialized: boolean;
}

/**
 * Error state for handling failures
 */
export interface ErrorState {
  /** Whether an error has occurred */
  hasError: boolean;
  /** Error message to display */
  message: string | null;
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Selection state for inbox view
 */
export interface InboxSelectionState {
  /** Currently selected contact phone number */
  selectedContactPhone: string | null;
  /** Currently selected message ID (for scrolling/highlighting) */
  selectedMessageId: string | null;
}

/**
 * Combined async state for data fetching
 */
export interface AsyncState<T> {
  /** The data when loaded */
  data: T | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if fetch failed */
  error: string | null;
}

/**
 * Pagination state for lists
 */
export interface PaginationState {
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there are more pages */
  hasNextPage: boolean;
  /** Whether there are previous pages */
  hasPreviousPage: boolean;
}

/**
 * Filter state for contact/message lists
 */
export interface FilterState {
  /** Search query for filtering */
  searchQuery: string;
  /** Filter by session status */
  sessionStatus?: SessionStatus | "all";
  /** Filter by unread status */
  hasUnread?: boolean;
  /** Sort field */
  sortBy: "last_interaction_at" | "created_at" | "profile_name";
  /** Sort direction */
  sortOrder: "asc" | "desc";
}

/**
 * Real-time subscription state
 */
export interface RealtimeState {
  /** Whether connected to realtime */
  isConnected: boolean;
  /** Whether currently reconnecting */
  isReconnecting: boolean;
  /** Last sync timestamp */
  lastSyncAt: string | null;
}

// =============================================================================
// View State Types
// =============================================================================

/**
 * Complete state for the inbox view
 */
export interface InboxViewState {
  /** List of contacts */
  contacts: Contact[];
  /** Messages for selected contact */
  messages: Message[];
  /** Selection state */
  selection: InboxSelectionState;
  /** Loading states */
  loading: {
    contacts: boolean;
    messages: boolean;
    sending: boolean;
  };
  /** Error states */
  errors: {
    contacts: string | null;
    messages: string | null;
    sending: string | null;
  };
  /** Filter/search state */
  filter: FilterState;
  /** Realtime connection state */
  realtime: RealtimeState;
}

/**
 * Complete state for the activity view
 */
export interface ActivityViewState {
  /** Automation logs */
  logs: AsyncState<AutomationLogItemProps["log"][]>;
  /** Pagination */
  pagination: PaginationState;
  /** Filter by workflow name */
  workflowFilter: string | null;
  /** Filter by status */
  statusFilter: "success" | "failed" | "all";
}
