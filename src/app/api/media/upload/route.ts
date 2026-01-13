import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// =============================================================================
// Constants
// =============================================================================

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB per Task 1.2 bucket config

const BUCKET_NAME = "whatsapp-media";

// =============================================================================
// POST Handler - Upload media to Supabase Storage
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Get Supabase client and verify user session
    const supabase = await getSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // 3. Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          message: `Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
          received: file.type,
        },
        { status: 400 }
      );
    }

    // 4. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          message: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          received: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        },
        { status: 400 }
      );
    }

    // 5. Generate unique file path
    const fileExtension = file.name.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const fileName = `${timestamp}-${randomId}.${fileExtension}`;
    const filePath = `outbound/${fileName}`;

    // 6. Convert file to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();

    // 7. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        {
          error: "Upload failed",
          message: uploadError.message,
        },
        { status: 500 }
      );
    }

    // 8. Get public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path);

    // 9. Return success with public URL
    return NextResponse.json(
      {
        success: true,
        url: publicUrlData.publicUrl,
        path: uploadData.path,
        fileName: fileName,
        mimeType: file.type,
        size: file.size,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Media upload error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
