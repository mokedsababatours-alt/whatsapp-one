"use client";

import { Activity, ChevronDown, Wifi, WifiOff, AlertCircle, Loader2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAutomationLogs, type LogFilter } from "@/hooks/useAutomationLogs";
import type { AutomationLog } from "@/types";

// =============================================================================
// Format Helpers
// =============================================================================

/**
 * Format timestamp to "HH:MM AM/PM"
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Mask phone number as "+972...XXX"
 */
function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  
  // Get country code and last 3 digits
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length < 6) return phone;
  
  // Extract country code (assume starts with +)
  const countryCodeMatch = cleaned.match(/^\+?\d{1,3}/);
  const countryCode = countryCodeMatch ? countryCodeMatch[0] : "";
  const lastDigits = cleaned.slice(-3);
  
  return `${countryCode}...${lastDigits}`;
}

/**
 * Get filter label for display
 */
function getFilterLabel(filter: LogFilter): string {
  switch (filter) {
    case "all":
      return "All";
    case "success":
      return "Success Only";
    case "failed":
      return "Failed Only";
  }
}

// =============================================================================
// Sub-components
// =============================================================================

function ConnectionIndicator({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-emerald-600">
              <Wifi className="h-3 w-3" />
              <span className="text-[10px] font-medium">Live</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Connected to real-time updates</TooltipContent>
        </Tooltip>
      );
    case "connecting":
      return (
        <div className="flex items-center gap-1 text-amber-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-[10px] font-medium">Connecting</span>
        </div>
      );
    case "error":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-red-500">
              <AlertCircle className="h-3 w-3" />
              <span className="text-[10px] font-medium">Error</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Connection error - updates may be delayed</TooltipContent>
        </Tooltip>
      );
    default:
      return (
        <div className="flex items-center gap-1 text-slate-400">
          <WifiOff className="h-3 w-3" />
          <span className="text-[10px] font-medium">Offline</span>
        </div>
      );
  }
}

function StatusBadge({ status }: { status: "success" | "failed" }) {
  if (status === "success") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px] px-1.5 py-0">
        Success
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[10px] px-1.5 py-0">
      Failed
    </Badge>
  );
}

function LogRowDetails({ log }: { log: AutomationLog }) {
  const hasDetails = log.error_detail || log.cost_estimate !== null;
  
  if (!hasDetails) {
    return <span className="text-slate-400">—</span>;
  }
  
  const tooltipContent = (
    <div className="space-y-1 max-w-xs">
      {log.error_detail && (
        <div>
          <span className="font-medium text-red-400">Error: </span>
          <span>{log.error_detail}</span>
        </div>
      )}
      {log.cost_estimate !== null && (
        <div>
          <span className="font-medium">Cost: </span>
          <span>₪ {log.cost_estimate.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Info className="h-3.5 w-3.5 text-slate-400" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full text-center py-12">
      <div className="rounded-full bg-slate-200 p-4 mb-3">
        <Activity className="h-8 w-8 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">No activity yet</p>
      <p className="text-xs text-slate-400 mt-1">
        Automation logs will appear here
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full py-12">
      <Loader2 className="h-8 w-8 text-slate-400 animate-spin mb-3" />
      <p className="text-sm text-slate-500">Loading activity...</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center h-full text-center py-12">
      <div className="rounded-full bg-red-100 p-4 mb-3">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>
      <p className="text-sm font-medium text-red-600">Failed to load activity</p>
      <p className="text-xs text-slate-400 mt-1 max-w-[200px]">{message}</p>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ActivityFeed() {
  const { logs, isLoading, error, connectionStatus, filter, setFilter } = useAutomationLogs();

  return (
    <div className="flex h-full w-[350px] flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <h1 className="text-lg font-semibold text-slate-900">Activity</h1>
        <ConnectionIndicator status={connectionStatus} />
      </div>

      {/* Filter Dropdown */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
              {getFilterLabel(filter)}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setFilter("all")}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("success")}>
              Success Only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("failed")}>
              Failed Only
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <span className="text-xs text-slate-400">
          {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : logs.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead className="w-[60px] text-[10px] text-slate-500 font-medium">Time</TableHead>
                <TableHead className="text-[10px] text-slate-500 font-medium">Workflow</TableHead>
                <TableHead className="w-[80px] text-[10px] text-slate-500 font-medium">Target</TableHead>
                <TableHead className="w-[60px] text-[10px] text-slate-500 font-medium">Status</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-100/50">
                  <TableCell className="py-2 text-[11px] text-slate-600 tabular-nums">
                    {formatTime(log.executed_at)}
                  </TableCell>
                  <TableCell className="py-2">
                    <span className="text-[11px] font-medium text-slate-800 truncate block max-w-[100px]">
                      {log.workflow_name}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-[11px] text-slate-500 font-mono">
                    {maskPhone(log.contact_phone)}
                  </TableCell>
                  <TableCell className="py-2">
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="py-2">
                    <LogRowDetails log={log} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}
