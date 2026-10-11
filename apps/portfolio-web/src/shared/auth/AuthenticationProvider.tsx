"use client";
import {
  ClerkProvider,
  ClerkLoaded,
  ClerkLoading,
  ClerkFailed,
} from "@clerk/nextjs";
import type { ReactNode } from "react";

export function AuthenticationProvider({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: ReactNode;
}) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkLoading>
        <main className="centered" role="status">
          Loading sign-in…
        </main>
      </ClerkLoading>
      <ClerkFailed>
        <main className="centered stack">
          <h1>Sign-in unavailable</h1>
          <p>Authentication could not start. Reload to try again.</p>
          <p>If this continues, contact your administrator.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      </ClerkFailed>
      <ClerkLoaded>{children}</ClerkLoaded>
    </ClerkProvider>
  );
}
