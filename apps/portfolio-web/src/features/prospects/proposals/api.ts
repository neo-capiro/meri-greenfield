import { ApiError, type ApiClient } from "@/shared/api/http";
import { librarySchema, templateSchema } from "./contracts";

export const readTemplateLibrary = (api: ApiClient, signal?: AbortSignal) =>
  api.request("workspace", "templates/library", librarySchema, { signal });

export async function readTemplate(
  api: ApiClient,
  id: string,
  signal?: AbortSignal,
) {
  const template = await api.request(
    "workspace",
    `templates/${encodeURIComponent(id)}`,
    templateSchema,
    { signal },
  );
  if (template.id !== id)
    throw new ApiError(
      502,
      "The returned template does not match your selection. Please retry.",
    );
  return template;
}
