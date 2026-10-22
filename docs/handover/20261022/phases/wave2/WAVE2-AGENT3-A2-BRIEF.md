# Wave 2 · Agent 3 · A2: finish screens that already have a backend (DRAFT: send only after Wave 1 closes; Neo's rule, fresh "agent 3 v{next}" session)

**From:** Fable. **Lane:** A (Portfolio, Workspace, Settings, Mail). **Repository:** neo-capiro/capiro-backend plus neo-capiro/capiro-frontend. Branch from the current default branch head at send time.
**How we work:** you build; dot's reviewers review; Fable gates, merges and ships. Draft PRs only; no merges, no AWS; list tests run and not run; mutation-check every new test. Read `WORKFLOW.md` (meri-greenfield `docs/handover/20261022/`).

## Sources of truth
The two master closeout plans (20261021), `STANDING-RULES.md`, and the tickets below, verbatim. Implement each ticket's bounded work and meet its acceptance exactly. If anything conflicts or is left open, ask on #202; don't decide.

## Plan row (FINAL-PLAN §5)
| **A2** · Finish screens that already have a backend | Settings ST-03 to ST-06, ST-19, ST-20, ST-24 (remaining forms), ST-25, ST-27, ST-28. Portfolio PF-07, PF-09, PF-13, PF-14, PF-16, PF-18. Mail status and sync ML-11 to ML-18, ML-26. | A1 | Every Settings, Portfolio and mail-read row in the closeout matrices is accepted in staging or explicitly held |

## Standing decisions
No Workspace approvals (O143). No new email functionality (Neo, 10-21). ML-09 skip-and-continue (O146). Schema changes need an idempotent, forward-safe migration (the one-database rule, O175).

## Tickets (verbatim)
#### ST-03 — Make Settings honest and usable in read-only preview (P1, CONFIG + concrete query defect)

**Evidence/root cause.** Generic preview admits only me.read and clients.list. Profiles always asks includeArchived:true, rejected by Core preview with 400; proxy failure mapping can surface a generic unavailable/502 rather than explaining the policy. [Allowlist][st-preview], [Core guard][st-core-preview], [Profiles][st-profiles], [proxy][st-preview-proxy].

**Tasks.** Expose a server-owned mode/capability to Settings, not a browser-controlled bypass. In preview render available identity and active roster with includeArchived:false/omitted; disable or omit Archived/owner-admin controls if their reads are not admitted. Mark other sections read-only-unavailable without sending known-forbidden operations on entry. Preserve explicit ordinary-mode behavior. If archived or additional Settings reads are truly required, qualify one bounded native-read contract at a time before any allowlist change.

**Tests.** Preview no writes/no ordinary fallback/no tenant headers; Profiles requests permitted shape and renders active rows; archived unavailable explanation; ordinary archived/create/restore unchanged; 401/403/source mismatch not fabricated as empty data. Test actual blocked-versus-upstream-error distinction.

#### ST-04 — Add a real account-profile/security opener (P2, MAIN UI gap; Clerk EXTERNAL)

**Evidence/root cause.** Personal instructions promise Profile from top-right menu; ModuleHeader only routes to Personal. PortfolioHeaderActions already renders Clerk UserButton. [Personal][st-personal], [Settings header][st-module-header], [working Portfolio control][st-portfolio-header].

**Tasks.** Reuse the existing Clerk account control or explicit supported profile opener in Settings header/Personal, with a real keyboard-accessible target. Keep name/email/password/MFA authority with Clerk. If this surface intentionally will not host it, link to an actual supported account surface and change the copy; do not leave circular instructions.

**Tests.** Signed-in user opens own Clerk profile from Settings, edits only supported Clerk fields, closes/returns correctly; unauthenticated/loading states; keyboard/focus; no client/tenant context leakage into provider identity.

#### ST-05 — Align Team controls with effective permissions and member states (P2, MAIN UI gap)

**Evidence/root cause.** UI billing switch checks busy/self/capiro only, while backend additionally requires caller billingAdmin and target active user_admin for grants. Role selector remains enabled on inactive memberships. [Team L122–187][st-team], [service L162–195/L346–378][st-tenant-service].

