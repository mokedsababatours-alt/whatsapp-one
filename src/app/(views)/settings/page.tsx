"use client";

import { useState } from "react";
import { Settings, Key, Bell, User, Shield, Database, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationBridge } from "@/components/settings/NotificationBridge";
import { TemplateManager } from "@/components/settings/TemplateManager";
import { signOut } from "@/lib/auth.client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type SettingsSection = "general" | "api" | "notifications" | "account" | "security" | "storage";

const settingsSections: Array<{
  id: SettingsSection;
  icon: typeof Key;
  title: string;
  description: string;
}> = [
  {
    id: "general",
    icon: Settings,
    title: "General",
    description: "Overview and main settings",
  },
  {
    id: "api",
    icon: Key,
    title: "API Configuration",
    description: "Manage Meta WhatsApp API credentials and tokens",
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications",
    description: "Configure notification preferences and alerts",
  },
  {
    id: "account",
    icon: User,
    title: "Account",
    description: "Manage your account settings and profile",
  },
  {
    id: "security",
    icon: Shield,
    title: "Security",
    description: "Password, two-factor authentication, and sessions",
  },
  {
    id: "storage",
    icon: Database,
    title: "Data & Storage",
    description: "Manage data retention and storage preferences",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      toast.error("Failed to sign out");
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="max-w-2xl space-y-6">
            {/* Admin Notifications */}
            <NotificationBridge />

            {/* Message Templates */}
            <TemplateManager />

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    API Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm font-medium">Not Configured</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Session Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium">Active</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-zinc-100 p-3">
                    <Settings className="h-6 w-6 text-zinc-600" />
                  </div>
                  <div>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>
                      Configure your WhatsApp Interface preferences
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Select a category from the left panel to configure specific settings.
                  API configuration, notifications, and security options are available.
                </p>
              </CardContent>
            </Card>
          </div>
        );
      case "api":
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-3">
                  <Key className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>API Configuration</CardTitle>
                  <CardDescription>
                    Manage Meta WhatsApp API credentials and tokens
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                API credentials are configured via environment variables in your <code className="bg-slate-100 px-1 rounded">.env.local</code> file.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="font-medium">META_ACCESS_TOKEN</span>
                  <span className="text-slate-500 text-xs">Configured in .env.local</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="font-medium">META_PHONE_NUMBER_ID</span>
                  <span className="text-slate-500 text-xs">Configured in .env.local</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="font-medium">META_WABA_ID</span>
                  <span className="text-slate-500 text-xs">Configured in .env.local</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                For security reasons, API credentials cannot be managed through the UI. 
                Please edit your <code className="bg-slate-100 px-1 rounded">.env.local</code> file directly.
              </p>
            </CardContent>
          </Card>
        );
      case "notifications":
        return (
          <div className="max-w-2xl space-y-6">
            <NotificationBridge />
          </div>
        );
      case "account":
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-purple-100 p-3">
                  <User className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Account Settings</CardTitle>
                  <CardDescription>
                    Manage your account settings and profile
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Account management features coming soon. Currently, account settings are managed through Supabase Auth.
              </p>
            </CardContent>
          </Card>
        );
      case "security":
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-3">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>
                    Password, two-factor authentication, and sessions
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Security features coming soon. Currently, authentication is managed through Supabase Auth.
              </p>
            </CardContent>
          </Card>
        );
      case "storage":
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-indigo-100 p-3">
                  <Database className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>Data & Storage</CardTitle>
                  <CardDescription>
                    Manage data retention and storage preferences
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Data and storage management features coming soon.
              </p>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Middle Panel - Settings Navigation */}
      <div className="flex h-full w-[350px] flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
        </div>

        {/* Settings Menu */}
        <div className="flex-1 overflow-y-auto p-2">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                  isActive
                    ? "bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                    : "hover:bg-slate-200"
                } focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2`}
              >
                <div className={`rounded-lg p-2 shadow-sm ${
                  isActive ? "bg-emerald-100" : "bg-white"
                }`}>
                  <Icon className={`h-5 w-5 ${
                    isActive ? "text-emerald-600" : "text-slate-600"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    isActive ? "text-emerald-900" : "text-slate-900"
                  }`}>{section.title}</p>
                  <p className={`text-xs truncate ${
                    isActive ? "text-emerald-700" : "text-slate-500"
                  }`}>{section.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Panel - Settings Content */}
      <div className="flex flex-1 flex-col bg-white overflow-y-auto">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {settingsSections.find(s => s.id === activeSection)?.title || "Settings"}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {renderSectionContent()}
        </div>
      </div>
    </>
  );
}
