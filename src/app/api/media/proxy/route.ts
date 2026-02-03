import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const META_API_VERSION = "v24.0";
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is authenticated
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get media_id from query params
    const searchParams = request.nextUrl.searchParams;
    const mediaId = searchParams.get("id");

    if (!mediaId) {
      return NextResponse.json(
        { error: "Missing media_id parameter" },
        { status: 400 }
      );
    }

    // 3. Fetch media URL from Meta
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("META_ACCESS_TOKEN not configured");
    }

    const metaMediaResponse = await fetch(
      `${META_API_BASE_URL}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!metaMediaResponse.ok) {
      if (metaMediaResponse.status === 404) {
        return NextResponse.json(
          { error: "Media expired or not found" },
          { status: 404 }
        );
      }
      throw new Error(`Meta API error: ${metaMediaResponse.status}`);
    }

    const mediaData = await metaMediaResponse.json();
    const mediaUrl = mediaData.url;
    const mimeType = mediaData.mime_type || "image/jpeg";

    // 4. Download image from Meta's URL
    const imageResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    // 5. Stream image to browser
    const imageBlob = await imageResponse.blob();
    const buffer = await imageBlob.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 }
    );
  }
}
