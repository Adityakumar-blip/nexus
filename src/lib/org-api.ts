// Client helpers for the server-side organization operations (/api/orgs).
// Both send the signed-in user's Firebase ID token as a bearer credential, the
// same pattern the Settings page uses for /api/keys.

import type { User } from "firebase/auth";

async function post(
  user: User,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/orgs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Request failed",
    );
  }
  return data;
}

// Join an organization by its share code. Returns the org id + name.
export async function joinOrgByCode(
  user: User,
  code: string,
): Promise<{ orgId: string; name: string }> {
  const data = await post(user, { action: "join", code });
  return { orgId: String(data.orgId), name: String(data.name ?? "") };
}

// Invite a teammate to an organization by email.
export async function inviteToOrg(
  user: User,
  orgId: string,
  email: string,
): Promise<{ uid: string; name: string; email: string }> {
  const data = await post(user, { action: "invite", orgId, email });
  return {
    uid: String(data.uid),
    name: String(data.name ?? ""),
    email: String(data.email ?? email),
  };
}
