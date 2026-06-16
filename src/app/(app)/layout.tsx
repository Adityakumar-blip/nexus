"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";
import { FirebaseBanner } from "@/components/firebase-banner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, ready, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && ready && !user) {
      router.replace("/login");
    }
  }, [configured, ready, user, router]);

  // When Firebase isn't configured we still let people in to explore the UI
  // (read-only demo mode) — the banner keeps the setup steps one click away.
  if (configured && (!ready || !user)) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      {!configured && <FirebaseBanner />}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
