"use client";
import { TextareaField } from "@/shared/ui/TextareaField";
import { useCreateProfile } from "./mutations";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { createProfileSchema } from "./contracts";
export function CreateProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [validation, setValidation] = useState("");
  const mutation = useCreateProfile((client) => {
    onOpenChange(false);
    router.push(`/portfolio/${client.id}`);
  });
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = createProfileSchema.safeParse(form);
    if (!parsed.success) {
      setValidation(
        parsed.error.issues.map((issue) => issue.message).join(" "),
      );
      return;
    }
    setValidation("");
    const body = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== ""),
    );
    mutation.mutate({ ...body, profileStatus: "ACTIVE" });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) onOpenChange(value);
      }}
      title="Add profile"
      description="Create a client organization and its primary contact."
    >
      <form onSubmit={submit} className="stack">
        <p className="muted">
          Adding a prospect?{" "}
          <Link href="/portfolio/prospects?new=1">Open Add prospect ↗</Link>
        </p>
        <div className="formGrid">
          <label>
            Organization name
            <input name="name" required maxLength={200} autoFocus />
          </label>
          <input type="hidden" name="profileType" value="CLIENT" />
          <label>
            Website
            <input name="website" placeholder="example.org" />
          </label>
          <label>
            Sector
            <input name="sectorTag" />
          </label>
          <label>
            Primary contact
            <input name="primaryContactName" />
          </label>
          <label>
            Contact email
            <input name="primaryContactEmail" type="email" />
          </label>
          <label>
            Contact phone
            <input name="primaryContactPhone" type="tel" />
          </label>
        </div>
        <TextareaField label="Organization description" name="description" />
        {validation && (
          <p role="alert" className="danger">
            {validation}
          </p>
        )}
        <QueryState error={mutation.error} />
        <div className="formActions">
          <button
            className="button"
            type="button"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button className="button primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create profile"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
