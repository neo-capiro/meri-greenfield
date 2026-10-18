# Run-bound read delegation (RC1 option B): contract, revision 3 (Meri side implemented)

| Field | Value |
|---|---|
| Status | **Meri side implemented in source, composed disabled** (`apps/runtime/native-authority/read-delegation/`, §14). Core side (protected auth/middleware, routes, tables, key) is Core's lane. No credential is minted, no key, grant or migration is applied, and nothing is activated. Merging source activates nothing. |
| Draft owner | Reads lane (rt-reads), per dot in PR #121 comment 6245899753 |
| Reviewers | Core integration owner: issuance, storage, revocation, middleware. R0: Meri runtime consumption. dot: contract. |
| Revision 2 | Closes dot's review comments 6246081306 and 6246089074, mapped below as R-a … R-g. Storage, key and grants are now chosen (§11). |
| Revision 3 | Neo approved source implementation at 07:50 UTC (PR #121 6247327210; `DECISIONS.md` D016-A 4) with corrections, now in §8 and §12. Dot's remaining points (6246081306, 6246089074) are closed in code (§14). §5 ceilings are re-derived from the actual call path, and the `tool` token now carries the reservation's arguments hash. |
| Neo decisions | Decided (§12): attended ≤ 30 min **total** from issuance, bounded by run expiry, may outlive the creating Clerk session, renewal only by a live login; unattended ≤ 15 min per occurrence under an explicit signed-in consent ≤ 30 days; pause or revoke ends authority; read delegation never authorizes writes. |
| Basis | Core #84 @ `7dd72a0e`, Meri integration `497479c7`. Investigation: 6245757066. A ack: 6245772555. Expiry fix: #149. |

## 1. Purpose and non-goals

Option A relays the user's live action-session bearer, which lasts at most 300 s after the session is issued, and unattended runs get no reads. B lets one Meri run make **read-only** native tool calls after the browser session has gone, inside limits that Core verifies from owner-backed facts.

Non-goals:
- writes, intents, approvals, or any tool with `sideEffect !== 'none'`;
- any route not listed in §3;
- the retained-signed routes, which keep their own `CapiroRetained` contract;
- any static or shared user token;
- refreshing a Clerk session.

Meri's admission, allocation and budget stay authoritative. Core never charges.

## 2. Shape

- A **read delegation** is a Core row: one per attended run, or one per scheduled occurrence under consent.
- **Per-call read tokens** (at most 60 s, single use) are issued under it. Each is bound to one kind (§3), one exact method, path and body hash, and one Meri call slot (§5).
- No user bearer is stored or used after issuance.
- This mirrors the Objective owners: `objective-consent-policy.ts`, `objective-workload-issuance*.ts` (issuance, decision and proof-use records), `objective-workload-jwt.ts` (method/path/body binding) and `objective-workload-current.ts` (current facts read in the same transaction).

## 3. Targets and the current-authority receipt (R-a, R-d)

Every token has exactly one `kind`. The middleware branch admits a read token **only** on its kind's target, never on `identity`, `context` or `membership`.

| kind | Target (POST, empty query) | Body binding checked by Core |
|---|---|---|
| `current` | `/api/clio/application-authority/read-delegations/{delegationId}/current` | `{"schemaVersion":1,"conversation":<bool>}`. `delegationId` must equal the token's `sub` |
| `tool` | `/api/clio/tools/{name}` | `name` is the native id of the token's `operation`, which must be in the delegation's operations and in Core's explicit read-name allowlist (the tools controller also runs writes). The body's sha256 must equal the token's `bodySha256`. Every decoded client or conversation selector in the body must equal the delegated `clientId`/`conversationId`; otherwise 403 before dispatch |
| `mode` | `/api/clio/application-authority/read-mode-observation` | `body.operation` must equal the token's `operation`, which must be one of the five `MODE_READ_OPERATIONS`. `body.requestSha256` must equal the token's `toolRequestSha256`, the hash of the exact tool request the mode is observed for |
| `reference` | `/api/clio/clients/check-ref` | The `ref` hash must equal the token's `referenceSha256`. **Result binding:** the resolved `clientId` must equal the delegated `clientId`; otherwise 403 and no result is released |

**Delegation-backed current-authority receipt (closes R-a).** Today Meri's native-read owner calls Core `identity` and `membership` on every observation, and Core's read-mode handler calls `ApplicationMembershipService.read`. That method re-derives identity from the live session three times (`application-membership.service.ts:24-58`). B replaces the identity *source*, not the checks:

- **Core, `ApplicationMembershipService.readDelegated(delegation, control)`.**
  - It runs the same three DB snapshots, `assertSame` comparisons and receipt shape as `read`.
  - Its identity evidence comes from `DelegatedIdentitySource`, not from `tenant.readApplicationAuthority(req, ctx)`. That source reads, in one transaction: the user row (active, same `clerkUserId`); the delegation row (active, unexpired, not superseded); and the Meri run facts (§4).
  - `identityRevision` = sha256 of `{userId, clerkUserId, userStatus, userUpdatedAt, delegationId, delegationRevision}`.
  - `recheckCurrent()` re-reads all three.
  - `ApplicationReadModeObservationService` calls `readDelegated` when the request context is delegation-backed, and `read` otherwise. Nothing else changes.
- **Core, the `current` route.** It returns:

```json
{"schemaVersion":1,"delegationId":"<uuid>","principal":{"tenantId":"<uuid>","actorId":"<uuid>"},"identityRevision":"<64 hex>","actorRole":"standard_user","membershipRevision":"<64 hex>","clientIds":["<delegated client uuid>"],
 "conversation":{"conversationId":"<uuid>","selectedClientId":"<uuid>","contextRevision":"<string>"},"checkedAtMs":0,"expiresAtMs":0}
```

  - `clientIds` is the delegated client only, and only while it is still visible under `assertCurrentClientVisible` and `resolveApplicationAuthorityClient`. It is never the actor's full roster.
  - `expiresAtMs ≤ min(delegation expiry, run deadline)`.
  - **BD context proof:** when `conversation:true`, Core computes `conversation` with the existing context owners (`loadOwnedActiveClioConversation`, `authorizeMeriProspectScope`, `assertCurrentClientVisible`, `resolveApplicationAuthorityClient`) on the delegation's own `(conversationId, clientId)` and actor. A prospect-linked conversation whose `linkedClientId` differs refuses, exactly as `application-authority.controller.ts:42-70` does.
- **Meri consumption** (`native-read-credentials`, R0 reviews):
  - With a delegation-backed bearer, the owner's `coreAuthority.readCurrent` is served by a delegated adapter. It returns the receipt minus `conversation`/`delegationId`, so `assertNativeToolAuthority` is unchanged.
  - `readConversation` is served from the `conversation` block (`assertNativeConversationAuthority`, unchanged). Meri still asserts `conversationId` and `selectedClientId` equal the BD resource.
  - `readClientReference` and `readModeObservation` call the `reference` and `mode` targets with their own tokens. Their receipts carry the same `principal`/`identityRevision`, and Meri's existing equality checks stay.
  - Personal BD tasks (no client resource) keep using the tool's own owned-conversation/prospect check under the delegated context.

## 4. Owner-backed verification Core uses (R-c)

Core never trusts caller digests for allocation, operations, deadline, allowance or fence. It reads Meri's owner tables through one **Meri-owned, read-only view**, in the same transaction as each issuance, token issue, token use and response release.

| Fact | Owner table | View column |
|---|---|---|
| Allocation, allowed operations | `meri_product_budget.tool_run_allocations.allocation`, `.allocation_sha256` | `allocation_sha256`, `allowed_operations` |
| Run deadline | `tool_run_allocations.started_at` + `allocation.budgets.maxRuntimeSeconds`, and `allocation.schedule.expiresAt` | `run_deadline` (the minimum) |
| Call allowance | `tool_run_allocations.max_tool_calls` (from `allocation.budgets.maxToolCalls`) | `max_tool_calls` |
| Calls used | count of `meri_product_budget.tool_reservations` for the run, the same count the budget owner checks at `postgres-tool-budget.mjs:107-108` | `reserved_calls` |
| Reservation for a tool call | `tool_reservations` (`invocation_id`, `run_id`, `operation`, `arguments_sha256`, `state`) | separate view `reservations_v1` |
| Attempt, fence, policy | `meri_product_budget.runs` (`attempt`, `fence`, `policy_revision`) | same |
| Run state, binding, scopes | `meri_conversations.runs.projection` (the Run object: `state`, `binding`, `scopes`) | `run_state`, `run_binding`, `run_scopes` |

At every check Core requires all of the following, or it refuses and records the reason. **A view row's existence is never authority** (dot 6248061000):
- `admitted` is true: the DB-checkable part of Meri's canonical current-admission predicate (`admitted-run-current.mjs` `readCurrentAdmission`). The budget is not quarantined, and an `ACTIVE`, unexpired grant of the run's attempt, fence and policy is bound to the run. Meri's admission revoke sets the grant `REVOKED`, which ends delegated authority at the next issue, use or release. This is the same revocation predicate the execution receiver must consume, so the two lanes map one owner;
- `run_state ∈ {queued, starting, running}`;
- `fence` and `attempt` equal the delegation's;
- `policy_revision` equals the delegation's;
- `run_scopes` is exactly one client scope equal to the delegated client;
- `allocation_sha256` equals the delegation's, and the token's operation is in `allowed_operations`;
- `now < admitted_until` (the earlier of the run deadline and the admitting grant's expiry);
- for `tool` tokens, a `reservations_v1` row with `invocation_id = callKey`, `state = 'UNKNOWN'` and an equal operation and arguments hash.

Meri's budget owner reserves before dispatch, so **Core only ever authorizes a tool call Meri has already counted and held**. Core is never a spend owner.

## 5. Call budget, slots and counting (R-b)

- **Allowance.** `remaining = max_tool_calls − reserved_calls` (view, §4). It is never derived from `allocation.schedule.operations`, which is unique operation/tariff entries and not an invocation count. The preview allocation today has `maxToolCalls: 1` (`infra/product-preview/first-chat/allocation.json`), so B allows exactly one tool call per run there.
- **Call slot.** One per Meri invocation, identified by `callKey` = the Meri `invocationId` (≤ 128 chars, the budget's primary key). Repeated operations are separate invocations, so they are separate slots, each counted by Meri.
- **Per-slot token ceilings** (fixed; Core counts them; Meri refuses first). Revision 2 counted 3 observations per call; the real path makes more, so revision 3 derives them from the code (`contract.mjs` `readTokenCeilings`, pinned by tests):
  - **Observations per call: 7.** The tool dispatch observes the current native context 5 times (prepare, before, effect after the reservation, release, final). The transport's credential acquisition observes twice (before and after the service secret). client-registry result authorization adds 2.
  - **Core calls per observation.** Each delegated reader mirrors option A's identity / route / identity, with `current` in place of identity:

| Class | `current` | `mode` | `reference` |
|---|---|---|---|
| plain read | 1 | 0 | 0 |
| BD client task (conversation proof) | 2 | 0 | 0 |
| named-client reference read | 4 | 0 | 1 |
| mode read | 5 | 1 | 0 |

| kind | Max per slot | Derivation |
|---|---|---|
| `tool` | 1 | One dispatch, after Meri's own UNKNOWN reservation (§4) |
| `mode` | 7 | 7 observations × 1 |
| `reference` | 7 | 7 observations × 1 |
| `current` | 35 | 7 observations × 5 (mode reads); also covers 9 × 1 for client-registry |

  These are Core-enforced maxima, not targets. A plain read uses exactly 7 `current` and 1 `tool` (composed test). Collapsing the owner's repeated observations would lower real use, never the bound, and is a later optimization.

- **Open slots.** A slot may be opened (its first token issued) only while `open_unreserved_slots < remaining`. A slot whose `tool` token was never issued closes at its tokens' expiry.
- **Retries.** At most 2 re-issues per (slot, kind), see §7. These never add slots.

## 6. Service identity (R-e)

- Every delegation route (create, tokens, current, revocations) and every delegated target requires **`hasVerifiedToolServiceIdentity(req) === true`** (`auth/tool-service-secret.guard.ts:24`), meaning the secret was actually matched.
- `ToolServiceSecretGuard` returning `true` in development/test observe mode is **not** sufficient. When `INTERNAL_SERVICE_SECRET` is unset, every delegation route and branch refuses in every environment.

## 7. Atomicity, idempotency, retries, stop and release (R-f)

- **Create (idempotent):**
  - `idempotencyKey` = sha256 of `{mode, tenantId, actorId, clientId, conversationId, runId, attemptId, writerFence, allocationSha256, operationsDigest, policyRevision, occurrenceKey|null}`.
  - A unique index on `(idempotency_key) WHERE state = 'active'` means a repeat returns the same row.
  - Allowance is never stored on the delegation; it is read live from Meri's view (§4). So creating or renewing **cannot multiply allowance**.
- **Renew:** attended only. It inserts a new row with `supersedes = old.id` and marks the old row `superseded` in the same transaction. Slots and counters are keyed by `(run_id, call_key)`, not by delegation, so they carry over.
- **Token issue (atomic):** in one transaction, Core
  1. `SELECT … FOR UPDATE` on the delegation;
  2. reads the view;
  3. upserts the slot `(run_id, call_key)` with `CHECK` limits per kind;
  4. increments that kind's counter only if it is below its ceiling;
  5. inserts the token row (`jti` primary key, `token_sha256`, `kind`, `call_key`, `target`, `expires_at`).

  Any check failing rolls back the whole transaction.
- **Lost response:** Meri retries with the same `(callKey, kind)` and canonical request digest (above), as `retryOf`.
  - If the previous token is unconsumed and unexpired, Core marks it `superseded` and issues a new `jti`. The kind counter does not increase, but `reissues` does (at most 2).
  - A consumed token is never re-issued.
  - Core never stores or returns a token value, only its hash.
- **Use (atomic `jti` consumption):** in one transaction with the delegation row `FOR SHARE` and the view read: `UPDATE meri_read_tokens SET consumed_at = now() WHERE jti = $1 AND consumed_at IS NULL AND superseded_at IS NULL AND expires_at > now() RETURNING …`. Zero rows means 401 or 409.
- **Before response release:** after the handler returns and **before any byte is written**, Core:
  - re-reads the delegation (active, not superseded, `now < expires_at`) and the view (state, fence, deadline, client scope);
  - re-checks client visibility.

  Any change gives 409 or 410 and the result is withheld. The hard expiry is `min(token exp, delegation expires_at, run_deadline)`.
- **Local stop without remote revoke:**
  - Meri Stop first marks the run terminal in its own store (`meri_conversations.runs.projection.state`). Core reads that at every issue, use and release, so authority ends even if the revoke call fails.
  - Meri also stops requesting tokens and aborts in-flight transports, as #149 does.
  - The `revocations` call is best-effort with bounded retries. It is not required for safety.

## 8. Expiry and renewal (R-g; the §6 contradiction in revision 1 is resolved)

| Authority | Expiry | Renewal |
|---|---|---|
| Attended delegation | `min(run_deadline, issuedAt + 30 min, tenant limit)` | **Attended only**, from a live `sid` session (the same path as create), as a new superseding row. Never silent |
| Unattended consent | `min(createdAt + 30 days, tenant limit)` | **Attended only**: the user, signed in, confirms a new consent that supersedes the old one. Never automatic |
| Unattended occurrence delegation | `min(consent expires_at, occurrence run_deadline, occurrence start + 15 min)` | **Never renewed.** One per occurrence; a retried create for the same `occurrenceKey` returns the same row (idempotent) |
| Read token | `min(now + 60 s, delegation expires_at, run_deadline)` | Re-issue only as in §7 |

Time is Core's database clock; skew is at most 5 s, as `isWellFormedMeriControlCredentialClaims` uses.

## 9. Revocation and unattended scope (R-g)

- **Terminal revocation of a delegation:**
  - the run is terminal, cancelled or fenced, or its scope changes (Core sees this through the view);
  - the user is deactivated, or the membership status, role or client visibility changes;
  - the policy revision changes;
  - it is superseded;
  - an explicit Meri revoke.
- **Consent states:** `active`, `paused`, `revoked`, `superseded`, `expired`.
  - **Paused:** authority ends at once (Neo, D016-A 4). No occurrence delegation is issued, and existing ones are revoked. Meri also re-reads the occurrence's consent before every unattended token and refuses locally.
  - **Revoked:** all occurrence delegations under the consent are revoked at once.
- **Changed schedule scope.** The consent binds `scheduleId`, `clientId`, `operationsDigest`, `policyRevision`, and the schedule's `projection_sha256` (`meri_schedules.projections`, read through `schedules_v1`, whose `owner_actor_id` must equal the consenting user). Any change to client, operations, cadence or projection makes the consent non-matching. Issuance refuses, and a new attended consent is required.
- **Occurrence issuance** also requires the `meri_schedules.occurrences` row `(tenant_id, occurrence_key)` to be in state `DISPATCHED`, with `effect.binding` equal to the delegation's run binding (tenant, conversation, run). Core reads this through the facts view `occurrences_v1` (§11.2).

## 10. Wire (bounded; placeholders only; no credential appears in this document)

All bodies are closed objects (additional properties refused) of at most 16 KiB, with `schemaVersion: 1`.

**Create:** `POST /api/clio/application-authority/read-delegations`
- Attended: `Authorization: Bearer <live user session>` (the `sid` branch, as `identity`) plus a verified service identity.
- Unattended: verified service identity plus `consentId`; no user bearer.
- Request:

```json
{"schemaVersion":1,"mode":"attended","binding":{"tenantId":"<uuid>","actorId":"<uuid>","conversationId":"<uuid>","runId":"<uuid>","attemptId":"<uuid>","writerFence":1},
 "clientId":"<uuid>","policyRevision":"<64 hex>","allocationSha256":"<64 hex>","operationsDigest":"<64 hex>","supersedes":null}
```

  Unattended adds `"mode":"unattended","consentId":"<uuid>","scheduleId":"<uuid>","occurrenceKey":"<64 hex>"`.
- Response: `{"schemaVersion":1,"delegationId":"<uuid>","expiresAtMs":0,"checkedAtMs":0}`. It is a reference, not a credential.

**Token:** `POST /api/clio/application-authority/read-delegations/{delegationId}/tokens`
- Verified service identity only. Request:

```json
{"schemaVersion":1,"kind":"tool","callKey":"<meri invocation id>","method":"POST","path":"/api/clio/tools/search_tracked_bills","bodySha256":"<64 hex>","operation":{"id":"search_tracked_bills","version":"0.2.0"},
 "argumentsSha256":"<64 hex>","toolRequestSha256":null,"referenceSha256":null,"retryOf":null}
```

- `argumentsSha256` is required for `tool` and null otherwise: Core matches it, with the operation, against the `reservations_v1` row for `callKey`. `retryOf` is null on a first request; a lost-response retry sends the same request with `retryOf` = its canonical digest. **Canonical request digest** (dot 6248070410): the canonical-JSON sha256 of the request with `retryOf` normalized to `null`, for first requests and retries alike. Core stores it with each token and finds a retry's unconsumed predecessor by that digest.
- Response: `{"schemaVersion":1,"token":"<opaque>","expiresAtMs":0}`.
- JWT claims (typ `capiro-meri-read+jwt`, ES256, header `kid`): `iss`, `aud` = `capiro:meri-native-read:v1`, `sub` = delegationId, `jti`, `iat`, `nbf`, `exp`, `kind`, `callKey`, `method`, `path`, `bodySha256`, `operation`, `toolRequestSha256`, `referenceSha256`, `tenantId`, `actorId`, `clientId`, `conversationId`, `runId`.

**Use:** `Authorization: CapiroMeriRead <token>` plus verified service identity, on the token's target only.
- The middleware branch verifies the signature, `kid`, `aud`, `nbf`/`exp`, method, path, empty query, body hash and target binding (§3), and consumes the `jti` (§7).
- It builds the tenant context from the delegation, with no provisioning, identity rebind, self-heal or `lastSeenAt` write, and refuses impersonation headers.

**Revoke:** `POST …/read-delegations/{delegationId}/revocations` with `{"schemaVersion":1,"reason":"run_terminal|cancelled|fenced|superseded"}`. Idempotent.

**Consent** (attended, user signed in): `POST …/read-delegation-consents` with `{schemaVersion, scheduleId, clientId, operationsDigest, policyRevision, scheduleProjectionSha256, requestedExpiresAtMs}`.

**Errors:**
- 401: credential.
- 403: scope, target, operation or binding.
- 409: changed or revoked.
- 410: expired.
- 429: slot or ceiling exhausted.

Meri maps these to `UNAVAILABLE` or `ACCESS_DENIED`.

## 11. Storage, key and grants packet (selected; Core owner confirms names in review)

### 11.1 Core migration: `apps/api/prisma/migrations/<timestamp>_meri_read_delegation/migration.sql` (CREATE-only, Core's normal migration role, `public` schema)

```sql
CREATE TABLE meri_read_delegation_consents (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, user_id uuid NOT NULL, client_id uuid NOT NULL,
  schedule_id uuid NOT NULL, schedule_projection_sha256 char(64) NOT NULL, operations_digest char(64) NOT NULL,
  policy_revision char(64) NOT NULL, state text NOT NULL CHECK (state IN ('active','paused','revoked','superseded','expired')),
  supersedes uuid REFERENCES meri_read_delegation_consents(id), created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 days'));
CREATE UNIQUE INDEX meri_read_consent_active ON meri_read_delegation_consents(tenant_id, schedule_id) WHERE state = 'active';

CREATE TABLE meri_read_delegations (
  id uuid PRIMARY KEY, idempotency_key char(64) NOT NULL, mode text NOT NULL CHECK (mode IN ('attended','unattended')),
  tenant_id uuid NOT NULL, user_id uuid NOT NULL, membership_id uuid NOT NULL, client_id uuid NOT NULL,
  conversation_id uuid NOT NULL, run_id uuid NOT NULL, attempt_id uuid NOT NULL, writer_fence integer NOT NULL CHECK (writer_fence > 0),
  allocation_sha256 char(64) NOT NULL, operations_digest char(64) NOT NULL, policy_revision char(64) NOT NULL,
  consent_id uuid REFERENCES meri_read_delegation_consents(id), occurrence_key char(64),
  revision integer NOT NULL DEFAULT 1, state text NOT NULL CHECK (state IN ('active','superseded','revoked','expired')),
  supersedes uuid REFERENCES meri_read_delegations(id), revoked_reason text,
  issued_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  CHECK ((mode = 'attended' AND consent_id IS NULL AND occurrence_key IS NULL AND expires_at <= issued_at + interval '30 minutes')
      OR (mode = 'unattended' AND consent_id IS NOT NULL AND occurrence_key IS NOT NULL AND expires_at <= issued_at + interval '15 minutes')));
CREATE UNIQUE INDEX meri_read_delegation_idem ON meri_read_delegations(idempotency_key) WHERE state = 'active';
CREATE UNIQUE INDEX meri_read_delegation_occurrence ON meri_read_delegations(tenant_id, occurrence_key) WHERE occurrence_key IS NOT NULL;

CREATE TABLE meri_read_delegation_slots (
  run_id uuid NOT NULL, call_key varchar(128) NOT NULL, delegation_id uuid NOT NULL REFERENCES meri_read_delegations(id),
  tool_tokens smallint NOT NULL DEFAULT 0 CHECK (tool_tokens BETWEEN 0 AND 1),
  mode_tokens smallint NOT NULL DEFAULT 0 CHECK (mode_tokens BETWEEN 0 AND 7),
  reference_tokens smallint NOT NULL DEFAULT 0 CHECK (reference_tokens BETWEEN 0 AND 7),
  current_tokens smallint NOT NULL DEFAULT 0 CHECK (current_tokens BETWEEN 0 AND 35),
  -- At most 2 lost-response re-issues per kind (4 kinds), matching contract.mjs READ_TOKEN_REISSUES.
  reissues smallint NOT NULL DEFAULT 0 CHECK (reissues BETWEEN 0 AND 8),
  opened_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (run_id, call_key));

CREATE TABLE meri_read_tokens (
  jti uuid PRIMARY KEY, token_sha256 char(64) NOT NULL UNIQUE, delegation_id uuid NOT NULL REFERENCES meri_read_delegations(id),
  run_id uuid NOT NULL, call_key varchar(128) NOT NULL, kind text NOT NULL CHECK (kind IN ('tool','mode','reference','current')),
  target_method text NOT NULL CHECK (target_method = 'POST'), target_path text NOT NULL, body_sha256 char(64) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL CHECK (expires_at <= issued_at + interval '60 seconds'),
  consumed_at timestamptz, superseded_at timestamptz, CHECK (consumed_at IS NULL OR superseded_at IS NULL),
  FOREIGN KEY (run_id, call_key) REFERENCES meri_read_delegation_slots(run_id, call_key));
CREATE INDEX meri_read_tokens_expiry ON meri_read_tokens(expires_at) WHERE consumed_at IS NULL AND superseded_at IS NULL;
```

Rollback is `DROP TABLE` of these four tables, which hold no other data. Take a snapshot first. There is no backfill.

### 11.2 Meri migration: run-facts views (CREATE-only; created as the owner of the base schemas, `meri_product_migrator` per the grants proposal)

In source: `apps/runtime/native-authority/read-delegation/migrations/0001_read_delegation_facts.sql`, sha256 `700663d7b788ba594c2ebd3df7c197949a471e6382ce4a98d94ce038fa9b03eb` (pinned by `read-delegation/test/core-client.test.mjs`). It needs the meri stage plus schedules 0001–0002, so its plan line goes in the `integration` stage after `apps/artifacts/migrations/0003_previews.sql` and before `phase:integration_grants` (R0 edits `infra/product-preview/first-chat-migrate.mjs`; not edited here):

```js
['migration','apps/runtime/native-authority/read-delegation/migrations/0001_read_delegation_facts.sql','700663d7b788ba594c2ebd3df7c197949a471e6382ce4a98d94ce038fa9b03eb','integration'],
```

The file's SQL, verbatim:

```sql
BEGIN;
CREATE SCHEMA meri_read_delegation_facts;
REVOKE ALL ON SCHEMA meri_read_delegation_facts FROM PUBLIC;
CREATE VIEW meri_read_delegation_facts.run_facts_v1 WITH (security_barrier = true) AS
SELECT a.run_id,
       c.tenant_id,
       c.conversation_id,
       a.allocation_sha256,
       a.allocation->'manifest'->'allowedOperations' AS allowed_operations,
       a.max_tool_calls,
       LEAST(a.started_at + make_interval(secs => (a.allocation->'budgets'->>'maxRuntimeSeconds')::double precision),
             (a.allocation->'schedule'->>'expiresAt')::timestamptz) AS run_deadline,
       (SELECT count(*) FROM meri_product_budget.tool_reservations t WHERE t.run_id = a.run_id) AS reserved_calls,
       r.attempt,
       r.fence,
       r.policy_revision,
       NOT (SELECT b.quarantined FROM meri_product_budget.budget b WHERE b.id = 1) AND g.grant_id IS NOT NULL AS admitted,
       LEAST(a.started_at + make_interval(secs => (a.allocation->'budgets'->>'maxRuntimeSeconds')::double precision),
             (a.allocation->'schedule'->>'expiresAt')::timestamptz, g.expires_at) AS admitted_until,
       c.projection->>'state' AS run_state,
       c.projection->'binding' AS run_binding,
       c.projection->'scopes' AS run_scopes
  FROM meri_product_budget.tool_run_allocations a
  JOIN meri_product_budget.runs r ON r.run_id = a.run_id
  JOIN meri_conversations.runs c ON c.run_id = a.run_id
  LEFT JOIN LATERAL (
   SELECT gr.grant_id, gr.expires_at FROM meri_product_budget.grants gr
     JOIN meri_product_budget.tool_grant_bindings gb ON gb.grant_id = gr.grant_id AND gb.run_id = a.run_id
    WHERE gr.run_id = a.run_id AND gr.state = 'ACTIVE' AND gr.attempt = r.attempt AND gr.fence = r.fence
      AND gr.policy_revision = r.policy_revision AND gr.expires_at > clock_timestamp()
    ORDER BY gr.expires_at DESC LIMIT 1) g ON true;
CREATE VIEW meri_read_delegation_facts.reservations_v1 WITH (security_barrier = true) AS
SELECT invocation_id, run_id, operation, arguments_sha256, state
  FROM meri_product_budget.tool_reservations;
CREATE VIEW meri_read_delegation_facts.occurrences_v1 WITH (security_barrier = true) AS
SELECT tenant_id, occurrence_key, schedule_id, generation, state, effect->'binding' AS run_binding, created_at
  FROM meri_schedules.occurrences;
CREATE VIEW meri_read_delegation_facts.schedules_v1 WITH (security_barrier = true) AS
SELECT tenant_id, schedule_id, owner_actor_id, generation, projection_sha256
  FROM meri_schedules.projections;
COMMIT;
```

- Only the product namespace (`meri_product_budget`) is eligible; `meri_qualification` runs never get a delegation.
- The view owner needs `SELECT` on `meri_conversations.runs`, `meri_schedules.occurrences` and `meri_schedules.projections`, granted by those schemas' owners.
- Meri `tenant_id` columns are `text`. Core compares them with its `uuid` tenant id as text.

### 11.3 Grants

```sql
-- Core's API runtime role: `capiro_app` in Core's security-rehearsal SQL; the Core owner confirms the deployed name.
GRANT USAGE ON SCHEMA meri_read_delegation_facts TO capiro_app;
GRANT SELECT ON meri_read_delegation_facts.run_facts_v1, meri_read_delegation_facts.reservations_v1,
  meri_read_delegation_facts.occurrences_v1, meri_read_delegation_facts.schedules_v1 TO capiro_app;
-- Core's own tables: SELECT/INSERT/UPDATE for capiro_app, no DELETE (expiry-sweep deletion is a later, separate migration).
GRANT SELECT, INSERT, UPDATE ON meri_read_delegation_consents, meri_read_delegations, meri_read_delegation_slots, meri_read_tokens TO capiro_app;
-- No Meri runtime role gets any privilege on Core's tables.
```

### 11.4 Key custody

- **Key:** AWS KMS asymmetric key, spec `ECC_NIST_P256`, usage `SIGN_VERIFY` (ES256), alias `alias/capiro-meri-read-delegation-v1`, in the Core account and region.
- **Key policy:** account root admin; the Core API task role gets `kms:Sign` and `kms:GetPublicKey` only. No other principal, and no `kms:Encrypt`/`Decrypt`.
- **Verification:** local, with the public key fetched once at startup and pinned by `kid` (the KMS key id). There is no remote verify per request.
- **Rotation:** create `-v2`, issue new tokens with it, and verify both `kid`s for 60 s (the maximum token lifetime). Then remove v1 from the verify set.
- Creating the key is an AWS action and is **not** done here.

## 12. Neo's decisions (D016-A 4, PR #121 6247327210): decided

1. **Attended:** at most 30 minutes **total** from issuance, never past the run deadline. It may outlive the creating Clerk session. Renewal is a new superseding delegation created only from a live login; there is no extension. Meri enforces the bound on every create receipt (`delegationBound`, `assertDelegationReceipt`).
2. **Unattended:** at most 15 minutes per occurrence, under an explicit signed-in consent of at most 30 days. It is never renewed; the consent is renewed only by a live login. Pause or revoke of the consent ends authority: Meri refuses before asking Core (`assertOccurrence`), and Core refuses issuance.
3. **No writes:** read delegation never authorizes a write. Only `sideEffect:'none'`, `approvalBoundary:'none'` operations get a token (`assertReadOnlyOperation`), and any write intent still needs attended approval.
4. **Option A stays the attended fallback.** It is used only when Core delegation is *unavailable* for an attended run, never when Core refused, and never for unattended runs. One call never mixes the two.

Out of scope for source (the packet): live credential creation, KMS/IAM, the Core migration and grants, the Meri migration's application, and activation.

## 13. Acceptance tests the implementation must carry (source)

- **Core issuance:**
  - Refuses: a marked token; a sidless or inactive session (attended); an observe-mode guard pass without `hasVerifiedToolServiceIdentity`.
  - Refuses: a run that isn't active, a fence/attempt/policy/allocation mismatch, an operation outside `allowed_operations`, and a scope wider than one client.
  - A repeated create returns the same row; a renew carries slots over and never adds allowance.
- **Core tokens:**
  - Refuses: a slot beyond `remaining`; a `tool` token without the matching `UNKNOWN` reservation; a ceiling per kind; a third re-issue; a consumed `jti`.
  - A lost-response retry supersedes the unconsumed token without spending.
- **Core use and release:**
  - Refuses: a wrong method, path, query or body; a `mode` operation or `toolRequestSha256` mismatch; a check-ref result for another client; a body selector naming another client or conversation; a write tool name; the `identity`/`context`/`membership` routes with any read token.
  - A run that goes terminal, fenced or expired, or a revoked delegation, during the handler withholds the response.
  - The branch never provisions, rebinds or writes `lastSeenAt`.
- **Core current receipt:**
  - Equal shape to `membership`, but `clientIds` holds only the delegated client.
  - The BD `conversation` block refuses a different client or a prospect link.
  - `readDelegated` refuses on user, delegation or run-fact drift between snapshots.
- **Meri:**
  - The delegated adapter keeps `assertNativeToolAuthority` and `assertNativeConversationAuthority` unchanged.
  - The transport is bounded by `min(token exp, delegation expiry, run_deadline)` and aborts in flight (#149).
  - Stop marks the run terminal first and refuses locally when revoke fails.
  - No token, bearer or secret is persisted or logged.
  - Unattended runs without consent stay `UNAVAILABLE`.

## 14. Meri implementation (revision 3) and how each review point is closed in code

| Module (`apps/runtime/native-authority/read-delegation/`) | Role |
|---|---|
| `contract.mjs` | Bounds (§12), routes, closed wire shapes, `readTokenCeilings`, occurrence and consent checks, read-only operation check |
| `core-client.mjs` | Fixed-route Core client: service identity on every call; live bearer only on attended create and consent widen; `CapiroMeriRead` only on targets; ≤ 16 KiB bodies; status mapping; lost responses marked |
| `delegation.mjs` | Per-run owner: mode from trusted facts, single-flight create/supersede, per-slot ceilings and call allowance, token retries, Stop order, `assertReleasable` |
| `native-credentials.mjs` | Adapter for the unchanged native credential owner: per-call handle, delegated `current`/conversation/reference/mode readers, `tool` token exchange, attended fallback to option A |
| `consent.mjs` | Approve (live login, ≤ 30 days), narrow (pause/revoke, service identity), resume (live login) |
| `migrations/0001_read_delegation_facts.sql` | The §4 facts views |

Shared changes:
- **Durable dispatch** passes its trusted invocation id to the executor (`tool-budget-execution.mjs`, `tool-budget-dispatch.mjs`).
- **Native context port:** `tool-dispatch.mjs` hands the invocation id only to a port that opted in (`acceptsInvocationId`, `native-read-context.mjs`). The real owner opts in; existing fakes are untouched.
- **Owner** (`owner.mjs`): pins the call key per call and passes it to the credential lookup. It exchanges a delegated handle for the `tool` token at the transport's exact target. All option A paths are unchanged.
- **Transport** (`http-transport.mjs`): hashes the exact body bytes it sends, passes `{method, path, bodySha256}` to the credential owner, and sends a delegated token with its own scheme.
- **Composer** (`reads-composer.mjs`): `delegation:{enabled, readOccurrence}`, disabled by default. It returns `readDelegation.{enabled, stopRun, consents}`.

| Review point | Closed in code by |
|---|---|
| 6246081306: B must not replace only the auth branch; the native owner calls identity/membership per observation | Delegated readers serve every owner observation from `current` receipts. Identity, context and membership are never called (composed test). The owner's checks run unchanged on the results |
| 6246081306: BD context proof | `readConversation` uses `current` with `conversation:true`, only for the delegation's own conversation and client |
| 6246081306: `maxReadTokens = schedule.operations.length` is not a call budget | Slots are keyed by the durable invocation id, and slot count ≤ the allocation's `maxToolCalls`. Per-slot ceilings are derived from the call path (§5). The `tool` token requires Meri's own UNKNOWN reservation |
| 6246081306 / 6246089074 #1: trusted verification source | The `run_facts_v1` / `reservations_v1` / `occurrences_v1` / `schedules_v1` views (migration above). Meri sends the reservation's arguments hash for Core to match |
| 6246089074 #2: bind decoded resources | A check-ref result for another client is refused (`ACCESS_DENIED`). The mode token carries the body's operation and request hash. The `tool` token is bound to the exact path and body bytes the transport sends. `current` must name exactly the delegated client |
| 6246089074 #3: verified service identity | Every delegation call and delegated target carries the service secret, re-read per call. No client exists without it. The secret is never sent as a bearer |
| 6246089074 #4: atomic counting, idempotency, lost responses, local stop, pre-release checks | **Retries:** a lost response is retried as `retryOf` the same request, at most 2 per slot and kind; refusals are never retried. **Idempotency:** create is single-flight and Core-idempotent. **Stop order:** refuse locally → abort in flight → bounded best-effort revoke. A stopped run keeps a tombstone, so a later task cannot re-create it. **Release:** the dispatch's release observation is a delegated `current`, and Core re-checks before release; a change withholds the result |
| 6246089074 #5: consent duration, occurrence expiry, scope change, pause/revoke, the renewal contradiction | **Durations:** consent ≤ 30 days; occurrence ≤ min(start + 15 min, consent, run). **Scope:** any client, operations, policy or binding change refuses. **Pause/revoke:** paused, revoked or expired consent refuses before Core. **Renewal:** attended renewal by live login only; unattended never renewed |

| 6248061000 #1: the view exposed no canonical admission | `run_facts_v1.admitted` / `admitted_until` (quarantine plus an ACTIVE, unexpired, bound grant of the run's attempt, fence and policy); §4 requires them and never treats row existence as authority |
| 6248061000 #2: Stop must abort target calls and the tool transport | The per-run Stop signal joins the reads mount's lifetime (every dispatch, credential and transport call of the run) and every delegated target call. Composed and unit tests abort an in-flight request at Stop, and mutation-check both paths |
| 6248070410: SQL constants and retry hashing | §11.1 CHECKs are 35/7/7/1 with reissues ≤ 8. The canonical request digest normalizes `retryOf` to null; the fixture now uses it, and a composed lost-response read completes with one superseded predecessor and one reissue |

**Tests** (Node 24, serial):
- `read-delegation/test/composed.test.mjs` 11/11 (real composer, installation, owner, durable dispatch, budget, session owner and relay; synthetic Core);
- `delegation.test.mjs` 13/13;
- `core-client.test.mjs` 4/4.

**Remaining, outside this lane:**
- **Core:** the routes, `TenantContextMiddleware` branch, `readDelegated`, the tables, and the ES256 key (§11), in Core's protected auth/middleware lane.
- **R0:** the plan line and grants (§11.2–§11.3) in `infra/**`. In `cli.mjs`: pass `delegation:{enabled, readOccurrence}`, where `readOccurrence` is the schedule owner's trusted occurrence facts for a run binding. Call `reads.readDelegation.stopRun({binding, reason})` from the run Stop path after the run is recorded terminal. Wire `readDelegation.consents` into the routines approve/pause/delete paths.
