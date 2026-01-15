import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MessageInsert, AutomationLogInsert } from "@/types/database";

// =============================================================================
// Types
// =============================================================================

interface SendMessageRequest {
  recipient: string;
  body: string;
}

interface MetaMessagePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url: boolean;
    body: string;
  };
}

interface MetaSuccessResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface MetaErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

const META_API_VERSION = "v24.0";
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const SESSION_WINDOW_HOURS = 24;
const WORKFLOW_NAME = "ui_send_message";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if contact's session window is still active (within 24 hours)
 */
function isSessionWindowActive(lastInteractionAt: string | null): boolean {
  if (!lastInteractionAt) {
    return false;
  }

  const lastInteraction = new Date(lastInteractionAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);

  return hoursDiff <= SESSION_WINDOW_HOURS;
}

/**
 * Build Meta API message payload
 */
function buildMetaPayload(recipient: string, body: string): MetaMessagePayload {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: {
      preview_url: false,
      body: body,
    },
  };
}

/**
 * Send message to Meta Graph API
 */
async function sendToMetaAPI(
  payload: MetaMessagePayload
): Promise<{ success: true; data: MetaSuccessResponse } | { success: false; error: MetaErrorResponse }> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("META_PHONE_NUMBER_ID or META_ACCESS_TOKEN environment variable not configured");
  }

  const url = `${META_API_BASE_URL}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data as MetaErrorResponse };
  }

  return { success: true, data: data as MetaSuccessResponse };
}

/**
 * Log action to automation_logs table
 * Wrapped in try-catch to ensure logging failures don't affect the main response
 */
async function logToAutomationLogs(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  contactPhone: string,
  status: "success" | "failed",
  errorDetail?: string
): Promise<void> {
  try {
    const logEntry: AutomationLogInsert = {
      workflow_name: WORKFLOW_NAME,
      contact_phone: contactPhone,
      status: status,
      error_detail: errorDetail || null,
      cost_estimate: null,
    };

    const { error: logError } = await supabase
      .from("automation_logs")
      .insert(logEntry);

    if (logError) {
      // Log to console but don't throw - logging failures shouldn't break the API
      console.error("Failed to insert automation log:", logError);
    }
  } catch (error) {
    // Catch any unexpected errors to prevent logging from breaking the response
    console.error("Automation logging error:", error);
  }
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  // Initialize supabase client early so it's available for logging
  let supabase: Awaited<ReturnType<typeof getSupabaseServerClient>> | null = null;
  let contactPhone: string | null = null;

  try {
    // 1. Parse and validate request body
    const requestBody: SendMessageRequest = await request.json();
    contactPhone = requestBody.recipient;

    if (!requestBody.recipient || !requestBody.body) {
      return NextResponse.json(
        { error: "Missing required fields: recipient and body" },
        { status: 400 }
      );
    }

    // Validate message body length (max 4096 per Meta API)
    if (requestBody.body.length > 4096) {
      return NextResponse.json(
        { error: "Message body exceeds maximum length of 4096 characters" },
        { status: 400 }
      );
    }

    // 2. Get Supabase client and verify user session
    supabase = await getSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 3. Query contact to check session window
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("phone_number, last_interaction_at, session_status")
      .eq("phone_number", requestBody.recipient)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        {
          error: "Contact not found",
          message: "The recipient is not in your contacts. They must send you a message first.",
        },
        { status: 404 }
      );
    }

    // 4. Validate 24-hour session window
    if (!isSessionWindowActive(contact.last_interaction_at)) {
      // Log the failed attempt (session expired before API call)
      await logToAutomationLogs(supabase, contactPhone, "failed", "Session window expired");

      return NextResponse.json(
        {
          error: "Session window expired",
          message: "Session window expired. Use template message.",
          session_status: "expired",
          last_interaction_at: contact.last_interaction_at,
        },
        { status: 400 }
      );
    }

    // 5. Build and send message to Meta API
    const metaPayload = buildMetaPayload(requestBody.recipient, requestBody.body);
    const metaResult = await sendToMetaAPI(metaPayload);

    if (!metaResult.success) {
      // Check for session window error from Meta (error code 131047)
      const isSessionError = metaResult.error.error?.code === 131047;
      const errorMessage = metaResult.error.error?.message || "Meta API error";

      // Log the failed attempt
      await logToAutomationLogs(
        supabase,
        contactPhone,
        "failed",
        `Meta API error: ${errorMessage} (code: ${metaResult.error.error?.code})`
      );

      if (isSessionError) {
        // Update contact session_status to expired
        await supabase
          .from("contacts")
          .update({ session_status: "expired" })
          .eq("phone_number", requestBody.recipient);

        return NextResponse.json(
          {
            error: "Session window expired",
            message: "Session window expired. Use template message.",
            meta_error: metaResult.error.error,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to send message",
          meta_error: metaResult.error.error,
        },
        { status: 502 }
      );
    }

    // 6. Log successful send to automation_logs
    await logToAutomationLogs(supabase, contactPhone, "success");

    // 7. Extract Meta message ID from response
    const metaMessageId = metaResult.data.messages[0]?.id;

    // 8. Insert message record into database
    const messageInsert: MessageInsert = {
      contact_phone: requestBody.recipient,
      direction: "outbound",
      type: "text",
      body: requestBody.body,
      media_url: null,
      meta_id: metaMessageId,
      status: "sent",
      source: "manual_ui",
    };

    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert(messageInsert)
      .select()
      .single();

    if (insertError) {
      // Message was sent via Meta but failed to record locally
      // Log this but still return success to user since message was sent
      console.error("Failed to insert message record:", insertError);

      return NextResponse.json(
        {
          success: true,
          warning: "Message sent but failed to record locally",
          meta_id: metaMessageId,
        },
        { status: 200 }
      );
    }

    // 9. Return success response
    return NextResponse.json(
      {
        success: true,
        message: insertedMessage,
        meta_id: metaMessageId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Send message error:", error);

    // Attempt to log the error if we have supabase client and contact phone
    if (supabase && contactPhone) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await logToAutomationLogs(supabase, contactPhone, "failed", `Exception: ${errorMessage}`);
    }

    // Handle environment variable errors specifically
    if (error instanceof Error && error.message.includes("environment variable")) {
      return NextResponse.json(
        { error: "Server configuration error", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
