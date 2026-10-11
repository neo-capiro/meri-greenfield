import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { ClientFrame } from "@/features/client-profile/public";
import { readConfig } from "@/shared/config/config";
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  if (!z.string().uuid().safeParse(clientId).success) notFound();
  return (
    <ClientFrame
      clientId={clientId}
      destinations={readConfig(process.env).destinations}
    >
      {children}
    </ClientFrame>
  );
}
