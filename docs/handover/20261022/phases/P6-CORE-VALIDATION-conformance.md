**CHANGES**: neo-capiro/capiro-backend PR #102 `feat/core-p6-authority-current` @ `1cd6f2b6` → `backend-import` @ `8b23c65b`.

- **Conformance.** K2 and the K1 flow conform to the plan. The tests show no new failures, and the PR adds +134 passing tests, as claimed.
- **Two defects block P6.**
  - **The control-credential path classifier.** It refuses the control credential on **all four** authority routes under the real production mounting. This is a real defect from PR96, not a test artifact. It also makes K3's user key dead in production.
  - **`/current` fails for Research Portfolio conversations.** Its `READ ONLY` snapshot reaches a `SELECT … FOR SHARE`, which PostgreSQL rejects.
- **One deploy blocker outside P6.** The same path bug exists in five more PR96 classifiers.
- **Raw-body size (b):** acceptable as is.

Validation by adj-d3-readiness, 2026-10-20. It was read-only: no edits and no GitHub comments. Labels: **[R]** ran or read now, **[D]** derived from code.

---

## 1. Plan conformance (§2, §3)

### K2: Clerk verified-session cache (`auth/clerk.service.ts`) [R, code]

| Plan rule | PR #102 | Verdict |
|---|---|---|
| Positive-only | `readCachedApplicationSession` stores an entry only after `read()` resolves *and* `expiresAtMs > storedAtMs`. Every throw leaves the cache untouched, and the in-flight entry is deleted in `finally`. | ✓ |
| Keys | `native:${sid}:${sub}`; `control:${jti}:${sub}:${iat}:${exp}`. The pre-checks (regex, exp, `isWellFormedMeriControlCredentialClaims`) run before every lookup. | ✓ |
| TTL | The constant `APPLICATION_SESSION_CACHE_TTL_MS = 5000`. Valid while `now < min(storedAt+5000, session.expiresAtMs)`. A hit is re-clipped to the caller's own JWT expiry (`applicationSessionForCaller`), because native keys exclude `exp`. | ✓ |
| Single-flight | One promise per key. Followers `await` the same promise, so they get the leader's result or the leader's identical rejection and inherit its deadline. | ✓ |
| Bounded, no timers | 10,000 entries. On insert it sweeps expired entries, then evicts the oldest. No `setInterval`. The only timer is the existing 2 s race. | ✓ |
| Nothing cached on 401/503/deadline | Covered by the "positive-only" mechanism. | ✓ |
| Observability | Logged lazily on the first call after 60 s, only if a counter is non-zero: `{"event":"auth.clerk_session_cache",hits,misses,joins,refused,unavailable,entries}`. No sid, sub, jti or token. | ✓ (emitted on the next call, not by a timer, as required) |
| Docstring | Updated ("four named … POSTs", 5 s positive cache). | ✓ |
| Extra | `frozenAuthorityCopy` deep-freezes the cached session and refuses proxies, accessors and non-plain prototypes, so a hit can't be mutated by a caller. | ✓ (stricter than the plan; harmless for Clerk's plain JSON) |

### K1: `POST /api/clio/application-authority/current` [R, code]

| Plan item | PR #102 | Verdict |
|---|---|---|
| Closed body, `expect` subset, ≤ 4096 | `parseApplicationAuthorityCurrentBody`. `closedBody` gained optional keys. The existing callers stay exact, because `own ⊆ keys` and `length ≥ keys` mean equality. | ✓ |
| One Clerk read **before** the transaction | `readApplicationAuthoritySession(req, ctx)`, the factored first half of `readApplicationAuthority`, runs before `withSystem`. | ✓ |
| One `REPEATABLE READ` + `READ ONLY` snapshot | `withSystem(…, {isolationLevel:'RepeatableRead', readOnly:true})`. `SET TRANSACTION READ ONLY` is the first statement. | ✓ shape, but **✗ defect 2** below |
| Ports on the one `tx` | Identity (`readCurrent(tx)`), membership (`readInTransaction`, no triple compare), conversation, bizdev scope, client visibility and client authority all take `tx`. bizdev needed `tx` threading; it is reported in the PR, as §3 allows. | ✓ |
| Revisions from the existing functions | `applicationMembershipPermissions` / `applicationMembershipRevision`; identity via `readCurrentApplicationAuthority`; `contextRevision = applicationAuthorityRevision('context', [identityRevision, conversation tuple, scope, client])`, identical to `/context`'s tuple. | ✓ |
| `expiresAtMs` | `min(identity evidence expiry, checkedAtMs + 120000)`. The evidence already carries the session and impersonation clip. | ✓ |
| 409 on `expect` mismatch | `ApplicationAuthorityChangedException`, body `{"error":"CHANGED"}`. | ✓ |
| 503 passes through | The catch rethrows `ApplicationAuthorityUnavailableException` and the 409 exception, and returns 403 for everything else. The session read sits outside that catch, so its 401/503 propagate. | ✓ |
| Control allowlist 3 → 4 | `MERI_CONTROL_POST_PATHS` + `current`. The no-store `authorityPaths` list is updated, along with the comments. | ✓ as written, but **✗ defect 1** (the classifier never matches under production mounting) |
| Old routes unchanged | `/context` and `/membership` still do their read/re-read/compare loops. `snapshot()` now calls `snapshotInTransaction(…, recheckMember=true)`, with the same statements in the same order. | ✓ |

