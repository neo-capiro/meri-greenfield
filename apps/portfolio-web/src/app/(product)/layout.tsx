import type { ReactNode } from "react";
import { readConfig } from "@/shared/config/config";
import { SessionBoundary } from "@/shared/auth/SessionBoundary";
import Image from "next/image";
export default function Layout({ children }: { children: ReactNode }) {
  const config = readConfig(process.env);
  if (config.issues.length)
    return (
      <main className="centered">
        <Image
          src="/design/411-41421-imgCapiroWordmark.png"
          alt="Capiro"
          width={77}
          height={26}
        />
        <h1>Portfolio setup required</h1>
        <p>Connect the designated test environment to start Portfolio.</p>
        <ul>
          {config.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </main>
    );
  return <SessionBoundary>{children}</SessionBoundary>;
}
