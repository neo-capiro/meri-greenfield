# A1 review: Portfolio and Mail (backend #106, frontend #118)

- **Reviewer:** Fable (adj-e), 2026-10-21. Review only: no edits, pushes or GitHub comments.
- **Backend:** capiro-backend #106 @ `50397769`, base `backend-import` `8d9958f7`.
- **Frontend:** capiro-frontend #118 @ `a4c1860b`, base `main` (PR base `24316f91`; `main` is one AGENTS.md commit ahead, `84f5ba29`).

## Verdicts

**Backend #106: CHANGES.**
- The security design is right on every ticket.
- But it regresses the repo's own suites: engagement jest goes from 22 to 79 failing, and `tsc` from 62 to 69.
- And the ML-09 guard stalls a re-added mailbox's sync forever.

**Frontend #118: CHANGES.**
- An uncertain or refused send permanently blocks mail to that contact in that browser, with no reconciliation path.
- It also fails to build: typecheck 0 → 2 errors in `email.ts`, plus 2 lint errors in a new test.

The exact change list is in §5.

## 1. Per ticket (code read in full on the changed paths)

| Ticket | Done server-side? | Notes |
|---|---|---|
| **PF-10** | **Yes** | `listMeetings`, `getMeeting`, notes and debriefs (and the artifact writes) now resolve current active membership (`currentMeetingActor`, Clerk-bound) and the established client wall (`clientMemoryAllowed`, the same owner used across clients/capabilities/workload) inside the read transaction. The list filters walled/archived clients (`visibleMeetingClientWhere`). An optional `clientId` additionally requires the meeting's association to that client. Owner-only null-client library behavior is retained. Denials are `404 Meeting not found`, so nothing leaks. |
| **PF-11** | **Yes** | An unchanged `clientId` is a semantic no-op: no reassignment, no override row, `isInternal`/score/reason preserved. A real change needs `expectedRevision` under a `FOR UPDATE` row lock, wall checks on both old and new client, and writes one override receipt. The frontend omits an unchanged client and sends the revision on a change. |
| **PF-12** | **Yes** | `meeting_debriefs` gains `approved_at`/`approved_by_user_id`. One versioned projection (`metadataVersion: 1`) is used for list rows, library rows and mutation receipts. `approvalKnown`/`sharingKnown` keep "unknown" distinct from "unset". Actor fields are withheld from non-readers, and capabilities are computed server-side. Historical approved debriefs stay `approvedAt: null` with `approvalKnown: false`; nothing is fabricated. |
| **PF-22** | **Yes, pending ruling (approved below)** | Completion eligibility is the recorded kind (`commitment`/`request`), not `dueAt`. The frontend matches. Rich-metadata editing is left as a separately allocated contract, as the ticket says. The update path also gained a current-membership and non-archived-client check. |
| **ML-02** | **Yes** | `graphFetch` retries only `GET` on 429/5xx. Every mutation, including draft and send POSTs, is dispatched once. A Graph 4xx on send is a definite rejection; everything else is fenced as unknown. |
| **ML-03** | **Yes (backend); frontend needs a reconciliation path** | `single_mail_intents` is keyed `(tenant, actor, requestKey)`. Its canonical request hash covers Bcc, mailbox, reply thread, signature and attachment hashes. It stores an immutable snapshot. `pending` is committed before an atomic `pending→sending` claim, which rechecks authority inside its transaction. Outcomes are recorded only from `sending`. An unrecordable outcome leaves `sending`, which stays fenced. Same key + different content → 409. The owned status read rechecks access. **Nothing can resend after an unknown outcome** (a reviewer mutation recycling `unknown` was KILLED; see §4). |
| **ML-07** | **Yes** | Before any ledger write and again inside the claim transaction:<br>- current membership;<br>- sender mailbox owned by the actor;<br>- readable, unarchived client behind the wall;<br>- selected people belong to that client and tenant;<br>- thread owned, with its own client behind the wall;<br>- a null-client recipient-derived history admitted only through the existing association predicate;<br>- attachments and source-document distribution.<br>Zero provider calls on rejection. One strictness to note: selected people must be **To** recipients (a Cc'd person is refused); acceptable. |
| **ML-08** | **Yes, with one regression** | The start flow distinguishes add (new row) from reconnect (explicit `connectionId`). Signed one-use state is bound to connection, actor, provider, expected account and token fingerprint. Reconnect must return the same `homeAccountId`. A duplicate account elsewhere in the tenant is refused under an advisory lock. A missing refresh token never inherits a prior identity. **Regression:** every top-level *Connect* now inserts a `needs_configuration` row before OAuth completes, and `listIntegrations` returns all of them. Each abandoned or repeated click leaves a visible orphan mailbox in Settings; the base reused the newest row. This affects both Microsoft and Google. |
| **ML-09** | **Bounded minimum (approved below), with one regression** | Sync, removal and single-mail upserts refuse a provider ID already bound to another connection, and mutation selectors include the connection. **Regression:** the refusal is a plain `Error`, which the Graph (and Gmail) loop deliberately rethrows so the delta cursor does not advance. Disconnect sets `mail_threads`/`mail_messages.connection_id` to NULL (`onDelete: SetNull`). So **re-adding the same mailbox after a disconnect hits `NULL !== connectionId` on its first historical message, and every later sync fails at the same message forever.** ML-08 now steers users exactly into "disconnect and add another mailbox". The existing replay suites show it: 4 new failures in `mail-replay-preservation`/`mail-unassociated-capture` throw `Mail mailbox identity mismatch`. |
| **ML-10** | **Yes** | Both cache selectors return only the exact `home_account_id` (no last-entry fallback). Each refresh builds an isolated MSAL instance. The returned account and scopes must match. Refresh results are fenced against disconnect, rotation and a pending re-auth (`admitMailboxRefresh`) for both providers. |
| **X-04** | **Partial** | The new specs cover cross-tenant, same-tenant wrong owner, wall/revoked client, archived client, removed member, wrong mailbox and role downgrade. But the repository's existing suites were not updated for the new membership read (see §3). |

**Mail, the three explicit checks:**
- **No resend after an unknown outcome:** holds (ML-03).
- **No wrong-account token fallback:** holds (ML-10).
- **Mailbox identity qualified everywhere:** holds as a fail-closed guard, but it needs the non-stalling fix (ML-09).

Mock providers only; no real mail or OAuth.

## 2. Policy rulings (asked in the PR bodies)

- **PF-22, approved: completion follows the recorded kind.** Commitment and request may settle or reopen with or without a due date; every other kind is refused. This is the ticket's own recommendation, it is simplest, and it needs no migration of undated rows. A required due date would force a backfill and change the create flow.
- **ML-09, approved for A1: the bounded fail-closed minimum.** Never reassign; the full mailbox-qualified key migration stays a tracked open item before ML-04 reconciliation trusts lineage. **Condition:** "fail closed" must hold the one colliding row and let the sync continue (counted and logged), never halt the mailbox. Otherwise one historical collision is a permanent outage.
- **Deployment order (required by the PR):** migrations → backend → frontend. Old single-send callers without `requestKey` get 400. In-flight OAuth attempts must restart.

## 3. Regressions measured

The P6/PR104 recipe: WSL Docker, `node:22.23.3-alpine3.24`, pnpm 9.12.0 frozen install of the api, api-strategy and intel-api closures, every Prisma client generated. One container at a time, base `8d9958f7` vs head `50397769`.

| Check | Base | Head | |
|---|---|---|---|
| `prisma validate` | ✓ | ✓ | ✓ |
| api `tsc --noEmit` | **62** | **69** | ✗ All 7 new errors are in `src/engagement/portfolio-a1.safety.spec.ts` L199–223 (TS2538/TS2464): the case table at L192–195 is not `as const`, so destructured `model`/`list`/`key` are `string \| undefined` |
| jest `src/auth src/tenant src/bootstrap src/config` | 26 failing | 26, identical names | ✓ |
| jest `src/clients` | 4 failing | 4, identical | ✓ |
| jest `src/engagement` | **22 failing** | **79 failing (+57 new, 0 gone)** | ✗ |

**What the 57 new failures are:**
- **45:** existing meeting suites not updated for the new reads:
  - `engagement-meetings.spec.ts` (22), `meeting-artifact-lifecycle.spec.ts` (13), `meeting-artifact-sharing.spec.ts` (15);
  - mocks lack `tenantMembership.findFirst` and `withTenantUser`;
  - one fixture lacks `updatedAt`, so `projectMeetingArtifactMetadata` crashes on `toISOString`;
  - plus the downstream "expected X but rejected" assertions.
- **4:** the ML-09 stall described above (`mail-replay-preservation` ×2, `mail-unassociated-capture` ×2).
- **2:** `mail-unassociated-capture`'s removal expectations, after `markMailMessageRemovedInTx` gained `connectionId`.
- **1:** `engagement-route-manifest.spec.ts`, the new `GET mail/send-intents/:requestKey` route (the PR asks for regeneration).
- The rest are the same suites' secondary assertions.

The agent's "190/190" and "25/25" came from its own mocked configs (`docs/a1/**`) with cached Jest/ts-jest in transpile-only mode, so neither typecheck errors nor the real suites were exercised.

**Reviewer spot mutations: 11/11 KILLED** (head tree, its own locked install; each defect reintroduced, the covering spec run, then restored). Every new A1 spec passes unmutated under the **repository** jest config.

| Mutant | Killed by |
|---|---|
| ML-02: Graph retries every method again | `microsoft-graph-sync.retry.spec.ts` 4/8 fail |
| ML-03: claim also takes `unknown`/`sending` (resend after an unknown outcome) | `single-mail-ledger.a1.spec.ts` 1/1 fail |
| ML-07: thread/client wall check removed | `single-mail-safety.a1` 1/12, `single-mail-service.a1` 2/10 |
| ML-08: reconnect accepts another account | `mailbox-oauth.a1.spec.ts` 4/43 |
| ML-09: Microsoft sync reassigns rows | `mailbox-persistence.a1.spec.ts` 1/4 |
| ML-09: Google sync reassigns rows | `mailbox-persistence.a1.spec.ts` 1/4 |
| ML-10: last-entry cache fallback restored | `microsoft-oauth.refresh-token.spec.ts` 2/5, `mailbox-oauth.a1` 1/43 |
| ML-10: stale refresh not fenced | `mailbox-oauth.a1.spec.ts` 2/43 |
| PF-10: meeting client wall skipped | `portfolio-a1.safety.spec.ts` 2/4 |
| PF-11: unchanged client reassigns | `portfolio-a1.safety` 1/4, `meeting-client-reassignment` 1/21 |
| PF-22: settle requires a due date again | `portfolio-a1.safety.spec.ts` 1/4 |

The agent's own evidence also records the direct-API cases failing at the pre-fix code (`docs/a1/evidence/backend-red.*`, `docs/a1/mail/baseline-direct-api.json`); I did not re-run the pre-fix code.

**Frontend** (node 24.21, `npm ci --ignore-scripts`, `main` `84f5ba29` vs head `a4c1860b`):

| Check | main | head | |
|---|---|---|---|
| `npm run typecheck` | 0 errors | **2 errors** | ✗ `src/features/portfolio/relationships/email.ts(135,69)` TS2339 `state` on `{}`; `(169,41)` TS2345 `{}` not assignable to the recovery row type. The recovery `useQuery` result is inferred as `{}` (the refined zod schema) |
| `npm run build` (`next build`) | ✓ | **✗ "Failed to type check"** | ✗ the same two errors |
| `lint` (`eslint src tests`) | 0 errors | **2 errors** | ✗ `tests/a1-portfolio.test.ts` 12:79 and 30:42 `@typescript-eslint/no-explicit-any` |
| web vitest | 473 files / 3052 pass | 477 / 3063 pass | ✓ |
| `test:capiro` | 549/549 | 549/549 | ✓ |
| root `npm test` | 173 pass, 1 fail (`meri-turn-recovery`) | the same | ✓ pre-existing |

## 4. Migrations (applied to a clone of the shared live database first; preview Core shares the live production database, O133)

There is **no Prisma migration directory** in the PR. `schema.prisma` changes, and two SQL proposals sit in `docs/`, for the coordinating owner to number and apply.

| Proposal | Additive? | Safe for the live capirov2 services? |
|---|---|---|
| `docs/a1/PF-12-unnumbered-migration.sql`: `meeting_debriefs` `ADD COLUMN approved_at timestamptz(6)`, `ADD COLUMN approved_by_user_id uuid`, FK → `users(id) ON DELETE SET NULL` | Yes: two nullable columns plus an FK | **Yes.** capirov2's client ignores unknown columns, and its inserts leave them NULL. The FK takes a brief SHARE ROW EXCLUSIVE lock on `meeting_debriefs` and `users` and scans `meeting_debriefs` to validate. Prefer `ADD CONSTRAINT … NOT VALID` then `VALIDATE CONSTRAINT` to keep the lock short. |
| `docs/a1/mail/single-mail-intents.sql`: new table `single_mail_intents` (FK `tenants ON DELETE CASCADE`, unique `(tenant_id, actor_id, request_key)`, index, `ENABLE`+`FORCE ROW LEVEL SECURITY`, policy on `app.current_tenant`) | Yes: a new table only | **Yes.** No existing table changes. The ledger reaches it only through `withTenant`, which sets `app.current_tenant`. A capirov2 tenant delete cascades into it, which is intended. |

**Hard precondition:** the PF-12 columns must exist **before** this backend is deployed anywhere. Prisma selects them on every `MeetingDebrief` read, so without them every debrief/notes read fails with "column does not exist". `single_mail_intents` must likewise exist before any single send.

## 5. Change list

### For agent 3 v1: backend #106

1. **Fix the ML-09 stall (blocking).**
   - In `microsoft-graph-sync.service.ts` (~L1540) and `google-sync.service.ts` (~L1250), a mailbox-identity mismatch (including a NULL `connectionId` left by a disconnect) must **hold that message** without writing, reassigning or removing anything. Count it in the sync stats (e.g. `held`) with a redacted warning, and **continue**, so the delta/history cursor advances.
   - Apply the same to the removal path.
   - Add tests: disconnect and re-add the same mailbox; the sync completes, the cursor advances, the old rows are untouched, and the held count is reported.
   - Keep the existing replay suites green.
2. **Make the existing suites pass again (blocking).** `src/engagement` failing names must equal base (22). Update the existing fixtures; do not delete or weaken tests:
   - `engagement-meetings.spec.ts`, `meeting-artifact-lifecycle.spec.ts`, `meeting-artifact-sharing.spec.ts`: mock `tenantMembership.findFirst` (active, Clerk-bound) and `prisma.withTenantUser`, and give artifact fixtures `updatedAt`;
   - `mail-unassociated-capture.spec.ts`, `mail-replay-preservation.spec.ts`: give fixture rows the syncing `connectionId` where they model the same mailbox, update the `markMailMessageRemovedInTx` expectations, and add the held-collision case from item 1;
   - `engagement-route-manifest.spec.ts`: regenerate with the repository's `verify:engagement-phase-0:update-fixtures` for `GET engagement/mail/send-intents/:requestKey`.
3. **`tsc` back to 62 (blocking).** In `portfolio-a1.safety.spec.ts` L192–195, end the case table with `] as const) {`, or give it an explicit tuple type.
4. **No orphan mailboxes on Add (blocking UX regression).** In both `microsoft-oauth.service.ts` and `google-oauth.service.ts`, the start of an *add* must reuse the actor's newest unbound row for that provider:
   - the row qualifies only when there is no token and `assertUnboundMailboxIsFresh` passes (fresh, no history), and the reuse happens under its row lock;
   - only when none qualifies, create one.

   This keeps "two concurrent starts" safe, because the later attempt replaces the nonce. Add a test: two Connect clicks then one completed flow → exactly one mailbox row.
5. **Migrations.** Keep the proposals, and use `NOT VALID` + `VALIDATE CONSTRAINT` for the PF-12 FK. State the deploy order in the PR body (migrations → backend → frontend). Numbering and application stay with Fable after a snapshot.
6. **Evidence.** Re-run with the repository's locked install: a full `tsc` and the real jest projects, not only `docs/a1` configs. Report base vs head failing names.

### For agent 3 v1: frontend #118

1. **Add an explicit reconciliation release (blocking, ML-03 "offers reconciliation rather than blind retry").** In `relationships/email/send-attempt.ts` / `email.ts`:
   - when an attempt is `unknown`, or its status read is `sending`, `pending` past the recovery window, inaccessible or not found, show the existing message;
   - **add a deliberate action**, for example "I checked Sent Items, start a new email". It releases the local reservation for that exact token (under the same Web Lock) and lets the next send mint a **new** `requestKey`.
   - Never reuse the old key, and never auto-release.

   Today an uncertain attempt blocks all mail to that contact or thread in that browser permanently. That includes a send refused **before** any intent was created (revoked client, disconnected mailbox): its status read is 404, recovery stops polling, and the attempt never clears.
   Tests: unknown → release → new key; a release while another tab holds the lock; a second tab sees the release.
2. **Typecheck and build (blocking).** In `relationships/email.ts`, give the recovery query an explicit result type:
   - name the schema, for example `const sendIntentReceipt = z.object({...}).refine(...)`;
   - use `useQuery<z.infer<typeof sendIntentReceipt>>(...)`;
   - or type `api.request`'s return.

   L135 and L169 then typecheck; `npm run typecheck` must be 0 errors and `npm run build` must pass.
3. **Lint (blocking).** In `tests/a1-portfolio.test.ts` L12 and L30, replace `any` with concrete types (or `unknown` plus narrowing).
4. Re-run with the pinned install: typecheck, lint, build, web vitest and `test:capiro`. Report against `main`.

## 6. Not verified by this review

- Native PostgreSQL RLS, locking and contention for `single_mail_intents` (only the agent's PGlite).
- Browser, two-tab and reload journeys.
- Real providers.
- Staging.
- Settings/Workspace #105/#117, which A is reviewing.

Evidence: `phases/a1-review/` (scripts, base/head jest JSON and `tsc` logs, mutation output).

## Round 2: backend #106 @ `6b58d0e6`; frontend #118 not pushed (still `a4c1860b`)

Same clean-install recipe, base `8d9958f7` vs head `6b58d0e6`, one container at a time.

| Check | Base | Head | |
|---|---|---|---|
| `prisma validate` | ✓ | ✓ | ✓ |
| api `tsc` | 62 | **62** | ✓ (item 3 fixed) |
| jest auth/tenant/bootstrap/config | 26 | 26, identical | ✓ |
| jest `src/clients` | 4 | 4, identical | ✓ |
| jest `src/engagement` | 22 | **23**: 22 identical + 1 new | ✗ |
| reviewer mutations (repo jest config) | | **13/13 KILLED**, including 2 new Add-reuse mutants (always-create: 8/10 fail; non-fresh reuse: 4/10 fail) | ✓ |

**Item by item:**
1. **ML-09 non-stall:** not changed. The stall is unchanged and acknowledged in `docs/a1/mail/README.md`. Per the coordinator's note, it waits on Neo, and #106 is judged with the guard kept as it is. It stays recorded as open.
2. **Existing suites:** fixed, apart from one new failure (below). The 57 earlier failures are gone. The three meeting suites and the two mail suites keep identical `expect(` and test counts (65/19, 41/17, 24/17, 7/2, 67/15), so nothing was weakened. The route manifest is regenerated.
3. **`tsc`:** 62. Fixed.
4. **Orphan rows on Add:** fixed (`findFreshMailboxForAdd`). It takes an advisory lock per tenant/actor/provider, re-reads each candidate under its row lock, accepts only tokenless, history-free rows (`assertUnboundMailboxIsFresh`), and creates a row only when none qualifies. Same for Microsoft and Google.
5. **PF-12 FK:** now `NOT VALID` plus `VALIDATE CONSTRAINT`. Both proposals remain additive (see §4).

**The one new failure** is `google-provider-contract.spec.ts` › "GoogleOAuthService.start builds an auth URL carrying access_type=offline, prompt=consent, all six scopes, and a two-segment state". It fails with `TypeError: tx.integrationConnection.findMany is not a function` at `findFreshMailboxForAdd`: the spec's `tx` mock predates Add reuse.

**Verdict: #106 CHANGES, one item.** In `google-provider-contract.spec.ts`, give the `start` test's `tx` mock `integrationConnection.findMany: jest.fn(async () => [])` and `$queryRaw: jest.fn(async () => [])`, so a fresh Add creates a row. Keep the existing assertions. Engagement failing names must then equal base (22).

**#118:** no push.
- **Scope now:** per Neo (#202), no change to send reservation or recovery behavior; the recovery gap is recorded as deferred.
- **Still required (mechanical):** typecheck 2 → 0 errors (`email.ts` L135/L169, by giving the recovery query an explicit result type), lint (`tests/a1-portfolio.test.ts` L12 and L30, no `any`), and `npm run build` passing.

**#118 verdict: CHANGES.**

## Round 3 (2026-10-21): stopped by a process change

- **#118 @ `e37c204b`: APPROVE**, from a clean install. Typecheck 0, lint 0 errors, `next build` passes, web vitest 3063/3063, `test:capiro` 549/549, root `npm test` the same as main. The only change is typing; there is no change to send reservation or recovery, and the gap is recorded as deferred. Posted: https://github.com/neo-capiro/capiro-frontend/pull/118#issuecomment-6329918181
- **#106 @ `89f99aa7`: partial only (source read, nothing run).** It has the fixture fix and the typed `MailboxIdentityMismatchError` hold-and-continue in all three loops, with the guard kept. The backend run was stopped when reviews moved to dot's sessions. The clean-install run and mutations are still owed; the ML-09 mutants are added to `a1-review/mutate.py` but not run. Posted: https://github.com/neo-capiro/capiro-backend/pull/106#issuecomment-6329983842
- **Cleanup:** containers, the `adj-e-a1-pnpm` volume, `/opt/adj-e-*` and the tars are removed. No worktrees were created.
