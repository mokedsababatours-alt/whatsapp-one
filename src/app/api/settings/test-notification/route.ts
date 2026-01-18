import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Send test notification message via Meta API
 */
async function sendTestNotification(
  recipientPhone: string
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return {
      success: false,
      error: "META_PHONE_NUMBER_ID or META_ACCESS_TOKEN not configured",
    };
  }

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientPhone,
    type: "text",
    text: {
      preview_url: false,
      body: "🔔 Test Notification\n\nThis is a test notification from your WhatsApp Interface. If you received this message, admin notifications are working correctly!",
    },
  };

  const url = `${META_API_BASE_URL}/${phoneNumberId}/messages`;

  try {
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
      const errorResponse = data as MetaErrorResponse;
      return {
        success: false,
        error: errorResponse.error?.message || "Failed to send message",
      };
    }

    const successResponse = data as MetaSuccessResponse;
    return {
      success: true,
      messageId: successResponse.messages[0]?.id || "unknown",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// =============================================================================
// POST Handler - Send Test Notification
// =============================================================================

export async function POST() {
  try {
    const supabase = await getSupabaseServerClient();

    // Verify user session
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

    // Get admin phone from settings
    const { data: settingsRow, error: settingsError } = await (supabase as any)
      .from("settings")
      .select("value")
      .eq("key", "admin_phone")
      .single();

    if (settingsError || !settingsRow?.value) {
      return NextResponse.json(
        {
          error: "Admin phone not configured",
          message: "Please save an admin phone number first",
        },
        { status: 400 }
      );
    }

    const adminPhone = settingsRow.value;

    // Check if notifications are enabled
    const { data: enabledRow } = await (supabase as any)
      .from("settings")
      .select("value")
      .eq("key", "notification_enabled")
      .single();

    if (enabledRow?.value !== "true") {
      return NextResponse.json(
        {
          error: "Notifications disabled",
          message: "Please enable notifications before testing",
        },
        { status: 400 }
      );
    }

    // Send test notification
    const result = await sendTestNotification(adminPhone);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Failed to send test notification",
          message: result.error,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test notification sent successfully",
      messageId: result.messageId,
      recipient: adminPhone,
    });
  } catch (error) {
    console.error("Test notification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
