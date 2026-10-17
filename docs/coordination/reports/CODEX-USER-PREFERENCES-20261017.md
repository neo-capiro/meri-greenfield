# Personal Meri preferences

Owner: Codex task-6. New independent branch `codex/meri-user-preferences-task6-20261017` starts at Meri PR98
`caa7810ff19c09c8f7ea1c2524c025f36f99ccd6`; the frontend branch starts at PR60
`e0b47a34d00b8c181420188ed39a1d849e25ec0a`. Previous task-update PR100/102/61 and their branches stay intact.
Task-owned sparse checkouts are reused because disk capacity is below 1 GiB. No dependency install, archive, migration or deployment.

## Selected gap and owners

Fable package four already supplied canonical settings documents, CAS/audit store, service and prototype routes. They are not mounted
by runtime and have no public browser contract. The current Meri preferences panel disables all persistence controls, and the sidebar
`/settings/preferences` alias does not select its existing `/settings/meri-preferences` section. Memory review still depends on Core
review integration; routines still need scheduled-run authority and worker composition. This slice closes user preference persistence.

- Existing Core membership transport and product gate own current native identity, tenant/actor, active membership, revision and clients.
  Reuse captured `conversationMembership.admit/recheck`; do not create another authorization or approval mechanism.
- Existing settings document and service owners validate preferences; the PostgreSQL store owns revision CAS and content-free audit.
  Keep tenant/platform settings unavailable in this user-only composition. Initial CAS now uses the PK-targeted conditional INSERT
  result, rather than an unlocked absent-row read. Conditional UPDATE acknowledgements are validated before the audit is written.
- New user-only application/feature composition owns bounded read/save routes over those owners and an independently checkable response
  owner. The shared runtime mount is an explicit shipping handoff, not a change in this branch.
- New public contract references the canonical preference document shape/defaults and derives browser receiver/types/schema/metadata.
  No handwritten frontend DTO or private cross-repository import. Existing public distributions and installed contracts0.1.8 stay intact.
- Frontend owns a connected personal form, current-account-scoped receiving/attempt state, fixed authenticated same-origin proxy,
  save/readback, explicit conflict reload and read-only reconciliation of uncertain writes. No automatic mutation or blind new revision.
  Context changes clear private state and cancel late reads; admitted known withheld outcomes remain explicit.
- Supported appearance/density may preview inside this preferences panel using local inherited tokens and spacing. Do not imply global
  application theme, notification delivery, default-client auto-selection, connectors or unsupported Figma fields are connected.

## Public flow

Exact POST paths: `/api/settings/user/read` takes `{}`; `/api/settings/user/save` takes
`{expectedRevision,preferences}` with the complete canonical `UserPreferences` document.
Both success bodies are `{owner:{tenantId,actorId},revision,preferences}`. Owner comes from freshly admitted membership, never the body.
The browser receiver requires independently current tenant/actor; save success also matches the exact captured document and next revision.
Existing content-free product/settings errors retain their exact HTTP statuses, optional field and UNKNOWN/RESULT_NOT_RELEASED outcomes.

## Allocation and checks

Root owns new `apps/control/settings/user-application/**`, existing settings service/routes/store integration, affected persistence/HTTP
regression fixtures and focused composition tests,
and this report. Contract author owns new `packages/contracts/user-preferences-application/**`, generator/dist/tests and the
canonical document-shape seam in `apps/control/settings/documents.mjs`. Root alone edits `packages/contracts/package.json`.
Frontend author owns new user-preferences modules/tests, settings page/panel seam, supplemental generated export and provenance,
and exact architecture allocations. Each author receives exact paths and an acceptance boundary; an independent reviewer accepts
the final source before draft publication. No shared gateway, first-chat host, startup/image recipe, lockfile or migration change.

Focused checks cover actual membership HTTP transport, service/store/application/runtime composition, first-save and stale CAS,
unknown commit and readback, membership removal/change before release, input/output limits and cancellation, tenant/actor substitution,
invalid documents/timezones, browser interaction, current-account cleanup, generated provenance, types and scoped lint/architecture.
Synthetic boundaries remain labelled. Full production build and live/native/database qualification remain separate release work.

