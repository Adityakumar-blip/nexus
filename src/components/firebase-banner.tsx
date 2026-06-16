"use client";

// Non-blocking notice shown inside the app when Firebase credentials are missing.
// Lets you explore the UI in a read-only "demo" state while still surfacing the
// setup steps on demand (replaces the old full-screen FirebaseGate block).

import { useState } from "react";
import { Boxes, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function FirebaseBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border-b border-amber-200/70 dark:border-amber-900/60">
      <div className="flex items-center gap-3 px-4 py-2 text-sm">
        <Boxes className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="font-medium">Demo mode.</span> Firebase isn&apos;t
          connected, so sign-in and saving are disabled.
        </p>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-amber-300 bg-transparent text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
            >
              Connect Firebase
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Firebase to continue</DialogTitle>
              <DialogDescription>
                Nexus is wired up and ready — it just needs your Firebase project
                credentials.
              </DialogDescription>
            </DialogHeader>
            <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
              <li>
                Create a project at{" "}
                <a
                  className="text-foreground font-medium underline underline-offset-4"
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  console.firebase.google.com
                </a>
                .
              </li>
              <li>
                In{" "}
                <span className="text-foreground">Build → Authentication</span>,
                enable the{" "}
                <span className="text-foreground">Email/Password</span> sign-in
                method.
              </li>
              <li>
                In <span className="text-foreground">Build → Firestore</span>,
                create a database and paste the rules from{" "}
                <code className="bg-muted rounded px-1 py-0.5">
                  firestore.rules
                </code>
                .
              </li>
              <li>
                Add a Web App, copy the config, and fill in{" "}
                <code className="bg-muted rounded px-1 py-0.5">.env.local</code>{" "}
                (see{" "}
                <code className="bg-muted rounded px-1 py-0.5">
                  .env.local.example
                </code>
                ).
              </li>
              <li>Restart the dev server.</li>
            </ol>
          </DialogContent>
        </Dialog>

        <button
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-100"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
