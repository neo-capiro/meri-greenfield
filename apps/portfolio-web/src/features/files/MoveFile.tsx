"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useFileChange } from "./mutations";
import type { Attachment } from "./contracts";
export function MoveFile({
  clientId,
  file,
  folders,
  onClose,
  creating = false,
}: {
  clientId: string;
  file: Attachment;
  folders: string[];
  onClose: () => void;
  creating?: boolean;
}) {
  const [folder, setFolder] = useState(creating ? "" : (file.folder ?? ""));
  const [search, setSearch] = useState("");
  const move = useFileChange(clientId, onClose);
  return (
    <Dialog
      open
      title={creating ? "New folder" : "Move to folder"}
      description={`File organization for ${file.fileName}.`}
      onOpenChange={(open) => {
        if (!open && !move.isPending) onClose();
      }}
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          move.mutate({
            kind: "move",
            id: file.id,
            folder: folder.trim() || null,
          });
        }}
      >
        {creating ? (
          <label>
            Folder name
            <input
              required
              autoFocus
              maxLength={120}
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            />
          </label>
        ) : (
          <>
            <input
              aria-label="Search folders"
              placeholder="Search folders"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <fieldset>
              <legend>Destination</legend>
              {["", ...folders]
                .filter((name) =>
                  name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((name) => (
                  <label className="row" key={name}>
                    <input
                      type="radio"
                      name="folder"
                      checked={folder === name}
                      onChange={() => setFolder(name)}
                    />
                    {name || "Unfiled"}
                  </label>
                ))}
            </fieldset>
          </>
        )}
        <p className="muted">
          Folders are shared labels on files. No physical copy is created. Empty
          folders are not persisted.
        </p>
        <QueryState error={move.error} />
        <button
          className="button primary"
          disabled={move.isPending || (creating && !folder.trim())}
        >
          {creating ? "Create folder & move file" : "Move file"}
        </button>
      </form>
    </Dialog>
  );
}
