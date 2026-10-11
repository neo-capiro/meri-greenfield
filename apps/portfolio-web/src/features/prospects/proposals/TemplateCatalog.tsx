"use client";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { SelectField } from "@/shared/ui/SelectField";
import { filterTemplates } from "./contracts";
import { useTemplateLibrary } from "./hooks";
import { TemplatePreview } from "./TemplatePreview";
import styles from "./proposals.module.css";

export function TemplateCatalog({
  tenantId,
  onClose,
}: {
  tenantId: string;
  onClose: () => void;
}) {
  const query = useTemplateLibrary(tenantId);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("");
  const [selected, setSelected] = useState<string>();
  const templates = query.isSuccess && !query.error ? query.data : undefined;
  const visible = templates && filterTemplates(templates, search, product);
  return (
    <Dialog
      open
      title="Workspace templates"
      description="All templates visible to your account. This catalog is not restricted to prospect proposals; previewing a template does not generate or save a document."
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={styles.catalog}
    >
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {templates && (
        <>
          <div className={styles.filters}>
            <label>
              Search templates
              <input
                className="input"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, description or product"
              />
            </label>
            <SelectField
              label="Product"
              value={product}
              onChange={(event) => setProduct(event.target.value)}
            >
              <option value="">All products</option>
              {[
                ...new Set(
                  templates.map((template) => template.product).filter(Boolean),
                ),
              ]
                .sort()
                .map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
            </SelectField>
          </div>
          <p className="muted">
            {visible?.length} of {templates.length} templates
          </p>
          {templates.length === 0 ? (
            <p>No Workspace templates are available for this account.</p>
          ) : visible?.length === 0 ? (
            <div className="status stack">
              <p>No templates match these filters.</p>
              <button
                className="button"
                onClick={() => {
                  setSearch("");
                  setProduct("");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className={styles.list} aria-label="Available templates">
              {visible?.map((template) => (
                <li key={template.id}>
                  <div>
                    <strong>{template.name}</strong>
                    <small>{template.product || "Product unspecified"}</small>
                    {template.description && <p>{template.description}</p>}
                  </div>
                  <button
                    className="button"
                    onClick={() => setSelected(template.id)}
                    aria-label={`Preview ${template.name}`}
                  >
                    Preview
                  </button>
                </li>
              ))}
            </ul>
          )}
          <small className="muted">
            The service returns the complete visible catalog without pagination.
            Template ownership and published version metadata are not provided
            here.
          </small>
        </>
      )}
      {selected && templates && (
        <TemplatePreview
          key={selected}
          tenantId={tenantId}
          templateId={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </Dialog>
  );
}
