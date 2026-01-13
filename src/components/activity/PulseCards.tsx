"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, AlertTriangle, Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// =============================================================================
// Types
// =============================================================================

interface PulseStats {
  totalMessages24h: number;
  previousMessages24h: number;
  errorRate: number;
  estimatedCostMonth: number | null;
  isLoading: boolean;
  error: string | null;
}

// =============================================================================
// Skeleton Component
// =============================================================================

function CardSkeleton() {
  return (
    <Card className="relative overflow-hidden border-slate-200 py-4">
      <CardContent className="px-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Trend Indicator Component
// =============================================================================

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-slate-400">
        <Minus className="h-3 w-3" />
        <span>No change</span>
      </span>
    );
  }

  if (previous === 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-emerald-600">
        <TrendingUp className="h-3 w-3" />
        <span>New</span>
      </span>
    );
  }

  const percentChange = ((current - previous) / previous) * 100;
  const isPositive = percentChange > 0;
  const isNeutral = percentChange === 0;

  if (isNeutral) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-slate-400">
        <Minus className="h-3 w-3" />
        <span>0%</span>
      </span>
    );
  }

  return (
    <span
      className={`flex items-center gap-0.5 text-xs ${
        isPositive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span>{isPositive ? "+" : ""}{percentChange.toFixed(0)}%</span>
    </span>
  );
}

// =============================================================================
// Format Helpers
// =============================================================================

function formatCurrency(amount: number): string {
  return `₪ ${amount.toFixed(2)}`;
}

function formatPercentage(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

// =============================================================================
// Data Fetching Hook
// =============================================================================

function usePulseStats() {
  const [stats, setStats] = useState<PulseStats>({
    totalMessages24h: 0,
    previousMessages24h: 0,
    errorRate: 0,
    estimatedCostMonth: null,
    isLoading: true,
    error: null,
  });

  const fetchStats = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const now = new Date();

    // Time boundaries
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    try {
      // Query 1: Total messages in last 24 hours
      const { count: total24h, error: error24h } = await supabase
        .from("automation_logs")
        .select("*", { count: "exact", head: true })
        .gte("executed_at", twentyFourHoursAgo);

      if (error24h) throw error24h;

      // Query 2: Total messages in previous 24 hours (24-48 hours ago)
      const { count: previous24h, error: errorPrev } = await supabase
        .from("automation_logs")
        .select("*", { count: "exact", head: true })
        .gte("executed_at", fortyEightHoursAgo)
        .lt("executed_at", twentyFourHoursAgo);

      if (errorPrev) throw errorPrev;

      // Query 3: Failed count in last 24 hours for error rate
      const { count: failed24h, error: errorFailed } = await supabase
        .from("automation_logs")
        .select("*", { count: "exact", head: true })
        .gte("executed_at", twentyFourHoursAgo)
        .eq("status", "failed");

      if (errorFailed) throw errorFailed;

      // Query 4: Sum of cost_estimate for current month
      const { data: costData, error: errorCost } = await supabase
        .from("automation_logs")
        .select("cost_estimate")
        .gte("executed_at", startOfMonth)
        .not("cost_estimate", "is", null);

      if (errorCost) throw errorCost;

      // Calculate error rate
      const totalCount = total24h ?? 0;
      const failedCount = failed24h ?? 0;
      const errorRate = totalCount > 0 ? (failedCount / totalCount) * 100 : 0;

      // Calculate total cost
      const totalCost = costData?.reduce((sum, row) => sum + (row.cost_estimate ?? 0), 0) ?? null;

      setStats({
        totalMessages24h: total24h ?? 0,
        previousMessages24h: previous24h ?? 0,
        errorRate,
        estimatedCostMonth: totalCost && totalCost > 0 ? totalCost : null,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setStats((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch stats",
      }));
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, refetch: fetchStats };
}

// =============================================================================
// Main Component
// =============================================================================

export function PulseCards() {
  const { stats } = usePulseStats();

  if (stats.isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4 p-6 pb-0">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="p-6 pb-0">
        <Card className="border-red-200 bg-red-50 py-4">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Failed to load statistics: {stats.error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isHighErrorRate = stats.errorRate > 5;

  return (
    <div className="grid grid-cols-3 gap-4 p-6 pb-0">
      {/* Total Messages (24h) Card */}
      <Card className="border-slate-200 bg-gradient-to-br from-blue-50 to-white py-4 transition-shadow hover:shadow-md">
        <CardContent className="px-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Messages (24h)
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {stats.totalMessages24h.toLocaleString()}
                </p>
                <TrendIndicator
                  current={stats.totalMessages24h}
                  previous={stats.previousMessages24h}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Rate Card */}
      <Card
        className={`py-4 transition-shadow hover:shadow-md ${
          isHighErrorRate
            ? "border-red-200 bg-gradient-to-br from-red-50 to-white"
            : "border-slate-200 bg-gradient-to-br from-emerald-50 to-white"
        }`}
      >
        <CardContent className="px-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isHighErrorRate ? "bg-red-100" : "bg-emerald-100"
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 ${isHighErrorRate ? "text-red-600" : "text-emerald-600"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Error Rate
              </p>
              <div className="flex items-baseline gap-2">
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    isHighErrorRate ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {formatPercentage(stats.errorRate)}
                </p>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    isHighErrorRate
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {isHighErrorRate ? "High" : "Normal"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estimated Cost (Month) Card */}
      <Card className="border-slate-200 bg-gradient-to-br from-amber-50 to-white py-4 transition-shadow hover:shadow-md">
        <CardContent className="px-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Wallet className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Cost (Month)
              </p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {stats.estimatedCostMonth !== null
                  ? formatCurrency(stats.estimatedCostMonth)
                  : "No data"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