**Tasks.** Derive canChangeRole/canGrantBilling/canRevokeBilling/canRemove per row and caller, preserving server checks. Show explanatory disabled labels for inactive targets and nonbilling admins. Refresh me/permissions after relevant membership changes; handle authority lost between render and dispatch. Do not add a “last billing admin” rule that contradicts existing policy, which allows HQ recovery.

**Tests.** Role×billingAdmin×target-role×status matrix; direct API denial remains; active user_admin grants/revokes; demotion behavior reconciles billing permission; self/staff protections; revoked actor cannot continue via stale UI.

#### ST-06 — Complete invitation enumeration and preserve resend identity (P2, MAIN backend completeness)

**Evidence/root cause.** Pending list and resend lookup call one Clerk invitation-list page without paging. Dedup revoke requests only one page with limit100. Resend recreates email/role/redirect but omits original publicMetadata carried by initial invite (tenant and name fields). [Service L198–297/L448–466][st-tenant-service].

**Tasks.** Implement bounded provider pagination or explicit paginated UI/API contracts using real provider cursors/offsets; ensure resend/dedup can find an authorized target beyond page one. Preserve safe intended invitation metadata across resend; retain tenant binding from verified org/current target. Return enough result to refresh the exact replaced invitation. Keep redirect validation/config separate from list completeness.

**Tests.** More than one provider page; target beyond100; empty pages with continuation; duplicate pending email; expired/revoked invitation; resend metadata/name preservation; cross-org ID denied; partial revoke/create failure gives recoverable truthful state; invitation acceptance results in real user/member without placeholder UUID collisions.

#### ST-19 — Remove fake feedback receipt and wire actual help/feedback (P2, MAIN presentation bug + UNSUPPORTED service)

**Evidence.** HelpShortcutsScreen always renders view.submitted; unavailable model titles it “Report submitted” while saying a real service must acknowledge. Submit remains disabled. [Help L61–81/L98–135][st-preference-help], [model][st-unavailable-account].

**Tasks.** Immediately stop rendering success absent a receipt. Verify actual keyboard registrations and label only implemented shortcuts as available. Qualify an existing help/support submission owner before enabling summary/detail/optional run-reference submission; explicitly limit attachments and redact sensitive run metadata. Provide request ID and real failure/uncertain state, no automatic private content attachment.

**Tests.** Fresh page has no success; disabled mode sends nothing; a real accepted response alone shows submitted/request ID; timeout preserves draft; opted-out run reference omitted; malicious text treated as data; keyboard instructions match behavior.

#### ST-20 — Deliver and acknowledge HQ broadcasts in the user shell (P1, missing frontend consumer)

**Evidence.** Admin UI promises next-sign-in display until acknowledged. Core already mounts GET /me/broadcasts/pending and POST /me/broadcasts/:id/acknowledge for current user with tenant-scoped recipient checks. No corresponding fixed frontend operations or signed-in-shell consumer exist; Updates buttons disabled. [Promise][st-broadcasts], [recipient routes][st-broadcast-recipient], [service L196–231][st-broadcast-service], [header][st-module-header].

**Tasks.** Add bounded recipient fixed operations; mount a signed-in recipient banner/dialog/inbox in shared authenticated shell, including Settings/Portfolio/Workspace entry as intended. Read pending once authenticated, display oldest/policy order, acknowledge exact broadcast after explicit user action, reconcile pending and admin metrics. Distinguish view/dismiss from persisted ack. Preserve recipient/tenant/archived checks and prevent tenant-switch flash.

**Tests.** Targeted vs nontargeted users, all_roles allowed by server, multiple messages/order, reload before ack retains, ack survives reload, duplicate ack idempotent, archive removes pending, foreign broadcast denied, removed member, multi-tab refresh, admin count changes only after actual ack.

#### ST-24 — Finish mutation lifecycle, receipt, and scope safety across remaining forms (P1 for consequential HQ/security writes; P2 elsewhere)

