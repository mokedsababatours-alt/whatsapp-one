import { Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PulseCards } from "@/components/activity/PulseCards";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export default function ActivityPage() {
  return (
    <>
      {/* Left Panel - Activity Feed */}
      <ActivityFeed />

      {/* Right Panel - Control Tower */}
      <div className="flex flex-1 flex-col bg-white">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-6">
          <h2 className="text-lg font-semibold text-slate-900">Control Tower</h2>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Pulse Cards - Real-time Statistics */}
        <PulseCards />

        {/* Empty State - Activity Details */}
        <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
          <div className="rounded-full bg-blue-100 p-6 mb-4">
            <Activity className="h-12 w-12 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Select an Activity
          </h2>
          <p className="text-slate-500 max-w-sm">
            Choose an automation log from the activity feed to view detailed execution information.
          </p>
        </div>
      </div>
    </>
  );
}
