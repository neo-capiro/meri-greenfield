# Product receiving dependencies - source consolidation

**SAFE STOP / SOURCE HOLD.** This report began before the usage interruption. Its proposed `task-commands.mjs` wrapper and factory test were never authored. Root preserved the narrower late-factory port in `product-applications.mjs` and will not add a second wrapper around the existing canonical feature. The current consolidation is incomplete and has no independent final acceptance. Use [the sealed product supplement](../../handover/20261017/fable-final/PRODUCT-FEATURES.md) for actual state and next actions; do not treat the implementation outline below as delivered code.

Audit baseline: PR128 local `2c738c0c2778c2aca6407c30239143ffced5b832`, tree `6d96cb5420d85e6d39d5d19788eb871af1169f87`. This task owns this report and the newly allocated task-command late-session helper/test only. Main startup/config/CLI/control, prepared-run and whole-facts files remain exclusive to their runtime owners. No live activation, credentials, services, SQL, dependency installation or denied-operation retry is authorized here.

## Implementation outline

Add `apps/runtime/task-commands.mjs` with `createRuntimeTaskCommandFeature({enabled,services,selectedClientId,authorizeExecution,intentJournalPool,resultRelease,httpLimits})`. The explicit disabled branch touches no dependencies and its `create()` returns null, leaving the one unavailable response with the runtime mount. Enabled construction snapshots immutable JSON facts and captures existing borrowed methods/callbacks without invoking them. `create({sessions})` uses the actual opaque session owner's captured methods and calls canonical `createTaskUpdateFeature`; it adds no executor, session resolver, grant installation or authority. State is disabled/pending/composed/unavailable. The root owns capture/mount/readiness changes for `taskCommandApplicationFactory`, including exclusivity against a static application and source-enabled gating. Focused tests use actual native session, canonical feature, metadata, command/budget and fixed HTTP owners over explicitly synthetic boundaries.

## Canonical composition and current defaults

| Surface | Existing canonical entry and actual receiving state | Missing genuine owners / default behavior |
| --- | --- | --- |
| Task updates | `apps/control/task-command-application/feature.mjs:createTaskUpdateFeature` composes `createTaskUpdateServices`, native opaque-session resolver, existing intent journal and Fetch API. Existing mount accepts only captured `taskCommandApplication.handle`; public contract is the additive task-command application subpath. | Explicit feature `enabled:false` returns null before dependencies. Executor source defaults false; runtime additionally requires `configuration.sourceEnabled === true` and a captured application. Main config currently only accepts source false. Missing/disabled mount returns TASK_COMMAND_UNAVAILABLE/NOT_DISPATCHED503. Native session, preparation policy, execution issuance, approvals, command authority, trusted budget grant, result-release and Core credentials remain required; none can be inferred from membership/config. |
| User preferences | `apps/runtime/user-preferences.mjs:createRuntimeUserPreferences` already composes canonical user feature/service/settings store with the borrowed control pool and captured `conversationMembership`. Control readiness already calls its readiness before listeners serve. | `userPreferences` absent/false is disabled. Enabled with no membership owner remains unavailable and readiness refuses. Both existing settings relations must be readable; current native membership is checked on API execution/release. No additional factory or platform-settings owner is needed. |
| Foreground routines | `apps/runtime/routines.mjs:createRuntimeRoutinesFeature` returns the late `create({sessions})` factory already captured by product applications. It composes existing runtime context, native foreground policy, canonical proposal reader, schedule owner/lifecycle and borrowed Temporal client. | Explicit enabled false is inert. Missing factory returns ROUTINES_UNAVAILABLE/NOT_DISPATCHED503. Enabled construction requires trusted context and policy; request-cancel additionally requires the paired canonical run-control/retirement owners. The control factory context currently omits its already-owned Temporal client. |
| Scheduled dispatch | `apps/runtime/schedule-service.mjs:startScheduleWorker` composes existing domain worker via `assembleScheduleDispatch`; `schedule-worker.mjs:startScheduleWorker` owns only the Temporal poller/health listener. These are different layers. | Requires four compiled ports before secrets: authority.authorize, runAdmission.admit, runControl.cancel, retirement.retire. No fallback authority. Main CLI/config does not yet accept the role. Service schema probe requires13 existing relations. |

## Minimal receiving seams and order

