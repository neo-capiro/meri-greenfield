// @ts-check
/** Definitions of the Capiro product metrics users ask Meri about, taken from the page that shows them so an answer never
 * invents one. Source: capiro-frontend `apps/web/src/features/portfolio/index/PortfolioMetricDefinitions.tsx` and
 * `PortfolioPulse.tsx` (the /portfolio "Portfolio pulse" panel); change both together. */
export const PRODUCT_DEFINITIONS='Capiro product definitions (answer what a Capiro page, metric or feature means only from these or from what a read returned; when neither defines it, say its definition is not available to you rather than guessing). '+
 'Portfolio pulse (the /portfolio panel for the current fiscal year): its headline is bill-watch coverage, the share of active clients with at least one saved bill watch (clients with a watch divided by all visible active clients; duplicate watches count once; no percentage for an empty population). '+
 'Its tiles: Active clients; Objectives (nondeleted draft, in-review and ready objectives); Awaiting review (in-review objectives only, not a health score); Overdue CRM (unsettled saved requests and commitments due before the snapshot, UTC); CRM activity 30d (saved activity entries in the prior 30 days, excluding derived email, meeting and Planner feeds). '+
 'All counts cover the tenant\'s visible active client records, excluding prospects and ethical-wall restricted clients, over the full saved population. Engagement health scores, stage-weighted revenue and win rates are not defined in Capiro yet.';
