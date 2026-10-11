"use client";
import { DropdownMenu } from "radix-ui";
import { fileStatus, type Attachment } from "./contracts";
import styles from "./files.module.css";
export type FileAction = "preview" | "move" | "access" | "delete";
export function FileTable({
  files,
  selected,
  onSelect,
  onAction,
}: {
  files: Attachment[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  onAction: (action: FileAction, file: Attachment) => void;
}) {
  return (
    <div className="tableWrap">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select visible files"
                checked={
                  files.length > 0 &&
                  files.every((f) => selected.includes(f.id))
                }
                onChange={(event) =>
                  onSelect(
                    event.target.checked
                      ? [...new Set([...selected, ...files.map((f) => f.id)])]
                      : selected.filter(
                          (id) => !files.some((f) => f.id === id),
                        ),
                  )
                }
              />
            </th>
            <th>Name</th>
            <th>Linked to / location</th>
            <th>Created</th>
            <th>Owner</th>
            <th>Status</th>
            <th>
              <span className="srOnly">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${file.fileName}`}
                  checked={selected.includes(file.id)}
                  onChange={(event) =>
                    onSelect(
                      event.target.checked
                        ? [...selected, file.id]
                        : selected.filter((id) => id !== file.id),
                    )
                  }
                />
              </td>
              <td>
                <button
                  className={styles.fileName}
                  onClick={() => onAction("preview", file)}
                >
                  <span className={styles.extension}>
                    {file.fileName.split(".").pop()}
                  </span>
                  {file.fileName}
                </button>
                <small>{file.source}</small>
              </td>
              <td>{file.folder ?? "Unfiled"}</td>
              <td>{new Date(file.createdAt).toLocaleDateString()}</td>
              <td>{file.uploadedByName ?? "Unknown"}</td>
              <td>
                <span className="chip">{fileStatus(file)}</span>
                {file.scanDisclosure && <small>{file.scanDisclosure}</small>}
              </td>
              <td>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger
                    className="button ghost iconButton"
                    aria-label={`Actions for ${file.fileName}`}
                  >
                    ⋯
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className={styles.menu} align="end">
                      {(["preview", "move", "access", "delete"] as const).map(
                        (action) => (
                          <DropdownMenu.Item
                            key={action}
                            onSelect={() => onAction(action, file)}
                          >
                            {action === "move"
                              ? "Move to folder"
                              : action === "access"
                                ? "Manage access"
                                : action === "delete"
                                  ? "Delete file"
                                  : "Preview / download"}
                          </DropdownMenu.Item>
                        ),
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {files.length === 0 && <p className="empty">No files match this view.</p>}
    </div>
  );
}
