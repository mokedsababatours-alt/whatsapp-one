"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ContactList } from "@/components/inbox/ContactList";
import { ConversationView } from "@/components/inbox/ConversationView";
import { TemplateSelector } from "@/components/inbox/TemplateSelector";
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
// Mock Data - For testing contact list functionality
// =============================================================================

const MOCK_CONTACTS: Contact[] = [
  {
    phone_number: "+972501234567",
    profile_name: "Sarah Cohen",
    last_interaction_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    session_status: "active",
    unread_count: 3,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    phone_number: "+972502345678",
    profile_name: "David Levi",
    last_interaction_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    session_status: "active",
    unread_count: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
  {
    phone_number: "+972503456789",
    profile_name: "Maya Rosenberg",
    last_interaction_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), // 20 hours ago
    session_status: "active",
    unread_count: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    phone_number: "+972504567890",
    profile_name: "Yosef Mizrahi",
    last_interaction_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), // 30 hours ago (expired)
    session_status: "expired",
    unread_count: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
  },
  {
    phone_number: "+972505678901",
    profile_name: "Noa Friedman",
    last_interaction_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    session_status: "expired",
    unread_count: 5,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    phone_number: "+972506789012",
    profile_name: "Avi Goldstein",
    last_interaction_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    session_status: "expired",
    unread_count: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  },
  {
    phone_number: "+972507890123",
    profile_name: null, // No profile name - will show phone number
    last_interaction_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    session_status: "active",
    unread_count: 2,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    phone_number: "+972508901234",
    profile_name: "Rivka Abramovich",
    last_interaction_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), // 5 days ago
    session_status: "expired",
    unread_count: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
  },
];

// =============================================================================
// Initial Mock Messages - For testing conversation view functionality
// =============================================================================

