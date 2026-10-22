# A1 ticket text (verbatim from the app closeout plan)

### X-04 — Preserve and test current tenant/client/session authority at every hop

**Priority:** P0 security acceptance gate; domain-specific fixes are listed in their domains. **State:** substantial existing authority implementation, not a missing global auth layer. **PR disposition:** preserve receiver safeguards; do not overwrite with old donor code.

Core resolves current local user/membership/tenant, cross-checks Clerk org/tenant claims and rejects removed/suspended memberships. Separate services use the required `ORG_TENANT_RESOLVER` and TenantGuard, resolving canonical UUID rather than treating Clerk org IDs as tenant UUIDs. The shared guard's source notes that Workspace `ws_*` data relies on guard plus explicit tenant predicates rather than PostgreSQL RLS. Tenant authorization alone does not prove owner/collaborator/client authorization. The frontend selected client is a navigation/data-scope hint, never authority. Ordinary Core identity handling can provision/self-heal/update last-seen; a supposedly read-only live probe must not be assumed mutation-free merely because it uses GET. Dedicated preview native reads intentionally bypass those mutations.

**Bounded work.** Reuse the current guards and current-membership checks. Domain owners add missing resource/role/client predicates only at identified holes. Test stale cached identity, no selected client, client switch while a query/write is pending, active→removed membership, same-tenant wrong owner, wrong tenant, archived client, impersonation constraints, provider connection owner mismatch and role downgrade. Ensure response/error/redirect data cannot leak another tenant's existence or tokens. Do not synthesize tenant claims or widen server permissions to make a fixture pass.

**Acceptance.** Negative cases deny before provider/storage/write effects; pending results from a prior user/org/client are discarded; reload uses the current actor; current membership is rechecked at irreversible send/share/decision boundaries where required. Same-tenant ACL tests are separate from cross-tenant tests.

**Evidence:** [Core middleware](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant/tenant-context.middleware.ts), [shared TenantGuard](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/auth/src/tenant.guard.ts), [resolver contract](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/packages/auth/src/org-tenant-resolver.ts), [scope lifetimes](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/CapiroBoundary.tsx).


---

#### ST-01 — Close the branding object-ownership bypass (P0, MAIN defect, pre-activation blocker)

**Evidence/root cause.** The generic PUT branding DTO and fixed frontend operation allow arbitrary logoS3Key/logoContentType. TenantAdminService writes them without the prefix/HEAD checks enforced by the dedicated confirm path. Branding GET later signs the stored key with shared bucket credentials. This is an exposed API boundary issue even though the current name form sends only name. Additionally confirm HEAD checks existence but not returned ContentType/ContentLength despite its comment. [Frontend contract][st-operations], [generic update, L381–400][st-tenant-service], [signing/finalization][st-branding-core], [DTO][st-tenant-controller].

**Bounded tasks.** Narrow generic branding update to name (or route every logo field through the same authoritative finalizer if backward compatibility requires it). Reject cross-tenant/nonbranding keys at both write and signed-read boundaries. Validate actual HEAD type/size against allowed values and configured limits; use an exact tenant-owned upload object, not an unverified client assertion. Keep existing presigned POST flow; no new storage architecture. Review existing persisted keys in a separately authorized operational step before exposing suspect keys.

**Dependencies/tests.** Core and FE operation change together; ASSETS_BUCKET/IAM/CORS qualification. Direct API tests with another tenant's key, arbitrary same-bucket object, omitted/false MIME, oversize HEAD, missing object, stale upload, and corrupted existing row must refuse and never produce a signed foreign-object URL. Legitimate own-tenant upload/name save still works. No live exploit test was performed.


---

#### ST-02 — Enforce protected-member removal server-side (P0, MAIN defect, pre-activation blocker)

**Evidence/root cause.** Controller minimum role is user_admin. removeMember blocks self but not a target capiro_admin before marking membership removed and queuing Clerk deletion. Adjacent role-change code does reject capiro_admin; UI hides Remove, but API callers can bypass that. The issue is within the actor's tenant, not demonstrated cross-tenant access. [Controller L160–195][st-tenant-controller], [service L300–363][st-tenant-service], [UI L218–225][st-team].