**Evidence/root cause.** useSettingsAction suppresses stale callbacks and exposes AbortSignal, but most callsites omit scopeKey and ignore the signal. Many dialogs allow backdrop/Escape/onClose while busy and fields remain editable. Examples: Team remove; Billing checkout/cancel; HQ create/delete/comp, key drawer/removal and broadcast send; mapping/analyst dialogs. Profiles create protects closing but not input edits. Signature editor disables typing but not upload/drop/default switch. Bulk mapping loop dispatches sequential requests without checking scope cancellation. [Hook][st-action-hook], [Profiles][st-profiles], [signature][st-signature], [HQ dialogs][st-tenant-dialogs], [AI drawer][st-ai-keys], [broadcasts][st-broadcasts], [mapping loop][st-mappings].

**Tasks.** Apply the existing safe dialog pattern per form, not a broad state-management rewrite: snapshot/freeze target and payload, disable editing and dismiss while mutation is in flight, pass signal and scope identity where safe, stop dispatching remaining bulk items after scope invalidation, preserve exact pending/unknown result record. Aborting fetch is not evidence the backend cancelled a write. On dispatched timeout re-read the exact resource/outcome before offering retry; avoid automatically replaying invite, broadcast, credential rotation, tenant create/delete, comp, or decisions. Verify semantic receipt target/status/value when available, and explicitly reconcile read state where responses are only ok.

**Acceptance inventory.** Apply to personal title, signature, branding name, contact, profile create/archive/restore, team invite/resend/remove/role/billing, integrations, billing handoff, HQ tenant create/delete/resend, customer comp, AI credential set/remove/model, broadcast send/archive, mapping single/bulk/manual/contractor, analyst decisions/alias/delete/merge/quarantine. Preserve already repaired Invite/Register/Disconnect/Profiles busy-close protections rather than regress them.

**Tests.** Double click; Enter+click; input edit; Escape/backdrop/Close/Cancel; route/tab/tenant/Clerk-account change; 401/403 midflight; response for wrong ID; malformed 2xx; failure after server commit; delayed readback; partial bulk completion. No false success in a different scope, no hidden background continuation beyond the initiated bounded work, no lost newer draft.

#### ST-25 — Qualify the actual billing handoff and settle in-app parity (P1 CONFIG for launch; P2 optional UI parity)

**Evidence.** Core read views and Onboard Stripe writer are mounted. State/summary revalidation and allowlisted Stripe URLs already exist. In-app payment-card/invoice/cancellation-detail data is deliberately not implemented. [Flow][st-billing-flow], [UI][st-billing], [Onboard][st-onboard-service].

**Tasks.** Qualify same-environment CORE/ONBOARD URLs, Clerk BillingActorGuard identity, Stripe key/prices, BILLING_RETURN_URL, portal products/settings, webhook secret/endpoint, and subscription event convergence. Test portal supports intended quantity/payment/invoice/cancel actions; “opens portal” is not proof configured portal permits each action. Decide whether hosted parity is sufficient; only if not, add bounded masked payment/invoice/contract-window DTOs to the billing owner, not Core's obsolete tenant-admin billing stub.

**Tests.** None/trialing with no subscription→checkout; live subscription→portal; comped/disabled/mismatched state refuses inappropriate flow; min slots/promo; no billing permission; changed permission before handoff; allowed HTTPS Stripe origins only; cancel return and successful checkout return do not mark paid until webhook/read convergence. No real purchase performed for this audit.

#### ST-27 — Make branding-name provider convergence truthful (P2, MAIN partial provider wiring)

**Evidence.** Tenant name persists, then Clerk update errors are swallowed. UI says branding saved and reloads local state, so Clerk could remain different indefinitely. [Service L381–400][st-tenant-service].

**Tasks.** If cross-provider name consistency is required, use the existing provider-outbox/retry pattern or a bounded sync-status receipt and repair command; distinguish local save from Clerk convergence. Do not move external calls deeper into a DB transaction. If best effort is intentional, label it and expose operational failure telemetry rather than promise synchronized identity.

**Tests.** Clerk timeout/error after local commit, retry idempotency, concurrent name changes and last-authoritative value, UI local-vs-provider notice, no leaked credentials. No new outbox architecture required.

#### ST-28 — Preserve client context and rebind actions on scope changes (P2, navigation/lifecycle)

