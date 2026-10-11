import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { ReactNode } from "react";
import { readConfig } from "@/shared/config/config";
import { AuthenticationProvider } from "@/shared/auth/AuthenticationProvider";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Portfolio · Capiro",
  description: "Capiro client Portfolio",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  const config = readConfig(process.env);
  const content = children;
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {config.authConfigured && config.publishableKey ? (
          <AuthenticationProvider publishableKey={config.publishableKey}>
            {content}
          </AuthenticationProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
