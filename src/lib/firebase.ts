// Firebase client initialization.
//
// Credentials are read from NEXT_PUBLIC_FIREBASE_* env vars (see .env.local.example).
// The app is written so that the UI loads even before you add credentials — we expose
// `isFirebaseConfigured` so screens can show a friendly "connect Firebase" prompt
// instead of crashing.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// True only when the essential keys are present. Used across the app to gate
// Firebase-dependent UI before credentials are supplied.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

// These are non-null at runtime whenever `isFirebaseConfigured` is true.
// We assert the type so call sites stay clean; always guard with isFirebaseConfigured first.
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export { app };