**Evidence.** Navigation has scoped helpers, but Personal monitoring/preferences and Billing AI-usage links use raw Link. Most settings mutations use unscoped local action hooks. [Personal][st-personal], [Billing][st-billing], [navigation][st-settings-nav], [hook][st-action-hook].

**Tasks.** Use the existing scoped-link/context mechanism for links whose destination should retain selected client. Explicitly define account/tenant-global pages so a query parameter never becomes authority. On tenant/actor switch clear local secrets/drafts, invalidate reads, and rebind mutation state to new API/session identity. Fold pending-request protection into ST-24.

**Tests.** Enter Settings from selected profile; traverse Personal→monitoring/preferences and Billing→usage; return scope preserved where designed. Tenant switch never displays old profile/member/key or sends old draft to new tenant. Query-tampered client still authorized server-side.

#### PF-07 · P1 frontend omission · Durable Objective associations exist in Core but have no authoring UI

**Evidence:** [ObjectiveWorkDestinations.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveWorkDestinations.tsx#L74); [ObjectiveOutreach.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveOutreach.tsx#L176); [objective-operational.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/objective-operational.ts#L220); [objective-operational.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/operational/objective-operational.service.ts#L131).

**Root cause:** Existing pickers only open already-authorized resources. The registered objectives.operational.link operation and Core transactional link/unlink/receipt implementation are not consumed by Portfolio controls.

**Bounded work:** Add an explicit “Link to this Objective” review and “Unlink” action distinct from Open. Support only allocated resource kinds: strategy, planner_project, planner_task, outreach_session and meeting; strategy-only cycle annotations. Capture objective version, association-set version, exact current resource snapshot, request ID and payload digest before dispatch. Use existing link and receipt operations, validate the returned digest/revisions/set version with requireOperationalAssociationReceipt, persist recovery identity across reload, and refresh the operational section after acknowledgement. Do not treat general Context Files, Directory targets or Calendar occurrences as supported durable link kinds without expanding the contract.

**Dependencies:** PF-01 ordinary deployment qualification (or separately approved preview admission), PF-24 owner mounts; correct existing-resource picker contracts. Core already owns resource locks and current authority.

**Acceptance:** Double click/reload returns same association; source moved/deleted before linking refuses; stale association set requires review; unlinked resource receipt remains historically recoverable; foreign client/kind/cycle refuses; current receiver still revalidates navigation. No unintended resource creation.

#### PF-09 · P1 cross-owner · Work/Workspace documents are matched by mutable client name, not canonical client ID

**Evidence:** [queries.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/queries.ts); [WorkspaceDocuments.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/WorkspaceDocuments.tsx); [contracts.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/work/contracts.ts). Workspace audit independently confirmed basic newsletter create/update lacks canonical clientId, while Outreach staging requires it.

**Root cause:** Workspace draft contract carries client display string; Portfolio currently permits a match only when that name is unambiguous and excludes prospect drafts. Renames and duplicates hide or disconnect genuine work. It is intentionally safer than guessing, but not complete binding.

**Bounded work:** Workspace canonical ticket owns draft schema/storage/write DTO/list/filter/saved-revision propagation of clientId, tenant/current access checks, and migration-safe backfill. Backfill only uniquely evidenced associations; ambiguous/unverified historical name rows remain held for explicit review. Portfolio reads exact clientId and stops joining by name; keep display names non-authoritative. Revalidate links on destination entry.

**Dependencies:** Workspace owner, PF-03 generated files and Outreach staging/mail owner. Do not duplicate implementation or weaken denyProspectTransfer.

**Acceptance:** Client rename preserves association; two equal names do not cross-bind; old ambiguous drafts stay unavailable; saved revision matches intended client; active grant revocation removes destination/staging access; an ordinary client-selected newsletter stages only after canonical binding is present.

#### PF-13 · P1 reliability · Several ordinary mutations have only mounted/session uncertainty fences, not durable attributable receipts

**Evidence:** [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/mutations.ts); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/artifacts/api.ts); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/sharing/api.ts); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/sync/api.ts); [contact-create-attempt.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/contact-create-attempt.ts); [mutations.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/mutations.ts); [actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/actions.ts). By contrast [command-actions.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/quick-log/command-actions.ts) already has command receipt recovery.