**Note on `withSystem` (for B).**
- The plan named `withTenant`. The PR uses `withSystem`: it bypasses RLS and the tenant hook, which is required because identity during impersonation reads the original membership.
- Defence in depth is therefore lost, and every read on this `tx` must pin the tenant itself. I checked each, and all do:
  - conversation: `tenantId` + `userId`;
  - the Research Portfolio check: raw SQL `tenant_id=`;
  - bizdev: `tenant.findUnique({id})` + prospect `{tenantId, id}`;
  - `assertCurrentClientVisible`: `tenantId`;
  - `resolveClients` / `client.findFirst`: `tenantId`;
  - `fetchAccessibleClientRevisionsForClerkActor`: `c.tenant_id=${tenantId}`;
  - membership `member()`: `tenantId` + `userId`;
  - identity: membership id + tenant + user.
- B should confirm this.

### K3: throttler tracker [R, code]

- `CapiroThrottlerGuard.getTracker` returns `applicationAuthorityThrottleKey(req) ?? super.getTracker(req)`. The key is `authority-user:${claims.sub}`, and only when the request is an authority POST **and** carries middleware provenance. Everything else uses the IP. No new limits, no `trust proxy`.
- The design conforms. **In production the key is never produced** (defect 1), so K3 is a no-op there.

### Scope [R]

The 23 changed files are all on §3's list or are specs:
- `bizdev-meri-scope.*`, used as §3 allows and reported;
- `prisma.service.ts`;
- `capiro-throttler.guard.ts` (new) and `app.module.ts`;
- specs, including small updates to `application-authority-artifact.spec.ts` and `read-delegation.spec.ts`.

`application-authority.module.ts` is unchanged; `ApplicationMembershipService` was already a provider, and the Nest pipeline specs boot it. No migration, schema change, environment variable or dependency.

---

## 2. Tests (§13) [R]

**Environment:**
- WSL Docker, one container per tree, `node:22.23.3-alpine3.24@sha256:2c752226…`, `-m 10g`, no database.
- `pnpm@9.12.0 install --frozen-lockfile` (api, api-strategy, intel-api closures), workspace deps built, `prisma generate`.
- Then: api `tsc --noEmit --rootDir .`, `nest build` for api, api-strategy and intel-api, api-strategy/intel-api `typecheck`, and jest (`--maxWorkers=2 --ci`):
  - api `src/auth src/tenant src/bootstrap src/config`;
  - api `src/meri`;
  - api `src/clients src/directory src/memory src/engagement/plans src/storage src/documents src/approvals`;
  - all of api-strategy;
  - all of intel-api.
- Logs: WSL `/opt/adj-d3-core-out/{p6base,p6head}/`.

| Check | base `8b23c65b` | head `1cd6f2b6` |
|---|---|---|
| install / deps / prisma generate | pass | pass |
| `nest build` api, api-strategy, intel-api; api-strategy and intel-api typecheck | pass | pass |
| api `tsc --noEmit` | 62 errors (spec files only, pre-existing since PR96) | **the same 62, byte-identical** |
| jest auth/tenant/bootstrap/config | 50 suites, 25 failed / 1102 passed (1127) | **54 suites, 25 failed / 1236 passed (1261)** |
| jest `src/meri` | 90 failed / 4322 | 90 / 4322 |
| jest feature dirs | 39 failed / 3494 | 39 / 3494 |
| jest api-strategy | 17 failed / 2452 | 17 / 2452 |
| jest intel-api | 171 failed / 2245 | 171 / 2245 |

