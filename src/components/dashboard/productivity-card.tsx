"use client";

import { Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeltaBadge } from "@/components/dashboard/primitives";
import { TrendChart, type ChartSeries } from "@/components/dashboard/trend-chart";

export interface LegendTotal {
  label: string;
  value: number;
  color: string;
}

// The "Productivity Overview" panel: a headline metric, an action slot for
// range controls, a multi-series trend chart, and a floating legend that pins
// the snapshot totals + overall percentage over the chart.
export function ProductivityCard({
  headline,
  subtitle,
  delta,
  series,
  labels,
  percentage,
  totals,
  headerRight,
}: {
  headline: string;
  subtitle: string;
  delta?: number;
  series: ChartSeries[];
  labels: string[];
  percentage: number;
  totals: LegendTotal[];
  headerRight?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-2">
        <div className="space-y-1">
          <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            Productivity Overview
            <Maximize2 className="size-3.5 opacity-50" />
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight">
              {headline}
            </span>
            {delta !== undefined && <DeltaBadge value={delta} />}
          </div>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
      </div>

      <div className="relative px-2 pb-2">
        <TrendChart series={series} labels={labels} height={210} />

        {/* Floating snapshot legend, like the reference's tooltip card. */}
        <div className="bg-popover pointer-events-none absolute top-3 right-6 w-40 rounded-xl border p-3 shadow-lg">
          <p className="text-xl font-semibold tracking-tight tabular-nums">
            {percentage}%
          </p>
          <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
            Productivity rate
          </p>
          <div className="mt-2 space-y-1.5 border-t pt-2">
            {totals.map((t) => (
              <div
                key={t.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: t.color }}
                  />
                  <span className="text-muted-foreground">{t.label}</span>
                </span>
                <span className="font-medium tabular-nums">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
