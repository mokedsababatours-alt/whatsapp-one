"use client";

import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from "react";
import { Send, Paperclip, FileText, Clock, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  /** Whether the 24-hour session is active */
  isSessionActive: boolean;
  /** Whether a message is currently being sent */
  isSending?: boolean;
  /** Whether an image is currently being uploaded */
  isUploadingImage?: boolean;
  /** Handler for sending a text message */
  onSend: (text: string) => void;
  /** Handler for sending an image */
  onSendImage?: (file: File, caption?: string) => void;
  /** Handler for sending a template (when session is expired) */
  onSendTemplate?: () => void;
  /** Whether input is disabled (separate from session status) */
  disabled?: boolean;
  /** Placeholder text override */
  placeholder?: string;
}

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

/**
 * MessageInput - Message composer with session-aware states
 * 
 * Active session: Enabled textarea with send button and image attachment
 * Expired session: Disabled state with template button
 */
export function MessageInput({
  isSessionActive,
  isSending = false,
  isUploadingImage = false,
  onSend,
  onSendImage,
  onSendTemplate,
  disabled = false,
  placeholder,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if input should be disabled
  const isDisabled = disabled || isSending || isUploadingImage || !isSessionActive;
  const isProcessing = isSending || isUploadingImage;

  // Handle file selection
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      alert(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setSelectedImage(file);
    setImagePreview(previewUrl);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Handle clearing selected image
  const handleClearImage = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
  }, [imagePreview]);

  // Handle attachment button click
  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle send action
  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim();

    // If there's a selected image, send it with optional caption
    if (selectedImage && onSendImage) {
      onSendImage(selectedImage, trimmedMessage || undefined);
      setMessage("");
      handleClearImage();
      textareaRef.current?.focus();
      return;
    }

    // Otherwise, send text message
    if (!trimmedMessage || isDisabled) return;

    onSend(trimmedMessage);
    setMessage("");
    
    // Focus textarea after send
    textareaRef.current?.focus();
  }, [message, selectedImage, isDisabled, onSend, onSendImage, handleClearImage]);

  // Handle keyboard events (Enter to send, Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Handle template button click
  const handleTemplateClick = useCallback(() => {
    onSendTemplate?.();
  }, [onSendTemplate]);

  // Cleanup preview URL on unmount
  const clearImageRef = useRef(handleClearImage);
  clearImageRef.current = handleClearImage;

  // Expired session overlay
  if (!isSessionActive) {
    return (
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="max-w-3xl mx-auto">
          {/* Expired session message */}
          <div className="flex flex-col items-center justify-center py-4 px-6 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 mb-3">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Window Closed</span>
            </div>
            <p className="text-sm text-amber-600 text-center mb-4">
              The 24-hour session has expired. Send a template message to reopen the conversation.
            </p>
            <Button
              onClick={handleTemplateClick}
              variant="outline"
              className="bg-white border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
            >
              <FileText className="h-4 w-4 mr-2" />
              Select Template
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active session input
  return (
    <div className="border-t border-slate-200 bg-white p-4">
      {/* Image preview */}
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Selected image preview"
              className="max-h-32 rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={handleClearImage}
              disabled={isProcessing}
              className={cn(
                "absolute -top-2 -right-2 p-1 rounded-full bg-slate-800 text-white",
                "hover:bg-slate-700 transition-colors",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
            {isUploadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Select image to upload"
        />

        {/* Attachment button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleAttachmentClick}
              disabled={isProcessing || !onSendImage}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                onSendImage && !isProcessing
                  ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
              )}
              aria-label="Attach image"
            >
              {selectedImage ? (
                <ImageIcon className="h-5 w-5 text-emerald-600" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{onSendImage ? "Attach image" : "Attachments coming soon"}</p>
          </TooltipContent>
        </Tooltip>

        {/* Template button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleTemplateClick}
              disabled={isProcessing || !onSendTemplate}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                onSendTemplate && !isProcessing
                  ? "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                  : "bg-slate-50 border border-slate-200 text-slate-300 cursor-not-allowed opacity-60"
              )}
              aria-label="Send template"
            >
              <FileText className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{onSendTemplate ? "Send template" : "Templates unavailable"}</p>
          </TooltipContent>
        </Tooltip>

        {/* Message textarea */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedImage ? "Add a caption (optional)..." : (placeholder || "Type a message...")}
            disabled={isDisabled}
            rows={1}
            className={cn(
              "resize-none min-h-[44px] max-h-[120px] py-3 px-4 rounded-2xl",
              "bg-slate-100 border-0 focus-visible:ring-2 focus-visible:ring-emerald-500",
              "placeholder:text-slate-400 text-slate-900",
              isDisabled && "opacity-60 cursor-not-allowed"
            )}
          />
        </div>

        {/* Send button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleSend}
              disabled={isDisabled || (!message.trim() && !selectedImage)}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                (message.trim() || selectedImage) && !isDisabled
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
              aria-label="Send message"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>
              {isProcessing
                ? isUploadingImage
                  ? "Uploading..."
                  : "Sending..."
                : selectedImage
                ? "Send image"
                : "Send message (Enter)"}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Helper text */}
      <p className="text-xs text-slate-400 text-center mt-2 max-w-3xl mx-auto">
        {selectedImage
          ? "Press Enter to send image, or click × to cancel"
          : "Press Enter to send, Shift+Enter for new line"}
      </p>
    </div>
  );
}
