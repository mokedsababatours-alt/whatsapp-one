// =============================================================================
// Database Type Definitions
// Matches Supabase schema at supabase/schema.sql
// =============================================================================

// =============================================================================
// Enums - Match database CHECK constraints exactly
// =============================================================================

export type MessageDirection = "inbound" | "outbound";

export type MessageType = "text" | "image" | "template" | "audio" | "video" | "document";

export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export type SessionStatus = "active" | "expired";

export type AutomationStatus = "success" | "failed";

// =============================================================================
// Table Interfaces
// =============================================================================

/**
 * Contact record from the contacts table
 * Primary key: phone_number (E.164 format)
 */
export interface Contact {
  /** E.164 format phone number (e.g., +972501234567) */
  phone_number: string;
  /** WhatsApp profile name */
  profile_name: string | null;
  /** Last message timestamp */
  last_interaction_at: string | null;
  /** WhatsApp 24-hour session window status */
  session_status: SessionStatus;
  /** Unread message counter */
  unread_count: number;
  /** Record creation timestamp */
  created_at: string;
}

/**
 * Message record from the messages table
 * Primary key: id (UUID)
 */
export interface Message {
  /** Unique message identifier (UUID) */
  id: string;
  /** FK to contacts.phone_number */
  contact_phone: string;
  /** Message direction: inbound (received) or outbound (sent) */
  direction: MessageDirection;
  /** Message content type */
  type: MessageType;
  /** Message text content */
  body: string | null;
  /** Persisted media URL */
  media_url: string | null;
  /** Meta's message ID for deduplication */
  meta_id: string | null;
  /** Delivery status */
  status: MessageStatus;
  /** Origin: 'manual_ui' or workflow name */
  source: string;
  /** Message timestamp */
  created_at: string;
}

/**
 * Automation log record from the automation_logs table
 * Primary key: id (UUID)
 */
export interface AutomationLog {
  /** Unique log identifier (UUID) */
  id: string;
  /** n8n workflow name */
  workflow_name: string;
  /** Associated contact phone (nullable) */
  contact_phone: string | null;
  /** Execution result */
  status: AutomationStatus;
  /** Error message if failed */
  error_detail: string | null;
  /** Estimated API cost */
  cost_estimate: number | null;
  /** Execution timestamp */
  executed_at: string;
}

// =============================================================================
// Insert/Update Types (for creating and updating records)
// =============================================================================

/**
 * Type for inserting a new contact
 */
export interface ContactInsert {
  phone_number: string;
  profile_name?: string | null;
  last_interaction_at?: string | null;
  session_status?: SessionStatus;
  unread_count?: number;
  created_at?: string;
}

/**
 * Type for updating a contact
 */
export interface ContactUpdate {
  phone_number?: string;
  profile_name?: string | null;
  last_interaction_at?: string | null;
  session_status?: SessionStatus;
  unread_count?: number;
}

/**
 * Type for inserting a new message
 */
export interface MessageInsert {
  id?: string;
  contact_phone: string;
  direction: MessageDirection;
  type: MessageType;
  body?: string | null;
  media_url?: string | null;
  meta_id?: string | null;
  status?: MessageStatus;
  source?: string;
  created_at?: string;
}

/**
 * Type for updating a message
 */
export interface MessageUpdate {
  status?: MessageStatus;
  body?: string | null;
  media_url?: string | null;
}

/**
 * Type for inserting a new automation log
 */
export interface AutomationLogInsert {
  id?: string;
  workflow_name: string;
  contact_phone?: string | null;
  status: AutomationStatus;
  error_detail?: string | null;
  cost_estimate?: number | null;
  executed_at?: string;
}

// =============================================================================
// Supabase Database Type (for type-safe client)
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: Contact;
        Insert: ContactInsert;
        Update: ContactUpdate;
      };
      messages: {
        Row: Message;
        Insert: MessageInsert;
        Update: MessageUpdate;
      };
      automation_logs: {
        Row: AutomationLog;
        Insert: AutomationLogInsert;
        Update: Partial<AutomationLogInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      message_direction: MessageDirection;
      message_type: MessageType;
      message_status: MessageStatus;
      session_status: SessionStatus;
      automation_status: AutomationStatus;
    };
  };
}
