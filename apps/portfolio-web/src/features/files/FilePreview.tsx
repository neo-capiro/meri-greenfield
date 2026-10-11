"use client";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { signedUrl, type Attachment } from "./contracts";
import { useExtractFile } from "./mutations";
export function FilePreview({
  clientId,
  file,
  onClose,
}: {
  clientId: string;
  file: Attachment;
  onClose: () => void;
}) {
  const extract = useExtractFile(clientId);
  const preview = file.usable ? signedUrl(file.previewUrl) : undefined;
  const download = file.usable ? signedUrl(file.downloadUrl) : undefined;
  return (
    <Dialog
      open
      title={file.fileName}
      description="Open the original file or read the service's extracted text."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="stack">
        {file.scanDisclosure && <p role="status">{file.scanDisclosure}</p>}
        {!file.usable ? (
          <p role="alert">
            This file cannot be opened:{" "}
            {file.blockedReason ?? file.lifecycleStatus}.
          </p>
        ) : (
          <div className="status">
            <p>
              Inline preview is unavailable. Open the original file in a new tab
              or download it.
            </p>
          </div>
        )}
        <div className="row">
          {preview && (
            <a
              className="button"
              href={preview}
              target="_blank"
              rel="noreferrer"
            >
              Open in new tab
            </a>
          )}
          {download && (
            <a
              className="button primary"
              href={download}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          )}
        </div>
        <button
          className="button"
          disabled={!file.usable || extract.isPending}
          onClick={() => extract.mutate(file.id)}
        >
          {extract.isPending ? "Reading text…" : "Read extracted text"}
        </button>
        <QueryState error={extract.error} />
        {extract.data && (
          <>
            <p role="status">
              {extract.data.truncated
                ? "Partial text · extraction limit reached."
                : "Extracted text"}
            </p>
            {extract.data.disclosure && (
              <small>{extract.data.disclosure}</small>
            )}
            <pre
              style={{
                whiteSpace: "pre-wrap",
                maxHeight: 400,
                overflow: "auto",
              }}
            >
              {extract.data.text || "No readable text was found."}
            </pre>
          </>
        )}
      </div>
    </Dialog>
  );
}