1. Root's additive late task application factory capture closes the pre-session construction gap; preserve static application compatibility and reject simultaneous owners. New helper receives actual `sessions` only after assembly creates them. Do not activate source access.
2. Runtime owner may expose the already-owned `client` alongside pool/native/clock in the trusted `productPortsFactory` context, then reuse the existing routines factory. Do not open a duplicate Temporal connection or add module selectors in JSON.
3. Runtime owner receives schedule-role config/CLI/package changes against its accepted successor. The existing service/poller/domain factories are reused. A trusted bootstrap may supply one borrowed pool/client to the native admission and service; JSON cannot manufacture the four owners. Unattended authority remains blocked on its separately approved genuine native grant owner.
4. Prepared-run owner receives the accepted `scheduled-run-profile.mjs` restriction before any task issuer effect, then consistently through model issuance, whole-facts, admission and reconstruction. Historical revoke/retire must use the exact retained scoped allocation and original facts/expiry; do not call the fresh current-run resolver for expired sources. This source remains UNRECEIVED; no shipping facts hash is changed.
5. Qualification then binds schema/privileges, whole-facts replay/cleanup, source credentials and native service startup to the accepted candidate. Existing held PG/Core operations remain held; source readiness is not live acceptance.

## Receiving pins and older proposal corrections

The following current baseline Git blobs are read-only patch anchors, not permission to edit:

| Reserved target | PR128 baseline blob |
| --- | --- |
| apps/runtime/config.mjs | d89b1464e1d44027c9e161e8daa0c0d38c106ead |
| apps/runtime/cli.mjs | b2e5819c334ae385666f6715a3b8c822dadeb6ed |
| apps/runtime/control.mjs | 828bb258c8462a92eef0c421dccb3d6133a43d03 |
| apps/runtime/package.json | 6f4bb8574be99cb7ad76028a28c42647344a6db6 |
| apps/runtime/product-applications.mjs | 27f9d871819b5e0e1f13cf15327fdc9cd14f62f1 |
| apps/runtime/prepared-run-bindings.mjs | 92e2df761fd9a4c481af4b3e89d3e2dba21ad646 |
| apps/runtime/prepared-run-issuance.mjs | a89195ac852791940422a4cf1f2b0fbb3468829c |
| apps/runtime/prepared-run-registry.mjs | c7bb5121779a389b9e0cb799415336812360d2a1 |
| apps/runtime/prepared-candidate.mjs | f6f419d2c00e956c503be52d945aea6c539c0951 |

[The primary role proposal](CODEX-ROUTINES-PRIMARY-RECEIVING-20261017.md) records an older PR121 pin and remains NOT APPLIED. Its two-port/two-activity descriptions are historical: current service requires four genuine ports and registers dispatch/reconcile/cancel activities. Its whitelist sketch must preserve the already-integrated userPreferences field and all later accepted primary additions. Re-read final config/CLI before receiving; never replace them wholesale. The role helper validates only role-specific settings, not complete common configuration.

[The profile receiving proposal](CODEX-ROUTINES-PROFILE-RECEIVING-PROPOSAL-20261017.md) still names the exact current prepared-run blobs above and correctly requires preflight before issuer.issue (facts.compile follows task issuance). It is a dependency proposal, not applied integration. [Preferences runtime continuation](CODEX-USER-PREFERENCES-RUNTIME-20261017.md) and [task integration](CODEX-TASK-UPDATE-INTEGRATION-20261016.md) retain their historical evidence and held qualifications.

## Duplication / removal audit

No production removal is proposed. The two schedule service/poller start functions own different resources. The instruction-only preparation reader and human proposal reader share one canonical implementation but expose intentionally different operations. User-only settings logic is already reused by the tenant settings service; document vocabulary/defaults already come from the shared public document module. The single scheduled-job lineage helper is reused rather than copied.

`scheduled-conversation-receipt.mjs` currently has fixture consumers only. It returns occurrence custody/dispatch identity and the original run's event pagination, while mounted history returns canonical whole-conversation/latest-run views. Those semantics differ; an absent production caller does not prove it is a duplicate or dead. Keep it explicitly unreceived, with no new public endpoint inferred. The accepted scheduled admission/profile helpers likewise await trusted receiving, rather than qualifying as dead code.

Verification for this initial report: actual source and existing proposals read; current commit/tree and reserved blobs checked; no unchanged tests rerun. Helper implementation and focused checks follow the outline above; final results will be appended after independent review. No protected source was edited by this task.
