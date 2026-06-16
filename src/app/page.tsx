"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, ready, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Not configured? Still let people into the app (demo mode).
    if (!configured) {
      router.replace("/dashboard");
      return;
    }
    if (!ready) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [configured, ready, user, router]);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
