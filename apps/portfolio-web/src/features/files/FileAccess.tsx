"use client";
import { useState } from "react";
import { useMemberOptions, memberName } from "@/features/portfolio/public";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useFileAccess } from "./queries";
import { useFileChange } from "./mutations";
import type { Attachment } from "./contracts";
export function FileAccess({
  clientId,
  file,
  folder,
  onClose,
}: {
  clientId: string;
  file?: Attachment;
  folder?: string | null;
  onClose: () => void;
}) {
  const query = useFileAccess(clientId, file?.id);
  const members = useMemberOptions();
  const change = useFileChange(clientId, onClose);
  return (
    <Dialog
      open
      title={`Access: ${file?.fileName ?? folder ?? "Unfiled"}`}
      description="Choose who on your team can view these files. The uploader retains access."
      onOpenChange={(open) => {
        if (!open && !change.isPending) onClose();
      }}
    >
      <QueryState
        pending={Boolean(file) && query.isPending}
        error={query.error ?? members.error}
        retry={() => {
          void query.refetch();
          void members.refetch();
        }}
      />
      {(!file || query.data) && (
        <AccessForm
          key={query.data?.id ?? "folder"}
          initial={query.data}
          members={members.data ?? []}
          pending={change.isPending || members.isPending}
          onSave={(viewerMode, viewerUserIds) =>
            change.mutate(
              file
                ? { kind: "access", id: file.id, viewerMode, viewerUserIds }
                : {
                    kind: "folder-access",
                    folder: folder ?? null,
                    viewerMode,
                    viewerUserIds,
                  },
            )
          }
        />
      )}
      {!file && (
        <small>
          Applies to the files currently visible in this folder. Future uploads
          do not inherit this setting.
        </small>
      )}
      <QueryState error={change.error} />
    </Dialog>
  );
}
function AccessForm({
  initial,
  members,
  pending,
  onSave,
}: {
  initial?: { viewerMode: "all" | "restricted"; viewerUserIds: string[] };
  members: NonNullable<ReturnType<typeof useMemberOptions>["data"]>;
  pending: boolean;
  onSave: (mode: "all" | "restricted", ids: string[]) => void;
}) {
  const [mode, setMode] = useState(initial?.viewerMode);
  const [ids, setIds] = useState(initial?.viewerUserIds ?? []);
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (mode) onSave(mode, mode === "all" ? [] : ids);
      }}
    >
      <fieldset>
        <legend>Who can view</legend>
        {(["all", "restricted"] as const).map((value) => (
          <label className="row" key={value}>
            <input
              type="radio"
              required
              name="mode"
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {value === "all" ? "All team members" : "Specific people"}
          </label>
        ))}
      </fieldset>
      {mode === "restricted" && (
        <div className="stack">
          {members.map((member) => (
            <label className="row" key={member.id}>
              <input
                type="checkbox"
                checked={ids.includes(member.id)}
                onChange={(event) =>
                  setIds(
                    event.target.checked
                      ? [...ids, member.id]
                      : ids.filter((id) => id !== member.id),
                  )
                }
              />
              <span>
                {memberName(member)}
                <small className="block">{member.email}</small>
              </span>
            </label>
          ))}
          <small>An empty selection grants access only to the uploader.</small>
        </div>
      )}
      <button className="button primary" disabled={pending || !mode}>
        Save access
      </button>
    </form>
  );
}
