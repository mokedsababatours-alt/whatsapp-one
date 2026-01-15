"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck, FileText } from "lucide-react";
import { MediaMessage } from "./MediaMessage";
import type { MessageBubbleProps } from "@/types";

/**
 * Format timestamp to display time (e.g., "2:30 PM")
 */
function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get status indicator for outbound messages
 */
function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <span className="text-slate-400" title="Sending...">
          <Check className="h-3.5 w-3.5" />
        </span>
      );
    case "sent":
      return (
        <span className="text-slate-400" title="Sent">
          <Check className="h-3.5 w-3.5" />
        </span>
      );
    case "delivered":
      return (
        <span className="text-slate-400" title="Delivered">
          <CheckCheck className="h-3.5 w-3.5" />
        </span>
      );
    case "read":
      return (
        <span className="text-blue-500" title="Read">
          <CheckCheck className="h-3.5 w-3.5" />
        </span>
      );
    case "failed":
      return (
        <span className="text-red-500 text-xs font-medium" title="Failed">
          Failed
        </span>
      );
    default:
      return null;
  }
}

/**
 * MessageBubble - Displays a single message in the conversation
 * Inbound messages align left with grey background
 * Outbound messages align right with green background
 * Supports text and image messages
 */
export function MessageBubble({
  message,
  showTimestamp = true,
  showStatus = true,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isAutomation = message.source !== "manual_ui";
  const isImageMessage = message.type === "image" && message.media_url;
  const isTemplateMessage = message.type === "template";

  return (
    <div
      className={cn(
        "flex flex-col max-w-[75%]",
        isOutbound ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {/* Automation source badge */}
      {isAutomation && isOutbound && (
        <span className="text-xs text-slate-400 mb-1 flex items-center gap-1">
          <span>🤖</span>
          <span>{message.source}</span>
        </span>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          "rounded-2xl break-words",
          isImageMessage ? "p-1" : "px-4 py-2",
          isOutbound
            ? "bg-emerald-50 text-slate-900 rounded-br-md"
            : "bg-slate-100 text-slate-900 rounded-bl-md"
        )}
      >
        {/* Image message */}
        {isImageMessage ? (
          <MediaMessage
            mediaUrl={message.media_url!}
            type="image"
            caption={message.body}
            isOutbound={isOutbound}
          />
        ) : (
          <>
            {isTemplateMessage && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full mb-1">
                <FileText className="h-3 w-3" />
                Template
              </span>
            )}
            {/* Text message body */}
            {message.body && (
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
            )}

            {/* Unsupported media type indicator */}
            {message.type !== "text" && !message.body && (
              <p className="text-sm italic text-slate-500">
                [{message.type} message]
              </p>
            )}
          </>
        )}
      </div>

      {/* Timestamp and status row */}
      {(showTimestamp || (showStatus && isOutbound)) && (
        <div className="flex items-center gap-1.5 mt-1 px-1">
          {showTimestamp && (
            <span className="text-xs text-slate-400">
              {formatMessageTime(message.created_at)}
            </span>
          )}
          {showStatus && isOutbound && (
            <StatusIndicator status={message.status} />
          )}
        </div>
      )}
    </div>
  );
}
