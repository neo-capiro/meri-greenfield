import { z } from "zod";

export const portfolioAlertSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().uuid(),
  clientName: z.string(),
  type: z.string(),
  severity: z.string(),
  title: z.string(),
  subtitle: z.string(),
  when: z.string().datetime({ offset: true }),
  countdownDays: z.number().finite().nullable(),
  countdownLabel: z.string().nullable(),
  href: z.string().nullable(),
  state: z.string().nullable().optional(),
  canonicalComplete: z.boolean().optional(),
  canonicalMissingFields: z.array(z.string()).optional(),
});

export const portfolioAlertsSchema = z
  .object({
    alerts: z.array(portfolioAlertSchema).max(50),
    total: z.number().int().nonnegative(),
    clientCount: z.number().int().nonnegative(),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .superRefine((value, context) => {
    if (value.total < value.alerts.length)
      context.addIssue({ code: "custom", message: "Invalid reported count" });
    const ids = new Set<string>();
    for (const alert of value.alerts) {
      if (!alert.id.startsWith(`${alert.clientId}:`) || ids.has(alert.id))
        context.addIssue({ code: "custom", message: "Invalid alert identity" });
      ids.add(alert.id);
    }
  });

export type PortfolioAlert = z.infer<typeof portfolioAlertSchema>;
export type PortfolioAlerts = z.infer<typeof portfolioAlertsSchema>;
export interface AttentionClient {
  id: string;
  name: string;
}
