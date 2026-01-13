-- =============================================================================
-- WhatsApp Interface - Supabase Schema
-- Task 1.1 - Database Schema Creation
-- Region: Frankfurt (eu-central-1)
-- =============================================================================

-- =============================================================================
-- TABLE: contacts
-- Stores WhatsApp contact information with session tracking
-- =============================================================================
CREATE TABLE contacts (
    phone_number TEXT PRIMARY KEY,                    -- E.164 format (e.g., +972501234567)
    profile_name TEXT,                                -- WhatsApp profile name
    last_interaction_at TIMESTAMPTZ,                  -- Last message timestamp
    session_status TEXT DEFAULT 'expired'             -- 'active' | 'expired' (24-hour window)
        CHECK (session_status IN ('active', 'expired')),
    unread_count INTEGER DEFAULT 0,                   -- Unread message counter
    created_at TIMESTAMPTZ DEFAULT NOW()              -- Record creation timestamp
);

-- Index for sorting contacts by recent activity
CREATE INDEX idx_contacts_last_interaction_at ON contacts(last_interaction_at DESC);

COMMENT ON TABLE contacts IS 'WhatsApp contacts with 24-hour session window tracking';
COMMENT ON COLUMN contacts.phone_number IS 'E.164 format phone number (primary identifier)';
COMMENT ON COLUMN contacts.session_status IS 'WhatsApp 24-hour session window status';

-- =============================================================================
-- TABLE: messages
-- Stores all inbound and outbound WhatsApp messages
-- =============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),    -- Unique message identifier
    contact_phone TEXT NOT NULL                       -- FK to contacts.phone_number
        REFERENCES contacts(phone_number) ON DELETE CASCADE,
    direction TEXT NOT NULL                           -- 'inbound' | 'outbound'
        CHECK (direction IN ('inbound', 'outbound')),
    type TEXT NOT NULL                                -- Message content type
        CHECK (type IN ('text', 'image', 'template', 'audio', 'video', 'document')),
    body TEXT,                                        -- Message text content
    media_url TEXT,                                   -- Persisted media URL (nullable)
    meta_id TEXT UNIQUE,                              -- Meta's message ID for deduplication
    status TEXT DEFAULT 'pending'                     -- Delivery status
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    source TEXT DEFAULT 'manual_ui',                  -- Origin: 'manual_ui' | workflow name
    created_at TIMESTAMPTZ DEFAULT NOW()              -- Message timestamp
);

-- Index for efficient conversation queries
CREATE INDEX idx_messages_contact_phone ON messages(contact_phone);

-- Index for chronological message ordering
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Index for Meta ID lookups (deduplication)
CREATE INDEX idx_messages_meta_id ON messages(meta_id) WHERE meta_id IS NOT NULL;

COMMENT ON TABLE messages IS 'WhatsApp messages with delivery tracking and source attribution';
COMMENT ON COLUMN messages.meta_id IS 'Meta WhatsApp API message ID for deduplication';
COMMENT ON COLUMN messages.source IS 'Origin tracking: manual_ui or n8n workflow name';

-- =============================================================================
-- TABLE: automation_logs
-- Tracks n8n workflow executions for Control Tower view
-- =============================================================================
CREATE TABLE automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),    -- Unique log identifier
    workflow_name TEXT NOT NULL,                      -- n8n workflow name
    contact_phone TEXT,                               -- Associated contact (nullable)
    status TEXT NOT NULL                              -- Execution result
        CHECK (status IN ('success', 'failed')),
    error_detail TEXT,                                -- Error message if failed
    cost_estimate FLOAT,                              -- Estimated API cost (nullable)
    executed_at TIMESTAMPTZ DEFAULT NOW()             -- Execution timestamp
);

-- Index for workflow filtering
CREATE INDEX idx_automation_logs_workflow_name ON automation_logs(workflow_name);

-- Index for chronological log ordering
CREATE INDEX idx_automation_logs_executed_at ON automation_logs(executed_at DESC);

COMMENT ON TABLE automation_logs IS 'n8n workflow execution logs for monitoring dashboard';
COMMENT ON COLUMN automation_logs.cost_estimate IS 'Estimated WhatsApp API cost per execution';

-- =============================================================================
-- Task 1.2 - Storage, RLS & Realtime Configuration
-- =============================================================================

-- =============================================================================
-- STORAGE BUCKET: whatsapp-media
-- Stores persisted media files (images, videos, audio, documents)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'whatsapp-media',
    'whatsapp-media',
    false,                                            -- Not publicly accessible
    16777216,                                         -- 16MB file size limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/3gpp',
        'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/amr',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
);

-- Storage policy: Authenticated users can read media files
CREATE POLICY "Authenticated users can read media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Storage policy: Authenticated users can upload media files
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Storage policy: Authenticated users can delete media files
CREATE POLICY "Authenticated users can delete media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- =============================================================================
-- ROW LEVEL SECURITY: contacts
-- =============================================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all contacts
CREATE POLICY "Authenticated users can view contacts"
ON contacts FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can create contacts
CREATE POLICY "Authenticated users can create contacts"
ON contacts FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update contacts
CREATE POLICY "Authenticated users can update contacts"
ON contacts FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================================================
-- ROW LEVEL SECURITY: messages
-- =============================================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all messages
CREATE POLICY "Authenticated users can view messages"
ON messages FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can create messages
CREATE POLICY "Authenticated users can create messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update message status
CREATE POLICY "Authenticated users can update messages"
ON messages FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================================================
-- ROW LEVEL SECURITY: automation_logs
-- =============================================================================
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all logs (read-only for UI)
CREATE POLICY "Authenticated users can view automation logs"
ON automation_logs FOR SELECT
TO authenticated
USING (true);

-- Policy: Service role can insert logs (for n8n via service key)
-- Note: Service role bypasses RLS by default, but explicit policy for clarity
CREATE POLICY "Service role can insert automation logs"
ON automation_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- =============================================================================
-- REALTIME CONFIGURATION
-- Enable Realtime subscriptions for live updates
-- =============================================================================

-- Enable Realtime on messages table (for live chat updates in Unified Inbox)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable Realtime on automation_logs table (for Control Tower live feed)
ALTER PUBLICATION supabase_realtime ADD TABLE automation_logs;

-- =============================================================================
-- TABLE: settings
-- Key-value store for application settings (Task 5.3)
-- =============================================================================
CREATE TABLE settings (
    key TEXT PRIMARY KEY,                             -- Setting key identifier
    value TEXT NOT NULL DEFAULT '',                   -- Setting value
    updated_at TIMESTAMPTZ DEFAULT NOW()              -- Last update timestamp
);

COMMENT ON TABLE settings IS 'Key-value store for application configuration settings';
COMMENT ON COLUMN settings.key IS 'Unique setting identifier (e.g., admin_phone, notification_enabled)';

-- =============================================================================
-- ROW LEVEL SECURITY: settings
-- =============================================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view settings
CREATE POLICY "Authenticated users can view settings"
ON settings FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can create/update settings
CREATE POLICY "Authenticated users can manage settings"
ON settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SCHEMA VERIFICATION
-- Run these queries after execution to verify all objects were created
-- =============================================================================
-- Tables: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Indexes: SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
-- RLS Status: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Policies: SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- Storage Buckets: SELECT id, name, public FROM storage.buckets;
-- Realtime: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
