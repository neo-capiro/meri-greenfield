import { z } from "zod";
export const strategySummarySchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  title: z.string(),
  type: z.string(),
  ownerUserId: z.string(),
  nodeCount: z.number().int(),
});
export const strategyNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  kind: z.string(),
  status: z.string(),
  startsOn: z.string(),
  endsOn: z.string().nullable(),
  openEnded: z.boolean(),
  ownerUserId: z.string().nullable(),
  note: z.string().nullable(),
});
export const strategyDetailSchema = strategySummarySchema
  .omit({ nodeCount: true })
  .extend({
    goal: z.string().nullable(),
    targetDate: z.string().nullable(),
    draftedByMeri: z.boolean(),
    nodes: z.array(strategyNodeSchema),
    artifacts: z.array(z.object({ id: z.string().uuid() })),
  });
export const workspaceDraftSchema = z.object({
  id: z.string().uuid(),
  docTitle: z.string(),
  client: z.string().nullable(),
  product: z.string().nullable(),
  ownerId: z.string(),
  status: z.enum(["draft", "complete"]),
  updatedAt: z.string(),
});
export type StrategyDetail = z.infer<typeof strategyDetailSchema>;
export type WorkspaceDraft = z.infer<typeof workspaceDraftSchema>;

// Workspace currently persists the client's display name. Never guess a match
// between same-name clients, or interpret a missing association as this client.
export function clientDrafts(
  drafts: WorkspaceDraft[],
  client: { id: string; name: string },
  clients: { id: string; name: string }[],
) {
  const unique =
    clients.filter((candidate) => candidate.name === client.name).length === 1;
  return unique ? drafts.filter((draft) => draft.client === client.name) : [];
}
export function workProjection(strategies: StrategyDetail[], today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 30);
  const end = date.toISOString().slice(0, 10);
  const nodes = strategies.flatMap((strategy) =>
    strategy.nodes.map((node) => ({
      ...node,
      strategyId: strategy.id,
      strategyTitle: strategy.title,
    })),
  );
  const live = nodes.filter(
    (node) => node.status === "active" || node.status === "in_progress",
  );
  const upcoming = live
    .filter(
      (node) =>
        node.startsOn.slice(0, 10) >= today && node.startsOn.slice(0, 10) < end,
    )
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return {
    live,
    upcoming,
    risks: nodes.filter(
      (node) => node.kind === "risk" && node.status !== "completed",
    ),
    artifacts: strategies.reduce(
      (total, strategy) => total + strategy.artifacts.length,
      0,
    ),
  };
}
