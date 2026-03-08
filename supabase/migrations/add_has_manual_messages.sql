-- =============================================================================
-- Migration: Add has_manual_messages column to contacts table
-- Purpose: Track contacts with manual (non-automation) messages for filtering
-- =============================================================================

-- Add has_manual_messages column to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS has_manual_messages BOOLEAN DEFAULT false;

-- Create index for efficient filtering by manual messages
CREATE INDEX IF NOT EXISTS idx_contacts_has_manual_messages 
ON contacts(has_manual_messages);

-- Add comment to document the column
COMMENT ON COLUMN contacts.has_manual_messages IS 'True if contact has received manual messages (source = manual_ui) or sent inbound messages';

-- Enable Realtime on contacts table for live inbox updates
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;

-- =============================================================================
-- Backfill Logic (Optional - can be run separately via script)
-- =============================================================================
-- This updates existing contacts based on their message history
-- Run this after the migration if you have existing data

-- Update contacts that have manual outbound messages
UPDATE contacts
SET has_manual_messages = true
WHERE phone_number IN (
    SELECT DISTINCT contact_phone
    FROM messages
    WHERE direction = 'outbound' 
    AND source = 'manual_ui'
);

-- Update contacts that have any inbound messages
UPDATE contacts
SET has_manual_messages = true
WHERE phone_number IN (
    SELECT DISTINCT contact_phone
    FROM messages
    WHERE direction = 'inbound'
);