**Root cause:** Some handlers deliberately freeze an uncertain write in mounted state, and some reconcile only current state via GET. That avoids immediate unsafe retry but does not identify whether this exact command succeeded after navigation/reload, nor prove attribution under concurrent edits.

**Bounded work:** Inventory by actual mutation and add only missing command protocols: meeting create/update/reassign; notes/debrief create/edit/approval/sharing; externally consequential calendar sync; client contact create; plain Quick Log create; file metadata/access/delete where current state is insufficient. Server accepts immutable command ID + actor/client/resource/version + payload digest, commits receipt with the mutation, exposes authenticated lookup, and handles same-key/same-payload replay versus conflict. UI stores a minimal scoped journal before dispatch and recovers the same command; never stores bearer tokens. Distinguish definitive refusal, accepted, completed, and unknown/provider-pending. Existing durable prep/ActivityCommand/prospect upload/Objective protocols should not be replaced.

**Dependencies:** Owner-specific DB transaction or provider reconciliation capability. For external actions, a DB receipt cannot falsely guarantee provider completion.

**Acceptance:** Lost response before/after commit, reload, multi-tab, session renewal, duplicate click and concurrent conflicting edit yield one intended write or an explicit unresolved outcome. Changed payload with same ID refuses; arbitrary fresh retries never recreate uncertain work; current-state match alone is labeled observation, not historical receipt.

#### PF-14 · P2 · Directory member Quick Log supports Note only

