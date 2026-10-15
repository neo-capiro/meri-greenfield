# Governed conversational write requests: proposals for dot (INTENTS lane, 16 October 2026)

Lane report: [FABLE-INTENTS-20261016.md](../reports/FABLE-INTENTS-20261016.md). Everything below is a **local proposal**. No contract, UIEvent, Run contract, lockfile, migration directory or shared decision file was edited. Nothing is deployed, migrated or activated.

## P-INT-1: prepare-only result shapes crossing the intent port

The control mount returns, and the worker admits (`apps/worker/conversation/intents/prepared.mjs`), exactly one of:

| Owner kind | Shape | Source of the inner value |
| --- | --- | --- |
| command | `{status:'approval_required', proposal}` | `commands/tool-interface.mjs` `prepare` (public `ApprovalProposal`, checked by `assertProposalIntegrity`) |
| schedule | `{status:'approval_required', proposal}` | `schedules/tool-interface.mjs` pending output (`status:'approval_required'`, `proposalId` = intent ID, `intentSha256`) |
| document | `{status:'draft', version}` | `ArtifactCreatedResult.version` with `generationStatus:'draft'`, `parentVersionId:null` |

Any other status (for example `observed`, `acknowledged`, `succeeded`) is refused as `INVALID_RESULT`. Failures cross as a closed `code` only: `UNAVAILABLE`, `ACCESS_DENIED`, `REFUSED`, `INVALID_ARGUMENTS`, `DEADLINE`, `CANCELLED`, `CONFLICT`, `UNKNOWN`.

## P-INT-2: intent availability facts

`readAvailability({signal})` → `{binding, operations:[{id, version:'0.2.0'}], checkedAtMs, expiresAtMs}`. `binding` must equal the run's `RunBinding`; at most 11 operations, no duplicates; `checkedAtMs <= now < expiresAtMs`. The mount answers with the operations whose preparer the trusted composition built for this run (30-second validity). It is a listing fact, not authority.

## P-INT-3: capability-policy flag and prompt sentence

- New default-off policy flag `governedIntents` in `apps/worker/conversation/capabilities/policy.mjs` (`POLICY_FLAGS`), resolved by the existing platform ∧ tenant ∧ role resolver (`policy-resolution.mjs`, flags AND). It admits the `meri_intents` server only; it grants nothing.
- Prompt sentence appended only while `meri_intents` is mounted (exact text for owner review): " Write requests may only be prepared with the listed write-request tools, as proposals the user approves in Meri or as drafts; never say a change was made before it is approved and applied."

## P-INT-4: per-run ceiling

At most 8 intent tool calls per run (`MAX_INTENT_CALLS`), counted at correlation before any owner call. Unqualified upper bound, never spending authority; each owner keeps its own budget path.

## P-INT-5: `list_scheduled_tasks`

The ledger routes it to `mcp__meri_intents__list_schedules`, but it is a read (`sideEffect:'none'`, `approvalBoundary:'none'`) with nothing to approve. Proposal: serve it from a read route (a `meri_reads` family or a read tool beside the intents), and change the ledger route accordingly. It is listed in `NOT_INTENTS` and never registered by `meri_intents`.

## P-INT-6: trusted schedule-context owner (blocks schedule intents)

`schedules/tool-interface.mjs` needs a trusted `scheduleContext` (caller identity, current projection, task/destination/limit resolutions, intent ID). No owner in the repository resolves it or persists the pending schedule proposal for later approval. The schedule preparer takes it as a port, `resolveContext({operation, request, deliveryId, signal})`, and refuses any context whose `approval` is not null. Proposal: a schedule-proposal owner that resolves from trusted state, stores the immutable intent under its intent ID (keyed so the same `deliveryId` resolves the same intent), and later supplies the approval through the existing approval control. Until it exists, no composition can offer schedule intents.

## P-INT-7: approval-metadata owners for the other command actions

`createTaskCreateApprovalMetadataOwner` persists task.create proposals only. `update_task` (task.update), `save_memory` (memory.propose) and `save_chat_attachments` (artifact.file) therefore stay unavailable with explicit reasons, although the command interface and executor already support those actions. Proposal: per-action metadata owners (or an action-parameterized owner) on the same `meri_approval_metadata` table, each normalizing through `commandToolValidators`. Memory stays shared-scope only (personal remains `PENDING_PRODUCER_UNAVAILABLE`); `confirm_memory`/`correct_memory`/`forget_memory` stay excluded.

## P-INT-8: surfacing prepared proposals to the approval control

Control admits only `run.status` and `message.delta` events today (P9). The worker keeps intent receipts (`{deliveryId, operation, argumentsSha256, outcome:'prepared'|'unknown', status, reference, resultSha256}`); nothing publishes them. Proposal (needs dot, UIEvent 0.1.0 is frozen): an admitted event or a control read that lists the run's prepared proposal/draft references, so the existing approval UI can show the exact proposal. Without it, the conversation can prepare, and the existing approval routes can approve, but the desktop cannot yet render the card from the conversation.

## P-INT-9: production composition and transport

The worker runs in a task; the mount lives in control. A trusted, task-bound transport (like the general-read port) must carry `readAvailability`/`prepare` to the control mount, which the startup composes per run with the run's preparers and journal store. Part of STARTUP-COMPOSITION; no composition supplies the port today.

## P-INT-M1: migration request — intent preparation journal

No migration ID is allocated to this lane. Proposed SQL for the store behind `apps/control/intents/journal.mjs` (`claim` = insert-or-read, `settle` = PENDING-only update):

```sql
CREATE TABLE meri_intent_preparations (
  tenant_id        text        NOT NULL,
  actor_id         text        NOT NULL,
  conversation_id  uuid        NOT NULL,
  delivery_id      text        NOT NULL CHECK (delivery_id ~ '^sdk:[a-f0-9]{64}$'),
  record           jsonb       NOT NULL,
  record_sha256    char(64)    NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
  state            text        NOT NULL CHECK (state IN ('PENDING','PREPARED','FAILED','UNKNOWN')),
  outcome          jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  settled_at       timestamptz,
  PRIMARY KEY (tenant_id, actor_id, conversation_id, delivery_id),
  CHECK ((state = 'PENDING') = (settled_at IS NULL)),
  CHECK (state <> 'PREPARED' OR (outcome ? 'result')),
  CHECK (state <> 'FAILED'   OR (outcome ? 'code')),
  CHECK (state NOT IN ('PENDING','UNKNOWN') OR outcome IS NULL)
);

-- claim (atomic insert-or-read):
--   INSERT INTO meri_intent_preparations (tenant_id, actor_id, conversation_id, delivery_id, record, record_sha256, state)
--   VALUES ($1,$2,$3,$4,$5,$6,'PENDING') ON CONFLICT DO NOTHING RETURNING state;
--   on no row: SELECT record, state, outcome FROM meri_intent_preparations WHERE (tenant_id, actor_id, conversation_id, delivery_id) = ($1,$2,$3,$4);
-- settle (PENDING only, same record):
--   UPDATE meri_intent_preparations SET state = $6, outcome = $7, settled_at = now()
--   WHERE (tenant_id, actor_id, conversation_id, delivery_id) = ($1,$2,$3,$4) AND state = 'PENDING' AND record_sha256 = $5
--   RETURNING record, state, outcome;
```

Retention: `outcome.result` holds the prepared proposal or draft reference (for example a task title), so this table joins the retention/deletion inventory with the conversation it belongs to. No row is ever deleted to allow a retry.
