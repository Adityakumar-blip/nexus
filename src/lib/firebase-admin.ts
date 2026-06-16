// Firebase Admin SDK initialization (server-only).
//
// This runs only inside server route handlers (/api/*) — never in the browser.
// It uses a service-account credential so it can read/write Firestore on behalf
// of the API-key system and the MCP endpoint. Because the Admin SDK BYPASSES the
// Firestore security rules, every data-access function in nexus-admin.ts must
// scope its queries/writes by ownerId itself.
//
// The service account is read from FIREBASE_SERVICE_ACCOUNT (or the legacy
// NEXT_FIREBASE_SERVICE_ACCOUNT). The value may be EITHER:
//   • the service-account JSON inline on a SINGLE line, or
//   • a filesystem path to the downloaded JSON file.
// Alternatively, set GOOGLE_APPLICATION_CREDENTIALS to the JSON file path.
//
// NOTE: inline JSON must be a single line (optionally single-quoted). A pretty-
// printed, multi-line value cannot be parsed from a .env file. See
// .env.local.example.

import "server-only";

import { readFileSync } from "node:fs";
import {
  getApps,
  getApp,
  initializeApp,
  cert,
  applicationDefault,
  type App,
  type ServiceAccount,
  type Credential,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

const RAW_ACCOUNT = (
  process.env.FIREBASE_SERVICE_ACCOUNT ??
  process.env.NEXT_FIREBASE_SERVICE_ACCOUNT ??
  ""
).trim();

// Build a Credential from the inline JSON or file path, or null if not provided.
function serviceAccountCredential(): Credential | null {
  if (!RAW_ACCOUNT) return null;
  // Inline JSON starts with "{"; otherwise treat the value as a file path.
  let json: string;
  try {
    json = RAW_ACCOUNT.startsWith("{")
      ? RAW_ACCOUNT
      : readFileSync(RAW_ACCOUNT, "utf8");
  } catch (e) {
    throw new Error(
      `Could not read the service-account file at "${RAW_ACCOUNT}": ` +
        (e instanceof Error ? e.message : String(e)),
    );
  }
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON. If you pasted the JSON " +
        "inline, it must be on a single line (a multi-line value can't be read " +
        "from a .env file) — or set it to the path of the JSON file instead.",
    );
  }
  return cert({
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    // Tolerate escaped newlines (\n) that survive .env round-tripping.
    privateKey:
      typeof parsed.private_key === "string"
        ? parsed.private_key.replace(/\\n/g, "\n")
        : parsed.private_key,
  } as ServiceAccount);
}

let app: App | undefined;

function init(): App {
  if (getApps().length) return getApp();
  const cred = serviceAccountCredential();
  if (cred) return initializeApp({ credential: cred });
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault() });
  }
  throw new Error(
    "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT (inline " +
      "JSON on a single line, or a path to the JSON file) or " +
      "GOOGLE_APPLICATION_CREDENTIALS in .env.local. See .env.local.example.",
  );
}

/** True when a service-account credential is available. */
export const isAdminConfigured = Boolean(
  RAW_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS,
);

export function adminDb(): Firestore {
  if (!app) app = init();
  return getFirestore(app);
}

export function adminAuth(): Auth {
  if (!app) app = init();
  return getAuth(app);
}
