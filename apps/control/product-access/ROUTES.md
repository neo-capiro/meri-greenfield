# Product surface routes: memory, settings and tasks

Status: **source only, unactivated**. Nothing here opens a listener, applies a migration or calls Core. The wire shapes below are a
**local proposal** (memory-surface / settings `0.1-proposal`), not frozen contracts; they change only through review. Composition:

```js
const app = createProductApplication({
  gate: createMembershipGate({verifyToken, readMembership, now, limits: {maxRequestMs, maxFactBytes}}),
  routes: {...createMemoryRoutes({producer}), ...createSettingsRoutes({service}), ...createTaskRoutes({operationalReads, now})},
  now, limits: {maxRequestMs, maxRequestBytes, maxResponseBytes},
});
// app.handle(Request) → Promise<Response>; mount it with the existing bounded Node HTTP bridge on the application origin.
```

## Common transport

- Same application origin, `POST` only, exact paths, no query string or fragment. No CORS policy is provided.
- Headers: `Content-Type: application/json` (optional `; charset=utf-8`), no `Content-Encoding`,
  `Authorization: Bearer <native session token>` (the user's Clerk session token, **not** an action-session credential or tool capability).
- Body: one JSON object, at most `maxRequestBytes`. Read routes take `{}` when they have no parameters; unknown fields are refused.
- Every request is admitted afresh: the token is verified and Core's **current** membership must be `active`. Tenant, actor, role,
  permissions and clients come only from those server-side facts; nothing in the body or headers selects them.
- Before any result is released the membership is read again. If it was removed, suspended or changed in the meantime, the result is
  withheld (see `MEMBERSHIP_REVOKED` / `MEMBERSHIP_CHANGED`).
- `200` bodies are the documented JSON. Responses carry `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- Errors are content-free: `{"error":{"code":"…","outcome"?:"…","field"?:"…"}}`. `field` names the offending request field (never its
  value) for validation refusals. `outcome` appears only when an effect may have happened:
  - `UNKNOWN`: the write may or may not have committed. Do not assume either; re-read (or replay with the same idempotency key / revision).
  - `RESULT_NOT_RELEASED`: the write was acknowledged but its result was withheld (membership changed, size or deadline at release).

| Status | Code | Meaning for the UI |
|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed JSON, length or body. |
| 401 | `UNAUTHENTICATED` | Missing/malformed bearer. Re-authenticate. |
| 403 | `ACCESS_DENIED` | Token or membership facts refused. Re-authenticate. |
| 403 | `MEMBERSHIP_REVOKED` | The user is no longer an active member of this tenant. Sign out of the tenant; nothing is shown. |
| 404 | `NOT_FOUND` | Unknown path. |
| 405 | `METHOD_NOT_ALLOWED` | Not `POST`. |
| 408 | `DEADLINE` | Request deadline passed. |
| 409 | `MEMBERSHIP_CHANGED` | Role, permissions or clients changed during the request. Refetch (a new request sees the new walls). |
| 413 | `REQUEST_TOO_LARGE` | Body over the limit. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Not JSON or encoded. |
| 499 | `CANCELLED` | Client cancelled. |
| 502 | `PRODUCT_UNAVAILABLE` | Any unexpected failure; no detail is disclosed. |

Membership removal also invalidates stored access elsewhere: when the gate's `verifyIdentity` is the identity port of the action-session
owner (`apps/control/action-host/session`), each stored action session is rechecked on use and is discarded once its member is removed
or changed (role, permissions or clients); a fresh issuance is required.

## Memory proposals

Meri **proposes**; Core's canonical review is the only authority that approves, publishes or rejects. There is no confirm, correct-in-place
or forget route (excluded by owner direction). Every proposal becomes one immutable, hash-pinned candidate with its cited sources and origin.

Common objects:

```ts
type SourceRef = {kind: 'conversation_message'|'artifact_version'|'document'|'web_page'|'memory'; reference: string /*1..512; https URL for web_page*/;
                  sha256: string|null /*64 hex*/; title: string|null /*1..200*/};
type Proposal = {
  candidateId: string /*uuid*/; candidateSha256: string /*64 hex: exact candidate submitted to review*/;
  kind: 'addition'|'correction'; scope: 'personal'|'client'|'firm'; clientId: string|null /*uuid, client scope only*/;
  content: string; key: string|null; ttlDays: number|null;
  corrects: {memoryId: string; memorySha256: string}|null /*correction target pinned at proposal time*/;
  reason: string|null; sources: SourceRef[]; origin: {kind:'surface'} | {kind:'conversation'; conversationId; runId; commandId; commandSha256};
  createdAt: string /*ISO*/;
  review: {status: ReviewStatus; reviewId: string|null; decidedAt: string|null; publishedMemoryId: string|null; checkedAt: string|null};
};
type ReviewStatus = 'pending'|'approved'|'rejected'|'expired'|'withdrawn'   // Core's decision
                  | 'submission_unknown'  // stored, but Core's receipt of it is not confirmed; replay the same request to resubmit it
                  | 'review_missing'      // acknowledged earlier but Core no longer reports it; show as an inconsistency, not as pending
                  | 'unavailable';        // Core's status could not be read now; never show this as pending
```

| Path | Body | 200 |
|---|---|---|
| `/api/memory/proposals/list` | `{cursor?: string\|null, limit?: 1..50 (20), clientId?: uuid\|null}` | `{proposals: Proposal[], nextCursor: string\|null}` (own proposals, newest first) |
| `/api/memory/proposals/status` | `{candidateId: uuid}` | `Proposal` |
| `/api/memory/proposals/propose` | `{idempotencyKey: uuid, scope, clientId?: uuid (required iff scope='client'), content: 1..4000, key?: 1..120\|null, ttlDays?: 1..365\|null, sources?: SourceRef[] (≤16)}` | `{proposal: Proposal}` |
| `/api/memory/proposals/correct` | `{idempotencyKey: uuid, targetMemoryId: 1..128, content: 1..4000, reason: 1..1000, sources: SourceRef[] (1..16)}` | `{proposal: Proposal}` (scope/client/key come from the target) |

Rules the UI can rely on:

- `personal` is always the user's own; `client` requires a client the user currently holds; `firm` requires Core's `memory.propose.firm`
  membership permission. The UI should offer only these, but the server decides.
- Generate one `idempotencyKey` per user intent and reuse it on retry. The same key with the same body returns the same proposal (and
  resubmits it only if its earlier submission was unconfirmed); the same key with a different body is `MEMORY_IDEMPOTENCY_CONFLICT`.
- Listings re-apply current walls: proposals about a client the user no longer holds disappear from list/status.
- Correction targets come from the user's memory reads (`targetMemoryId`). Targets outside the user's walls are reported as not found.

| Status | Code |
|---|---|
| 400 | `MEMORY_REQUEST_INVALID` |
| 403 | `MEMORY_SCOPE_REFUSED`, `MEMORY_CLIENT_REFUSED` |
| 404 | `MEMORY_PROPOSAL_NOT_FOUND`, `MEMORY_TARGET_NOT_FOUND` |
| 409 | `MEMORY_IDEMPOTENCY_CONFLICT`, `MEMORY_TARGET_INELIGIBLE` (target superseded/forgotten/expired) |
| 500 | `MEMORY_JOURNAL_STATE`, `MEMORY_CANDIDATE_INVALID` |
| 503 | `MEMORY_TARGET_UNAVAILABLE`, `MEMORY_JOURNAL_UNAVAILABLE`, `MEMORY_JOURNAL_UNKNOWN` (`outcome: UNKNOWN`), `MEMORY_UNAVAILABLE` |

Conversational `memory.propose` (the agent tool) uses the same producer through the canonical command executor and approval path
(`apps/control/memory/command-source.mjs`); a keyed proposal that matches an existing eligible memory is proposed as a correction of it.

## Settings

```ts
type UserPreferences = {theme: 'system'|'light'|'dark'; density: 'comfortable'|'compact'; timezone: string|null /*IANA; null = tenant default*/;
                        notifications: {runCompleted: boolean; approvalRequested: boolean; memoryReviewed: boolean}; defaultClientId: string|null /*uuid*/};
type TenantSettings = {defaultTimezone: string /*IANA*/; capabilityPolicy: {capabilities?: Partial<CapabilityPolicy>; roles?: {[role]: Partial<CapabilityPolicy>}}};
```

`CapabilityPolicy` is the worker policy in `apps/worker/conversation/capabilities/policy.mjs`. Saves send the **complete** document and
the revision the user edited (`0` before the first save).

| Path | Body | 200 |
|---|---|---|
| `/api/settings/user/read` | `{}` | `{revision, preferences: UserPreferences}` (defaults at revision 0; a default client the user no longer holds reads as `null`) |
| `/api/settings/user/save` | `{expectedRevision, preferences: UserPreferences}` | `{revision, preferences}` |
| `/api/settings/tenant/read` | `{}` | `{revision, defaultTimezone, capabilityStatus, effectiveCapabilities}` for every member (effective for *their* role); admins also get `capabilityPolicy` and `platform` (`{maximum, defaults, roleCeilings}`) |
| `/api/settings/tenant/save` | `{expectedRevision, settings: TenantSettings}` (requires `tenant.settings.manage`) | `{revision, defaultTimezone, capabilityPolicy, capabilityStatus, effectiveCapabilities}` |
| `/api/settings/tenant/audit` | `{beforeSequence?: int\|null, limit?: 1..100 (25)}` (admins) | `{entries: [{sequence, auditId, target, subjectActorId, actorId, fromRevision, toRevision, beforeSha256, afterSha256, platformSha256, changedFields, recordedAt}], nextBeforeSequence}` |

`capabilityStatus` is `resolved`, or the refusal code when the stored tenant record no longer fits a narrowed platform record
(`effectiveCapabilities` is then `null`; nothing is silently clipped). Tenant admins choose inside the platform maximum and may only
narrow role ceilings.

| Status | Code |
|---|---|
| 400 | `SETTINGS_REQUEST_INVALID`, `SETTINGS_DOCUMENT_INVALID`, `SETTINGS_FIELD_INVALID` (with `field`, e.g. `theme`, `notifications.runCompleted`) |
| 403 | `SETTINGS_CLIENT_REFUSED`, `SETTINGS_ADMIN_REQUIRED` |
| 409 | `SETTINGS_REVISION_CONFLICT` (reload, then reapply) |
| 422 | `CAPABILITY_TENANT_WIDENING_REFUSED`, `CAPABILITY_ROLE_WIDENING_REFUSED`, `CAPABILITY_ROLE_UNKNOWN`, `CAPABILITY_POLICY_REFUSED`, `CAPABILITY_TENANT_SETTINGS_REFUSED` (with `field` = `capabilityPolicy.<name>`) |
| 500 | `SETTINGS_STORE_STATE` |
| 503 | `SETTINGS_PLATFORM_UNAVAILABLE`, `SETTINGS_STORE_UNAVAILABLE`, `SETTINGS_COMMIT_UNKNOWN` (`outcome: UNKNOWN`), `SETTINGS_UNAVAILABLE` |

## Tasks and action items

Reads use the canonical operational-read contracts and are answered by the gateway's current-authorized `query_tasks` /
`query_action_items` owners (through the host's `operationalReads` port). Bodies are exactly the contract inputs.

| Path | Body | 200 |
|---|---|---|
| `/api/tasks/list` | `TaskReadInput` (`{clientId?, taskId?, assignedToMe?, status?, dueBefore?, limit?, cursor?}`) | `TaskReadPage` |
| `/api/tasks/action-items` | `ActionItemReadInput` with a `clientId` (client-less listing has no validated page contract and is refused) | `ActionItemClientScopedPage` |

Errors: 400 `TASKS_REQUEST_INVALID`, 403 `TASKS_ACCESS_DENIED`, 502 `TASKS_RESULT_INVALID`, 503 `TASKS_UNAVAILABLE`.

Creating and updating tasks are **not** duplicated here. They stay on the commands owner's approval-gated
`/api/action-followthrough/{session,query,draft,prepare,execute}` routes (`apps/control/action-application/README.md`,
`apps/control/action-host/session/README.md`): prepare returns an approval-required immutable proposal, and only the approved exact
proposal is executed.
