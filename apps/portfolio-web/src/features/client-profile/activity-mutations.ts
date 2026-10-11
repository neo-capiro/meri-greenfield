"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useApi } from "@/shared/api/provider";
import {
  activityEditSchema,
  type Activity,
  type ActivityEdit,
} from "./contracts";
import { profileKey } from "./queries";

type ActivityChange =
  | { action: "edit"; fields: ActivityEdit }
  | { action: "settle"; settled: boolean }
  | { action: "remove" };

export function useChangeActivity(
  clientId: string,
  item: Activity,
  onSaved?: () => void,
) {
  const api = useApi();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (change: ActivityChange) => {
      if (item.origin !== "recorded")
        throw new Error("Open the original record to change this activity.");
      const path = `clients/${clientId}/activity/${encodeURIComponent(item.id)}`;
      if (change.action === "remove")
        return api.request("core", path, z.object({ ok: z.literal(true) }), {
          method: "DELETE",
        });
      if (change.action === "settle" && !item.dueAt)
        throw new Error("This activity does not have a due date.");
      // PATCH returns the persisted row, not the normalized timeline projection.
      return api.request(
        "core",
        path,
        z.object({ id: z.literal(item.id), clientId: z.literal(clientId) }),
        {
          method: "PATCH",
          body:
            change.action === "edit"
              ? activityEditSchema.parse(change.fields)
              : { settled: change.settled },
        },
      );
    },
    onSuccess: async () => {
      await cache.invalidateQueries({
        queryKey: profileKey(clientId, "activity"),
      });
      onSaved?.();
    },
  });
}
