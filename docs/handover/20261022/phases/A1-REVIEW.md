# A1 review: capiro-backend #105 @ `e4b6040b` and capiro-frontend #117 @ `f2dc9a39`

adj-a, 2026-10-21. Review only: no edits, no pushes, no GitHub comments.

**Labels:** [R] run here; [D] derived from source.

**Method:**
- **Backend:** WSL Docker, one container at a time, `node:22.23.3-alpine3.24`, pnpm 9.12 frozen install of `@capiro/api...` and `@capiro/workspace...`, `prisma generate`. I ran `tsc`, both builds, full api and workspace jest (JSON) on base `backend-import` `8d9958f7` and on head. Then 31 guard mutants, one at a time on head.
- **Frontend:** a WSL `/opt` copy, `npm ci --ignore-scripts`, then typecheck, all `@capiro/web` unit suites (JSON), lint and build on base `24316f91` and head.
- Both PRs merge cleanly onto their current bases (`backend-import` unchanged; FE `main` `84f5ba29`).

## Verdict

- **capiro-backend #105: CHANGES.** The api build fails. The workspace tests regress, and the new authority suite doesn't run under the repo's own jest config. Three core WS-02 guards are unpinned. Plus the WS-02/03/04 rulings below.
- **capiro-frontend #117: CHANGES.** Typecheck, lint and `next build` all fail on head because of new test files, and one new test can't run in the repo's environment. Plus WS-04 owner recovery.

## Change list for agent 3 v1

### Backend #105 (blocking)

1. **The api build fails** [R]: `src/branding/branding.service.ts:17:49` TS2322 (`'string | undefined'` → `'string | null'`). Under the repo's strict index setting, `contentType.split('/')[1]` is possibly undefined, so `nest build` exits 1 and no API image can be built.
   - **Fix:** return `?? null`, or index safely.
   - **Also fix the two new spec errors:** `src/branding/branding.safety.spec.ts:79` (TS2322, a `Jest` return from a test body) and `:95` (TS2532).
   - **Afterwards** api `tsc` must show only the base error set (62 in the canonical method; my closure shows 75 on both trees, the extra 13 being an ungenerated `api-strategy` client). Head currently adds exactly these 3.
2. **Workspace typecheck goes from 0 to 1 error, and the suite fails to compile** [R]: `src/hillday/hillday-resolution.service.spec.ts:478` calls `clientRelationships('t','missing-doc')` without the new `actorId` (TS2554). Pass an actor, and assert the missing-document refusal separately from an actor refusal.
3. **Workspace jest regresses under the repo's own config (`apps/workspace/jest.config.cjs`)** [R]. Base has 670 tests and 10 failures; head has 636 and 16. The new failures:
   - **`prospect-draft-access.spec.ts`, six tests:** `identity.withSystem is not a function`. `requireDraftClient` now runs a membership query through `withSystem` on the prospect path too, and the fixture lacks it. Adapt the fixture, and keep the prospect assertions.
   - **`hillday-resolution.service.spec.ts`:** suite fails to run (item 2).
   - **`delivery/a1-authority.spec.ts`, the PR's main authority suite:** fails to load (`Could not locate module ../core/index.cjs mapped as $1`). The repo config's mapper `'^(\.{1,2}/.*).js$'` leaves the dot unescaped, so it also rewrites `libphonenumber-js`'s `index.cjs` once a test imports a controller (`class-validator`). The PR's evidence ran these tests only under a private `docs/a1-workspace/jest.config.cjs`, which **itself cannot resolve `ts-jest` from the repo root after a clean pnpm install**.
   - **Fix:** make the A1 workspace tests run under `apps/workspace/jest.config.cjs`. Escape the mapper dot (`'^(\\.{1,2}/.*)\\.js$'`), which would also stop it rewriting `.cjs` elsewhere, or restructure the import. Then drop the private config, or keep it only as documentation.
   - **Done when** the workspace failing-name set equals base.
4. **Pin the core WS-02 guards; three mutants survive the PR's own tests** [R]. Every Hill Day test mocks `source.requireClient` wholesale, so the real membership-and-wall query is never exercised. Add tests over the real `HillDaySourceService.requireClient` (or its SQL through the fixture DB):
   - **B8 survives:** drop `if (!client?.wallAllowed) throw` in `requireClient`. Test: an owner whose client wall is revoked gets 404 on get, list, job, export and file.
   - **B9 survives:** drop `if (!userId) throw` (the active-membership row). Test: a removed or suspended member, or one in an inactive tenant, gets 404.
   - **B10 survives:** drop the per-unit `assertDoc` inside the generation run loop. Test: revoke the wall mid-job; the remaining units are not generated.
   - **B22b survives (WS-04):** drop "a client name cannot establish association" in `DraftsService.create`. Test: create with only `client` (no UUID) is 409 with no write.
