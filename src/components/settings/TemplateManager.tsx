"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, RefreshCw, Loader2, AlertCircle, Clock, Database, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
}

interface TemplatesResponse {
  success: boolean;
  templates: Template[];
  cached: boolean;
  lastSync?: string;
  count?: number;
  error?: string;
}

// =============================================================================
// Category Badge Colors (matching TemplateSelector)
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
// Format Helpers
// =============================================================================

/**
 * Format timestamp to relative time or date
 */
function formatSyncTime(timestamp: string | null): string {
  if (!timestamp) return "Never";
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Get language display name
 */
function formatLanguage(code: string): string {
  const languages: Record<string, string> = {
    en: "English",
    en_US: "English (US)",
    en_GB: "English (UK)",
    he: "Hebrew",
    ar: "Arabic",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt_BR: "Portuguese (BR)",
  };
  return languages[code] || code;
}

// =============================================================================
// Main Component
// =============================================================================

export function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  // Fetch templates
  const fetchTemplates = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const url = forceRefresh ? "/api/templates?refresh=true" : "/api/templates";
      const response = await fetch(url);
      const data: TemplatesResponse = await response.json();

      if (!response.ok) {
        // Handle different error types
        let errorMessage = data.error || "Failed to fetch templates";
        
        // Check for specific error types
        if (response.status === 401) {
          errorMessage = "Please sign in to view templates";
        } else if (response.status === 500 && data.message) {
          // Environment variable error
          if (data.message.includes("META_WABA_ID")) {
            errorMessage = "META_WABA_ID is required. Templates must be fetched from the WhatsApp Business Account ID, not the Phone Number ID. Please add META_WABA_ID to your .env.local file.";
          } else if (data.message.includes("environment variable")) {
            errorMessage = "Meta API credentials not configured. Please add META_ACCESS_TOKEN and META_WABA_ID to .env.local";
          } else {
            errorMessage = data.message;
          }
        } else if (response.status === 502) {
          // Meta API error
          const metaError = (data as any).meta_error;
          if (metaError?.message) {
            errorMessage = `Meta API Error: ${metaError.message}`;
          } else {
            errorMessage = "Failed to connect to Meta API. Check your credentials.";
          }
        }
        
        throw new Error(errorMessage);
      }

      setTemplates(data.templates || []);
      setLastSync(data.lastSync || null);
      setIsCached(data.cached || false);

      if (forceRefresh) {
        toast.success("Templates refreshed", {
          description: `Loaded ${data.count || data.templates?.length || 0} templates from Meta`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load templates";
      setError(message);
      console.error("Template fetch error:", err);
      
      if (forceRefresh) {
        toast.error("Refresh failed", { description: message });
      } else {
        // Show toast on initial load failure too
        toast.error("Failed to load templates", { description: message });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTemplates(false);
  }, [fetchTemplates]);

  // Handle refresh
  const handleRefresh = () => {
    fetchTemplates(true);
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category || "OTHER";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  // Sort categories
  const sortedCategories = Object.keys(groupedTemplates).sort();

  // Loading State
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-100 p-3">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">Message Templates</CardTitle>
              <CardDescription>Loading templates...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error State
  if (error && templates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-base">Message Templates</CardTitle>
              <CardDescription className="text-red-600">{error}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => fetchTemplates(false)} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-100 p-3">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base">Message Templates</CardTitle>
              <CardDescription>
                Pre-approved WhatsApp message templates from Meta
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isRefreshing ? "Refreshing..." : "Refresh from Meta"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sync Status Bar */}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-4">
            {/* Cache Status */}
            <div className="flex items-center gap-1.5">
              {isCached ? (
                <Database className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              )}
              <span className="text-sm font-medium text-slate-700">
                {isCached ? "Cached" : "Fresh"}
              </span>
            </div>

            {/* Last Sync */}
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Last synced: {formatSyncTime(lastSync)}</span>
            </div>
          </div>

          {/* Template Count */}
          <Badge variant="secondary" className="font-mono">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Templates Table */}
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No templates found</p>
            <p className="text-xs text-slate-400 mt-1">
              Create templates in the Meta Business Suite
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[120px]">Language</TableHead>
                  <TableHead className="w-[80px] text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((category) =>
                  groupedTemplates[category]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          <span className="text-sm text-slate-800">{template.name}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", getCategoryColor(template.category))}
                          >
                            {template.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {formatLanguage(template.language)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                          >
                            {template.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Category Summary */}
        {templates.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {sortedCategories.map((category) => (
              <div
                key={category}
                className="flex items-center gap-1.5 text-xs text-slate-500"
              >
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0", getCategoryColor(category))}
                >
                  {category}
                </Badge>
                <span>{groupedTemplates[category].length}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
