"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PulseCards } from "@/components/activity/PulseCards";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export default function ActivityPage() {
  return (
    <div className="flex flex-1 flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-6 flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Control Tower</h2>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Split View: Activity Log (Left) and Dashboard (Right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Activity Log */}
        <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden">
          <ActivityFeed />
        </div>

        {/* Right Panel - Dashboard */}
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Dashboard Header */}
          <div className="flex h-14 items-center border-b border-slate-200 px-6 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
          </div>
          <PulseCards />
        </div>
      </div>
    </div>
  );
}
