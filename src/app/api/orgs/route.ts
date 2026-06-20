// Organization membership API — the operations that can't be done safely from
// the browser:
//   • join  — add the caller to an org by its share code (the caller isn't a
//             member yet, so client-side rules can't let them read/write it)
//   • invite — resolve a teammate's email to a uid (Firebase Auth lookups are
//             server-only) and add them to the org
//
// Authenticated with the signed-in user's Firebase ID token, exactly like
// /api/keys. The Admin SDK bypasses Firestore rules, so every handler checks the
// caller's membership/ownership itself.

import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function requireUid(req: NextRequest): Promise<string | NextResponse> {
  if (!isAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Server is not configured for collaboration. Set FIREBASE_SERVICE_ACCOUNT in .env.local.",
      },
      { status: 503 },
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }
  try {
    const decoded = await adminAuth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch (e) {
    console.error("[api/orgs] verifyIdToken failed:", e);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }
}

export async function POST(req: NextRequest) {
  const uid = await requireUid(req);
  if (typeof uid !== "string") return uid;

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "join") return await join(uid, body);
    if (action === "invite") return await invite(uid, body);
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[api/orgs] handler failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 },
    );
  }
}

// Add the caller to an organization identified by its share code.
async function join(
  uid: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) {
    return NextResponse.json({ error: "Missing join code" }, { status: 400 });
  }
  const db = adminDb();
  const snap = await db
    .collection("organizations")
    .where("joinCode", "==", code)
    .limit(1)
    .get();
  if (snap.empty) {
    return NextResponse.json(
      { error: "No organization found for that code" },
      { status: 404 },
    );
  }
  const org = snap.docs[0];
  await org.ref.update({
    memberIds: FieldValue.arrayUnion(uid),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({
    orgId: org.id,
    name: org.data().name ?? "",
  });
}

// Resolve an email to a Firebase user and add them to the caller's org.
async function invite(
  uid: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const orgId = typeof body.orgId === "string" ? body.orgId : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!orgId || !email) {
    return NextResponse.json(
      { error: "Missing organization or email" },
      { status: 400 },
    );
  }

  const db = adminDb();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const members: string[] = orgSnap.data()?.memberIds ?? [];
  if (!members.includes(uid)) {
    return NextResponse.json(
      { error: "You are not a member of this organization" },
      { status: 403 },
    );
  }

  let invited;
  try {
    invited = await adminAuth().getUserByEmail(email);
  } catch {
    return NextResponse.json(
      { error: "No Nexus account exists for that email yet" },
      { status: 404 },
    );
  }

  // Make sure the invited user has a queryable profile so they render in member
  // lists right away, even if they haven't opened the app since signing up.
  await db
    .collection("users")
    .doc(invited.uid)
    .set(
      {
        uid: invited.uid,
        name: invited.displayName ?? "",
        email: invited.email ?? email,
        photoURL: invited.photoURL ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  await orgRef.update({
    memberIds: FieldValue.arrayUnion(invited.uid),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    uid: invited.uid,
    name: invited.displayName ?? "",
    email: invited.email ?? email,
  });
}
