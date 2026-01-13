"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Save, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

// =============================================================================
// Types
// =============================================================================

interface Settings {
  admin_phone: string | null;
  notification_enabled: boolean;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate E.164 phone format
 */
function isValidE164(phone: string): boolean {
  if (!phone) return true; // Empty is valid (optional field)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Format phone input with E.164 guidance
 */
function formatPhoneInput(value: string): string {
  // Allow only + and digits
  let formatted = value.replace(/[^\d+]/g, "");
  
  // Ensure starts with + if has content
  if (formatted && !formatted.startsWith("+")) {
    formatted = "+" + formatted;
  }
  
  // Limit length (E.164 max is +15 digits)
  if (formatted.length > 16) {
    formatted = formatted.slice(0, 16);
  }
  
  return formatted;
}

// =============================================================================
// Main Component
// =============================================================================

export function NotificationBridge() {
  const [settings, setSettings] = useState<Settings>({
    admin_phone: null,
    notification_enabled: false,
  });
  const [phoneInput, setPhoneInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Fetch current settings
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          admin_phone: data.admin_phone || null,
          notification_enabled: data.notification_enabled || false,
        });
        setPhoneInput(data.admin_phone || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Track changes
  useEffect(() => {
    const phoneChanged = phoneInput !== (settings.admin_phone || "");
    setHasChanges(phoneChanged);
  }, [phoneInput, settings.admin_phone]);

  // Handle phone input change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhoneInput(formatted);
    
    // Validate
    if (formatted && !isValidE164(formatted)) {
      setPhoneError("Enter valid E.164 format (e.g., +972501234567)");
    } else {
      setPhoneError(null);
    }
  };

  // Handle toggle change
  const handleToggleChange = async (enabled: boolean) => {
    // Optimistically update UI
    setSettings((prev) => ({ ...prev, notification_enabled: enabled }));
    
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_enabled: enabled }),
      });

      if (!response.ok) {
        // Revert on error
        setSettings((prev) => ({ ...prev, notification_enabled: !enabled }));
        const data = await response.json();
        toast.error(data.message || "Failed to update notification setting");
      } else {
        toast.success(enabled ? "Notifications enabled" : "Notifications disabled");
      }
    } catch (error) {
      // Revert on error
      setSettings((prev) => ({ ...prev, notification_enabled: !enabled }));
      console.error("Failed to toggle notifications:", error);
      toast.error("Failed to update setting");
    }
  };

  // Save settings
  const handleSave = async () => {
    if (phoneInput && !isValidE164(phoneInput)) {
      setPhoneError("Enter valid E.164 format (e.g., +972501234567)");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_phone: phoneInput || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to save settings");
        return;
      }

      setSettings((prev) => ({ ...prev, admin_phone: phoneInput || null }));
      setHasChanges(false);
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Send test notification
  const handleTestNotification = async () => {
    if (!settings.admin_phone) {
      toast.error("Please save an admin phone number first");
      return;
    }

    if (!settings.notification_enabled) {
      toast.error("Please enable notifications first");
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch("/api/settings/test-notification", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to send test notification");
        return;
      }

      toast.success("Test notification sent!", {
        description: `Message sent to ${settings.admin_phone}`,
      });
    } catch (error) {
      console.error("Failed to send test notification:", error);
      toast.error("Failed to send test notification");
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-3">
              <Bell className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Admin Notifications</CardTitle>
              <CardDescription>Loading settings...</CardDescription>
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-3">
              <Bell className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Admin Notifications</CardTitle>
              <CardDescription>
                Receive WhatsApp alerts for important system events
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">
              {settings.notification_enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={settings.notification_enabled}
              onCheckedChange={handleToggleChange}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Admin Phone Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Admin Alert Number
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="tel"
                placeholder="+972501234567"
                value={phoneInput}
                onChange={handlePhoneChange}
                className={phoneError ? "border-red-300 focus-visible:ring-red-500" : ""}
              />
              {phoneError && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {phoneError}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                E.164 format: +[country code][number]
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges || !!phoneError}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasChanges ? (
                <Save className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {isSaving ? "Saving..." : hasChanges ? "Save" : "Saved"}
            </Button>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  settings.notification_enabled && settings.admin_phone
                    ? "bg-emerald-500"
                    : "bg-slate-300"
                }`}
              />
              <span className="text-sm text-slate-600">
                {settings.notification_enabled && settings.admin_phone
                  ? "Ready to receive notifications"
                  : settings.admin_phone
                  ? "Notifications disabled"
                  : "No phone number configured"}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNotification}
              disabled={isTesting || !settings.notification_enabled || !settings.admin_phone}
              className="gap-2"
            >
              {isTesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {isTesting ? "Sending..." : "Test Ping"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
