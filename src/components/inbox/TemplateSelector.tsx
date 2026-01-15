"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, FileText, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

// =============================================================================
// Types
// =============================================================================

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
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

interface TemplatesResponse {
  success: boolean;
  templates: Template[];
  cached: boolean;
}

interface SendTemplateResponse {
  success: boolean;
  message?: Message;
  meta_id?: string;
  template_name?: string;
  warning?: string;
}

interface TemplateSelectorProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Recipient phone number */
  recipient: string;
  /** Callback when template is successfully sent */
  onSuccess: (message: Message) => void;
}

type LoadingState = "idle" | "loading" | "error" | "loaded";

// =============================================================================
// Category Badge Colors
// =============================================================================

const categoryColors: Record<string, string> = {
  MARKETING: "bg-purple-100 text-purple-700 border-purple-200",
  UTILITY: "bg-blue-100 text-blue-700 border-blue-200",
  AUTHENTICATION: "bg-amber-100 text-amber-700 border-amber-200",
};

function getCategoryColor(category: string): string {
  return categoryColors[category] || "bg-slate-100 text-slate-700 border-slate-200";
}

// =============================================================================
// Component
// =============================================================================

/**
 * TemplateSelector - Modal for selecting and sending template messages
 *
 * Used when the 24-hour session window has expired.
 * Fetches available templates from Meta API and allows sending.
 */
export function TemplateSelector({
  open,
  onOpenChange,
  recipient,
  onSuccess,
}: TemplateSelectorProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates when dialog opens
  const fetchTemplates = useCallback(async () => {
    setLoadingState("loading");
    setError(null);

    try {
      const response = await fetch("/api/templates");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to fetch templates");
      }

      const result = data as TemplatesResponse;
      setTemplates(result.templates);
      setLoadingState("loaded");
    } catch (err) {
      console.error("Fetch templates error:", err);
      setError(err instanceof Error ? err.message : "Failed to load templates");
      setLoadingState("error");
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (open && loadingState === "idle") {
      fetchTemplates();
    }
  }, [open, loadingState, fetchTemplates]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplate(null);
      setLoadingState("idle");
      setError(null);
    }
  }, [open]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
  }, []);

  // Handle send template
  const handleSendTemplate = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsSending(true);

    try {
      const response = await fetch("/api/messages/send-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient,
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const metaErrorCode = data?.meta_error?.code;
        const metaErrorDetails = data?.meta_error?.error_data?.details;
        const errorMessage =
          metaErrorCode === 131030
            ? "Recipient not in allowed list (test number)"
            : data.message ||
              data.error ||
              data.meta_error?.message ||
              "Failed to send template";
        const errorDetails =
          metaErrorCode === 131030
            ? "Add the recipient to the allowed list in Meta (test mode)."
            : metaErrorDetails;
        const error = new Error(errorMessage);
        (error as Error & { details?: string }).details = errorDetails;
        throw error;
      }

      const result = data as SendTemplateResponse;

      // Show success toast
      toast.success("Template sent", {
        description: `Sent "${selectedTemplate.name}" to ${recipient}`,
      });

      // Call success callback with message
      if (result.message) {
        onSuccess(result.message);
      } else {
        // Create message object if not returned
        const message: Message = {
          id: `temp-tpl-${Date.now()}`,
          contact_phone: recipient,
          direction: "outbound",
          type: "template",
          body: `Template: ${selectedTemplate.name}`,
          media_url: null,
          meta_id: result.meta_id || null,
          status: "sent",
          source: "manual_ui",
          created_at: new Date().toISOString(),
        };
        onSuccess(message);
      }

      // Close dialog
      onOpenChange(false);
    } catch (err) {
      console.error("Send template error:", err);
      const errorDetails =
        err instanceof Error && "details" in err
          ? (err as Error & { details?: string }).details
          : undefined;
      toast.error("Failed to send template", {
        description: errorDetails || (err instanceof Error ? err.message : "Please try again"),
      });
    } finally {
      setIsSending(false);
    }
  }, [selectedTemplate, recipient, onSuccess, onOpenChange]);

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || "OTHER";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  // Get preview text from template components
  const getTemplatePreview = (template: Template): string => {
    const bodyComponent = template.components?.find((c) => c.type === "BODY");
    if (bodyComponent?.text) {
      return bodyComponent.text.length > 100
        ? `${bodyComponent.text.slice(0, 100)}...`
        : bodyComponent.text;
    }
    return "No preview available";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Select Template
          </DialogTitle>
          <DialogDescription>
            Choose a pre-approved template message to re-open the conversation
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {loadingState === "loading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm text-slate-500">Loading templates...</p>
          </div>
        )}

        {/* Error State */}
        {loadingState === "error" && (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
            <p className="text-sm text-slate-700 font-medium mb-1">
              Failed to load templates
            </p>
            <p className="text-xs text-slate-500 mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTemplates}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {/* Templates List */}
        {loadingState === "loaded" && (
          <>
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-10 w-10 text-slate-400 mb-3" />
                <p className="text-sm text-slate-600 font-medium">
                  No templates available
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Create templates in the Meta Business Suite
                </p>
              </div>
            ) : (
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4 pb-4">
                  {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                    <div key={category}>
                      {/* Category Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={cn("text-xs", getCategoryColor(category))}
                        >
                          {category}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {categoryTemplates.length} template
                          {categoryTemplates.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Templates */}
                      <div className="space-y-2">
                        {categoryTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className={cn(
                              "w-full text-left p-3 rounded-lg border transition-colors",
                              selectedTemplate?.id === template.id
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {template.name}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {template.language}
                                </p>
                              </div>
                              {selectedTemplate?.id === template.id && (
                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                              {getTemplatePreview(template)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Send Button */}
            {templates.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <Button
                  onClick={handleSendTemplate}
                  disabled={!selectedTemplate || isSending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Template
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
