import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Contact } from "@/types/database";

export type ContactFilter = "all" | "unread" | "manual";

interface ListContactsResponse {
  contacts: Contact[];
  totalCount: number;
  hasMore: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const filter = (searchParams.get("filter") || "all") as ContactFilter;

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Invalid limit", message: "Limit must be between 1 and 100" },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        { error: "Invalid offset", message: "Offset must be non-negative" },
        { status: 400 }
      );
    }

    if (!["all", "unread", "manual"].includes(filter)) {
      return NextResponse.json(
        { error: "Invalid filter", message: "Filter must be 'all', 'unread', or 'manual'" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("contacts")
      .select("*", { count: "exact" });

    switch (filter) {
      case "unread":
        query = query.gt("unread_count", 0);
        break;
      case "manual":
        query = query.eq("has_manual_messages", true);
        break;
      case "all":
      default:
        break;
    }

    query = query
      .order("last_interaction_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data: contacts, error: fetchError, count } = await query;

    if (fetchError) {
      console.error("Contacts list fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch contacts", message: fetchError.message },
        { status: 500 }
      );
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    const response: ListContactsResponse = {
      contacts: contacts || [],
      totalCount,
      hasMore,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Contacts list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
