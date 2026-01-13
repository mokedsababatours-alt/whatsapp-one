import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{
      type: string;
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

interface MetaTemplatesResponse {
  data: MetaTemplate[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
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

interface TemplateListItem {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components?: MetaTemplate["components"];
}

// =============================================================================
// Constants
// =============================================================================

const META_API_VERSION = "v18.0";
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Simple in-memory cache for templates
let templatesCache: {
  data: TemplateListItem[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// Cache duration: 5 minutes (templates don't change often)
const CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Get last sync timestamp in ISO format
 */
export function getLastSyncTimestamp(): string | null {
  return templatesCache.timestamp ? new Date(templatesCache.timestamp).toISOString() : null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  return (
    templatesCache.data !== null &&
    Date.now() - templatesCache.timestamp < CACHE_DURATION_MS
  );
}

/**
 * Fetch templates from Meta API
 */
async function fetchTemplatesFromMeta(): Promise<
  { success: true; data: TemplateListItem[] } | { success: false; error: MetaErrorResponse }
> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const wabaId = process.env.META_WABA_ID;

  if (!accessToken) {
    throw new Error("META_ACCESS_TOKEN environment variable not configured");
  }

  if (!wabaId) {
    throw new Error("META_WABA_ID environment variable is required for fetching templates. Templates must be fetched from the WhatsApp Business Account ID, not the Phone Number ID. Please add META_WABA_ID to your .env.local file.");
  }

  // Templates endpoint requires WABA ID, not Phone Number ID
  const url = `${META_API_BASE_URL}/${wabaId}/message_templates?fields=id,name,language,status,category,components`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data as MetaErrorResponse };
  }

  const templatesResponse = data as MetaTemplatesResponse;

  // Filter to only APPROVED templates
  const approvedTemplates: TemplateListItem[] = templatesResponse.data
    .filter((template) => template.status === "APPROVED")
    .map((template) => ({
      id: template.id,
      name: template.name,
      language: template.language,
      category: template.category,
      status: template.status,
      components: template.components,
    }));

  return { success: true, data: approvedTemplates };
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: NextRequest) {
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

    // 2. Check for force refresh query param
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get("refresh") === "true";

    // 3. Check cache first (unless force refresh)
    if (!forceRefresh && isCacheValid()) {
      return NextResponse.json(
        {
          success: true,
          templates: templatesCache.data,
          cached: true,
          lastSync: new Date(templatesCache.timestamp).toISOString(),
          count: templatesCache.data?.length || 0,
        },
        { status: 200 }
      );
    }

    // 4. Fetch from Meta API
    const result = await fetchTemplatesFromMeta();

    if (!result.success) {
      const metaError = result.error.error;
      const errorMessage = metaError?.message || "Failed to fetch templates from Meta API";
      
      return NextResponse.json(
        {
          error: "Failed to fetch templates",
          message: errorMessage,
          meta_error: metaError,
        },
        { status: 502 }
      );
    }

    // 5. Update cache
    templatesCache = {
      data: result.data,
      timestamp: Date.now(),
    };

    // 6. Return templates
    return NextResponse.json(
      {
        success: true,
        templates: result.data,
        cached: false,
        lastSync: new Date(templatesCache.timestamp).toISOString(),
        count: result.data.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Fetch templates error:", error);

    // Handle environment variable errors specifically
    if (error instanceof Error && error.message.includes("environment variable")) {
      return NextResponse.json(
        { error: "Server configuration error", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}
