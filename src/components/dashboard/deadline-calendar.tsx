"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Maximize2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface DeadlineItem {
  id: string;
  title: string;
  date: number; // ms
  color: string; // CSS color for the bar
  href?: string;
}

const WINDOW = 7; // days shown in the strip

// A week-at-a-glance deadline panel: a navigable day strip plus a staggered,
// gantt-style list of the deadlines that fall inside the visible window.
export function DeadlineCalendar({ items }: { items: DeadlineItem[] }) {
  // Anchor the initial week on the earliest upcoming deadline so the panel
  // opens populated; fall back to today.
  const initial = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const future = items
      .map((i) => i.date)
      .filter((d) => d >= today)
      .sort((a, b) => a - b);
    return startOfDay(new Date(future[0] ?? today));
  }, [items]);

  const [start, setStart] = useState(initial);
  const days = useMemo(
    () => Array.from({ length: WINDOW }, (_, i) => addDays(start, i)),
    [start],
  );
  const end = addDays(start, WINDOW).getTime();

  const visible = useMemo(() => {
    const s = start.getTime();
    return items
      .filter((i) => i.date >= s && i.date < end)
      .sort((a, b) => a.date - b.date);
  }, [items, start, end]);

  const headerLabel = `${format(start, "MMM d")} – ${format(addDays(start, WINDOW - 1), "MMM d")}`;

  return (
    <Card className="h-full gap-0 py-0">
      <div className="flex items-center justify-between gap-2 p-5 pb-3">
        <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="size-4" />
          Deadline Calendar
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setStart((s) => addDays(s, -WINDOW))}
            className="hover:bg-accent text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="w-28 text-center text-xs font-medium tabular-nums">
            {headerLabel}
          </span>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setStart((s) => addDays(s, WINDOW))}
            className="hover:bg-accent text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
          <Maximize2 className="text-muted-foreground/50 ml-1 size-3.5" />
        </div>
      </div>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1 px-4">
        {days.map((d) => {
          const today = isSameDay(d, new Date());
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-center",
                today && "bg-primary text-primary-foreground",
              )}
            >
              <span
                className={cn(
                  "text-[10px] uppercase",
                  today ? "opacity-80" : "text-muted-foreground",
                )}
              >
                {format(d, "EEE")}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {format(d, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Timeline list — bars staggered by weekday to read like a gantt. */}
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto px-4 pb-5">
        {visible.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No deadlines this week.
          </p>
        ) : (
          visible.map((item) => {
            const offset = days.findIndex((d) => isSameDay(d, new Date(item.date)));
            const left = Math.max(0, offset) / WINDOW;
            const bar = (
              <div
                className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-accent/60"
                style={{ marginInlineStart: `${left * 100}%` }}
              >
                <span
                  className="h-7 w-1 shrink-0 rounded-full"
                  style={{ background: item.color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {format(item.date, "EEE, MMM d")}
                  </p>
                </div>
              </div>
            );
            return item.href ? (
              <Link key={item.id} href={item.href} className="block">
                {bar}
              </Link>
            ) : (
              <div key={item.id}>{bar}</div>
            );
          })
        )}
      </div>
    </Card>
  );
}
