// Personal Access Token (PAT) system for the MCP endpoint.
//
// A user generates a key in the web app; we store only its SHA-256 hash (never
// the raw token), so a database leak can't recover working keys. An agent later
// presents the raw token as a Bearer credential to /api/mcp; we hash it, look up
// the matching key, and resolve the owner uid — that uid scopes every operation.
//
// Tokens look like:  nx_live_<43 url-safe base64 chars>

import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

const COL = "apiKeys";
const TOKEN_PREFIX = "nx_live_";
/** How many leading chars we keep in plaintext for display (e.g. "nx_live_aB3x"). */
const DISPLAY_PREFIX_LEN = TOKEN_PREFIX.length + 4;

export interface ApiKeyMetadata {
  id: string;
  label: string;
  prefix: string; // e.g. "nx_live_aB3x…" — safe to show, not the full token
  createdAt: number;
  lastUsedAt: number | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  // 32 random bytes → 43 url-safe base64 chars, no padding.
  const raw = randomBytes(32).toString("base64url");
  return TOKEN_PREFIX + raw;
}

/**
 * Create a new key for `ownerId`. Returns the RAW token exactly once — it is
 * never retrievable again. Persist only the hash + display prefix.
 */
export async function createApiKey(
  ownerId: string,
  label: string,
): Promise<{ token: string; meta: ApiKeyMetadata }> {
  const token = generateToken();
  const prefix = token.slice(0, DISPLAY_PREFIX_LEN);
  const ref = await adminDb().collection(COL).add({
    ownerId,
    hash: hashToken(token),
    prefix,
    label: label.trim() || "Untitled key",
    revoked: false,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
  });
  const snap = await ref.get();
  return { token, meta: toMeta(ref.id, snap.data()!) };
}

/**
 * Verify a presented Bearer token. Returns the owner uid if the token is valid
 * and not revoked, otherwise null. Updates lastUsedAt as a side effect.
 */
export async function verifyApiKey(token: string): Promise<string | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const snap = await adminDb()
    .collection(COL)
    .where("hash", "==", hashToken(token))
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  if (data.revoked) return null;
  // Best-effort touch; don't fail the request if it can't write.
  doc.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});
  return data.ownerId as string;
}

/** List a user's keys (metadata only — never the hash or raw token). */
export async function listApiKeys(ownerId: string): Promise<ApiKeyMetadata[]> {
  const snap = await adminDb()
    .collection(COL)
    .where("ownerId", "==", ownerId)
    .where("revoked", "==", false)
    .get();
  return snap.docs
    .map((d) => toMeta(d.id, d.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Revoke (soft-delete) a key the caller owns. */
export async function revokeApiKey(ownerId: string, id: string): Promise<boolean> {
  const ref = adminDb().collection(COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.ownerId !== ownerId) return false;
  await ref.update({ revoked: true });
  return true;
}

function toMeta(id: string, data: FirebaseFirestore.DocumentData): ApiKeyMetadata {
  const createdAt =
    data.createdAt && typeof data.createdAt.toMillis === "function"
      ? data.createdAt.toMillis()
      : Date.now();
  const lastUsedAt =
    data.lastUsedAt && typeof data.lastUsedAt.toMillis === "function"
      ? data.lastUsedAt.toMillis()
      : null;
  return {
    id,
    label: data.label ?? "Untitled key",
    prefix: data.prefix ?? TOKEN_PREFIX,
    createdAt,
    lastUsedAt,
  };
}