**Tasks.** Define the existing intended protected-target rule explicitly and enforce it inside the removal transaction before any local state/outbox mutation. Use HQ's distinct authorized personnel lifecycle for any intentional staff removal. Preserve immediate local revocation plus durable outbox for allowed ordinary targets.

**Tests.** user_admin→capiro_admin target denied with unchanged membership and no outbox; self denied; standard user denied; foreign-tenant ID absent/denied; ordinary active target removed and old access refused even if Clerk fails; retry idempotency; explicit HQ path authorized only as designed.


---

#### ST-24 — Finish mutation lifecycle, receipt, and scope safety across remaining forms (P1 for consequential HQ/security writes; P2 elsewhere)

**Evidence/root cause.** useSettingsAction suppresses stale callbacks and exposes AbortSignal, but most callsites omit scopeKey and ignore the signal. Many dialogs allow backdrop/Escape/onClose while busy and fields remain editable. Examples: Team remove; Billing checkout/cancel; HQ create/delete/comp, key drawer/removal and broadcast send; mapping/analyst dialogs. Profiles create protects closing but not input edits. Signature editor disables typing but not upload/drop/default switch. Bulk mapping loop dispatches sequential requests without checking scope cancellation. [Hook][st-action-hook], [Profiles][st-profiles], [signature][st-signature], [HQ dialogs][st-tenant-dialogs], [AI drawer][st-ai-keys], [broadcasts][st-broadcasts], [mapping loop][st-mappings].

**Tasks.** Apply the existing safe dialog pattern per form, not a broad state-management rewrite: snapshot/freeze target and payload, disable editing and dismiss while mutation is in flight, pass signal and scope identity where safe, stop dispatching remaining bulk items after scope invalidation, preserve exact pending/unknown result record. Aborting fetch is not evidence the backend cancelled a write. On dispatched timeout re-read the exact resource/outcome before offering retry; avoid automatically replaying invite, broadcast, credential rotation, tenant create/delete, comp, or decisions. Verify semantic receipt target/status/value when available, and explicitly reconcile read state where responses are only ok.

**Acceptance inventory.** Apply to personal title, signature, branding name, contact, profile create/archive/restore, team invite/resend/remove/role/billing, integrations, billing handoff, HQ tenant create/delete/resend, customer comp, AI credential set/remove/model, broadcast send/archive, mapping single/bulk/manual/contractor, analyst decisions/alias/delete/merge/quarantine. Preserve already repaired Invite/Register/Disconnect/Profiles busy-close protections rather than regress them.

**Tests.** Double click; Enter+click; input edit; Escape/backdrop/Close/Cancel; route/tab/tenant/Clerk-account change; 401/403 midflight; response for wrong ID; malformed 2xx; failure after server commit; delayed readback; partial bulk completion. No false success in a different scope, no hidden background continuation beyond the initiated bounded work, no lost newer draft.


---

#### WS-02 — Enforce current Hill Day document/client authority everywhere (P0)

**Evidence/root cause:** [HillDay service][ws-hill-service] listDocuments applies client wall only when a client filter is supplied; the unfiltered Hill Day query is tenant-only. get/quality/assertDoc do not receive actor; getClient is called with a null user. Owner writes do not consistently recheck current client wall. [Generation job reads][ws-hill-generation] and [export status][ws-hill-export] are tenant/document scoped without actor. These differ from source-guarded ordinary drafts.

**Bounded work:** Introduce one small Hill Day resource admission helper using existing actor resolution/client-wall lookup. Apply it to list rows, get/quality/context/resolution, job/event reads, edit/generate/refine/export and signed-link issuance. Preserve owner-write policy; explicitly decide whether reads are tenant-team or owner-based, but always enforce the current client's wall and active membership. Do not add a new ACL platform.

