"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ContactList } from "@/components/inbox/ContactList";
import { ConversationView } from "@/components/inbox/ConversationView";
import { TemplateSelector } from "@/components/inbox/TemplateSelector";
import { useContacts } from "@/hooks/useContacts";
import { useMessages } from "@/hooks/useMessages";
import type { Contact, Message } from "@/types";

// =============================================================================
// API Response Types
// =============================================================================

interface SendMessageResponse {
  success: boolean;
  message?: Message;
  meta_id?: string;
  warning?: string;
}

interface SendMessageErrorResponse {
  error: string;
  message?: string;
  session_status?: string;
}

interface UploadMediaResponse {
  success: boolean;
  url: string;
  path?: string;
}

interface UploadMediaErrorResponse {
  error: string;
  message?: string;
}

// =============================================================================
// Inbox Page Component
// =============================================================================

export default function InboxPage() {
  const router = useRouter();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);

  // Fetch real contacts from Supabase
  const {
    contacts,
    isLoading: isLoadingContacts,
    error: contactsError,
    realtimeError: contactsRealtimeError,
    refetch: refetchContacts,
  } = useContacts();

  // Fetch messages for selected contact
  const {
    messages,
    isLoading: isLoadingMessages,
    error: messagesError,
    realtimeError: messagesRealtimeError,
    refetch: refetchMessages,
  } = useMessages(selectedContact?.phone_number || null);

  // Mark messages as read when a contact is selected
  useEffect(() => {
    if (!selectedContact) {
      return;
    }

    // Call mark-read API whenever a contact is selected (even if unread_count is 0)
    // This ensures messages are marked as read when viewing the conversation
    const markAsRead = async () => {
      try {
        const response = await fetch("/api/messages/mark-read", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contactPhone: selectedContact.phone_number,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Failed to mark messages as read:", errorData.error || "Unknown error");
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };

    // Small delay to ensure messages are loaded first
    const timeoutId = setTimeout(() => {
      markAsRead();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedContact?.phone_number]); // Only run when contact changes

  // Handle contact selection
  const handleSelectContact = useCallback((contact: Contact) => {
    setSelectedContact(contact);
  }, []);

  const handleStartNewChat = useCallback(async (phoneNumber: string) => {
    setSelectedContact({
      phone_number: phoneNumber,
      profile_name: null,
      last_interaction_at: null,
      session_status: "expired",
      unread_count: 0,
      created_at: new Date().toISOString(),
    });
    return true;
  }, []);

  // Handle sending a text message with optimistic update
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedContact) return;

      const contactPhone = selectedContact.phone_number;

      try {
        // Call send API
        const response = await fetch("/api/messages/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: contactPhone,
            body: text,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Handle error responses
          const errorData = data as SendMessageErrorResponse;

          // Show appropriate error toast
          switch (response.status) {
            case 400:
              if (errorData.session_status === "expired") {
                toast.error("Session expired. Send a template to continue.", {
                  description: "The 24-hour messaging window has closed.",
                });
              } else {
                toast.error(errorData.error || "Invalid request", {
                  description: errorData.message,
                });
              }
              break;

            case 401:
              toast.error("Please sign in again", {
                description: "Your session has expired.",
              });
              // Redirect to login
              router.push("/login");
              break;

            case 404:
              toast.error("Contact not found", {
                description: "The recipient is not in your contacts.",
              });
              break;

            case 502:
            case 500:
            default:
              toast.error("Failed to send message", {
                description: "Please try again later.",
              });
              break;
          }

          return;
        }

        // Success - message will be updated via realtime subscription from useMessages hook
        const successData = data as SendMessageResponse;

        // Show warning if there was one (message sent but not recorded)
        if (successData.warning) {
          toast.warning("Message sent", {
            description: successData.warning,
          });
        }
      } catch (error) {
        // Network or unexpected error
        console.error("Send message error:", error);

        toast.error("Failed to send message", {
          description: "Please check your connection and try again.",
        });
      }
    },
    [selectedContact, router]
  );

  // Handle sending an image with optimistic update
  const handleSendImage = useCallback(
    async (file: File, caption?: string) => {
      if (!selectedContact) return;

      const contactPhone = selectedContact.phone_number;

      // Create local preview URL for optimistic update
      const localPreviewUrl = URL.createObjectURL(file);

      // Optimistic update will be handled by useMessages hook via realtime subscription

      try {
        // Step 1: Upload to Supabase Storage
        toast.info("Uploading image...");

        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok) {
          const errorData = uploadData as UploadMediaErrorResponse;
          throw new Error(errorData.message || errorData.error || "Upload failed");
        }

        const uploadSuccess = uploadData as UploadMediaResponse;

        // Step 2: Send image via WhatsApp
        toast.info("Sending image...");

        const sendResponse = await fetch("/api/messages/send-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: contactPhone,
            mediaUrl: uploadSuccess.url,
            caption: caption,
          }),
        });

        const sendData = await sendResponse.json();

        if (!sendResponse.ok) {
          const errorData = sendData as SendMessageErrorResponse;

          // Show appropriate error toast
          if (errorData.session_status === "expired") {
            toast.error("Session expired. Send a template to continue.", {
              description: "The 24-hour messaging window has closed.",
            });
          } else if (sendResponse.status === 401) {
            toast.error("Please sign in again", {
              description: "Your session has expired.",
            });
            router.push("/login");
          } else {
            toast.error(errorData.error || "Failed to send image", {
              description: errorData.message,
            });
          }

          return;
        }

        // Success - message will be updated via realtime subscription from useMessages hook
        const successData = sendData as SendMessageResponse;

        toast.success("Image sent");

        // Cleanup local preview URL
        URL.revokeObjectURL(localPreviewUrl);

        // Show warning if there was one
        if (successData.warning) {
          toast.warning("Image sent", {
            description: successData.warning,
          });
        }
      } catch (error) {
        console.error("Send image error:", error);

        toast.error("Failed to send image", {
          description: error instanceof Error ? error.message : "Please try again later.",
        });

        // Cleanup local preview URL
        URL.revokeObjectURL(localPreviewUrl);
      }
    },
    [selectedContact, router]
  );

  // Handle template selection - opens TemplateSelector modal
  const handleSendTemplate = useCallback(() => {
    if (!selectedContact) {
      toast.error("No contact selected");
      return;
    }
    setIsTemplateSelectorOpen(true);
  }, [selectedContact]);

  // Handle successful template send
  const handleTemplateSent = useCallback(
    (message: Message) => {
      // Message will be added via realtime subscription from useMessages hook
      if (!selectedContact) return;
    },
    [selectedContact]
  );

  // Hard error: initial fetch failed (no contacts at all)
  const hasContactsHardError = contactsError && !isLoadingContacts && contacts.length === 0;
  if (hasContactsHardError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="text-center">
          <p className="text-red-600 mb-2 font-medium">Failed to load contacts</p>
          <p className="text-sm text-slate-500 mb-4">{contactsError}</p>
          <button
            onClick={() => refetchContacts()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Soft error: realtime failed but we have cached contacts - show banner
  const hasRealtimeIssue = contactsRealtimeError || messagesRealtimeError;
  const handleRetry = useCallback(() => {
    refetchContacts();
    if (selectedContact) {
      refetchMessages();
    }
  }, [refetchContacts, refetchMessages, selectedContact]);

  return (
    <>
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Realtime connection warning banner - non-blocking */}
        {hasRealtimeIssue && (
          <div className="flex flex-shrink-0 items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
            <span>
              {contactsRealtimeError && messagesRealtimeError
                ? "Connection issues – some updates may be delayed."
                : contactsRealtimeError || messagesRealtimeError}
            </span>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-200 px-3 py-1.5 text-amber-900 hover:bg-amber-300 transition-colors font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}
        {/* Main content: Contact List + Conversation View */}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          <ContactList
            contacts={contacts}
            selectedContact={selectedContact}
            onSelectContact={handleSelectContact}
            onStartNewChat={handleStartNewChat}
          />
          <ConversationView
            selectedContact={selectedContact}
            messages={messages}
            onSendMessage={handleSendMessage}
            onSendImage={handleSendImage}
            onSendTemplate={handleSendTemplate}
          />
        </div>
      </div>

      {/* Template Selector Modal */}
      {selectedContact && (
        <TemplateSelector
          open={isTemplateSelectorOpen}
          onOpenChange={setIsTemplateSelectorOpen}
          recipient={selectedContact.phone_number}
          onSuccess={handleTemplateSent}
        />
      )}
    </>
  );
}
