import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface LookupRequest {
  phone: string;
}

interface MetaContactsPayload {
  messaging_product: "whatsapp";
  contacts: string[];
  type: "individual";
}

interface MetaContactsResponse {
  contacts?: Array<{
    input: string;
    wa_id?: string;
    status?: "valid" | "invalid";
  }>;
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

const META_API_VERSION = "v24.0";
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

function isValidE164(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

async function lookupContact(phone: string) {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("META_PHONE_NUMBER_ID or META_ACCESS_TOKEN environment variable not configured");
  }

  const url = `${META_API_BASE_URL}/${phoneNumberId}/contacts`;
  const payload: MetaContactsPayload = {
    messaging_product: "whatsapp",
    contacts: [phone],
    type: "individual",
  };

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

  return { success: true, data: data as MetaContactsResponse };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody: LookupRequest = await request.json();
    if (!requestBody.phone || typeof requestBody.phone !== "string") {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    if (!isValidE164(requestBody.phone)) {
      return NextResponse.json(
        { error: "Invalid phone format", message: "Phone number must be in E.164 format." },
        { status: 400 }
      );
    }

    const metaResult = await lookupContact(requestBody.phone);
    if (!metaResult.success) {
      return NextResponse.json(
        { error: "Failed to verify number", meta_error: metaResult.error?.error },
        { status: 502 }
      );
    }

    const metaContact = metaResult.data?.contacts?.[0];
    const valid = metaContact?.status === "valid";

    return NextResponse.json(
      {
        valid,
        wa_id: metaContact?.wa_id || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contacts lookup error:", error);

    if (error instanceof Error && error.message.includes("environment variable")) {
      return NextResponse.json(
        { error: "Server configuration error", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