**Acceptance:** Tenant A vs B, same-tenant unrelated member, owner whose client access was revoked, removed member, invalid IDs, filtered/unfiltered list, direct URL, job ID and export ID tests; forbidden rows do not leak title/count/source text. A formerly issued public grant follows the explicit expiry/revocation policy, not an accidental authenticated fallback.


---

#### WS-03 — Close draft sharing/approval authorization holes (P0)

**Evidence/root cause:** [Delivery controller][ws-delivery] supplies no actor to revoke/list. [Share service][ws-share-service] create/revoke validate tenant and deny prospect transfer but do not call collaborator permission policy; list enumerates tenant-wide titles/counts. [Approval service][ws-approval] preflight/request omit actor permission checks; decision uses generic canReview but does not enforce blueprint permittedApproverRoles.

**Bounded work:** Reuse CollaboratorsService/current source access for list/read/share/revoke/request/decide; define who may share and approve, then check it at service boundaries, not buttons alone. Validate pinned version belongs to the exact draft+tenant. Enforce approval policy against the exact frozen revision before public release and invalidate or refuse stale approvals. Preserve prospect transfer denial.

**Acceptance:** Owner/editor/reviewer/viewer/unrelated member matrix, removed collaborator, revoked source/client access, cross-draft version substitution, forged share/approval IDs, and request-vs-decision role mismatches. No public share release without the required approval of the exact served version. Security tests must pass before WS-09 consumers activate.


---

#### WS-04 — Canonical client association for legacy drafts (P1, cross-Portfolio dependency)

**Evidence/root cause:** [Draft DTO][ws-draft-ops] accepts only display-name client; [newsletter create][ws-newsletter-save] sends client.name. [Schema][ws-schema] retains legacy string association. [Merged library][ws-hill-service] and Portfolio Work match names. [Saved-revision projection][ws-saved-revision] explicitly refuses legacy client hints unless snapshot/current config.clientId are valid and equal. Therefore a normal client-selected basic newsletter cannot stage to Outreach using the current flow.

**Bounded work:** Add canonical nullable clientId to the ordinary draft owner contract and persisted association (prefer typed column plus safe snapshot field), validated against active client/current wall. Carry it in create/read/save/version/library/Portfolio adapters; retain display name only for presentation. Backfill only provably unique authorized mappings, keep ambiguous/renamed legacy rows held for explicit association, and never infer prospect conversions from names. Define immutable revision attribution versus current-client changes.

**Acceptance:** Duplicate names, rename, inactive/deleted client, reassignment, revoked wall, firm/null and snapshot mismatch. Creating a client newsletter, saving, reopening from Portfolio and staging must retain the same UUID and succeed; ambiguous legacy content must not migrate or become visible to the wrong client.


---

#### PF-10 · P0 native-read blocker · Four meeting reads do not establish current selected-client visibility

**Evidence:** [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1448); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6138); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6194); compare stronger [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1460); [feeds.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/feeds.ts). PR111's checklist independently retains these four GETs held.

**Root cause:** GET engagement/meetings, meetings/:id, notes and debriefs use tenant/ownMeetingWhere. Filtering by associated client is not the same as a current user/client ethical-wall check. The stronger getClientMeeting helper is not the authority used by these ordinary endpoints.

**Bounded work:** Allocate client-scoped meeting read methods/DTOs or strengthen the existing endpoints with an explicit authorized-client parameter. Resolve current native tenant/user, current active client visibility and meeting-to-client association inside the authoritative transaction; use equivalent checks for notes/debriefs and redaction. Retain separately authorized owner/unassigned-library behavior without treating it as authority for client context. Do not merely add frontend selectedClient checks.

**Dependencies:** Shared native authorization qualification for the selected ordinary deployment cohort, Engagement owner, current client-wall grants; any cache keyed by prior client needs invalidation.

**Acceptance:** Native tests for owned meeting on hidden client, recently revoked grant, archived client, moved meeting, foreign tenant, owner-only unassigned library and legitimately shared content. Four routes remain held until passing; distinguish “not available” from permission-leaking metadata. This is a proven source admission gap, not a claim that a live leak was observed.