5. **WS-02 ruling, export grants** (see Rulings): recheck admission when a signed Hill Day file URL is served. In `HillDayExportService.file`, after the signature check, call `admitHillDayDocument(prisma, source, row.tenantId, row.actorId, documentId)` and refuse with 404. Test: a URL issued before the owner's wall or membership was revoked is refused.
6. **WS-03 ruling, self-approval:** in `ApprovalService.decide`, refuse when `actorId === request.requestedById` (403, no update). Test: owner requests, owner tries to approve → 403; a different eligible reviewer → OK.
7. **WS-04 ruling, owner recovery:**
   - **(a) Backfill (ticket bounded work).** Add a reviewed SQL proposal next to `ws04-client-association.sql` that binds only provably unique mappings: an ordinary draft with `client_id IS NULL`, no prospect, and a trimmed `client` name that equals exactly one `active`, non-`ARCHIVED` client name in the same tenant. Set `client_id` and `config.clientId` together. Leave zero-match, multi-match and archived rows held. The wall is enforced at read, so a backfill grants nothing.
   - **(b) Owners must not lose their own held drafts.** Today `draftClientSourceAccess` returns false for name-only legacy rows, so even the owner gets 404, and the list drops them. Change it so a held legacy row (null `client_id` with a legacy client name) is **owner-only**: readable and editable by its active owner, invisible to collaborators. It is refused by every client-scoped surface (client filters, Portfolio, staging, share, approval, public links) until it is explicitly bound. List it to its owner with a `clientAssociation: 'held'` flag.
   - **Tests:** an owner reads a held row; a collaborator gets 404; share, approval, staging and client filter are refused; binding then proceeds through the existing wall check.

### Frontend #117

9. **Typecheck and `next build` fail** [R]: `tests/newsletter-client-authority.test.ts:2` imports `@testing-library/react`, which is not a repo dependency (TS2307), and `:44` has TS2532. Vitest also can't start that file: `Cannot find package 'jsdom'`.
   - **Fix:** rewrite it with the repo's existing hook/test pattern, with no new dependencies. If it really needs RTL/jsdom, ask Fable first; don't add them silently.
   - **Done when** `npm run typecheck`, `npm run build` and all `@capiro/web` unit suites pass on head, as on base.
10. **Lint fails with 3 errors** [R], all in new tests:
    - `src/features/settings/security-action.test.ts:29` (reassigning a variable declared outside the component/hook);
    - `src/features/settings/security-form.test.ts:106` (`react/no-children-prop`);
    - `tests/newsletter-client-authority.test.ts:13` (`no-explicit-any`).

    Base lint has 0 errors.
8. **WS-04 owner recovery UI (pairs with item 7b):** show held legacy drafts to their owner with "Choose a client to continue", and bind through `workspace.draft.update { clientId }`. A wrong-client or walled selection shows the server refusal. Without this, owners can't recover legacy drafts after the backend deploys.

### Not blocking

- **Deploy order** (both PR bodies say this): backend migration, then backend image, then frontend. FE #117 requires the qualified HQ resend receipt and removes `logoS3Key` from the generic PUT.
- **ST-01 residual:** the confirm path trusts `x-amz-meta-*` set by the server-signed POST policy. Any **other** presigned flow that issues `starts-with $key tenants/{id}/` with free metadata could forge a same-tenant branding object. That is same-tenant only; confirm none exists during the ASSETS_BUCKET qualification.
- **Existing persisted logo keys** still need the "separately authorized operational review" in ST-01. GET now refuses to sign non-owned keys, so there is no exposure meanwhile.
- **The api failure `sam-entity … returns null when no api key configured`** appeared once under load and passes 12/12 alone (unrelated to this PR).

## Per ticket

