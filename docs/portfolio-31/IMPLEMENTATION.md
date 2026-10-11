# Portfolio 3.1 implementation

## Authority and isolation

Human placement decision on 11 October 2026: continue Portfolio in meri-greenfield,
overriding D014 for this explicitly scoped frontend. Meri runtime and qualification
ownership stay with their existing owners. This does not move or rebuild Meri.

Base: `351be38b19279bbf8159b6da6ffc674239ac8ecf`; branch
`codex/portfolio-31-20261010`; checkout `C:\dev\meri-greenfield-portfolio-31`.
Shared policy: `capiro-agent-ops` at `b32b4803933760dc0a93fffdcd8fba30a89c3aac`.
Cleanup owner confirmed no overlap with `apps/portfolio-web/**` on 11 October.

## Outline and ownership

- `apps/portfolio-web`: isolated Next.js/React frontend, own lockfile and port 5188.
  Uses the same approved stack as capiro-frontend. No copied Capiro application.
- `src/app`: thin routes, layouts and bounded same-origin service proxy.
- `src/shared`: validated configuration, HTTP/session boundary, query cache,
  Figma tokens and accessible primitives. No feature imports.
- `src/features`: Portfolio, client profile, Objectives, calendars, relationships,
  work, capabilities, files and opportunities own their adapters and interactions.
- Server authenticates with the existing Clerk application and `capiro` token
  template. Backend remains authoritative for tenant, client and role permissions.
  No browser-supplied tenant header or separate authorization database.
- Transient form/navigation state is local/URL based; shared records persist in
  backend services. TanStack Query owns server cache/invalidation.
- New Objectives backend candidate is capirov2 draft PR 2362. Integration is held
  pending cleanup combined-source review; no migration has been applied.

Existing new frontend public UI exports depend on Tailwind and currently expose
only Meri primitives plus Button. The Figma implementation instruction prohibits
adding Tailwind; use upstream Radix behavior with CSS tokens for Portfolio and
keep stable presentation APIs compatible for later consolidation. Do not import
another application's private shell, DTOs or fixture data.

## Verification and external boundaries

Run focused domain/adapter/proxy tests, type/lint/architecture/build checks and
Playwright responsive flow checks. Fixture checks are labeled separately from
live integration. Review >400 nonblank-line modules and >80-line functions for
mixed responsibility; these are review signals, not acceptance shortcuts.

Backend origins, existing Clerk test configuration, allowed tenant/account and
sandbox operations await the human. Missing config produces a setup state;
missing contracts produce actionable errors rather than fabricated data.
No hosted deployment, shared routing/CORS/auth setting, shared migration,
customer send, calendar write, conversion or billing action is authorized here.
Prepare hosted preview configuration after inspecting available infrastructure.

## Scope checkpoints

1. Shared shell, auth, configuration, tokens/primitives and Portfolio list/intake.
2. Client Overview, account team, facilities and activity; Objectives lifecycle.
3. Distinct client/Master calendar; meeting preparation/notes/debriefs.
4. Relationships, Work links, capabilities, bill tracking, opportunities, files.
5. Prospects/proposals, current audit gaps, full traceability and draft delivery.

Baseline audit evidence remains read-only outside the repo. The implementation
matrix retains all 345 original IDs and never equates API availability with a
working frontend. Record specific dependencies and checks for each workflow.
