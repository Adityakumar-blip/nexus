// MCP key management API, used by the web app's Settings page.
//
// Authenticated with the signed-in user's Firebase ID token (NOT a PAT): the
// browser sends `Authorization: Bearer <idToken>` and we verify it with the
// Admin SDK. This endpoint mints, lists, and revokes the Personal Access Tokens
// that agents later use against /api/mcp.

import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";

// firebase-admin needs the Node.js runtime (not Edge).
export const runtime = "nodejs";

// Resolve the caller's uid from their Firebase ID token, or return an error response.
async function requireUid(req: NextRequest): Promise<string | NextResponse> {
  if (!isAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Server is not configured for MCP. Set FIREBASE_SERVICE_ACCOUNT in .env.local.",
      },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }
  // Initializing the Admin SDK can fail if the service-account credential is
  // malformed — surface that as a 500 with a real message rather than a 401,
  // which would wrongly look like an auth problem.
  let auth;
  try {
    auth = adminAuth();
  } catch (e) {
    console.error("[api/keys] Firebase Admin init failed:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? `Firebase Admin init failed: ${e.message}`
            : "Firebase Admin init failed",
      },
      { status: 500 },
    );
  }
  try {
    const decoded = await auth.verifyIdToken(match[1]);
    return decoded.uid;
  } catch (e) {
    console.error("[api/keys] verifyIdToken failed:", e);
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}

// Surface Firestore/Admin errors as JSON instead of an opaque generic 500,
// mirroring /api/orgs — otherwise a failing data op is undiagnosable in prod.
function fail(e: unknown): NextResponse {
  console.error("[api/keys] handler failed:", e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Request failed" },
    { status: 500 },
  );
}

export async function GET(req: NextRequest) {
  const uid = await requireUid(req);
  if (typeof uid !== "string") return uid;
  try {
    const keys = await listApiKeys(uid);
    return NextResponse.json({ keys });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const uid = await requireUid(req);
  if (typeof uid !== "string") return uid;
  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label : "";
  try {
    const { token, meta } = await createApiKey(uid, label);
    // `token` is returned exactly once — the client must show/copy it now.
    return NextResponse.json({ token, key: meta }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  const uid = await requireUid(req);
  if (typeof uid !== "string") return uid;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });
  }
  try {
    const ok = await revokeApiKey(uid, id);
    if (!ok) return NextResponse.json({ error: "Key not found" }, { status: 404 });
    return NextResponse.json({ revoked: id });
  } catch (e) {
    return fail(e);
  }
}
