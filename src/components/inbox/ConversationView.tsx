"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { MessageSquare } from "lucide-react";
import { ConversationHeader } from "./ConversationHeader";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { isSessionActive } from "@/lib/session";
import type { Contact, Message } from "@/types";

interface ConversationViewProps {
  /** Currently selected contact, or null if none selected */
  selectedContact: Contact | null;
  /** Messages for the selected contact */
  messages: Message[];
  /** Callback when a text message is sent */
  onSendMessage?: (text: string) => void;
  /** Callback when an image is sent */
  onSendImage?: (file: File, caption?: string) => void;
  /** Callback when template button is clicked */
  onSendTemplate?: () => void;
}

/**
 * ConversationView - Main conversation display component
 * Shows header, scrollable messages, and input area
 */
export function ConversationView({
  selectedContact,
  messages,
  onSendMessage,
  onSendImage,
  onSendTemplate,
}: ConversationViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Auto-scroll to bottom when messages change or contact changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedContact?.phone_number]);

  // Handle send text message
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!onSendMessage) {
        return;
      }

      setIsSending(true);
      try {
        await onSendMessage(text);
      } finally {
        setIsSending(false);
      }
    },
    [onSendMessage]
  );

  // Handle send image
  const handleSendImage = useCallback(
    async (file: File, caption?: string) => {
      if (!onSendImage) {
        return;
      }

      setIsUploadingImage(true);
      try {
        await onSendImage(file, caption);
      } finally {
        setIsUploadingImage(false);
      }
    },
    [onSendImage]
  );

  // Handle template selection
  const handleSendTemplate = useCallback(() => {
    if (onSendTemplate) {
      onSendTemplate();
    }
  }, [onSendTemplate]);

  // No contact selected - show empty state
  if (!selectedContact) {
    return (
      <div className="flex flex-1 flex-col bg-white">
        <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
          <div className="rounded-full bg-emerald-100 p-6 mb-4">
            <MessageSquare className="h-12 w-12 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Inbox View
          </h2>
          <p className="text-slate-500 max-w-sm">
            Select a conversation from the list to view messages, or wait for
            incoming WhatsApp messages.
          </p>
        </div>
      </div>
    );
  }

  // Calculate session status using centralized utility
  const sessionActive = isSessionActive(selectedContact.last_interaction_at);

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* Header */}
      <ConversationHeader contact={selectedContact} />

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 bg-slate-50/50"
      >
        {messages.length > 0 ? (
          <div className="flex flex-col gap-3 max-w-3xl mx-auto">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                showTimestamp={true}
                showStatus={true}
              />
            ))}
          </div>
        ) : (
          // No messages state
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="rounded-full bg-slate-100 p-4 mb-3">
              <MessageSquare className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              No messages yet
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Start the conversation by sending a message
            </p>
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        isSessionActive={sessionActive}
        isSending={isSending}
        isUploadingImage={isUploadingImage}
        onSend={handleSendMessage}
        onSendImage={onSendImage ? handleSendImage : undefined}
        onSendTemplate={handleSendTemplate}
      />
    </div>
  );
}