**Evidence:** [MemberNoteForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/member-notes/MemberNoteForm.tsx#L83); [MemberNoteForm.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/member-notes/MemberNoteForm.tsx#L107); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/member-notes/api.ts).

**Missing:** Call/Meeting/Email kind; staff selection; event time; client association; Objective link; Planner follow-up. Current note is saved in Directory, deliberately not in the selected client's activity.

**Bounded work:** Either keep clearly labeled Directory note-only scope, or define a canonical Directory activity command with recognized member/staff identity, event kind/time and optional explicitly authorized client/objective binding. Backend must verify canonical directory entity itself: current frontend preflight is not authorization. Reuse the ActivityCommand owner for an explicit client-bound follow-up rather than writing duplicate events independently. Add versioned receipt and durable recovery.

**Acceptance:** Note behavior stays intact; unsupported kinds cannot be disguised as note text; staff/member ID confusion refuses; client links require current client access and exact Objective version; one approved follow-up creates one linked task; no implicit client note sharing from a Directory-only action.

#### PF-16 · P2 · Files multi-selection cannot perform an atomic batch move

**Evidence:** [FileSelectionBar.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FileSelectionBar.tsx#L35); [FileSelectionBar.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/FileSelectionBar.tsx#L44); [client-files.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-files.controller.ts).

**Root cause:** Existing metadata PATCH is per-file. The UI allows selection but intentionally disables Move unless exactly one file is selected.

**Bounded work:** Add a bounded batch-move command with sorted file IDs, exact client/folder, expected per-file revisions, destination authority and idempotency key. Server locks and validates all records then commits all or none, returning per-file revisions plus aggregate receipt. Frontend reviews hidden selected rows explicitly and submits one command, not a loop of individual PATCHes.

**Acceptance:** One denied/stale/missing file means zero moves; duplicate IDs refuse; concurrent source/destination changes conflict; uncertain replay yields same atomic receipt; selection across filters remains visible and clearable. Keep single-file workflow unchanged.

#### PF-18 · P1 · Prospect conversion UI only links an existing client; new-client and reviewed carry-over are missing

**Evidence:** [ProspectClientLink.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/conversion/ProspectClientLink.tsx#L174); [api.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/conversion/api.ts); [business-development.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/business-development.service.ts#L936).

**Root cause:** Backend already has a new-client conversion transaction, capacity/billing checks and audit, but UI narrows to existingClientId and expects created=false. No selected transfer manifest exists for contacts/files/research.

**Bounded work:** First add a dedicated new-client conversion review using canonical intake fields, duplicate check and capacity/price implications, with command/receipt identity and explicit result type. Keep existing-client link behavior. Then separately allocate an opt-in transfer manifest for each permitted data category with immutable source IDs/revisions, target authority, conflict/merge rules, attachment ACL handling, audit and rollback/recovery. Do not implicitly copy everything or preserve inappropriate sharing.

**Dependencies:** Core BD/Clients owner, Settings billing/capacity, Workspace/files identity and mail restrictions. New client creation and transfer are separate acceptance stages.

**Acceptance:** Same conversion cannot create two clients; already converted/archived/stale prospect refuses or returns same receipt; exact client returned; capacity failure leaves prospect unchanged; existing-client link is not billed as new client; approved selected transfers have deterministic receipts and all unselected data remains prospect-scoped.

#### ML-11 — Consume OAuth outcomes in Settings
**P2 confirmed UX gap; owner: Settings frontend + callback controllers.**

Callbacks emit provider/error/connected/connectionId/admin-consent query parameters, but current Settings page/screen/integration component does not consume them. Google exchange errors redirect; Microsoft exchange failures can escape as raw endpoint errors. Success/error/admin-consent results therefore disappear or strand the user away from Settings. [ML-S01][ml-ML-S01] [ML-S09][ml-ML-S09] [ML-S10][ml-ML-S10]

**Tasks:** parse a bounded allowlisted callback result, reconcile against freshly loaded owned connection, display success/cancel/denied/admin-consent/reconnect/error states, and clear transient query parameters. Do not trust query text as a connected receipt or render unsanitized provider details. Add equivalent safe Microsoft exception-to-return handling; do not leak secrets from provider errors.

**Acceptance:** granted, denied, cancelled, missing code/state, expired/tampered state, wrong connection, provider exchange failure, admin consent only and duplicate callback. Success requires list-read confirmation; refresh does not repeat toast/action. Dependencies ML-08/12.

#### ML-12 — Separate requested scopes, actual grants and runtime capability
**P2 confirmed observability/contract gap; owner: OAuth backend + Settings.**

Canonical requested scopes are written to token/connection rows. Microsoft refresh logs insufficient resource scopes but can keep connected; Google initial denial check is good but refresh stamps canonical scopes. Settings permissions can therefore look authoritative when they are not. OAuth “configured” does not include notification URL/runtime eligibility. Generic Engagement capabilities also hardcode campaignSendingProvider=microsoft_365 despite Gmail routing. [ML-S01][ml-ML-S01] [ML-S14][ml-ML-S14] [ML-S16][ml-ML-S16] [ML-S23][ml-ML-S23] [ML-S71][ml-ML-S71]

**Tasks:** represent requested/granted/last-verified scope separately, classify missing read/send/calendar permissions, and provide actionable reconnect/admin-consent reasons. Extend existing capabilities with per-action configured/allowed/held reason and Microsoft push readiness. Correct generic provider metadata or deprecate unused misleading fields, without replacing provider-specific endpoints.

**Acceptance:** partial Google consent, older Microsoft token missing Mail.ReadWrite/Send, scope revoked after connection, runtime shadow, missing notification URL, valid Gmail-only sender. No optimistic “permissions granted” claim from requested list alone. Dependencies ML-01/13.

#### ML-13 — Preserve permanent reconnect state through sync failure
**P1 confirmed status-transition bug; owner: both provider sync/token services.**

Google invalid_grant and Microsoft interactive-consent errors mark needs_configuration, then throw. Outer sync catch unconditionally calls markSyncError, overwriting that with error and a 15-minute retry hint. Scheduler selects error rows, so revoked credentials can remain on a retry loop instead of an explicit reconnect hold. [ML-S16][ml-ML-S16] [ML-S23][ml-ML-S23] [ML-S24][ml-ML-S24] [ML-S26][ml-ML-S26] [ML-S27][ml-ML-S27] [ML-S28][ml-ML-S28]

**Tasks:** use typed sync/token errors and a single transition policy distinguishing transient, needs-reconnect, mailbox-not-enabled, permission-denied and disconnected. Preserve terminal/reconnect state and stop automated redemption until owner reconnects; retain safe diagnostics. Let UI retry transient sync without forcing new OAuth, but not invalid grants.

**Acceptance:** real top-level sync invocation with fake token exchange invalid_grant/consent required, not only token-service unit test. Final row remains reconnect-required, excluded from scheduler claims; reconnect restores scheduled eligibility. Dependencies ML-12/17.

#### ML-14 — Report mail-specific partial health and backfill progress
**P2 confirmed truthfulness gap; owner: sync backend + Settings.**

If calendar succeeds and mail hits a transient error, both sync services may return success without mail, set connected/lastSyncAt and clear lastError. This intentionally avoids falsely calling calendar failure, but Settings then reports “Connection sync completed”/“Synced just now.” Settings inspects failed counts only, not missing mail, hasMore, cursor backlog or mailbox coverage. Existing detailed coverage is available to assistant readers but not surfaced here. [ML-S01][ml-ML-S01] [ML-S20][ml-ML-S20] [ML-S26][ml-ML-S26] [ML-S27][ml-ML-S27] [ML-S28][ml-ML-S28] [ML-S32][ml-ML-S32]

**Tasks:** persist/return per-resource attempted/succeeded/error/lastSuccess/continuation state; distinguish connected authorization from sync health. Show partial mail failure, catch-up in progress, last complete mail sync, scope/window, auto-sync schedule and explicit safe retry. Preserve durable continuations; do not loop unboundedly in browser. Make manual reset a clearly distinct advanced action with server authority and recovery evidence.

**Acceptance:** calendar success/mail429, mail success/calendar failure, page/quota cap, failed record, expired history/delta reset, empty mailbox, deleted folder and long initial catch-up. UI never equates connection timestamp with complete mail coverage. Dependencies ML-13/16.

#### ML-15 — Complete Microsoft subscription lifecycle recovery
**P1 confirmed lifecycle gap; owner: Graph integration + runtime operations.**

subscriptionRemoved only sets configured=false; it retains subscriptions. configureSubscriptions ignores configured and can reuse a future-dated removed entry. reauthorizationRequired is recorded but no reauthorize action is performed. Near-expiry renewal currently creates replacements rather than updating/retiring old subscriptions, and multiple triggers are not serialized around subscription creation. [ML-S18][ml-ML-S18] [ML-S20][ml-ML-S20] [ML-S24][ml-ML-S24] [ML-S28][ml-ML-S28]

**Tasks:** invalidate/remove the exact removed subscription ID, implement provider-supported reauthorization/renewal or deliberate recreate-and-retire, serialize per-mailbox resource subscription reconciliation, and persist each resource outcome so partial creation does not leak untracked subscriptions. Expose expiry, last notification, last renewal, lifecycle failure and periodic fallback health. Preserve signed clientState matching. Reconcile missed notifications via cursor sync. Decide whether process-local notification queue plus periodic repair satisfies the product SLA; add durable queue only if required.

**Acceptance:** removed while unexpired, missed, reauthorizationRequired, one of two resources fails, duplicate callback, forged clientState, wrong subscription/tenant, concurrent scheduler/manual renewal, restart after accepted notification. Later authorized live challenge/expiry recovery test. Dependencies ML-01/10/16.

#### ML-16 — Bound provider calls and make sync claim lifetime match execution
**P1 residual reliability risk; owner: provider transport + sync scheduler.**

Provider fetches do not have explicit AbortSignal/deadlines. Scheduler handles claimed mailboxes sequentially with an in-process busy guard and uses nextSyncAt as lease; one hung call can stall a process, and a call exceeding its lease can overlap another process/manual/webhook sync. Transaction-level persistence locks do not prove the entire token/cursor operation is serialized. [ML-S24][ml-ML-S24] [ML-S27][ml-ML-S27] [ML-S28][ml-ML-S28]

**Tasks:** introduce per-call and total sync budgets into existing transports; classify send timeout as unknown, read timeout as retryable. Give each sync a durable claim token/version or equivalent serialization across manual/scheduler/webhook entry points; cursor/state commit must reject stale owners. Release/reschedule transient work safely, retain pending page state, and use bounded jitter/backoff rather than resetting all mailboxes together. Refresh/network cancellation should not advance cursors.

**Acceptance:** never-resolving fetch, process crash, lease overrun, manual+webhook+scheduler concurrency, stale state commit, multi-replica renewal, disconnect during work. Other mailboxes progress; no regression of cursor/removal state. Dependencies ML-13/15.

#### ML-17 — Make disconnect available and explain retained-data semantics
**P2 confirmed UI/contract gap; owner: Settings + mailbox lineage.**

Backend disconnect supports errored/stale connections, but UI shows Disconnect only for connected rows and disables Sync on error. Deleting the connection sets message/thread connectionId null; owner predicates require a connection owner, so physically retained records become unreadable through these mail surfaces. The dialog only says existing records are kept. Microsoft local disconnect intentionally does not revoke the upstream app grant. [ML-S01][ml-ML-S01] [ML-S13][ml-ML-S13] [ML-S15][ml-ML-S15] [ML-S33][ml-ML-S33] [ML-S34][ml-ML-S34] [ML-S35][ml-ML-S35]

**Tasks:** allow owner disconnect for any existing state; offer transient retry separately from reconnect. Define retained-history policy explicitly: either retain owner/mailbox lineage independently so historical read stays authorized, or state that history disappears from mail views until a supported recovery. Never broaden to tenant-wide history access. Expose Microsoft user/admin grant-removal guidance and Google's best-effort revoke outcome honestly. Decide whether reconnect can recover prior lineage only with proof of same stable account.

**Acceptance:** error/needs_configuration disconnect, revoke failure, orphaned history, repeated delete, reconnect same/different mailbox, reader permission after deletion. Dependencies ML-08/09/13.

#### ML-18 — Close mail UI pagination/search/completeness and bound thread reads
**P2 confirmed gap; owner: Mail read API + Portfolio.**

Contact list fetch returns at most 50 threads, no cursor/hasMore; UI has no route to older results/search. Each list embeds only three messages; detail loads all messages in DB with no page bound. Frontend schema strips body completeness/truncation and renders text as if that is the stored whole body. Assistant list/search is already bounded with asOf, offset, mailbox coverage and continuation, but thread output slices only after the full DB read. [ML-S31][ml-ML-S31] [ML-S32][ml-ML-S32] [ML-S36][ml-ML-S36] [ML-S50][ml-ML-S50]

**Tasks:** extend existing read contracts with stable bounded thread/message cursors, explicit hasMore and coverage/completeness; UI Load more/search/date/folder controls only within authorized scope. Reuse mail-query filtering semantics, do not build a second global inbox engine. Push thread pagination to DB while preserving active-message order and current mailbox authorization; keep assistant body continuation exact. Distinguish no matches, still importing, truncated body and unavailable body.

**Acceptance:** >50 threads, >3 messages, very large thread, deleted/reordered message between pages, stable asOf filters, incomplete backfill and removed account. No silent “all history” claim; no unbounded response/proxy failure. Dependencies ML-14/17.

#### ML-26 — Make unsupported IMAP and consumer-provider scope truthful
**P2 product/metadata boundary; owner: Settings + integration owner.**

UI permits IMAP/CalDAV registration but explicitly disables OAuth/manual sync/disconnect and says server configuration is required. No active IMAP/CalDAV adapter/controller/job was found in the inspected application source tree. Generic capabilities says requires_server_credentials, which is not evidence that supplying credentials would create ingestion. Microsoft defaults to organization accounts. [ML-S01][ml-ML-S01] [ML-S58][ml-ML-S58] [ML-S71][ml-ML-S71]

**Tasks:** label IMAP/CalDAV as unsupported/external unless an actual separately owned ingestion service is identified and verified. If external, document its exact contract, owner, health signal and record attribution; don't invent a credential form for absent code. Clarify Microsoft 365 work/school scope and Gmail/Google Workspace account eligibility. Build additional providers only after an explicit product decision; leave no misleading “just configure credentials” promise.

**Acceptance:** unsupported provider registration does not claim connected/syncable; connect buttons/labels match capabilities; no accidental fallback of an unsupported provider to Graph sender. No broad new integration platform is needed for this closeout.