Current parent coordination (17 October): the proposed Fable transfer is canceled; dot owns first-shipment image qualification,
service deployment/integration and live acceptance. This independent slice preserves shipping pins, infrastructure and runtime bindings.
Accordingly `apps/runtime/product-applications.mjs`, prepared startup and deployment/image sources remain untouched. The source handoff
will name the optional application owner and exact two-route mount requirement for dot. No shipping work is duplicated or delayed.

## Source qualification holds

`meri_settings` DDL is proposal-only; no migration ID or execution is allocated here. The current Core membership endpoint/source must
be qualified with the release owners. Defaults stay off and preview writes remain held. No source result establishes live persistence,
notification delivery, approval changes, AWS readiness or deployment acceptance.

## Source verification checkpoint

The current combined affected run passes **107 tests, zero failures, one explicit real-PostgreSQL skip**: new user-only API and
actual-store composition, CAS/transaction tests, unchanged settings/tenant behavior, current Core membership transport, product HTTP
and its pending-COMMIT regressions, proposed-DDL static checks and the new public receiver. Scripted boundaries are native
identity/Core Fetch and PostgreSQL responses; the actual application, membership gate, canonical service, SQL store and transaction
owners execute. Initial concurrent creator scripts return only one PK claim/audit; the loser rolls back with a revision conflict.
Lost COMMIT acknowledgement remains UNKNOWN; a safe readback sees the committed document and replay does not create another audit.
This is not a PostgreSQL concurrency or database durability qualification.

Independent review found that an earlier service read could compute changed fields from a different revision than the store's later
locked before/hash. The store now derives the audit diff at the same atomic revision as its CAS. Services pass canonical defaults only
as the first-creation baseline and no longer pre-read for saves. A regression runs the real user service and SQL store against a locked
revision1 dark/compact document, writes revision2 dark/comfortable and requires exactly `density` in the audit. Removing that read also
eliminates false write uncertainty from a lost read-only COMMIT acknowledgement before any save. Existing pending settings-COMMIT
controls now provide the actual INSERT RETURNING row/hash; their UNKNOWN and late-success assertions remain unchanged.

The first focused API test expected an already-aborted request to report499. The existing lifetime owner reports408/DEADLINE for that
pre-start case; the test was corrected to preserve canonical behavior and still requires zero mutation. No lifetime/authority owner
was changed. Existing settings/tenant regressions passed before and after the user-service extraction and canonical document seam.
An expanded check initially lacked the tracked proposal SQL in this sparse checkout; its failure receipt is retained and the existing
file was materialized without editing it. The complete affected rerun then passed. No schema was applied.

The Core membership source is present in the read-only `task-3/capiro-backend` at
`06aa1bbe30f783f8bda9cff226824e907721598a`: `apps/api/src/auth/application-membership.controller.ts`, service and receipt owner.
It defines the fixed POST route already consumed by Meri; no Core code or deployment was changed. Live endpoint binding remains unproven.

The public contract has independent ACCEPT:29 public tests plus6 existing settings regressions, all eight strict public TypeScript
smoke files, default/explicit offline generation checks and browser-like VM isolation/correlation. Existing public distributions remain
unchanged. Backend/CAS has independent ACCEPT after the audit repair:78 passed, one explicit real-PostgreSQL skip, zero failures, plus
an independent actual-service/SQL-store audit probe and a throwing read spy that confirms zero preliminary reads. The reviewed backend
18-file snapshot SHA256 is `a09201ee2a164e9d89c82719d2c1c27fbdb376747083750e592ec0a16df32393`.

Generated metadata SHA256 is `413ccc14695a42f318142998cab1230b9f892b1ad43702e3010ac796cedac398`;
the final combined test receipt SHA256 is `fdfa76ac62437b23e86f3badda33fd559ca9d5236a763e07a6ff6003f6c6b193`.
Existing public distribution files, runtime/shared shipping bindings, Core, gateways, worker/image recipes and lockfiles are unchanged.
The frontend consumes the four real generated artifacts and is qualifying the complete request/revision flow in a desktop browser.
Final published pins, the companion frontend draft and remaining integration gaps are recorded in the source handoff/PR descriptions.
