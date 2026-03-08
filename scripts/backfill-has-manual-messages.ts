/**
 * Backfill Script: Update has_manual_messages flag for existing contacts
 * 
 * This script analyzes existing messages for each contact and sets the
 * has_manual_messages flag to true if:
 * - The contact has any inbound messages (from customer)
 * - The contact has any outbound messages with source = "manual_ui"
 * 
 * Usage:
 *   npx tsx scripts/backfill-has-manual-messages.ts
 * 
 * Or with environment variables:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/backfill-has-manual-messages.ts
 */

import { createClient } from "@supabase/supabase-js";

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Error: Missing required environment variables");
  console.error("   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_KEY");
  process.exit(1);
}

// Create Supabase client without type constraints (for migration script)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface BackfillResult {
  totalContacts: number;
  updated: number;
  alreadySet: number;
  errors: number;
}

async function backfillHasManualMessages(): Promise<BackfillResult> {
  console.log("🚀 Starting backfill for has_manual_messages...\n");

  const result: BackfillResult = {
    totalContacts: 0,
    updated: 0,
    alreadySet: 0,
    errors: 0,
  };

  try {
    // Fetch all contacts
    console.log("📥 Fetching all contacts...");
    const { data: contacts, error: fetchError } = await supabase
      .from("contacts")
      .select("phone_number, has_manual_messages");

    if (fetchError) {
      throw new Error(`Failed to fetch contacts: ${fetchError.message}`);
    }

    result.totalContacts = contacts?.length || 0;
    console.log(`   Found ${result.totalContacts} contacts\n`);

    if (!contacts || contacts.length === 0) {
      console.log("ℹ️  No contacts to process");
      return result;
    }

    // Process each contact
    for (const contact of contacts) {
      try {
        // Check if contact has manual messages by querying messages table
        const { data: messages, error: messagesError } = await supabase
          .from("messages")
          .select("direction, source")
          .eq("contact_phone", contact.phone_number)
          .or("direction.eq.inbound,and(direction.eq.outbound,source.eq.manual_ui)")
          .limit(1);

        if (messagesError) {
          console.error(`   ❌ Error checking messages for ${contact.phone_number}: ${messagesError.message}`);
          result.errors++;
          continue;
        }

        const hasManualMessages = messages && messages.length > 0;

        // Update contact if necessary
        if (hasManualMessages && !contact.has_manual_messages) {
          const { error: updateError } = await supabase
            .from("contacts")
            .update({ has_manual_messages: true })
            .eq("phone_number", contact.phone_number);

          if (updateError) {
            console.error(`   ❌ Error updating ${contact.phone_number}: ${updateError.message}`);
            result.errors++;
          } else {
            console.log(`   ✅ Updated ${contact.phone_number}`);
            result.updated++;
          }
        } else if (hasManualMessages && contact.has_manual_messages) {
          result.alreadySet++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${contact.phone_number}:`, error);
        result.errors++;
      }
    }

    console.log("\n✨ Backfill complete!\n");
    console.log("📊 Results:");
    console.log(`   Total contacts:         ${result.totalContacts}`);
    console.log(`   Updated:                ${result.updated}`);
    console.log(`   Already set correctly:  ${result.alreadySet}`);
    console.log(`   Errors:                 ${result.errors}`);

    return result;
  } catch (error) {
    console.error("❌ Fatal error during backfill:", error);
    throw error;
  }
}

// Run the backfill
backfillHasManualMessages()
  .then((result) => {
    if (result.errors > 0) {
      console.log("\n⚠️  Backfill completed with errors");
      process.exit(1);
    } else {
      console.log("\n✅ Backfill completed successfully");
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  });
