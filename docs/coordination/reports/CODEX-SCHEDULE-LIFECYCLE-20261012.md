# Application schedule lifecycle source

Candidate source `b5d0f55108a375ce15eed97d3a7a6926558221af`, based on PR37 `e5fb3963de787bbd7b7663316c368f15814897da`. Author branch `task/meri-schedule-lifecycle-20261012`. All four allocated application operations have concrete source control paths; independent acceptance and live qualification are separate. No catalog, public0.1, existing inspection/core, dependency/lock or unrelated source changed.

## Concrete behavior and owners

`createPostgresScheduleLifecycle({pool,scheduleClient,workflowClient,authorize,clock})` composes the real new PostgreSQL owner with the SDK adapter. `createScheduleLifecycle` retains an injected owner seam for tests/application composition. Construction is inert. SDK clients/connections and the pg8.23.1-compatible pool are borrowed and never closed by this adapter.

| Operation | Concrete control path |
| --- | --- |
| `schedule_task` | Immutable private intent and approval hash → current authorization → durable stable-intent/generation claim → DISPATCHING acknowledgement → actual borrowed `ScheduleClient.create` → atomic acknowledged projection generation → current release authorization. |
| `update_scheduled_task` | Same journal and generation fence → exact `getHandle(id).update` with synchronous guarded replacement callback. No server CAS is claimed. |
| `cancel_scheduled_task` | Explicit pause/delete choice; optional explicit exact-run cancellation requests, each separately reauthorized. No inferred current retry or physical termination. |
| `list_scheduled_tasks` | Tenant/owner-bound application projection page → current authorization of each exact projection → existing inspector → at most ten exact original-execution summaries. SDK namespace listing is not used as application authority. |

Modules separate private contract validation, lifecycle composition, PostgreSQL ownership, SDK mutation translation, and safe run-history projection. Existing public ScheduleProjection/Identity/ApprovalDecision shapes, canonical inert JSON admission, Temporal inspector and shared operation lifetime are reused unchanged. Public ApprovalDecision is only a private intent correlation shape here; no private schedule intent is passed through the public Command execution validator. Current `authorize` owns actual policy, delegation and approval eligibility.

The private schema closes selectors and requires explicit schedule policy: full calendar fields, interval every/offset, cron strings, exclusions, timezone, start/end/jitter, overlap, catchup, pause-on-failure, remaining actions, paused/note, immediate execution and task/workflow references. Dates require canonical `Date.toISOString()` spelling. Interval milliseconds must be exact whole seconds. List limit is1–20, total original execution summaries0–10, and one local call is bounded to60 seconds. These are private resource admissions, not schedule execution permission or spending authority. Calendar/cron/IANA interpretation still belongs to the SDK/server. Immediate create explicitly acknowledges the SDK's ALLOW_ALL behavior. Update does not accept an immediate trigger.

The immutable public projection carries owner/scopes/budget/runtime/retry/destination; the private task reference carries task ID/version/manifest hash. The trusted producer and future workflow must actually enforce these facts. This adapter does not create a second model loop or claim that passing arguments implements future task execution.

## Persistence and uncertainty

`migrations/0001_schedule_owner.sql` is an explicitly applied product migration, never executed on import or constructor calls. The schedule owner serializes claim by tenant/schedule with a transaction advisory lock, validates expected generation and previous projection digest, reserves stable tenant/intent identity, and commits the claim before any SDK effect. A repeated intent, new intent while an active unresolved claim exists, or changed generation cannot redispatch. Known completion advances projection/generation and clears its active intent in the same transaction. Unknown cleanup cannot overwrite ACKNOWLEDGED.

CLAIMED, DISPATCHING and UNKNOWN remain unresolved barriers. Expiry during cleanup does not start unbounded work; an already persisted unresolved state remains available for explicit reconciliation. Lost commit acknowledgement, failed rollback, or ambiguous BEGIN evicts the borrowed client; release failure does not overwrite an existing commit-unknown error. The pool owner must configure finite connection/query timeouts. Local SQL statement/lock timeouts are installed, but caller cancellation is not proof that an in-flight DB operation physically stopped. No PostgreSQL execution occurred.

Approval expiry and each fresh authorization expiry monotonically constrain the reused lifetime before later ports can park. Current authority runs before claim, each effect, and release. Revocation after acknowledged persistence refuses result release without relabeling the durable acknowledgement. All exposed failures are scrubbed through inert own-data code inspection. No provider/database error body is returned.

## Temporal limits and safe inspection

Public upstream installed1.24.0 source is pinned in `sdk-reference-identities.json` (upstream commit `1fd1c81a0383f5f5c7923dd735472c7d1ffdc867`). `update` describes then replaces without conflictToken; application generation fences do not defeat external writers. Create/update use random SDK request IDs, and the default connection has retry interceptors. One adapter invocation is not one wire attempt or exactly-once execution. Deferred conversion/external storage and SDK abort behavior may still permit late internal RPCs; lifetime rejection proves neither physical cancellation nor no remote effect.

The SDK can decode payload/memo/external storage before a description reaches this adapter. Output omission does not claim those fields were never fetched. The adapter only returns safe selected state, counts, dates and original execution references; it neither calls unbounded `fetchHistory` nor returns workflow arguments, memo, raw history/event attributes or credentials. Original action `firstExecutionRunId` is used as the exact original run ID for summaries, never silently as the current retry. Known status code/name pairs follow the pinned helper/protobuf enum; future codes retain UNKNOWN.

Cancelled application state does not imply missing Temporal state. Listing still attempts the exact description; a failed SDK inspection retains an authorized row with `inspection:null` and `inspectionState:'unavailable'`, after fresh row authorization. Current-authority, cancellation and deadline failures are not softened into unavailable data. History is always partial and `currentRetryVerified:false`.

## Checks and preserved failures

Final author focused checks: **50/50 pass** (34 adapter controls,10 scripted PostgreSQL-owner controls,6 private contract controls), exact source `b5d0f551`. Offline audit:69/69 at this source, all8,678 original Git entries unchanged, nine installed SDK reference hashes verified, every captured owned process group absent without timeout/kill. No broad suite or public regeneration was run in this lane.

All original assertions remain; regressions are appended. Raw failures and immutable source commits remain in `schedule-author/` and branch ancestry:

- Initial21 adapter and10 owner controls passed. New owner-page negative23/24 exposed impossible short `hasMore`; expanded23/25 additionally exposed UUID textual ordering. Exact UUID normalization and page-size correlation repaired both, preserving projection bytes.
- Independent review's update-description Proxy counterexample reproduced0/1; rejected before reflection. Original source remains6f8be6b1.
- Missing Temporal description of a retained cancelled row reproduced0/1; explicit unavailable-row handling added with current-authorization negatives.
- Contradictory status code/name reproduced1/2 with UNKNOWN positive retained; pinned enum correlation repaired.
- Raw list authority/store/history error leakage reproduced0/3; list now uses the same inert scrubber as mutations.

No test result closes a real runtime gate. Live database migration/concurrency/crash/role isolation, actual Temporal service behavior, retry/converter configuration, exclusive schedule ownership, current approval/policy producer, future task/template enforcement and explicit uncertain-outcome reconciliation remain unqualified. Root owns canonical route/capability integration. All source connectivity stays disabled; G1 remains OPEN. No service, SQL, provider/model, native, cloud, resource, credential or security-state action occurred.
