# Proposals for dot: durable schedules (audit L6)

Fable, 15 October 2026, branch `fable/s3-l6-schedules-20261015` from `866110f8`. These proposals accompany the L6 lane report
([FABLE-S3-L6-SCHEDULES-20261015.md](../reports/FABLE-S3-L6-SCHEDULES-20261015.md)). Nothing here edits a frozen contract, applies
a migration, changes placement or grants activation. Each item says exactly what stays unwired until it is decided.

## P-L6-1 Migration request: a recorded "never applied" outcome for schedule intents

**Why.** The reviewed `meri_schedules.intents` state check allows only `CLAIMED`, `DISPATCHING`, `ACKNOWLEDGED`, `UNKNOWN`. The lane's
reconciler (`apps/control/schedules/intent-reconciliation.mjs`) can now acknowledge an uncertain intent when the provider shows its
exact effect, but it cannot record the opposite: an intent that provably never took effect. Such an intent keeps
`projections.active_intent` set forever, so the schedule cannot be edited and its firings are refused (`SCHEDULE_FIRING_UNRESOLVED`).
That is safe but leaves no way to recover availability.

**Proposed DDL** (product namespace `meri_schedules`; ID to be allocated centrally; not applied anywhere):

```sql
ALTER TABLE meri_schedules.intents DROP CONSTRAINT intents_state_check;
ALTER TABLE meri_schedules.intents
  ADD CONSTRAINT intents_state_check CHECK (state IN ('CLAIMED','DISPATCHING','ACKNOWLEDGED','UNKNOWN','NOT_APPLIED')),
  ADD COLUMN resolution_sha256 text,
  ADD CONSTRAINT intents_resolution_check CHECK ((state = 'NOT_APPLIED') = (resolution_sha256 IS NOT NULL));
```

(`intents_state_check` is PostgreSQL's generated name for the unnamed column check in `0001_schedule_owner.sql`; the allocator should
confirm it on the target database before applying.)

**Transition rules for review.** One transaction with the intent row `FOR UPDATE`, mirroring `acknowledgeReconciled`:

- From `CLAIMED`: no provider effect was attempted (the lifecycle mutates Temporal only after a committed `DISPATCHING` receipt).
  Allowed once the row is quiescent: `clock_timestamp() > updated_at + interval '75 seconds'` (the execute deadline is at most 60 s
  after admission, plus margin), measured on the database clock.
- From `DISPATCHING` or `UNKNOWN`: only with provider proof of absence after the same quiescence: `schedule_task` → the typed
  `ScheduleNotFoundError` for the exact Temporal schedule ID; `update_scheduled_task` → the exact schedule's action args still carry
  `expectedGeneration` and the previous projection digest; `cancel_scheduled_task` pause → not paused, or paused with a different
  note; delete → the schedule still exists. `request_cancel` cannot prove absence (a cancel request is not readable back), so those
  intents stay `UNKNOWN`.
- Effect: `state='NOT_APPLIED'`, `resolution_sha256` = digest of the observed evidence, and
  `UPDATE projections SET active_intent=NULL WHERE tenant_id=$1 AND schedule_id=$2 AND active_intent=$3 AND generation=$expected`
  (rowCount 1 or refuse). Generation does not advance. A never-applied create leaves the generation-0 projection row with no active
  intent; a later create must use a new schedule ID (the existing `SCHEDULE_EXISTS` check is unchanged).

**Unwired until allocation.** No `NOT_APPLIED` code exists in this branch. The reconciler returns `UNRESOLVED` with
`SCHEDULE_INTENT_NEVER_DISPATCHED` or `SCHEDULE_INTENT_EFFECT_NOT_OBSERVED` and leaves the barrier in place.

## P-L6-2 Placement: who hosts the scheduled-dispatch workflow and activities (needs owner approval)

