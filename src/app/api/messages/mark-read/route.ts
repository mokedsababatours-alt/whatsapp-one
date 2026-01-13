import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/messages/mark-read
 * Marks all inbound messages for a contact as read and resets unread_count
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify user session
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

    // 2. Parse request body
    const body = await request.json();
    const { contactPhone } = body;

    if (!contactPhone || typeof contactPhone !== "string") {
      return NextResponse.json(
        { error: "contactPhone is required" },
        { status: 400 }
      );
    }

    // 3. Mark all inbound messages as read (only update pending, sent, or delivered messages)
    // This excludes messages already marked as read or failed
    const { error: updateMessagesError } = await supabase
      .from("messages")
      .update({ status: "read" })
      .eq("contact_phone", contactPhone)
      .eq("direction", "inbound")
      .in("status", ["pending", "sent", "delivered"]); // Only update unread messages

    if (updateMessagesError) {
      console.error("Error updating messages:", updateMessagesError);
      return NextResponse.json(
        { error: "Failed to mark messages as read", details: updateMessagesError.message },
        { status: 500 }
      );
    }

    // 4. Reset unread_count to 0
    const { error: updateContactError } = await supabase
      .from("contacts")
      .update({ unread_count: 0 })
      .eq("phone_number", contactPhone);

    if (updateContactError) {
      console.error("Error updating contact:", updateContactError);
      return NextResponse.json(
        { error: "Failed to update unread count" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
