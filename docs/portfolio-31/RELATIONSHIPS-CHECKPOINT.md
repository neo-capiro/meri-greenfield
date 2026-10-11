# Organization Relationships checkpoint

## Implementation outline (before changes)

Base `f0fbc06abc404af61ed6f072561cfb62e3cbb3bb`, branch `codex/portfolio-relationships-20261011`, isolated checkout `C:\dev\meri-portfolio-relationships-261011`.

Shared policy reread/fetched: local `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; origin/main `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; local map date `2026-09-30T00:21:48.2698715Z`. Repository AGENTS, implementation standards and portfolio AGENTS read. Explicit human frontend repository instruction supersedes the older ops application placement. Next 16.4 installed useRouter/useSearchParams guides read.

- Organization contact API module owns scoped reads/writes and validated receipts through the existing HTTP client. Canonical Person/input/hierarchy contracts remain unchanged; no competing contact service or backend implementation.
- Existing queries/mutations own React Query caching. Successful verified writes invalidate the client roster. Pending client writes refuse duplicates across contact/hierarchy controls. No write retries are automatic.
- ContactForm owns field validation/focus and draft input. ContactDrawer owns scroll/fixed actions, nested confirmation, failure and pending presentation, and composes existing ContactMail/QuickLog/HierarchyEditor unchanged.
- OrganizationRelationships retains query-string deep links, organization chart and roster; identity uses the shared hook and current standard_user/user_admin/capiro_admin rule. Server retains authorization. Government dispatch and its modules remain unchanged.
- Figma 411:51458 (contact details/message history/fixed footer) and 411:50673 (organization chart) inspected with high-fidelity context and screenshots. Legacy backend comment node907:2919 is absent in current Figma and is not an implementation reference.
- Verify API scope/identity/receipt refusal, form retention, pending duplicate refusal, create/edit/remove, keyboard/discard behavior, hierarchy and email/note integration through focused unit and isolated loopback browser checks. No live/provider/customer writes, installs, full Next build or new shared configuration.

## Verified source contracts

Current capirov2 ClientPeopleController/Service: GET/POST `/api/clients/:clientId/people`, PATCH/DELETE `.../:id`, PATCH `.../:id/hierarchy`. Minimum role standard_user; server binds tenant and client. Create/update/hierarchy return ClientPerson; delete returns `{deleted:true}`. Separate hierarchy mutation preserves automatic/manual title inference. No optimistic version, create idempotency or source-history endpoint exists; frontend cannot claim those semantics. Notes are saved contact text; QuickLog is a separate existing person-linked activity workflow.

## Validation / integration status

First source pass: 29/29 focused API/permission tests pass; application TypeScript check passes with installed dependency/type resolver and incremental writes disabled. Focused ESLint passes (the isolated checkout has no installed React package; existing plugin emits its detection warning). Changed source/test files are Prettier formatted and diff check is clean. Early setup failures were transient resolver issues (Geist has no root export, Vitest require-entry selection, Next Link and React type resolution); scratch resolvers were corrected without installs or source workarounds. They remain recorded in task evidence.

Contact writes now validate client/person association and saved field or placement receipts; delete requires `deleted:true`. All writes use the canonical core API and have no automatic retry. A client-scoped mutation key refuses simultaneous writes before a second request. The drawer preserves failed inputs, refuses close during pending contact/hierarchy writes, confirms discard/removal, and has the inspected 640px desktop / viewport-width mobile scroll body and fixed footer. Read-only/unknown roles cannot submit; backend remains the authority. An ambiguous create failure disables another create in that draft and asks the user to inspect the refreshed roster, because the current backend has no create idempotency contract.

Browser and visual results will be appended next. This checkpoint is not live acceptance.
