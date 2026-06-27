"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  X,
  Check,
  Circle,
  Flag,
  Tag,
  CalendarClock,
  User,
  ArrowDownUp,
  ListFilter,
  type LucideIcon,
} from "lucide-react";
import {
  TASK_STATUSES,
  PRIORITIES,
  TASK_TYPES,
  type UserProfile,
} from "@/lib/types";
import {
  type TaskFilters,
  type SortKey,
  DUE_PRESETS,
  SORT_OPTIONS,
  UNASSIGNED,
  activeFilterCount,
} from "@/lib/task-filters";
import { PRIORITY_CLASSES, taskTypeMeta, STATUS_DOT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/user-avatar";

type DimensionKey = keyof Omit<TaskFilters, "search">;

interface FacetOption {
  value: string;
  label: string;
  swatch?: React.ReactNode;
}

interface Dimension {
  key: DimensionKey;
  label: string;
  icon: LucideIcon;
  options: FacetOption[];
}

function dot(cls: string) {
  return <span className={cn("size-2 rounded-full", cls)} />;
}

export function TaskFilterBar({
  filters,
  onChange,
  sort,
  onSortChange,
  memberIds,
  profiles,
  resultCount,
  totalCount,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  memberIds: string[];
  profiles: Map<string, UserProfile>;
  resultCount: number;
  totalCount: number;
}) {
  const dimensions = useMemo<Dimension[]>(() => {
    const assigneeOptions: FacetOption[] = [
      {
        value: UNASSIGNED,
        label: "Unassigned",
        swatch: (
          <span className="bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full">
            <User className="size-3" />
          </span>
        ),
      },
      ...memberIds.map((uid) => {
        const p = profiles.get(uid);
        return {
          value: uid,
          label: p?.name || p?.email || "Member",
          swatch: <UserAvatar profile={p} className="size-5" />,
        };
      }),
    ];
    return [
      {
        key: "status",
        label: "Status",
        icon: Circle,
        options: TASK_STATUSES.map((s) => ({
          value: s.value,
          label: s.label,
          swatch: dot(STATUS_DOT[s.value]),
        })),
      },
      {
        key: "priority",
        label: "Priority",
        icon: Flag,
        options: PRIORITIES.map((p) => ({
          value: p.value,
          label: p.label,
          swatch: (
            <Flag className={cn("size-3.5", PRIORITY_CLASSES[p.value])} />
          ),
        })),
      },
      {
        key: "type",
        label: "Type",
        icon: Tag,
        options: TASK_TYPES.map((t) => ({
          value: t.value,
          label: t.label,
          swatch: dot(
            taskTypeMeta(t.value).badge.split(" ")[0].replace("/10", ""),
          ),
        })),
      },
      {
        key: "assignee",
        label: "Assignee",
        icon: User,
        options: assigneeOptions,
      },
      {
        key: "due",
        label: "Due date",
        icon: CalendarClock,
        options: DUE_PRESETS.map((d) => ({ value: d.value, label: d.label })),
      },
    ];
  }, [memberIds, profiles]);

  const activeKeys = dimensions.filter((d) => filters[d.key].length > 0);
  const inactiveKeys = dimensions.filter((d) => filters[d.key].length === 0);
  const count = activeFilterCount(filters);

  function setValues(key: DimensionKey, values: string[]) {
    onChange({ ...filters, [key]: values });
  }

  function toggleValue(key: DimensionKey, value: string) {
    const cur = filters[key] as string[];
    const next = cur.includes(value)
      ? cur.filter((v) => v !== value)
      : [...cur, value];
    setValues(key, next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Free-text search */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search tasks…"
          className="h-8 w-44 pl-8 text-sm"
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: "" })}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Active filter pills */}
      {activeKeys.map((d) => (
        <FacetPill
          key={d.key}
          dimension={d}
          selected={filters[d.key] as string[]}
          onToggle={(v) => toggleValue(d.key, v)}
          onClear={() => setValues(d.key, [])}
        />
      ))}

      {/* Add filter */}
      {inactiveKeys.length > 0 && (
        <AddFilterMenu
          dimensions={inactiveKeys}
          onToggle={toggleValue}
          hasAny={count > 0}
        />
      )}

      {/* Sort */}
      <SortMenu sort={sort} onSortChange={onSortChange} />

      <div className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">
          {count > 0 ? `${resultCount} of ${totalCount}` : `${totalCount}`}{" "}
          {totalCount === 1 ? "task" : "tasks"}
        </span>
        {count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() =>
              onChange({
                search: "",
                status: [],
                priority: [],
                type: [],
                assignee: [],
                due: [],
              })
            }
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function summarize(dimension: Dimension, selected: string[]): string {
  if (selected.length === 1) {
    return dimension.options.find((o) => o.value === selected[0])?.label ?? "";
  }
  return `${selected.length} selected`;
}

