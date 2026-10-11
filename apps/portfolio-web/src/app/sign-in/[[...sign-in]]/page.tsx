import { SignIn } from "@clerk/nextjs";
import { readConfig } from "@/shared/config/config";
export default function Page() {
  return (
    <main className="centered">
      {readConfig(process.env).authConfigured ? (
        <SignIn fallbackRedirectUrl="/portfolio" />
      ) : (
        <p>Configure the existing Clerk test application to sign in.</p>
      )}
    </main>
  );
}
