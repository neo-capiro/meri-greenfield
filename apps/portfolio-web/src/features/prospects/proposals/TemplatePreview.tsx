"use client";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useTemplate } from "./hooks";
import styles from "./proposals.module.css";

export function TemplatePreview({
  tenantId,
  templateId,
  onClose,
  onRestoreFocus,
}: {
  tenantId: string;
  templateId: string;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  const query = useTemplate(tenantId, templateId);
  const template = query.isSuccess && !query.error ? query.data : undefined;
  return (
    <Dialog
      open
      title={template?.name ?? "Template preview"}
      description="Preview of the saved template structure. No proposal content, fees or document has been generated."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={styles.catalog}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onRestoreFocus();
      }}
    >
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {template && (
        <div className="stack">
          <div>
            <span className="eyebrow">Product</span>
            <p>{template.product || "Unspecified"}</p>
          </div>
          {template.description && <p>{template.description}</p>}
          <h3>Sections</h3>
          {template.sections.length ? (
            <ol className={styles.sections}>
              {template.sections.map((section, index) => (
                <li key={`${index}:${section}`}>{section}</li>
              ))}
            </ol>
          ) : (
            <p>No section outline is provided for this template.</p>
          )}
          <h3>Included elements</h3>
          {template.elements.length ? (
            <ul className={styles.sections}>
              {template.elements.map((element, index) => (
                <li key={`${index}:${element}`}>{element}</li>
              ))}
            </ul>
          ) : (
            <p>No additional elements are provided.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}
