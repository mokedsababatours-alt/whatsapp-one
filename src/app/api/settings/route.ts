import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

interface Settings {
  admin_phone: string | null;
  notification_enabled: boolean;
}

interface SettingsRow {
  key: string;
  value: string;
  updated_at: string;
}

// =============================================================================
// Settings Keys
// =============================================================================

const SETTINGS_KEYS = {
  ADMIN_PHONE: "admin_phone",
  NOTIFICATION_ENABLED: "notification_enabled",
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse settings rows into Settings object
 */
function parseSettings(rows: SettingsRow[]): Settings {
  const settings: Settings = {
    admin_phone: null,
    notification_enabled: false,
  };

  for (const row of rows) {
    switch (row.key) {
      case SETTINGS_KEYS.ADMIN_PHONE:
        settings.admin_phone = row.value || null;
        break;
      case SETTINGS_KEYS.NOTIFICATION_ENABLED:
        settings.notification_enabled = row.value === "true";
        break;
    }
  }

  return settings;
}

/**
 * Validate E.164 phone format
 */
function isValidE164(phone: string): boolean {
  // E.164: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

// =============================================================================
// GET Handler - Read Settings
// =============================================================================

export async function GET() {
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

    // Try to read from settings table
    const { data: rows, error: queryError } = await supabase
      .from("settings")
      .select("key, value, updated_at")
      .in("key", [SETTINGS_KEYS.ADMIN_PHONE, SETTINGS_KEYS.NOTIFICATION_ENABLED]);

    // If table doesn't exist, return defaults
    if (queryError) {
      // Table may not exist - return defaults
      console.warn("Settings table query failed:", queryError.message);
      return NextResponse.json({
        admin_phone: null,
        notification_enabled: false,
        _warning: "Settings table not configured",
      });
    }

    const settings = parseSettings(rows || []);

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST Handler - Update Settings
// =============================================================================

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { admin_phone, notification_enabled } = body;

    // Validate admin_phone if provided
    if (admin_phone !== undefined && admin_phone !== null && admin_phone !== "") {
      if (!isValidE164(admin_phone)) {
        return NextResponse.json(
          {
            error: "Invalid phone format",
            message: "Phone number must be in E.164 format (e.g., +972501234567)",
          },
          { status: 400 }
        );
      }
    }

    // Prepare upsert data
    const updates: { key: string; value: string; updated_at: string }[] = [];
    const now = new Date().toISOString();

    if (admin_phone !== undefined) {
      updates.push({
        key: SETTINGS_KEYS.ADMIN_PHONE,
        value: admin_phone || "",
        updated_at: now,
      });
    }

    if (notification_enabled !== undefined) {
      updates.push({
        key: SETTINGS_KEYS.NOTIFICATION_ENABLED,
        value: String(notification_enabled),
        updated_at: now,
      });
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No settings provided to update" },
        { status: 400 }
      );
    }

    // Upsert settings (insert or update on conflict)
    const { error: upsertError } = await supabase
      .from("settings")
      .upsert(updates, { onConflict: "key" });

    if (upsertError) {
      console.error("Settings upsert error:", upsertError);
      return NextResponse.json(
        {
          error: "Failed to save settings",
          message: upsertError.message,
        },
        { status: 500 }
      );
    }

    // Fetch updated settings
    const { data: rows } = await supabase
      .from("settings")
      .select("key, value, updated_at")
      .in("key", [SETTINGS_KEYS.ADMIN_PHONE, SETTINGS_KEYS.NOTIFICATION_ENABLED]);

    const settings = parseSettings(rows || []);

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
