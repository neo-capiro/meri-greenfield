"use client";
import { useRouter } from "next/navigation";
import { ClientIntakeDialog } from "@/features/client-intake/public";
export function CreateProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  return (
    <ClientIntakeDialog
      open={open}
      onOpenChange={onOpenChange}
      onSaved={(client) => router.push(`/portfolio/${client.id}`)}
    />
  );
}