| Ticket | Bounded work, server-side [D] | Negative tests and mutants [R] |
| --- | --- | --- |
| **ST-01** | The generic PUT is name-only in both the DTO and the service. Confirm requires an exact server-issued key (`logo-{issuedAt}-{uuid}.{ext}`), TTL 5 min, HEAD `ContentType`/`ContentLength` against allowed values, and HEAD metadata `tenant-id` and `upload-issued-at` fixed by the signed policy (`eq` conditions). It locks the row and refuses a superseded upload. GET never signs a non-owned stored key. Presigned POST is kept. | `branding.safety`, `tenant-admin.safety` and `settings-safety.http` (direct HTTP). Mutants B1–B4 and B3b–d **all killed**. |
| **ST-02** | Admin-only role. Self is refused. Inside the transaction, with locks on both memberships, it rechecks the actor's current active `user_admin` and refuses a `capiro_admin` target before any state or outbox change. Removing an already-removed member is idempotent. | B5, B6, B6b **killed**. |
| **ST-24 (consequential)** | FE: `useSettingsMutation` freezes the input, journals every write, refuses new writes while one is uncertain, validates the semantic receipt, and does read-only reconciliation; dialogs block busy dismissal. BE: the HQ resend returns a tenant/email/role-qualified receipt or 502. | HQ receipt mutant B23 **killed**. FE suites in §FE. |
| **WS-02** | One helper, `admitHillDayDocument` (owner-only, active membership, active non-archived client, current wall), is applied to list rows, get, quality, resolution, context, relationships, job and events, generation (start and per unit), refine and export. | Owner B7 and list-row B10b are killed. **The wall (B8), membership (B9) and per-unit recheck (B10) survive** (item 4). Signed file URLs are not rechecked (item 5). |
| **WS-03** | Share/revoke is owner-only. Request needs canEdit; decide needs canReview, narrowed by the frozen nonempty allowlist and rechecked before the conditional update. Release is tied to an exact saved revision (canonical snapshot equality). Share requires approval of that exact version when the policy requires it. Public read/comment rechecks the issuer's authority and serves frozen content. The share index is filtered. Idempotency can't cross revisions. | B11–B17 and B16b/B17b **all killed**. Self-approval is still allowed (item 6). |
| **WS-04** | The `client_id` UUID column (an unnumbered SQL proposal) is carried through create, update, snapshot, restore, list and library. An authoritative name is derived from it. Binding is immutable, and config smuggling is refused. Restore across bindings is refused. | B18–B22 **killed**; **B22b survives** (item 4). No backfill, and owners lose their legacy drafts (items 7, 8). |
| **X-04** | Wrong tenant, wrong owner, client wall, removed member and role downgrade are covered in Settings and WS-03 with direct service and HTTP negatives. WS-02's wall and membership cases are only mocked (item 4). | as above |

## Rulings on the agent's policy questions

- **WS-02 reads, owner-only:** accepted. It is the simplest secure option; team visibility can come later through the existing collaborator model.
- **WS-02 issued PDF URLs, a bearer grant for up to 1 h after revocation:** **not accepted.** The export row already has `tenantId` and `actorId`, so a serve-time recheck through the same helper costs one query, closes the window, and mirrors WS-03's public-link issuer recheck (item 5).
- **WS-03 who shares, requests and decides** (owner shares and revokes; owner/editor requests; owner/editor/reviewer decides, narrowed by a nonempty frozen allowlist; empty adds no restriction): accepted.
- **WS-03 self-approval allowed:** **not accepted.** An approval its requester can grant is not a control. Refuse decider == requester (item 6). A solo tenant that needs approval-free sharing should use a blueprint without `clientFacingApprovalRequired`.
- **WS-03 no pinned blueprint means no approval requirement; missing pinned policy fails closed; approve/reject require unchanged content; public shares serve frozen content with the existing optional expiry and no default deadline:** accepted. The issuer recheck on every read is the revocation path.
- **WS-04 immutable binding, explicit owner binding of legacy/null rows, old versions keep their attribution and can't restore across bindings:** accepted.
- **WS-04 no inferred backfill:** **not accepted as the whole policy.** The ticket requires backfilling provably unique mappings, and the held rows must stay owner-accessible (items 7, 8).

## Gates [R]

| Gate | base | head |
| --- | --- | --- |
| api `tsc --noEmit --rootDir .` | 75 (62 + 13 from the ungenerated `api-strategy` client) | **78**: +3, one of them in production source (item 1) |
| workspace typecheck | 0 | **1** (item 2) |
| api `nest build` | pass | **FAIL** (item 1) |
| workspace build | pass | pass |
| api jest, full | 29 726 tests, 584 failed | 29 744 tests, 583 failed. No new failure except the one load flake; 2 base failures pass |
| workspace jest (repo config) | 670 tests, 10 failed | 636 tests, **16** failed (item 3) |
| PR's settings config (`jest.a1-settings.config.cjs`) | — | 22/22 |
| workspace mutants under the PR's `docs/` config (with `NODE_PATH` so it can resolve `ts-jest`) | — | 16/20 killed; B8, B9, B10, B22b survive (item 4) |

### Frontend [R] (WSL `/opt`, `npm ci --ignore-scripts`)

| Gate | base `24316f91` | head `f2dc9a39` |
| --- | --- | --- |
| typecheck | pass | **FAIL** (2 errors, item 9) |
| unit, all `@capiro/web` | 230 files pass | 230 files pass, **plus 1 file errors on start** (`jsdom`/RTL missing; exit 1, item 9) |
| unit name-equality | — | 5 legacy name-based Workspace association tests (`work-associations`, `domain-behavior`) replaced by 5 UUID-based ones. That is WS-04's intended semantic change, accepted |
| lint | 0 errors | **3 errors** (item 10) |
| `next build` | pass | **FAIL** (type-check of the same test, item 9) |

**Evidence:** `adj-a-notes/a1/` (`fe-*.log`, `fe-summary.tsv`, `be-mutants-*.txt`, `be-steps-*.txt`). Scratchpad `a1/` (`mutants.json`, `be-in.sh`, `be-run.sh`).