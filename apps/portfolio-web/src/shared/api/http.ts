import { z } from "zod";
import type { Service } from "../config/config";
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export interface ApiClient {
  request<T>(
    service: Service,
    path: string,
    schema: z.ZodType<T>,
    options?: { method?: string; body?: unknown; signal?: AbortSignal },
  ): Promise<T>;
}
export function createApiClient(
  fetcher: typeof fetch = fetch,
  onSessionExpired?: () => void,
): ApiClient {
  return {
    async request(service, path, schema, options = {}) {
      const response = await fetcher(`/api/backend/${service}/${path}`, {
        method: options.method ?? "GET",
        signal: options.signal,
        credentials: "same-origin",
        headers:
          options.body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        cache: "no-store",
      });
      const data: unknown =
        response.status === 204
          ? null
          : await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) onSessionExpired?.();
        const detail = z
          .object({ message: z.union([z.string(), z.array(z.string())]) })
          .safeParse(data);
        const message = detail.success
          ? [detail.data.message].flat().join(" ")
          : "The request could not be completed.";
        throw new ApiError(
          response.status,
          response.status === 401
            ? "Your session expired. Sign in again."
            : message,
        );
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success)
        throw new ApiError(
          502,
          "The service returned an unexpected response. Please retry or contact support.",
        );
      return parsed.data;
    },
  };
}
export const acknowledged = z.unknown();
export const queryString = (
  values: Record<string, string | number | undefined>,
) => {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) result.set(key, String(value));
  return result.toString();
};
