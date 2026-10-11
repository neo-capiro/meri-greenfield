import type { Page } from "@playwright/test";
export const layoutActor = {
  tenantId: "20000000-0000-4000-8000-000000000001",
  userId: "30000000-0000-4000-8000-000000000001",
};
export const cardIds = [1, 2, 3].map(
  (index) => `10000000-0000-4000-8000-00000000000${index}`,
);
export const layoutReceipt = (version = 0, ids = cardIds) => ({
  ...layoutActor,
  contractVersion: 1,
  version,
  updatedAt: version ? "2026-10-11T00:00:00.000Z" : null,
  order: ids.map((id) => `client:${id}`),
});
export async function layoutFixtures(page: Page, role = "standard_user") {
  await page.route("**/api/backend/core/me", (route) =>
    route.fulfill({
      json: {
        user: { id: layoutActor.userId, email: "layout@example.test" },
        tenant: { id: layoutActor.tenantId, name: "Synthetic tenant" },
        role,
      },
    }),
  );
}
