# Portfolio summary / Needs attention checkpoint

## Binding and outline — 2026-10-11

- Frontend worktree `C:\dev\meri-portfolio-program-elements-20261011`, branch `codex/portfolio-program-elements-20261011`, root reviewed base `5c66b68a0add1e2498767a35fc04cec53fc9d080`; fetched remote main `4069390` independently. No other checkout changes included.
- Policy freshly fetched/read: capiro-agent-ops `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, remote main `b2b0ce8c2bf03817b81e671d968b7892985b8d06`, clean ahead three. BOOTSTRAP, AGENTS, machine map and frontend instructions applied. Explicit bundled Node `v24.19.0`; approved read-only dependency junction, no installs or dependency writes.
- Mandatory Figma design-to-code skill read before context. Full current Portfolio index `411:41421` and focused Needs attention `411:41621` context/screenshots inspected. `411:47008` metadata is the Client profile Desktop section, not a competing Portfolio index. No Figma writes.
- Parent extended allocated new feature path to `features/portfolio/attention/**` after finding CORE-010 obsolete. Parent owns index composition/shared files. Public interface: `PortfolioAttention({clients: readonly {id, name}[]})`; caller supplies valid canonical accessible clients, not the filtered display subset.
- Outline: validate actual bounded alert response; identity-scoped cached GET; preserve authoritative ordering and source provenance; filter to accessible roster before rendering; source-only severity/recency, incomplete-alert indicators, client profile drill-through; meaningful loading/error/retry/empty states; focused schema/model and synthetic integrated browser qualification.

## CORE-010 — obsolete/legacy current visual scope

The original read-only audit labels API existence, not frontend implementation. Current full index `411:41421` contains Portfolio pulse, profile cards and Needs attention; no standalone Program Elements summary. The Desktop entry `411:47008` contains client workflows, with Program Elements in retained client Capabilities/opportunity context. No summary card was added to close a historical count.

Source read at backend reference `fd6ed6c017ae91ab774fd34f74475a746de13b68` (root verifies current main `fd8765ec01d292013758606204f2c9d886cd31c1`): `apps/api/src/intelligence/intelligence.service.ts:getPortfolioPeSummary` averages finite `delta_pct` from the most-material live delta for each tenant-wide watched PE. This is not a summed/weighted portfolio funding change and provides no common fiscal year/stage/denominator. Attribution is a ClientCapability association, not evidence the client funds a PE. Legacy `PortfolioProgramElements.tsx` used a current-user watch list (different scope), first 100 only, and `latestCurrent ?? latestEnacted` under “Auth”; these unsafe historical labels are not reproduced. Current PE list has source-owned fiscal-year/stage funding claims and matched comparables; no frontend financial calculation is introduced.

## CORE-008 — real attention feed, qualified

- Audited `/api/intelligence/portfolio-rollup` counts **open engagement tasks** as attentionCount; it does not supply the current Needs attention list or unread intelligence. Existing PortfolioPulse is untouched.
- Exact list route: `GET core intelligence/portfolio-alerts?limit=50`, controller standard_user minimum with inherited admin ranks. Source `IntelligenceService:getPortfolioAlerts/computePortfolioAlerts` composes per-user client profile Top alerts, retaining acknowledged and incomplete rows; per-user dismissed/snoozed filtering occurs server-side.
- Bounds: alphabetical first 40 nonarchived tenant clients; each profile returns at most 20; final list at most 50. No paging/continuation. Severity, numeric countdown, then event timestamp determine server order. UI does not infer deadlines from event timestamps, derive priority or show fixture approval/objective/workspace alerts.
- Known backend gap: profile failures are skipped, source helpers may return empty on errors; 12-second timeout/compute failure returns HTTP200 with empty alerts and clientCount0. The response has no completeness/source-failure status. Therefore the card labels a limited feed, counts only returned accessible rows, never claims an empty list proves all clear, and offers explicit refresh. Full coverage requires an owner-defined paginated, authorization-scoped feed with completeness/failure provenance; frontend cannot recover unavailable pages.
- Names/links derive from canonical accessible roster; raw href is not followed (legacy Intelligence route is removed). Clicking opens the actual client profile. The endpoint does not provide a stable source binding to a retained client action/detail drawer; precise source drill-through remains a contract dependency. Incomplete source alerts remain visible.

## Validation / delivery

Pending focused source checks, synthetic integrated browser checks, representative light/mobile-dark visual inspection, parent composition and permitted live GET. No live writes, provider calls, auth/deployment changes, backend edits or full builds. Fixtures will not establish live authenticated browser acceptance. Historical root-qualified 936 evidence is separate from this source.
