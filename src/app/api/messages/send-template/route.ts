import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getTemplateByNameAndLanguage,
  buildTemplateDisplayText,
} from "@/lib/templates-cache";
import type { MessageInsert, AutomationLogInsert } from "@/types/database";

// =============================================================================
// Types
// =============================================================================

interface TemplateParameter {
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
}

interface TemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters?: TemplateParameter[];
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
const WORKFLOW_NAME = "ui_send_template";
const TEMPLATE_CATEGORY_COSTS: Partial<Record<string, number>> = {};

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

/**
 * Extract parameters from request components by type
 */
function extractParametersByType(
  components?: TemplateComponent[]
): {
  headerParams?: TemplateParameter[];
  bodyParams?: TemplateParameter[];
} {
  if (!components) return {};

  const headerComponent = components.find((c) => c.type === "header");
  const bodyComponent = components.find((c) => c.type === "body");

  return {
    headerParams: headerComponent?.parameters,
    bodyParams: bodyComponent?.parameters,
  };
}

/**
 * Log action to automation_logs table
 * Wrapped in try-catch to ensure logging failures don't affect the main response
 */
async function logToAutomationLogs(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  contactPhone: string,
  status: "success" | "failed",
  templateName: string,
  errorDetail?: string,
  costEstimate?: number | null
): Promise<void> {
  try {
    const logEntry: AutomationLogInsert = {
      workflow_name: WORKFLOW_NAME,
      contact_phone: contactPhone,
      status: status,
      error_detail: errorDetail || `Template: ${templateName}`,
      cost_estimate: costEstimate ?? null,
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
  let templateName: string | null = null;

  try {
    // 1. Parse and validate request body
    const requestBody: SendTemplateRequest = await request.json();
    contactPhone = requestBody.recipient;
    templateName = requestBody.templateName;

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

    // 3. Fetch template from cache to get body text
    const template = await getTemplateByNameAndLanguage(
      requestBody.templateName,
      requestBody.languageCode
    );
    const templateCostEstimate =
      template?.category ? TEMPLATE_CATEGORY_COSTS[template.category] ?? null : null;

    // 4. Build display text for the template
    let templateBodyText: string;

    if (template) {
      // Extract parameters from request to substitute placeholders
      const { headerParams, bodyParams } = extractParametersByType(requestBody.components);

      // Build full display text with parameter substitution
      templateBodyText = buildTemplateDisplayText(template, headerParams, bodyParams);
    } else {
      // Fallback if template not found in cache (still try to send)
      templateBodyText = `Template: ${requestBody.templateName}`;
    }

    // 5. Check if contact exists (optional - templates can initiate conversations)
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

    // 6. NO SESSION WINDOW CHECK
    // Template messages work even with expired sessions - that's the point!

    // 7. Build and send template to Meta API
    const metaPayload = buildTemplatePayload(
      requestBody.recipient,
      requestBody.templateName,
      requestBody.languageCode,
      requestBody.components
    );

    const metaResult = await sendTemplateToMetaAPI(metaPayload);

    if (!metaResult.success) {
      console.error("Meta template send error:", metaResult.error.error);
      const errorCode = metaResult.error.error?.code;
      const errorMessage = metaResult.error.error?.message || "Meta API error";

      await logToAutomationLogs(
        supabase,
        requestBody.recipient,
        "failed",
        requestBody.templateName,
        `Template "${requestBody.templateName}": Meta API error: ${errorMessage} (code: ${errorCode})`,
        templateCostEstimate
      );
      
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

    // Log successful send to automation_logs
    await logToAutomationLogs(
      supabase,
      requestBody.recipient,
      "success",
      requestBody.templateName,
      undefined,
      templateCostEstimate
    );

    // 8. Extract Meta message ID from response
    const metaMessageId = metaResult.data.messages[0]?.id;

    // 9. Insert message record into database with full template body text
    const messageInsert: MessageInsert = {
      contact_phone: requestBody.recipient,
      direction: "outbound",
      type: "template",
      body: templateBodyText, // Full template text instead of just "Template: {name}"
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
          template_body: templateBodyText,
        },
        { status: 200 }
      );
    }

    // 10. Return success response with full body text for UI display
    return NextResponse.json(
      {
        success: true,
        message: insertedMessage,
        meta_id: metaMessageId,
        template_name: requestBody.templateName,
        template_body: templateBodyText, // Include for UI rendering
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Send template error:", error);

    // Attempt to log the error if we have supabase client and contact/template context
    if (supabase && contactPhone && templateName) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await logToAutomationLogs(
        supabase,
        contactPhone,
        "failed",
        templateName,
        `Template "${templateName}": Exception: ${errorMessage}`
      );
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