- **No new failures.** The failing test names are identical in every set (`comm` of the `●` lines: 0 only-head, 0 only-base).
- **The added tests: +134, all passing.** 1261 − 1127 = 134, matching the PR's claim. The 4 new suites all pass:
  - `application-authority-current.spec`;
  - `clerk-session-cache.spec`;
  - `clerk-session-cache-callers.spec`;
  - `capiro-throttler.guard.spec`.
- **What the suites can't catch.** The `/current` spec runs on a **mocked** transaction, and no spec covers a Research Portfolio conversation on `/current`. Nothing boots the production middleware mounting. Both defects below therefore pass the suites.

---

## 3. The two documented issues

### (a) "Pre-existing control-credential mounting issue": a **real production defect**, not a test artifact [R]

**Probe.** I built a minimal Nest app with the repo's locked **Nest 10.4.22 / Express 4.22.1**, mounted exactly as production does:
- `setGlobalPrefix('api', {exclude: health, webhooks/(.*)})` from `bootstrap/configure-api-http-app.ts:91`;
- `consumer.apply(…).exclude(<the full app.module.ts list>).forRoutes('*')`.

It recorded what the middleware sees on `POST /api/clio/application-authority/{identity,current}` (`phases/P6-CORE-VALIDATION-mount-probe.cjs`, run in the head's install):

```
path: "/"   url: "/"   originalUrl: "/api/clio/application-authority/identity"   baseUrl: "/api/clio/application-authority/identity"
isMeriControlAuthorityPost (verbatim copy) → false        (same for /current)
```

- Nest mounts consumer middleware through `app.use(<route>, …)`, and Express strips the mount path into `baseUrl`, so `req.path` is `/`.
- `isMeriControlAuthorityPost` (`tenant-context.middleware.ts:91-97`) requires `req.path === originalUrl`, so it is **false on every route**.
- The middleware's early branch (`:332-334`) then answers a marked control credential **401 on identity, context, membership and current**.

**Why live preview still works.** Live `:3` runs `0f5d7e15` (`ade7fc88` + 2). That source has **no** path classifier: `grep -c isMeriControlAuthorityPost` gives 0 at `0f5d7e15` and 1 at `8b23c65b`. The classifier came in PR96 (`9ab565f4`, "Scope Meri control credential to authority POSTs"), which is not deployed. So Meri's working control-credential traffic today is no evidence about `backend-import`.

**Impact:**
- **Any image built from `backend-import`, with or without P6, would break Meri's control-credential calls on all three existing routes.** That covers Meri's prepared-candidate readiness and its control-side identity, context and membership. It must not ship until this is fixed.
- `/current` for the control credential, which Meri's P3/P6 lease renewal needs, is refused for the same reason.
- K3's key is never produced in production (`applicationAuthorityThrottleKey` returns null through the same classifier), so throttling stays per-IP.
- The PR's own spec "preserves the existing control refusal when consumer mounting changes the parsed path" pins the **broken** behaviour as intended.

**The same `req.path`-under-consumer-mount pattern elsewhere in PR96/PR97 code** [R, grep]. These are called from the middleware:
- `isRetainedSignedPost` (`tenant-context.middleware.ts:121-131`);
- `historyReleaseProvenance` (`:749-750`, unmounted);
- `auth/meri-execution-request.ts:27,42` (the `create_task` execution bearer);
- `auth/read-delegation/read-delegation-request.ts:47`;
- `auth/read-delegation/signed-memory-http-gate.ts:30,38,46`;
- `auth/preview-native-read-mode.ts:49` (the roster decision when re-checked in the middleware).

Not affected: line 200 (the no-store list checks `originalUrl` too), `isBypassPath` (uses `baseUrl + path`, as at `ade7fc88`), and `preview-native-read-mode.ts:97` (ORs the raw path).

**Correction to my CONSOLIDATION-CORE §5:** I called PR96's control-credential narrowing "consistent with what Meri assumes". The narrowing is consistent, but its implementation refuses even the three allowed routes in production. I missed that.

### (b) Raw-body size on `/current`: **acceptable** [R, code]

- The global JSON parser caps every body at **1 MB** (`main.ts:37` `defaultJsonLimit: '1mb'`, applied in `configure-api-http-app.ts` before any route middleware). That bound and exposure are the same as the three sibling authority POSTs and every other JSON route, which have no 4096 cap at all.
- `/current` also refuses a declared `Content-Length > 4096`, and a re-serialized body over 4096 bytes. Chunked padding up to 1 MB is parsed by the global parser and then reduced to the closed, ≤ 4096-byte semantic body.
- No change required. Two optional improvements:
  - a route-scoped `json({ limit: '4kb' })` for this path, if a hard wire bound is wanted;
  - rewording the controller comment, because the `Content-Length` check runs after parsing, so it is a semantic check, not a DoS guard.

---

## 4. Defect 2: `/current` refuses Research Portfolio conversations [R]

- `loadOwnedActiveClioConversation` calls `authorizeResearchPortfolioConversation(tx, ctx, row)` (`research-portfolios/research-portfolio-artifact-authority.ts`).
- For a conversation carrying the Research Portfolio scope, that function runs three `SELECT … FOR SHARE` statements: `tenant_memberships`, `research_portfolios`, `research_portfolio_grants`.
- PostgreSQL forbids row locks in a read-only transaction. Run in `pgvector/pgvector:pg16`:
  `BEGIN ISOLATION LEVEL REPEATABLE READ; SET TRANSACTION READ ONLY; SELECT set_config('app.bypass_rls','on',true); SELECT … FOR SHARE;`
  gives **`ERROR: cannot execute SELECT FOR SHARE in a read-only transaction`**.
- The controller's catch maps that to **403**. So `/current` refuses every Research Portfolio conversation that `/context` accepts.
- The spec's mocked `tx` doesn't model this.

---

## 5. Exact change list for Neo's agent

**Required in PR #102:**

1. **Fix the control-credential classifier under consumer mounting** (`tenant-context.middleware.ts`, a §3 file).
   - Add one helper, e.g. `mountedRequestPath(req) = (req.baseUrl ?? '') + (req.baseUrl && req.path === '/' ? '' : req.path)`.
   - In `isMeriControlAuthorityPost`, require `mountedRequestPath(req) === originalUrl-without-query` and membership of the normalized path in `MERI_CONTROL_POST_PATHS`.
   - Keep the refusals of rewritten, absolute-form and trailing-slash targets. A trailing `/` yields `baseUrl ≠ originalUrl`, so it is refused.
   - This also makes `applicationAuthorityThrottleKey` (K3) work in production.
   - Replace the spec that pins the refusal ("preserves the existing control refusal when consumer mounting changes the parsed path") with the opposite assertion.
2. **Add a production-mounting test.**
   - Boot a Nest app with the **real** `configureApiHttpApp` prefix and the **real** `AppModule.configure` mounting (or an exact copy of both, like `phases/P6-CORE-VALIDATION-mount-probe.cjs`).
   - Assert:
     - (a) the marked control credential is admitted on all four authority POSTs;
     - (b) it is refused on a fifth path, on a trailing-slash target and on an absolute-form target;
     - (c) K3's tracker is `authority-user:<sub>` on those four routes and the IP elsewhere.
3. **`/current` with Research Portfolio conversations.** Keep `READ ONLY` as the plan requires, and don't take row locks inside the snapshot.
   - Give `authorizeResearchPortfolioConversation` an explicit `{ lock: false }` option. The locks are redundant inside one REPEATABLE READ snapshot that never writes.
   - Pass it only from `loadOwnedActiveClioConversation` when a caller `tx` is supplied by `/current`. The old routes keep their locks.
   - It's a one-function change outside §3; report it in the PR, as bizdev was.
   - Add a real-PostgreSQL test (§13.4) of `/current` for a plain conversation and a Research Portfolio-scoped one. Assert 200, `SET TRANSACTION READ ONLY` first, and no SQLSTATE 25006.
4. **Comment** (optional, from (b)): say that the `Content-Length` check is semantic, or add the route-scoped 4 kb parser.

**Required before any image from `backend-import`** (outside P6's §3; propose as the PR96 repair change, owner to decide):

5. Apply the same `mountedRequestPath` fix, with production-mounting tests, to:
   - `isRetainedSignedPost`;
   - `meri-execution-request.ts:27,42`;
   - `read-delegation-request.ts:47`;
   - `signed-memory-http-gate.ts:30,38,46`;
   - `preview-native-read-mode.ts:49`;
   - `historyReleaseProvenance`.

   Without it, every PR96 route that relies on these classifiers misbehaves in production. Most are dark today; the control-credential path is not.

**Ask B (security review):**
- Confirm the `withSystem`/RLS-bypass tenant pins listed in §1.
- Confirm that the fixed classifier still refuses rewritten and absolute-form targets.

---

# Re-validation: PR #102 @ `05d95139` and PR #103 @ `749ad1d1` (2026-10-21)

## Verdicts

- **PR #102 `feat/core-p6-authority-current` @ `05d95139`: ACCEPT.**
  - Items 1-4 of §5 are done, and so are N2 and N4.
  - The 10 PostgreSQL tests pass here, with zero PostgreSQL errors and no 25006.
  - The production mount probe passes.
  - One decision is noted: the `clientId: null` contract extension (below).
- **PR #103 `feat/core-mounted-authority-paths` @ `749ad1d1`: CHANGES, cleanup only, no behaviour change.**
  - Merge one shared `mountedRequestPath` instead of six copies.
  - **Merge #103 only together with or after #102.** On its own, #103 leaves the control-credential classifier on `req.path`, because #102 owns that fix.
- **#102 + #103 merge cleanly.** Git combines the identical helper the two PRs add to the middleware, leaving one declaration that both classifiers use. The merged tree shows no new failures.

Read-only throughout: no edits or GitHub comments. The local merge `0e875ca3` was never pushed.

## R1. #102 delta since `1cd6f2b6` (one commit, `05d95139`) [R, code]

| Item | Change | Verdict |
|---|---|---|
| §5.1 classifier | `mountedRequestPath(req) = baseUrl + (baseUrl && path === '/' ? '' : path)`; `isMeriControlAuthorityPost` uses it. The `parsed === originalUrl-without-query` check is kept. | ✓ |
| §5.2 production-mount tests | `tenant-context.meri-control.spec`: exact mounted identity/context/membership/current targets admitted; trailing slash, rewritten and absolute-form targets refused. `capiro-throttler.guard.spec`: boots the real `configureApiHttpApp` and `new AppModule().configure()`, with user buckets on all 4 POSTs and IP elsewhere. | ✓ (54/54 passed here) |
| §5.3 RP without locks | `authorizeResearchPortfolioConversation(…, { lock: false })`. It is called only when `loadOwnedActiveClioConversation` receives a caller `tx`, and `/current` is the only such caller (grep: the 3 other callers pass no `tx`). The legacy calls keep all three `FOR SHARE`. | ✓ |
| §5.4 comment | The `Content-Length` check is now documented as a wire check, with upstream parsing owning raw limits. | ✓ |
| B's N2 | The `/current` catch: `ServiceUnavailableException` (which includes the Clerk 503) and the 409 rethrow; any non-`HttpException` (Prisma/transaction errors) → **503**; other `HttpException` → 403. The snapshot owners preserve infrastructure errors only on the `tx` path (`readCurrentApplicationAuthority(…, preserveTransactionUnavailable)`, bizdev, context-security). `ContextResolutionError` (the wall refusal) → 403; `MeriProspectScopeConflictError` extends `ConflictException`, so it stays 403. | ✓ |
| B's N4 | Cache age = `performance.now()` taken **when the leader starts its read**, and the TTL is checked on the monotonic clock. Session expiry stays on epoch time. A slow answer can't extend the 5 s window, and a wall-clock step can't either. | ✓ |
| **New, beyond the plan** | `/current` accepts `clientId: null` **only** for an owned, current Research Portfolio conversation. The proof is a `WeakMap` entry set by the resource owner after a successful RP check on that exact row, so neither the body nor the metadata can forge it. `selectedClientId` can now be `null`, and the RP scope tuple enters `contextRevision`. `/context` keeps its null-client 400. | Sound and tested. **It is a K1 contract extension (ADR §2.6 had `clientId` required).** Meri's `action-authority-0.2` contract must add it when Meri uses it, and B should cover it. Orchestrator to acknowledge. |

**A correction to my §4.** Research Portfolio conversations always have `clientId = null`, so `/context` never served them either: it requires a UUID `clientId`. The `FOR SHARE` defect was real, but "refuses what `/context` accepts" overstated it. #102 resolves it by adding the null-client RP path.

## R2. PostgreSQL tests (§13.4) [R]

- **Setup:** `pgvector/pgvector:pg16` with `log_statement=all`, the Node container sharing its network namespace, the fixture `/tmp/capiro-p6-postgres.json` → `127.0.0.1:5432/p6test`. The spec builds an isolated random schema from `prisma migrate diff`.
- **#102 @ `05d95139`: 10/10 pass.**
  - Current 200 equals the three route revisions.
  - A wall-grant deletion is observed.
  - Clientless RP on REPEATABLE READ + READ ONLY with no locks.
  - The legacy RP call keeps 3 locks.
  - A revoked RP grant or membership is refused inside the snapshot and over HTTP (403).
  - Clientless RP 200 over HTTP.
  - A client-bound RP selector is refused, and `/context` keeps its null-client 400.
- **#103 @ `749ad1d1`:** the spec is not in #103 (0 tests), so there is nothing to run there.
- **Merged #102 + #103: 10/10 pass.**
- **PostgreSQL server log** (parsed per backend PID), on #102 and on the merge:
  - #102: 22 transactions containing `SET TRANSACTION READ ONLY`; the merge: 11.
  - Sequence in every one: `BEGIN` → `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` (Prisma) → **`SET TRANSACTION READ ONLY`** → `set_config('app.bypass_rls', …)` → data reads. READ ONLY comes before any data statement in all of them.
  - **0 `FOR SHARE` inside a read-only transaction; 0 `ERROR` lines in the whole server log; no 25006.**
  - The 6 `FOR SHARE` statements in the log belong to the legacy-locks test, outside read-only transactions.

## R3. #103: classifiers [R, code + tests]

- **`mountedRequestPath` applied to:**
  - `isRetainedSignedPost` and `historyReleaseProvenance` (middleware);
  - `isMeriExecutionCapabilityPost` and `isMeriRoutineUnattendedGrantPost` (`meri-execution-request.ts`);
  - `exactPath` (`read-delegation-request.ts`);
  - the three signed-memory gates (`signed-memory-http-gate.ts`);
  - `coreRosterPreviewDecision` and `isPreviewNativeReadRoute` (`preview-native-read-mode.ts`).
- Every list item from my §5.5 is covered. The `parsed === original` and no-query checks are kept everywhere.
- **Production-mount tests:** `tenant-context.authority-mount.spec.ts` boots the real `configureApiHttpApp` and the real `AppModule.configure`. Its route table covers:
  - the execution receiver;
  - the retained POSTs (`CapiroRetained`/`CapiroRetainedAuthority`);
  - unattended grant;
  - read-delegation (create/tokens/current/revocations/consent state);
  - the signed-memory tools;
  - the roster GET, preview native reads and history-release provenance.

  `mounted-authority-request.spec.ts` adds the unit-level predicates. **58/58 pass** (3 suites) on #103, and the 4 mount suites pass **88/88** on the merge.
- **Cleanup required (Neo's no-duplication rule):** the same 4-line helper is copied into five files (six counting #102). Move it to one module, e.g. `apps/api/src/auth/mounted-request-path.ts`, and import it in all six places. No behaviour change.
- **Ordering:** in #103 alone, `isMeriControlAuthorityPost` still reads `req.path`. My probe on #103 alone refuses the control credential on all authority POSTs. Merge #103 only with or after #102; that's the plan anyway.

## R4. Production mount probe (`phases/P6-CORE-VALIDATION-mount-probe.cjs` v2) [R]

The probe now loads the **real** `MERI_CONTROL_POST_PATHS`, `mountedRequestPath` and `isMeriControlAuthorityPost` from each tree's `tenant-context.middleware.ts` (transpiled with the repo's TypeScript). It runs them inside a Nest 10.4.22 / Express 4.22.1 consumer-mounted middleware with the production prefix and exclude list, and sends raw HTTP request lines.

| Case | #102 | #103 alone | #102 + #103 |
|---|---|---|---|
| POST identity / context / membership / current | admitted ×4 | **refused ×4** (classifier not fixed in #103; 3-path list) | admitted ×4 |
| POST `…/artifact` (fifth path) | refused | refused | refused |
| POST `…/identity/` (trailing slash) | refused | refused | refused |
| absolute-form `POST http://host/api/…/identity` | refused | refused | refused |
| POST `…/identity?x=1` | admitted (query stripped, as designed) | refused | admitted |
| GET `…/identity` | refused | refused | refused |

**K3 tracker under the real `AppModule` mounting** (`capiro-throttler.guard.spec`, run on #102 and the merge):
- user provenance before the guard on all four POSTs;
- one bucket shared by native and control credentials;
- the IP fallback for non-exact paths, GET, forged fields and non-authority routes.

All pass.

## R5. Full regression on #102 + #103 (local merge `0e875ca3`; base `backend-import` @ `8b23c65b`) [R]

| Check | base `8b23c65b` | #102 + #103 |
|---|---|---|
| install / deps / prisma generate | pass | pass |
| `nest build` api / api-strategy / intel-api; api-strategy and intel-api typecheck | pass | pass |
| api `tsc --noEmit` | 62 (spec files only) | the same 62 |
| jest auth/tenant/bootstrap/config | 25 failed / 1102 passed (1127) | 25 failed / 1315 passed / 10 skipped (1350) |
| jest `src/meri` | 90 failed / 4322 | 90 / 4322 |
| jest feature dirs | 39 failed / 3494 | 39 / 3494 |
| jest api-strategy | 17 failed / 2452 | 17 / 2452 |
| jest intel-api | 171 failed / 2245 | 172 / 2244 |
| PostgreSQL spec | — | 10/10 (separate run with the fixture) |

- **Failing test names equal the base in every set.**
  - The 10 skipped in the auth run are the PostgreSQL spec, run with its fixture separately.
  - The one extra intel failure is the "200×50 under 250 ms" timing test, which also flaked in earlier runs; neither PR touches intel-api.
- **My first merged run showed api-strategy/intel-api typecheck, build and jest failing.** My script had dropped their `prisma generate` step. Rerun with it, they pass (table above). The same artifact explains the 2 extra api `tsc` errors in that run, which point at api-strategy's ungenerated client; the remaining 62 match the base exactly.
- **On #102 alone:** auth 25 failed / 1291 passed (1316), with names identical to the base.
- **On #103 alone:** auth 25 failed / 1136 passed (1161), with names identical to the base.

## R6. Change list

- **#103 (cleanup):** move `mountedRequestPath` into one shared module imported by all six classifiers. Re-run `tenant-context.authority-mount.spec`, `mounted-authority-request.spec`, `tenant-context.meri-control.spec` and `capiro-throttler.guard.spec`.
- **#102:** no code change.
  - The orchestrator acknowledges the `clientId: null` Research Portfolio extension to K1.
  - The Meri side adds it to `action-authority-0.2` only when it uses it.
  - B confirms its security.
- **Merge order:** #102, then #103 (or both together). No image from `backend-import` with #103 but without #102.

---

# Third validation: #102 @ `946511a7`, #103 @ `43a03ada` (stacked on #102), 2026-10-21

## Verdicts

- **PR #102 @ `946511a7`: ACCEPT.**
- **PR #103 @ `43a03ada`: ACCEPT.**
- One non-blocking note on the PostgreSQL spec's hook timeout (below).

Read-only: no edits and no GitHub comments.

## T1. #102 delta (`05d95139..946511a7`, one commit) [R, code + tests]

- **UUID-only.**
  - `ApplicationAuthorityCurrentRequest.clientId` and `selectedClientId` are `string` again.
  - `parseApplicationAuthorityCurrentBody` requires `typeof clientId === 'string' && UUID.test(clientId)`.
  - The `researchPortfolioScope` port, the WeakMap proof and `readApplicationAuthorityResearchPortfolioScope` are removed; no dead code is left (grep).
- **A null or missing selector is 400 before any read.**
  - `closedBody` requires both keys, and the parse is the first statement of the controller method, before `readApplicationAuthoritySession` and the snapshot.
  - The PostgreSQL spec asserts 400 for `clientId: null` on `/current` and `/context`, with **no online read and no `SET TRANSACTION READ ONLY` issued**.
- **RP conversations get 403 on `/current`, as on `/context`.**
  - The RP check runs inside the read-only snapshot with `{lock:false}`, then `assertCurrentConversation` refuses `clientId null ≠ UUID`.
  - The spec asserts 403 with the same message as `/context`, and a READ ONLY snapshot ending in `ROLLBACK`.
- **Legacy callers keep their `FOR SHARE`.**
  - `{lock:false}` is used only when `loadOwnedActiveClioConversation` receives `/current`'s `tx`.
  - The spec "keeps all three real row locks for the unchanged legacy RP helper call" passes.

## T2. The 10 real-PostgreSQL tests [R]

- **Setup:** `pgvector/pgvector:pg16`, `log_statement=all`, the fixture `127.0.0.1:5432/p6test`, run with `--runInBand`.
- **Results:**
  - **#102 @ `946511a7`: 10/10 pass.**
  - **#103 @ `43a03ada`** (= #102 + #103): **10/10 pass.**
- **Tests:**
  - current 200 equals the three revisions;
  - a wall-grant deletion is observed;
  - RP through the real helper on READ ONLY without locks;
  - the legacy call keeps 3 locks;
  - a revoked RP grant or membership is refused inside the snapshot;
  - a clientless RP gets 403, as on `/context`;
  - a revoked RP grant or membership gets 403 over HTTP;
  - a null selector gets 400 on current and context.
- **Server log, parsed per PID:**
  - #102: 18 read-only transactions (12 ending in `ROLLBACK`, the refusal cases).
  - #103: 9 (6 `ROLLBACK`).
  - In all of them `SET TRANSACTION READ ONLY` comes before any data statement.
  - **0 `FOR SHARE` inside them, 0 errors, no 25006.**
- **Note (non-blocking).** In my #102 auth-set run, the fixture was also present, so the PostgreSQL spec ran in parallel inside the auth set. Its `afterAll` (app close + schema drop) **exceeded Jest's default 5 s hook timeout** ("Test suite failed to run"). Its 10 tests still passed in the dedicated `--runInBand` run, and the same mode passed on `05d95139`. Suggest an explicit timeout (e.g. 30 s) on that spec's `beforeAll`/`afterAll`, so a loaded CI host cannot flake it.

## T3. #103: one shared helper, plus the trailing-slash tests [R]

- **One helper.** `apps/api/src/auth/mounted-request-path.ts` exports the only `mountedRequestPath` (grep: 1 definition, 0 local copies). It is imported in:
  - `tenant-context.middleware.ts`: `isMeriControlAuthorityPost`, `isRetainedSignedPost` and `historyReleaseProvenance`;
  - `meri-execution-request.ts` (2 sites);
  - `preview-native-read-mode.ts` (2);
  - `read-delegation-request.ts`;
  - `signed-memory-http-gate.ts` (3).
- **Spec edits.** The three sandbox-loaded specs (`application-authority`, `application-membership`, `retained-native-authority`) only supply the new module to their loaders; nothing is loosened.
- **New trailing-slash tests, all passing:**
  - `retained-native-authority.spec`: an `it.each` over the 4 retained targets, "refuses a trailing-slash retained target rewritten to the canonical mount", asserting `baseUrl` = path, `path` = `/`, `originalUrl` = path + `/`;
  - "refuses a trailing-slash history target … before any lock or online read" (403).
- **Mount suites on #103:** `tenant-context.authority-mount`, `capiro-throttler.guard`, `tenant-context.meri-control` and `mounted-authority-request` pass **93/93**.

## T4. Production mount probe (v2; it now also loads the helper from `auth/mounted-request-path.ts`) [R]

| Case | #102 @ `946511a7` (helper local to the middleware) | #103 @ `43a03ada` (shared helper) |
|---|---|---|
| POST identity / context / membership / current | admitted ×4 | admitted ×4 |
| fifth path `…/artifact` | refused | refused |
| trailing slash `…/identity/` | refused | refused |
| absolute-form `POST http://host/api/…/identity` | refused | refused |
| query `…/identity?x=1` | admitted (as designed) | admitted |
| GET `…/identity` | refused | refused |

K3 (`capiro-throttler.guard.spec`, real `AppModule` mounting) passes on both: user buckets on the 4 POSTs, IP elsewhere.

## T5. Full regression on the merged pair (#103 @ `43a03ada`) against `backend-import` @ `8b23c65b` [R]

| Check | base | #102 + #103 |
|---|---|---|
| install / deps / prisma generate (api, api-strategy, intel-api) | pass | pass |
| `nest build` api / api-strategy / intel-api; api-strategy and intel-api typecheck | pass | pass |
| api `tsc --noEmit` | 62 | **62, identical (diff 0)** |
| jest auth/tenant/bootstrap/config | 25 failed / 1102 (1127) | 25 failed / 1320 / 10 skipped (1355) |
| jest `src/meri` | 90 failed / 4322 | 90 / 4322 |
| jest feature dirs | 39 failed / 3494 | 39 / 3494 |
| jest api-strategy | 17 failed / 2452 | 17 / 2452 |
| jest intel-api | 171 failed / 2245 | 171 / 2245 |

- **Failing test names are identical to the base in every set (0 only-head, 0 only-base).**
- The 10 skipped are the PostgreSQL spec, run separately with its fixture (10/10).
- **#102 alone:** auth failing names are identical to the base. The only difference is the extra suite from the hook timeout described in T2.

