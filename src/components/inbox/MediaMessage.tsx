"use client";

import { useState, useCallback } from "react";
import { ImageOff, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

interface MediaMessageProps {
  /** URL of the media content or Meta media ID */
  mediaUrl: string;
  /** Type of media */
  type: "image" | "video" | "audio" | "document";
  /** Optional caption for the media */
  caption?: string | null;
  /** Whether this is an outbound message (affects styling) */
  isOutbound?: boolean;
  /** Message direction - determines if we use proxy or direct URL */
  direction?: "inbound" | "outbound";
}

type LoadingState = "loading" | "loaded" | "error";

/**
 * MediaMessage - Displays media content (images) in conversation
 * Includes loading skeleton, error fallback with retry, and lightbox modal
 */
export function MediaMessage({
  mediaUrl,
  type,
  caption,
  isOutbound = false,
  direction = "outbound",
}: MediaMessageProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Determine if this is a Meta media ID (inbound) or Supabase URL (outbound)
  const isMetaMediaId = direction === "inbound" && !mediaUrl.startsWith("http");
  const imageUrl = isMetaMediaId 
    ? `/api/media/proxy?id=${encodeURIComponent(mediaUrl)}`
    : mediaUrl;

  const handleLoad = useCallback(() => {
    setLoadingState("loaded");
  }, []);

  const handleError = useCallback(() => {
    setLoadingState("error");
  }, []);

  const handleRetry = useCallback(() => {
    setLoadingState("loading");
    setRetryKey((prev) => prev + 1);
  }, []);

  const handleImageClick = useCallback(() => {
    if (loadingState === "loaded") {
      setIsLightboxOpen(true);
    }
  }, [loadingState]);

  // Only handle images for now
  if (type !== "image") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-200/50 rounded-lg">
        <span className="text-sm text-slate-600 italic">
          [{type} message - display not supported]
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        {/* Loading skeleton */}
        {loadingState === "loading" && (
          <div
            className={cn(
              "w-[200px] h-[150px] rounded-xl overflow-hidden",
              "bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200",
              "animate-pulse"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
          </div>
        )}

        {/* Error fallback */}
        {loadingState === "error" && (
          <button
            onClick={handleRetry}
            className={cn(
              "w-[200px] h-[150px] rounded-xl overflow-hidden",
              "bg-slate-100 border border-slate-200",
              "flex flex-col items-center justify-center gap-2",
              "hover:bg-slate-50 transition-colors cursor-pointer"
            )}
          >
            <ImageOff className="h-8 w-8 text-slate-400" />
            <span className="text-xs text-slate-500">Image unavailable</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Click to retry
            </span>
          </button>
        )}

        {/* Image */}
        <img
          key={retryKey}
          src={imageUrl}
          alt={caption || "Media message"}
          onLoad={handleLoad}
          onError={handleError}
          onClick={handleImageClick}
          className={cn(
            "max-w-[300px] rounded-xl object-cover cursor-pointer",
            "hover:opacity-95 transition-opacity",
            loadingState !== "loaded" && "hidden"
          )}
        />

        {/* Caption */}
        {caption && loadingState === "loaded" && (
          <p className="text-sm mt-2 whitespace-pre-wrap">{caption}</p>
        )}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[90vw] max-h-[90vh] w-auto p-0 bg-transparent border-none shadow-none"
        >
          <DialogTitle className="sr-only">
            {caption || "Image preview"}
          </DialogTitle>
          <div className="relative">
            {/* Close button */}
            <DialogClose
              className={cn(
                "absolute -top-10 right-0 z-10",
                "p-2 rounded-full bg-black/60 text-white",
                "hover:bg-black/80 transition-colors"
              )}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogClose>

            {/* Full-size image */}
            <img
              src={imageUrl}
              alt={caption || "Media message"}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            />

            {/* Caption in lightbox */}
            {caption && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg">
                <p className="text-white text-sm">{caption}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
