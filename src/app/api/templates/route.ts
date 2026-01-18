import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  isCacheValid,
  getCachedTemplates,
  getCacheTimestamp,
  fetchAndCacheTemplates,
} from "@/lib/templates-cache";

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
      const cachedData = getCachedTemplates();
      const timestamp = getCacheTimestamp();
      
      return NextResponse.json(
        {
          success: true,
          templates: cachedData,
          cached: true,
          lastSync: new Date(timestamp).toISOString(),
          count: cachedData?.length || 0,
        },
        { status: 200 }
      );
    }

    // 4. Fetch from Meta API
    const result = await fetchAndCacheTemplates();

    if (!result.success) {
      const metaError = result.error?.error;
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

    // 5. Return templates (cache already updated by fetchAndCacheTemplates)
    const timestamp = getCacheTimestamp();
    
    return NextResponse.json(
      {
        success: true,
        templates: result.data,
        cached: false,
        lastSync: new Date(timestamp).toISOString(),
        count: result.data?.length || 0,
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
