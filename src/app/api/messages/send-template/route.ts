import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MessageInsert } from "@/types/database";

// =============================================================================
// Types
// =============================================================================

interface TemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters?: Array<{
    type: "text" | "currency" | "date_time" | "image" | "document" | "video" | "payload";
    text?: string;
    currency?: {
      fallback_value: string;
      code: string;
      amount_1000: number;
    };
    date_time?: {
      fallback_value: string;
    };
    image?: {
      link: string;
    };
    document?: {
      link: string;
      filename?: string;
    };
    video?: {
      link: string;
    };
    payload?: string;
  }>;
}

interface SendTemplateRequest {
  recipient: string;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
}

interface MetaTemplatePayload {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: TemplateComponent[];
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
 * Build Meta API template message payload
 */
function buildTemplatePayload(
  recipient: string,
  templateName: string,
  languageCode: string,
  components?: TemplateComponent[]
): MetaTemplatePayload {
  const payload: MetaTemplatePayload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  // Only include components if provided and non-empty
  if (components && components.length > 0) {
    payload.template.components = components;
  }

  return payload;
}

/**
 * Send template message to Meta Graph API
 */
async function sendTemplateToMetaAPI(
  payload: MetaTemplatePayload
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

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request body
    const requestBody: SendTemplateRequest = await request.json();

    if (!requestBody.recipient || !requestBody.templateName || !requestBody.languageCode) {
      return NextResponse.json(
        { error: "Missing required fields: recipient, templateName, and languageCode" },
        { status: 400 }
      );
    }

    // Validate template name format (alphanumeric and underscores only)
    const templateNameRegex = /^[a-z0-9_]+$/;
    if (!templateNameRegex.test(requestBody.templateName)) {
      return NextResponse.json(
        { error: "Invalid template name format. Use lowercase letters, numbers, and underscores only." },
        { status: 400 }
      );
    }

    // 2. Get Supabase client and verify user session
    const supabase = await getSupabaseServerClient();

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

    // 3. Check if contact exists (optional - templates can initiate conversations)
    // Note: Unlike free-form messages, templates can be sent even to new contacts
    // But we still want the contact to exist in our system for tracking
    const { data: contact } = await supabase
      .from("contacts")
      .select("phone_number")
      .eq("phone_number", requestBody.recipient)
      .single();

    // If contact doesn't exist, create it
    if (!contact) {
      const { error: insertContactError } = await supabase
        .from("contacts")
        .insert({
          phone_number: requestBody.recipient,
          profile_name: null,
          session_status: "expired", // Will be updated when they reply
          unread_count: 0,
        });

      if (insertContactError) {
        console.error("Failed to create contact:", insertContactError);
        // Continue anyway - the message can still be sent
      }
    }

    // 4. NO SESSION WINDOW CHECK
    // Template messages work even with expired sessions - that's the point!

    // 5. Build and send template to Meta API
    const metaPayload = buildTemplatePayload(
      requestBody.recipient,
      requestBody.templateName,
      requestBody.languageCode,
      requestBody.components
    );

    const metaResult = await sendTemplateToMetaAPI(metaPayload);

    if (!metaResult.success) {
      const errorCode = metaResult.error.error?.code;
      
      // Handle specific Meta API errors
      if (errorCode === 132000) {
        // Template not found
        return NextResponse.json(
          {
            error: "Template not found",
            message: `Template '${requestBody.templateName}' does not exist or is not approved.`,
            meta_error: metaResult.error.error,
          },
          { status: 404 }
        );
      }

      if (errorCode === 132001) {
        // Template parameter mismatch
        return NextResponse.json(
          {
            error: "Invalid template parameters",
            message: "The provided components don't match the template requirements.",
            meta_error: metaResult.error.error,
          },
          { status: 400 }
        );
      }

      if (errorCode === 132005) {
        // Template paused
        return NextResponse.json(
          {
            error: "Template paused",
            message: `Template '${requestBody.templateName}' has been paused due to quality issues.`,
            meta_error: metaResult.error.error,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to send template message",
          meta_error: metaResult.error.error,
        },
        { status: 502 }
      );
    }

    // 6. Extract Meta message ID from response
    const metaMessageId = metaResult.data.messages[0]?.id;

    // 7. Insert message record into database
    const messageInsert: MessageInsert = {
      contact_phone: requestBody.recipient,
      direction: "outbound",
      type: "template",
      body: `Template: ${requestBody.templateName}`,
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
      console.error("Failed to insert message record:", insertError);

      return NextResponse.json(
        {
          success: true,
          warning: "Template sent but failed to record locally",
          meta_id: metaMessageId,
          template_name: requestBody.templateName,
        },
        { status: 200 }
      );
    }

    // 8. Return success response
    return NextResponse.json(
      {
        success: true,
        message: insertedMessage,
        meta_id: metaMessageId,
        template_name: requestBody.templateName,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Send template error:", error);

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
