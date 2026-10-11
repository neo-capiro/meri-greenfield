"use client";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataProvider } from "../api/provider";
export function SessionBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, userId, sessionId, orgId } = useAuth();
  if (!isLoaded)
    return (
      <div className="centered" role="status">
        Loading your session…
      </div>
    );
  if (!userId)
    return (
      <main className="centered">
        <h1>Welcome to Capiro</h1>
        <Link className="button primary" href="/sign-in">
          Sign in
        </Link>
      </main>
    );
  // A new authenticated scope gets a fresh cache; records never survive sign-out/tenant switches.
  return (
    <DataProvider key={`${userId}:${sessionId}:${orgId}`}>
      {children}
    </DataProvider>
  );
}
