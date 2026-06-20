"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

// Renders a teammate's avatar (photo if present, initials otherwise). Falls back
// to a neutral "?" when the profile hasn't loaded yet.
export function UserAvatar({
  profile,
  className,
}: {
  profile?: UserProfile | null;
  className?: string;
}) {
  const label = profile?.name || profile?.email || "";
  return (
    <Avatar className={cn("size-6", className)}>
      {profile?.photoURL && <AvatarImage src={profile.photoURL} alt={label} />}
      <AvatarFallback className="text-[10px] font-medium">
        {initials(label)}
      </AvatarFallback>
    </Avatar>
  );
}

// Human-friendly display name for a profile.
export function displayName(profile?: UserProfile | null): string {
  if (!profile) return "Unknown user";
  return profile.name || profile.email || "Unknown user";
}