**Why.** `meriScheduledDispatchWorkflow` (`apps/control/conversations/scheduled-dispatch-workflow.ts`) and its activities
(`apps/control/schedules/scheduled-activities.mjs`) need a Temporal worker that also holds the control database pool, the conversation
store, the conversation dispatcher and a Temporal client. The runtime worker (`apps/runtime/temporal-worker.mjs`) deliberately holds
no database credentials; the control process (`apps/runtime/control.mjs`) holds all of them but runs no worker. AGENTS.md requires
approval before a placement change, so this lane did not register the workflow anywhere.

**Options.**

1. *(Recommended)* The control process runs a second Temporal worker restricted to a dedicated schedule task queue (for example
   `meri-schedules`). It registers only `meriScheduledDispatchWorkflow` (its own `workflowsPath`, never the conversation bundle) and
   the two activities from `createScheduledDispatchActivities({dispatch:createScheduledDispatch({scheduleOwner:createPostgresScheduleOwner({pool}),store,dispatcher,runs:createTemporalRunEvidence({client}),authority,taskInstructions,versions}),context:()=>Context.current()})`.
   Temporal's schedule remains the only scheduler; this worker only executes firings Temporal starts.
2. The runtime worker registers the workflow and its activities call control through a new authenticated internal operation. This adds a
   new trusted route and a second network hop for every firing.

Either option also needs the trusted schedule context to set `configuration.workflow` to
`{workflowType:'meriScheduledDispatchWorkflow', taskQueue:<schedule queue>, workflowId:<schedule-scoped prefix>}`.

**Unwired until approved.** Nothing registers the workflow, so no schedule fires a product run today. Registering the workflow without
its activities is unsafe (an activity task nobody polls), so neither part was registered alone.

## P-L6-3 Two product owners the dispatch consumes but the repository does not have

Both are injected ports with closed receipts. Until they exist, dispatch answers `UNKNOWN` (the port throws) and nothing runs.

- **Current schedule authority.** `authorize({phase:'before_admission'|'before_start', occurrence, occurrenceKey, projection, signal, limitDeadline})`
  returns `{authorized:true, occurrenceKey, owner, scopes, checkedAtMs, expiresAtMs}` or `{authorized:false, occurrenceKey, code}`. `owner` must equal the
  schedule's original owner. `scopes` must name exactly the schedule's resources at one current policy revision. It must refuse when
  the owner is deactivated or revoked, or when tenant schedule policy is disabled. It never substitutes another actor.
- **Approved task instruction store.** `read({tenantId, scheduleId, generation, task, instructionSha256, signal})` returns
  `{instruction}`. The dispatch checks `canonicalSha256(instruction)` against the acknowledged intent's `taskInstructionSha256`. Today
  the intent stores only the digest; the text exists in the approval proposal and is not persisted for later firings. A natural home
  is the command/approval journal that already retains the approved proposal, keyed by intent ID.

## P-L6-4 Keeping an occurrence's UNKNOWN beyond its workflow lifetime (design question)

The dispatch workflow holds an UNKNOWN occurrence open, so the schedule's overlap policy keeps blocking later firings. The schedule
action's `workflowRunTimeout` comes from `scheduleSdkOptions` (`projection.maxRuntimeSeconds × 1000`, retried `retryLimit` times).
That bound was designed for the task's runtime, not for dispatch reconciliation. When it elapses, the occurrence's identity is
unchanged and no duplicate is possible, but later firings are no longer overlap-blocked. Two choices for dot:

1. Give the dispatch workflow its own run timeout, separate from the task runtime. This changes `temporal-schedule-mutations.mjs`
   and the reviewed intent shape.
2. Add a per-occurrence journal row (a new migration) that a later firing must check before admission.

The branch implements neither.

## Wire shapes

The dispatch outcome `{outcome, occurrenceKey, binding, code, admitted}` is a local activity result. It is not a contract and is not
exposed publicly. Allowed `outcome` values are `DISPATCHED | REFUSED | UNKNOWN | ADMITTED | NOT_DISPATCHED`. No frozen schema was
edited.
