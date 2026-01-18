import { Settings, Key, Bell, User, Shield, Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationBridge } from "@/components/settings/NotificationBridge";
import { TemplateManager } from "@/components/settings/TemplateManager";

const settingsSections = [
  {
    icon: Key,
    title: "API Configuration",
    description: "Manage Meta WhatsApp API credentials and tokens",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Configure notification preferences and alerts",
  },
  {
    icon: User,
    title: "Account",
    description: "Manage your account settings and profile",
  },
  {
    icon: Shield,
    title: "Security",
    description: "Password, two-factor authentication, and sessions",
  },
  {
    icon: Database,
    title: "Data & Storage",
    description: "Manage data retention and storage preferences",
  },
];

export default function SettingsPage() {
  return (
    <>
      {/* Middle Panel - Settings Navigation */}
      <div className="flex h-full w-[350px] flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        {/* Header */}
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
        </div>

        {/* Settings Menu */}
        <div className="flex-1 overflow-y-auto p-2">
          {settingsSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <button
                key={index}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <div className="rounded-lg bg-white p-2 shadow-sm">
                  <Icon className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{section.title}</p>
                  <p className="text-xs text-slate-500 truncate">{section.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Panel - Settings Content */}
      <div className="flex flex-1 flex-col bg-white overflow-y-auto">
        {/* Header */}
        <div className="flex h-14 items-center border-b border-slate-200 px-6">
          <h2 className="text-lg font-semibold text-slate-900">General Settings</h2>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
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

          </div>
        </div>
      </div>
    </>
  );
}