function FacetPill({
  dimension,
  selected,
  onToggle,
  onClear,
}: {
  dimension: Dimension;
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const Icon = dimension.icon;
  return (
    <div className="border-primary/40 bg-accent text-accent-foreground inline-flex items-center rounded-md border text-xs">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="hover:bg-accent-foreground/5 inline-flex items-center gap-1.5 rounded-l-md py-1 pr-1.5 pl-2"
          >
            <Icon className="text-muted-foreground size-3.5" />
            <span className="text-muted-foreground">{dimension.label}</span>
            <span className="text-muted-foreground/60">is</span>
            <span className="font-medium">
              {summarize(dimension, selected)}
            </span>
          </button>
        </PopoverTrigger>
        <FacetOptionList
          dimension={dimension}
          selected={selected}
          onToggle={onToggle}
        />
      </Popover>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${dimension.label} filter`}
        className="hover:bg-accent-foreground/10 text-muted-foreground hover:text-foreground rounded-r-md py-1 pr-1.5 pl-1"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function FacetOptionList({
  dimension,
  selected,
  onToggle,
}: {
  dimension: Dimension;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [q, setQ] = useState("");
  const options =
    dimension.options.length > 6
      ? dimension.options.filter((o) =>
          o.label.toLowerCase().includes(q.toLowerCase()),
        )
      : dimension.options;
  return (
    <PopoverContent align="start" className="w-56 p-1">
      {dimension.options.length > 6 && (
        <div className="relative mb-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Filter ${dimension.label.toLowerCase()}…`}
            className="placeholder:text-muted-foreground h-8 w-full rounded-sm bg-transparent pr-2 pl-7 text-sm outline-none"
          />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto">
        {options.length === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-xs">
            No matches
          </p>
        ) : (
          options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onToggle(o.value)}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                    on
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                {o.swatch && <span className="shrink-0">{o.swatch}</span>}
                <span className="truncate">{o.label}</span>
              </button>
            );
          })
        )}
      </div>
    </PopoverContent>
  );
}

function AddFilterMenu({
  dimensions,
  onToggle,
  hasAny,
}: {
  dimensions: Dimension[];
  onToggle: (key: DimensionKey, value: string) => void;
  hasAny: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Dimension | null>(null);

  // Reset the drill-down whenever the menu closes.
  function change(o: boolean) {
    setOpen(o);
    if (!o) setActive(null);
  }

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1 border border-dashed text-xs",
            hasAny ? "px-2" : "px-2.5",
          )}
        >
          {hasAny ? (
            <Plus className="size-3.5" />
          ) : (
            <ListFilter className="size-3.5" />
          )}
          {!hasAny && "Filter"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {active ? (
          <FacetOptionListInline
            dimension={active}
            onToggle={(v) => onToggle(active.key, v)}
            onBack={() => setActive(null)}
          />
        ) : (
          dimensions.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setActive(d)}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
              >
                <Icon className="text-muted-foreground size-4" />
                {d.label}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}

// Same checklist as FacetOptionList but rendered inline (the parent owns the
// Popover) with a back affordance, for the add-filter drill-down.
function FacetOptionListInline({
  dimension,
  onToggle,
  onBack,
}: {
  dimension: Dimension;
  onToggle: (value: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground mb-1 flex w-full items-center gap-1 px-2 py-1 text-xs"
      >
        ‹ {dimension.label}
      </button>
      <div className="max-h-64 overflow-y-auto">
        {dimension.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
          >
            {o.swatch && <span className="shrink-0">{o.swatch}</span>}
            <span className="truncate">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SortMenu({
  sort,
  onSortChange,
}: {
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
}) {
  const current = SORT_OPTIONS.find((o) => o.value === sort);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
          <ArrowDownUp className="size-3.5" />
          <span className="text-muted-foreground">Sort:</span>
          <span className="font-medium">{current?.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSortChange(o.value)}
            className="hover:bg-accent flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm"
          >
            {o.label}
            {o.value === sort && <Check className="size-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
