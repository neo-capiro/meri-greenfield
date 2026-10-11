import { z } from "zod";

// Workspace TemplateView is generic across products. It contains no firm/global
// ownership, published version or prospect-specific availability designation.
export const templateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  description: z.string().nullable(),
  product: z.string(),
  style: z.string().nullable(),
  fontFamily: z.string().nullable(),
  accentColor: z.string().nullable(),
  meriPrimary: z.boolean(),
  meriSecondary: z.boolean(),
  elements: z.array(z.string()),
  sections: z.array(z.string()),
});
export type WorkspaceTemplate = z.infer<typeof templateSchema>;
export const librarySchema = z
  .array(templateSchema)
  .refine(
    (templates) =>
      new Set(templates.map((template) => template.id)).size ===
      templates.length,
    "Duplicate template identities",
  );
export function filterTemplates(
  templates: WorkspaceTemplate[],
  search: string,
  product: string,
) {
  const needle = search.trim().toLocaleLowerCase();
  return templates.filter(
    (template) =>
      (!product || template.product === product) &&
      (!needle ||
        [template.name, template.description ?? "", template.product].some(
          (value) => value.toLocaleLowerCase().includes(needle),
        )),
  );
}