---

#### PF-11 · P1 · Editing an unchanged client assignment rewrites meeting association provenance

**Evidence:** [MeetingForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/MeetingForm.tsx); [meeting-save.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/meeting-save.ts); [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/mutations.ts); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1563); [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L1664).

**Root cause:** Meeting edit sends clientId. Backend checks presence of that property and invokes reassignment even when the ID is unchanged; reassign writes manual reason/score and isInternal=false. “Changed=false” avoids some downstream reset but does not preserve provenance.

**Bounded work:** Frontend omits clientId if unchanged from the reviewed saved meeting. Backend independently makes unchanged assignment a semantic no-op and preserves association reason, score and internal state. For real changes require expected current association/revision, explicit reviewed target, client-wall/capacity policy as applicable and an attributable receipt; refresh old/new client calendars and related artifact metadata.

**Acceptance:** Change only subject/time on auto-associated or internal meeting preserves all association fields and no reassignment audit/event. Actual client change updates exactly once; stale/moved/hidden target refuses. A malicious unchanged clientId cannot trigger side effects server-side.


---

#### PF-12 · P1/P2 · Debrief list omits approval/sharing metadata needed by artifact controls

**Evidence:** [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6138) includes approvedAt/approvedBy/sharedAt/sharedBy; [engagement.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/engagement/engagement.service.ts#L6194) returns debrief fields without that metadata; [MeetingArtifacts.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/MeetingArtifacts.tsx#L191) depends on it.

**Root cause:** Asymmetric notes/debrief read projection. The frontend intentionally does not invent sharing state; debrief rows can show unavailable and cannot expose reliable Unshare from absent sharedAt.

**Bounded work:** Publish one versioned artifact metadata projection for notes/debrief reads, including nullable approval/share timestamps, actor IDs/names with visibility rules, content/source revision and current action capabilities. Use it in list and mutation receipts, and align frontend schema. Do not assume absent optional field means unshared.

**Acceptance:** Create → approve → share → reread → unshare → reread works for both artifact types; false/unavailable/null are distinct; unauthorized role cannot infer actors or act; response loss does not show success merely from stale cached row. Verify both selected meeting and shared-library surfaces.


---

#### PF-22 · P1/P2 correctness · Undated commitment/request cannot settle; rich metadata cannot be edited

**Evidence:** [QuickLogDetailFields.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/QuickLogDetailFields.tsx) makes due date optional; [ActivityActions.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ActivityActions.tsx#L49); [activity-change.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/activity-change.ts#L30); [client-activity.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-activity.service.ts#L366); [ActivityDialogs.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ActivityDialogs.tsx).

**Root cause:** Settlement checks dueAt presence instead of activity kind. Backend update selects id/dueAt and rejects settled when no dueAt. The edit DTO only supports title/body/pinned/settled, so an undated commitment cannot be given a due date through this editor. Direction/counterparty/Objective metadata is captured at create but cannot be revised here.

**Bounded work:** Decide canonical lifecycle rule: recommended completion eligibility is recorded kind commitment/request regardless of optional dueAt. Update backend kind validation and frontend action availability together; reject settling all other types. If due required is intended, make it explicit at create and migrate/review existing undated entries instead. Allocate versioned rich metadata editing separately with due-day/timezone semantics, objective-version authority and stale-write protection.

**Acceptance:** Dated and undated commitment/request settle/reopen; note/email cannot; due date edit preserves local intended day; stale linked Objective/current client refuses inappropriate reassociation; old entries remain reachable; no loss of recorded metadata during title-only edit.


---

#### ML-02 — Prevent automatic replay of Graph mutations below the send ledger
**P1 confirmed release blocker; owner: Mail provider adapter.**

`graphFetch` retries every method on 429/5xx with small Retry-After, including `POST /me/messages/{draftId}/send`. Ambiguous-send classification runs only after that helper completes. A caller-level “never retry” promise therefore does not guarantee one provider invocation. Current send tests stub `graphPost/graphPostNoContent`, bypassing precisely this retry code. [ML-S19][ml-ML-S19] [ML-S24][ml-ML-S24] [ML-S65][ml-ML-S65]

**Tasks:** add explicit retry semantics to the existing Graph transport: read-only retries allowed; create/send mutations default no replay after dispatch. A definite pre-acceptance rejection may be a new explicit attempt only under ledger policy, not generic HTTP recursion. Keep draft creation and send separate, preserve draft/correlation evidence, and classify unknown at the actual network boundary. Apply this to ordinary compose, Meri, durable outreach and newsletter through the shared adapter.

**Acceptance:** real helper with fake fetch receives send 500/429 + Retry-After, response loss, socket close, malformed result; assert exactly one send POST and unknown/definite failure as appropriate. GET retry tests remain. No live send needed for this test. Dependency: none; precedes ML-03/04/05 and any send release.


---

#### ML-03 — Give single-mail an actor-scoped durable dispatch identity and recovery receipt
**P1 confirmed release blocker; owner: Mail backend + Portfolio frontend.**

Single-mail sends before saving any receipt and accepts no request key; frontend's random attempt lock is React Query memory with infinite cache lifetime, not a server ledger or cross-tab/reload guarantee. A 30-second proxy timeout, reload, second tab or process failure can lose the only lock. Backend correctly warns on ambiguity/receipt loss, but there is no durable lookup to resume. Existing outreach intents already implement the relevant claim/unknown pattern. [ML-S03][ml-ML-S03] [ML-S30][ml-ML-S30] [ML-S38][ml-ML-S38] [ML-S44][ml-ML-S44] [ML-S45][ml-ML-S45] [ML-S46][ml-ML-S46]

**Tasks:** extend the existing mail domain with a bounded single-message intent/receipt record or shared low-level delivery primitive, not a new platform and not fake campaign records. Bind tenant+actor+request key to exact mailbox, reply target, recipients including Bcc, subject/body hash, signature policy/content snapshot and attachment manifest. Commit pending then claim before provider dispatch. Expose owned status/read receipt; never recycle sending/unknown to pending automatically. Replay same key returns existing state; different content same key conflicts. UI retains intent ID and resumes/polls after navigation/reload, distinguishes safely rejected from unknown, and offers reconciliation rather than blind retry. Persist provider acceptance even if current visibility is later revoked, while withholding body/details from unauthorized reads.

**Acceptance:** concurrent duplicate requests/processes, reload/cross-tab, timeout before/after dispatch, failure after provider acceptance before DB commit, revoked client permission and changed sender. At most one irreversible send dispatch per intent; zero sends on preflight/authority rejection; unknown remains fenced pending reconciliation and survives restart. This is not an exactly-once delivery claim. Graph draft creation and send are separate provider calls. Reuse Core104's post-provider outcome-persistence principle, not its legacy campaign function as a substitute. [ML-S68][ml-ML-S68]


---

#### ML-07 — Complete server-side client/person preflight before irreversible single-mail send
**P1 confirmed missing explicit preflight; owner: Mail backend + Portfolio access policy.**

The server checks thread ownership/originating connection and attachment access, but `sendSingleMail` does not explicitly load/authorize input client/person associations before provider dispatch. Attachment validation returns immediately when no attachment IDs exist. Thread preflight selects id/connectionId, not client binding; the frontend currently enforces the client relation, which direct API callers can bypass. Later persistence failure is too late to stop a sent message. [ML-S30][ml-ML-S30] [ML-S42][ml-ML-S42]

**Tasks:** before ledger creation/dispatch, resolve current client visibility and allowed operation using the same Portfolio policy; validate person IDs and their client/tenant membership, client/thread association semantics including recipient-derived histories, and source-document distribution. Recheck relevant mutable authority immediately before claim/send. Do not prohibit valid recipient-derived null-client histories accidentally. Ensure private inbox ownership does not silently grant access to a revoked client.

**Acceptance:** no attachments, nonexistent/foreign/archived client, inaccessible same-tenant client, foreign person IDs, recipient-derived thread vs directly assigned thread, grant revoked during attachment fetch. Assert zero provider calls on every rejection. Dependencies shared client policy; donor Core104 contains related outreach access hardening but not a complete single-mail fix.


---

#### ML-08 — Make adding versus reconnecting a mailbox identity-safe
**P1 confirmed unsafe transition; owner: OAuth services + Settings.**

Top-level Connect submits an empty body; OAuth start selects the newest existing caller/provider row when accountEmail is absent. Callback overwrites row accountEmail/homeAccountId with the chosen account and retains old sync state; an omitted new refresh token can preserve the prior row's refresh token. Selecting account B while reconnecting A can therefore change the identity underneath A's cursors/history. [ML-S01][ml-ML-S01] [ML-S12][ml-ML-S12] [ML-S13][ml-ML-S13] [ML-S14][ml-ML-S14] [ML-S15][ml-ML-S15]

**Tasks:** distinguish create-new from reconnect-existing explicitly. Bind OAuth state to expected connection/provider/actor/identity intent. Reconnect must prove the same stable provider account ID, otherwise refuse with a clear “add another mailbox” flow; adding another creates an independent row. Never retain a previous account's refresh token or cursors after identity changes. Handle existing same-account unique conflicts transactionally, with no cross-owner takeover. Confirm the actual account before showing connected.

**Acceptance:** A->A reconnect without new refresh token, A->B attempted replacement, two concurrent starts, callback for deleted row, registered account email differs, same email identity changed, duplicate existing mailbox. No cursor/history/token crosses identities. Dependencies ML-11/25.


---

#### ML-09 — Mailbox-qualified persistence identity
**P1 residual cross-mailbox integrity risk; owner: Mail persistence/schema.**

MailThread and MailMessage uniqueness is `tenantId, source, externalId`, not connection/mailbox. Sync looks up those keys and updates connection association. This is unsafe if provider IDs collide across mailboxes or one message's identifier is reused across imported accounts; provider-wide uniqueness across every mailbox is not proven by this schema. Current single-mail upsert has an additional connection/thread mismatch check, but provider sync needs the same invariant. [ML-S22][ml-ML-S22] [ML-S35][ml-ML-S35]

**Tasks:** reproduce with synthetic two-mailbox same-ID fixtures. Adopt mailbox-qualified keys or a stable mailbox-lineage namespace after reviewing reconnect semantics; at minimum fail closed on mismatched existing connection rather than reassigning it. Migrate indexes and all readers/upserts/removal/reconciliation paths together; preserve historical URLs and disconnected lineage. Do not mass reassign ambiguous old rows.

**Acceptance:** same tenant different owners, same owner two accounts, same provider message/thread IDs, shared-message copies, reconnect and deletion. No row or attachment transfers ownership; reader remains owner-scoped. Dependency ML-08/17; blocks trusting ML-04 reconciliation.


---

#### ML-10 — Remove wrong-account token-cache fallback and prove refresh concurrency
**P1 confirmed fallback defect plus residual concurrency risk; owner: Microsoft OAuth/token.**

Both refresh-token selectors return the last cache entry if an expected homeAccountId has no match, contrary to the OAuth selector's stated exact-account guarantee. Initial OAuth uses a fresh MSAL instance, but refresh uses a shared instance/cache; concurrent account refreshes widen the risk. No exploit is asserted. [ML-S11][ml-ML-S11] [ML-S23][ml-ML-S23]

**Tasks:** exact expected-account match or fail closed; only permit single-entry fallback if account identity is truly absent and independently verified. Isolate cache per refresh/connection or serialize guarded refresh with a durable version/CAS update. Bind returned access-token account/scopes to the connection before writing. Prevent late refresh from resurrecting disconnected/replaced connection or overwriting a newer rotated token.

**Acceptance:** unmatched home ID with several cache entries, simultaneous two-account refresh, rotated token races, refresh after disconnect, stale callback. No wrong-account token persisted or returned. Dependencies ML-08/25.
