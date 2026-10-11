"use client";
import { useState } from "react";
import { QueryState } from "@/shared/ui/QueryState";
import { useFiles } from "./queries";
import type { Attachment } from "./contracts";
import { UploadDialog } from "./UploadDialog";
import { FilePreview } from "./FilePreview";
// Public shared feature: sub-entity documents use the same attachment pipeline,
// cache, client association and readiness rules as the client's Files page.
export function EntityDocuments({
  clientId,
  source,
}: {
  clientId: string;
  source: string;
}) {
  const query = useFiles(clientId);
  const [upload, setUpload] = useState(false);
  const [preview, setPreview] = useState<Attachment>();
  const files = query.data?.filter((file) => file.source === source);
  return (
    <section className="stack">
      <header className="row between">
        <h3>Documents</h3>
        <button className="button" onClick={() => setUpload(true)}>
          Upload document
        </button>
      </header>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {files?.map((file) => (
        <button
          className="button ghost"
          key={file.id}
          onClick={() => setPreview(file)}
        >
          {file.fileName}
        </button>
      ))}
      {files?.length === 0 && (
        <p className="muted">No documents linked to this record.</p>
      )}
      {upload && (
        <UploadDialog
          clientId={clientId}
          source={source}
          onClose={() => setUpload(false)}
        />
      )}{" "}
      {preview && (
        <FilePreview
          clientId={clientId}
          file={preview}
          onClose={() => setPreview(undefined)}
        />
      )}
    </section>
  );
}
