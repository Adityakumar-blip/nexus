"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DeltaBadge } from "@/components/dashboard/primitives";

export type StatTone = "blue" | "emerald" | "amber" | "rose" | "violet";

const TONE: Record<StatTone, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

// One overview metric: tinted icon, big value, label, and an optional delta
// chip with a "from last month" caption. Reusable for any KPI tile.
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  delta,
  caption = "from last month",
  loading,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: StatTone;
  delta?: number;
  caption?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg",
            TONE[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-muted-foreground text-sm font-medium">
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {delta !== undefined && <DeltaBadge value={delta} className="mb-1" />}
          <span className="text-muted-foreground mb-1 text-xs">{caption}</span>
        </div>
      )}
    </div>
  );
}
