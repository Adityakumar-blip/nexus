"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  FolderKanban,
  Map,
  BookOpen,
  FileText,
  Boxes,
  Users,
  Settings,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { watchProjects } from "@/lib/store";
import type { Project } from "@/lib/types";
import { colorClasses } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/dashboard/primitives";
import { UserMenu } from "@/components/user-menu";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    return watchProjects(user.uid, (p) => setProjects(p ?? []));
  }, [user]);

  const main: NavLink[] = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/projects",
        label: "Projects",
        icon: FolderKanban,
        count: projects.length || undefined,
      },
      { href: "/roadmap", label: "Roadmap", icon: Map },
      { href: "/organizations", label: "Clients", icon: Users },
    ],
    [projects.length],
  );

  const workspace: NavLink[] = [
    { href: "/docs", label: "Docs", icon: FileText },
    { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  ];

  const shownProjects = useMemo(() => {
    const list = q.trim()
      ? projects.filter((p) =>
          p.name.toLowerCase().includes(q.trim().toLowerCase()),
        )
      : projects;
    return list.slice(0, 6);
  }, [projects, q]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const isDark = resolvedTheme === "dark";

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex h-svh shrink-0 flex-col border-r transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand + collapse */}
      <div className="flex items-center gap-2 px-3 py-4">
        <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Boxes className="size-5" />
        </div>
        {!collapsed && (
          <span className="flex-1 text-lg font-semibold tracking-tight">
            Nexus
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="bg-background focus-visible:ring-ring/40 h-8 w-full rounded-md border pl-8 pr-2 text-sm outline-none focus-visible:ring-2"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        <NavGroup label="Main menu" collapsed={collapsed}>
          {main.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}
        </NavGroup>

        <NavGroup label="Workspace" collapsed={collapsed}>
          {workspace.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}
        </NavGroup>

        {!collapsed && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-1">
              <SectionLabel>Projects</SectionLabel>
              <Link
                href="/projects"
                aria-label="New project"
                className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground inline-flex size-5 items-center justify-center rounded transition-colors"
              >
                <Plus className="size-3.5" />
              </Link>
            </div>
            {shownProjects.length === 0 ? (
              <p className="text-muted-foreground px-3 py-1 text-xs">
                {q ? "No matches" : "No projects yet"}
              </p>
            ) : (
              shownProjects.map((p) => {
                const cc = colorClasses(p.color);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive(`/projects/${p.id}`)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", cc.dot)} />
                    <span className="truncate">{p.name}</span>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </nav>

      {/* System */}
      <div className="space-y-1 border-t px-3 py-3">
        {!collapsed && <SectionLabel className="px-3">System</SectionLabel>}
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={cn(
            "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            collapsed && "justify-center",
          )}
          title="Dark mode"
        >
          <Moon className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Dark Mode</span>
              <span
                className={cn(
                  "relative h-4 w-7 rounded-full transition-colors",
                  isDark ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "bg-background absolute top-0.5 size-3 rounded-full shadow transition-all",
                    isDark ? "left-3.5" : "left-0.5",
                  )}
                />
              </span>
            </>
          )}
        </button>
        <NavItem
          item={{ href: "/settings", label: "Settings", icon: Settings }}
          active={isActive("/settings")}
          collapsed={collapsed}
        />
      </div>

      {/* User */}
      <div className="border-t p-2">
        {collapsed ? (
          <Link
            href="/settings"
            className="hover:bg-sidebar-accent flex items-center justify-center rounded-md p-2"
            aria-label="Account"
          >
            <Boxes className="size-4" />
          </Link>
        ) : (
          <UserMenu />
        )}
      </div>
    </aside>
  );
}

function NavGroup({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {!collapsed && <SectionLabel className="px-3">{label}</SectionLabel>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  item,
  active,
  collapsed,
}: {
  item: NavLink;
  active: boolean;
  collapsed: boolean;
}) {
  const { icon: Icon, label, href, count } = item;
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && count !== undefined && (
        <span className="bg-muted-foreground/15 text-muted-foreground rounded-full px-1.5 text-[11px] tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}