const INITIAL_MOCK_MESSAGES: Record<string, Message[]> = {
  "+972501234567": [
    {
      id: "msg-1",
      contact_phone: "+972501234567",
      direction: "inbound",
      type: "text",
      body: "Hi! I'm interested in your product. Can you tell me more about the pricing?",
      media_url: null,
      meta_id: "wamid.1",
      status: "read",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: "msg-2",
      contact_phone: "+972501234567",
      direction: "outbound",
      type: "text",
      body: "Hello Sarah! Thanks for reaching out. Our pricing starts at $99/month for the basic plan.",
      media_url: null,
      meta_id: "wamid.2",
      status: "read",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    },
    {
      id: "msg-3",
      contact_phone: "+972501234567",
      direction: "inbound",
      type: "text",
      body: "That sounds reasonable. Do you offer any discounts for annual subscriptions?",
      media_url: null,
      meta_id: "wamid.3",
      status: "read",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "msg-4",
      contact_phone: "+972501234567",
      direction: "outbound",
      type: "text",
      body: "Yes! We offer 20% off for annual billing. Would you like me to send you a detailed quote?",
      media_url: null,
      meta_id: "wamid.4",
      status: "delivered",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "msg-5",
      contact_phone: "+972501234567",
      direction: "inbound",
      type: "text",
      body: "Yes please, that would be great!",
      media_url: null,
      meta_id: "wamid.5",
      status: "read",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
    {
      id: "msg-6",
      contact_phone: "+972501234567",
      direction: "outbound",
      type: "text",
      body: "I've prepared a quote for you based on your requirements. Let me know if you have any questions!",
      media_url: null,
      meta_id: "wamid.6",
      status: "sent",
      source: "quote_workflow",
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
  ],
  "+972502345678": [
    {
      id: "msg-7",
      contact_phone: "+972502345678",
      direction: "inbound",
      type: "text",
      body: "Hi, I need help with my account",
      media_url: null,
      meta_id: "wamid.7",
      status: "read",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: "msg-8",
      contact_phone: "+972502345678",
      direction: "outbound",
      type: "text",
      body: "Hello David! I'd be happy to help. What seems to be the issue?",
      media_url: null,
      meta_id: "wamid.8",
      status: "read",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2.5).toISOString(),
    },
    {
      id: "msg-9",
      contact_phone: "+972502345678",
      direction: "inbound",
      type: "text",
      body: "I can't login to the dashboard. It keeps saying invalid credentials.",
      media_url: null,
      meta_id: "wamid.9",
      status: "read",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2.3).toISOString(),
    },
    {
      id: "msg-10",
      contact_phone: "+972502345678",
      direction: "outbound",
      type: "text",
      body: "I've reset your password. You should receive an email with instructions shortly. Please let me know if you need anything else!",
      media_url: null,
      meta_id: "wamid.10",
      status: "read",
      source: "support_workflow",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ],
  "+972503456789": [
    {
      id: "msg-11",
      contact_phone: "+972503456789",
      direction: "outbound",
      type: "text",
      body: "Hi Maya! Just following up on our conversation from last week. Have you had a chance to review the proposal?",
      media_url: null,
      meta_id: "wamid.11",
      status: "delivered",
      source: "followup_workflow",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    },
  ],
  "+972504567890": [
    {
      id: "msg-12",
      contact_phone: "+972504567890",
      direction: "inbound",
      type: "text",
      body: "Thanks for the information!",
      media_url: null,
      meta_id: "wamid.12",
      status: "read",
      source: "manual_ui",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    },
  ],
};

// =============================================================================
// Inbox Page Component
// =============================================================================

export default function InboxPage() {
  const router = useRouter();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(INITIAL_MOCK_MESSAGES);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);

  // Get messages for selected contact
  const messages = useMemo(() => {
    if (!selectedContact) return [];
    return messagesMap[selectedContact.phone_number] || [];
  }, [selectedContact, messagesMap]);

  // Handle sending a text message with optimistic update
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedContact) return;

      const contactPhone = selectedContact.phone_number;

      // Create optimistic message with temporary ID
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        contact_phone: contactPhone,
        direction: "outbound",
        type: "text",
        body: text,
        media_url: null,
        meta_id: null,
        status: "pending",
        source: "manual_ui",
        created_at: new Date().toISOString(),
      };

      // Add optimistic message to state immediately
      setMessagesMap((prev) => ({
        ...prev,
        [contactPhone]: [...(prev[contactPhone] || []), optimisticMessage],
      }));

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

          // Mark message as failed
          setMessagesMap((prev) => ({
            ...prev,
            [contactPhone]: prev[contactPhone].map((msg) =>
              msg.id === tempId ? { ...msg, status: "failed" as const } : msg
            ),
          }));

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

        // Success - update message with real data from response
        const successData = data as SendMessageResponse;

        if (successData.message) {
          // Replace temp message with real message from server
          setMessagesMap((prev) => ({
            ...prev,
            [contactPhone]: prev[contactPhone].map((msg) =>
              msg.id === tempId ? successData.message! : msg
            ),
          }));
        } else {
          // If no message returned (edge case), update status to sent
          setMessagesMap((prev) => ({
            ...prev,
            [contactPhone]: prev[contactPhone].map((msg) =>
              msg.id === tempId
                ? { ...msg, status: "sent" as const, meta_id: successData.meta_id || null }
                : msg
            ),
          }));
        }

        // Show warning if there was one (message sent but not recorded)
        if (successData.warning) {
          toast.warning("Message sent", {
            description: successData.warning,
          });
        }
      } catch (error) {
        // Network or unexpected error
        console.error("Send message error:", error);

        // Mark message as failed
        setMessagesMap((prev) => ({
          ...prev,
          [contactPhone]: prev[contactPhone].map((msg) =>
            msg.id === tempId ? { ...msg, status: "failed" as const } : msg
          ),
        }));

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

      // Create optimistic message with temporary ID
      const tempId = `temp-img-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        contact_phone: contactPhone,
        direction: "outbound",
        type: "image",
        body: caption || null,
        media_url: localPreviewUrl,
        meta_id: null,
        status: "pending",
        source: "manual_ui",
        created_at: new Date().toISOString(),
      };

      // Add optimistic message to state immediately
      setMessagesMap((prev) => ({
        ...prev,
        [contactPhone]: [...(prev[contactPhone] || []), optimisticMessage],
      }));

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

        // Update optimistic message with real Supabase URL
        setMessagesMap((prev) => ({
          ...prev,
          [contactPhone]: prev[contactPhone].map((msg) =>
            msg.id === tempId ? { ...msg, media_url: uploadSuccess.url } : msg
          ),
        }));

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

          // Mark message as failed
          setMessagesMap((prev) => ({
            ...prev,
            [contactPhone]: prev[contactPhone].map((msg) =>
              msg.id === tempId ? { ...msg, status: "failed" as const } : msg
            ),
          }));

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

        // Success - update message with real data from response
        const successData = sendData as SendMessageResponse;

        if (successData.message) {
          // Replace temp message with real message from server
          setMessagesMap((prev) => ({
            ...prev,
            [contactPhone]: prev[contactPhone].map((msg) =>
              msg.id === tempId ? successData.message! : msg
            ),
          }));
        } else {
          // Update status to sent
          setMessagesMap((prev) => ({
            ...prev,
            [contactPhone]: prev[contactPhone].map((msg) =>
              msg.id === tempId
                ? { ...msg, status: "sent" as const, meta_id: successData.meta_id || null }
                : msg
            ),
          }));
        }

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

        // Mark message as failed
        setMessagesMap((prev) => ({
          ...prev,
          [contactPhone]: prev[contactPhone].map((msg) =>
            msg.id === tempId ? { ...msg, status: "failed" as const } : msg
          ),
        }));

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
      if (!selectedContact) return;

      const contactPhone = selectedContact.phone_number;

      // Add message to conversation
      setMessagesMap((prev) => ({
        ...prev,
        [contactPhone]: [...(prev[contactPhone] || []), message],
      }));
    },
    [selectedContact]
  );

  return (
    <>
      {/* Middle Panel - Contact List */}
      <ContactList
        contacts={MOCK_CONTACTS}
        selectedContact={selectedContact}
        onSelectContact={setSelectedContact}
      />

      {/* Right Panel - Conversation View */}
      <ConversationView
        selectedContact={selectedContact}
        messages={messages}
        onSendMessage={handleSendMessage}
        onSendImage={handleSendImage}
        onSendTemplate={handleSendTemplate}
      />

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
