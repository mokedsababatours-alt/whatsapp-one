import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSessionActive } from "@/lib/session";
import type { MessageInsert } from "@/types/database";

// =============================================================================
// Types
// =============================================================================

interface SendImageRequest {
  recipient: string;
  mediaUrl: string;
  caption?: string;
}

interface MetaMediaUploadResponse {
  id: string;
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
 * Upload image to Meta's media endpoint
 * Downloads from Supabase URL and uploads to Meta
 */
async function uploadToMetaMedia(
  imageUrl: string
): Promise<
  { success: true; mediaId: string } | { success: false; error: string }
> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "META_PHONE_NUMBER_ID or META_ACCESS_TOKEN environment variable not configured"
    );
  }

  try {
    // Download the image from Supabase
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { success: false, error: "Failed to fetch image from storage" };
    }

    const imageBlob = await imageResponse.blob();
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Create form data for Meta upload
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("file", imageBlob, "image.jpg");
    formData.append("type", contentType);

    // Upload to Meta
    const url = `${META_API_BASE_URL}/${phoneNumberId}/media`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as MetaErrorResponse;
      return {
        success: false,
        error: errorData.error?.message || "Failed to upload to Meta",
      };
    }

    const uploadData = data as MetaMediaUploadResponse;
    return { success: true, mediaId: uploadData.id };
  } catch (error) {
    console.error("Meta media upload error:", error);
    return { success: false, error: "Failed to upload media to Meta" };
  }
}

/**
 * Send image message via Meta Graph API
 */
async function sendImageMessage(
  recipient: string,
  mediaId: string,
  caption?: string
): Promise<
  { success: true; data: MetaSuccessResponse } | { success: false; error: MetaErrorResponse }
> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "META_PHONE_NUMBER_ID or META_ACCESS_TOKEN environment variable not configured"
    );
  }

  const url = `${META_API_BASE_URL}/${phoneNumberId}/messages`;

  const payload: {
    messaging_product: "whatsapp";
    recipient_type: "individual";
    to: string;
    type: "image";
    image: { id: string; caption?: string };
  } = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "image",
    image: {
      id: mediaId,
    },
  };

  // Add caption if provided
  if (caption) {
    payload.image.caption = caption;
  }

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
    const requestBody: SendImageRequest = await request.json();

    if (!requestBody.recipient || !requestBody.mediaUrl) {
      return NextResponse.json(
        { error: "Missing required fields: recipient and mediaUrl" },
        { status: 400 }
      );
    }

    // Validate caption length if provided
    if (requestBody.caption && requestBody.caption.length > 1024) {
      return NextResponse.json(
        { error: "Caption exceeds maximum length of 1024 characters" },
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
          message:
            "The recipient is not in your contacts. They must send you a message first.",
        },
        { status: 404 }
      );
    }

    // 4. Validate 24-hour session window
    if (!isSessionActive(contact.last_interaction_at)) {
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

    // 5. Upload image to Meta's media endpoint
    const uploadResult = await uploadToMetaMedia(requestBody.mediaUrl);

    if (!uploadResult.success) {
      return NextResponse.json(
        {
          error: "Failed to upload media",
          message: uploadResult.error,
        },
        { status: 502 }
      );
    }

    // 6. Send image message via Meta
    const sendResult = await sendImageMessage(
      requestBody.recipient,
      uploadResult.mediaId,
      requestBody.caption
    );

    if (!sendResult.success) {
      // Check for session window error from Meta (error code 131047)
      const isSessionError = sendResult.error.error?.code === 131047;

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
            meta_error: sendResult.error.error,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to send image",
          meta_error: sendResult.error.error,
        },
        { status: 502 }
      );
    }

    // 7. Extract Meta message ID from response
    const metaMessageId = sendResult.data.messages[0]?.id;

    // 8. Insert message record into database
    const messageInsert: MessageInsert = {
      contact_phone: requestBody.recipient,
      direction: "outbound",
      type: "image",
      body: requestBody.caption || null,
      media_url: requestBody.mediaUrl,
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
          warning: "Image sent but failed to record locally",
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
    console.error("Send image error:", error);

    // Handle environment variable errors specifically
    if (
      error instanceof Error &&
      error.message.includes("environment variable")
    ) {
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
