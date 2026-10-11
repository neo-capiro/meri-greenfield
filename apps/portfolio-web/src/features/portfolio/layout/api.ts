import { ApiError, type ApiClient } from "@/shared/api/http";
import {
  layoutReceiptSchema,
  layoutOrderSchema,
  type LayoutActor,
  type LayoutReceipt,
  type LayoutSave,
} from "./contracts";
import { sameOrder } from "./ordering";

export function assertLayoutActor(receipt: LayoutReceipt, actor: LayoutActor) {
  if (receipt.tenantId !== actor.tenantId || receipt.userId !== actor.userId)
    throw new ApiError(
      502,
      "The saved layout response does not match this session.",
    );
  return receipt;
}
export async function readPortfolioLayout(
  api: ApiClient,
  actor: LayoutActor,
  clientIds: readonly string[],
  signal?: AbortSignal,
) {
  return assertLayoutCatalog(
    assertLayoutActor(
      await api.request("core", "me/portfolio-layout", layoutReceiptSchema, {
        signal,
      }),
      actor,
    ),
    clientIds,
  );
}
export function assertLayoutCatalog(
  receipt: LayoutReceipt,
  clientIds: readonly string[],
) {
  const expected = new Set(clientIds.map((id) => `client:${id}`));
  if (
    receipt.order.length !== expected.size ||
    receipt.order.some((id) => !expected.has(id))
  )
    throw new ApiError(
      502,
      "The saved layout response does not match the current profile catalog. Reload profiles before continuing.",
    );
  return receipt;
}
export function resolvesLayoutSave(
  receipt: LayoutReceipt,
  input: LayoutSave,
  clientIds: readonly string[],
) {
  return (
    receipt.version === input.expectedVersion + 1 &&
    receipt.order.length === clientIds.length &&
    sameOrder(receipt.order, input.order)
  );
}
export async function savePortfolioLayout(
  api: ApiClient,
  actor: LayoutActor,
  input: LayoutSave,
  clientIds: readonly string[],
  signal?: AbortSignal,
) {
  if (
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    input.expectedVersion >= 2147483647 ||
    !layoutOrderSchema.safeParse(input.order).success
  )
    throw new ApiError(400, "The saved layout order or version is invalid.");
  const receipt = assertLayoutCatalog(
    assertLayoutActor(
      await api.request("core", "me/portfolio-layout", layoutReceiptSchema, {
        method: "PUT",
        body: input,
        signal,
      }),
      actor,
    ),
    clientIds,
  );
  if (!resolvesLayoutSave(receipt, input, clientIds))
    throw new ApiError(
      502,
      "The service did not confirm the requested layout order.",
    );
  return receipt;
}
