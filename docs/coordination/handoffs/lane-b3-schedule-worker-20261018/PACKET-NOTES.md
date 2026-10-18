# Lane B3: the schedule worker as its own service (packet notes)

Decision: D016-A #5 (unattended routine firing in scope; the schedule worker ships as its own service). Source: lane B2
(`composeRoutinesWorkerOwners`, firing authority and unattended stop over Core's wire C grant) plus this lane (the two lane-1
owners as control native operations; the service's owner factory). Nothing here is executed; it is the material the packet's
render, grants and deploy steps need. `COMPOSER-DIFFS.patch` beside this file is the exact composer-owned change (cli.mjs,
config.mjs, control.mjs, control-route-boundary.mjs, prepared-candidate.mjs, product-ports/routines.mjs and the role test); it
applies cleanly to `cb927d37` + this lane with `git apply`, and the suites listed in the lane report were green with it applied.

## 1. Task family

| Item | Value |
|---|---|
| Service / family | `meri-product-preview-schedule-worker` (DEPLOYMENT-PACKET §7), same runtime image as control and the temporal-worker |
| Entry | `node apps/runtime/cli.mjs schedule-worker --config /run/meri/schedule-worker.json` |
| User / container | `1000:1000`, container `schedule-worker` (as `temporal-worker`) |
| Environment | `MERI_PRODUCT_PREVIEW_REQUIRED=1`; `NODE_EXTRA_CA_CERTS=/run/meri/issuer-ca.pem` (the pinned server CA; the worker reaches control's private origin with global fetch exactly as the temporal-worker does) |
| Volumes | `/run/meri` material (read-only): config, `database.uri` (its OWN login, §3), `control-capability`, Temporal client CA/cert/key, `routines-service-secret`; `/run/meri-temporal` is NOT needed (`temporal.tokenWriter` is refused for this role) |
| Ports | health listener only (`http.port`, propose 8083; `/api/*` answers 404, readiness from the poller) |
| Network | same private subnets and security groups as the temporal-worker (egress: Aurora, Temporal, control private listener 8082, Core's public ALB for wire C) |
| Temporal | task queue `meri-schedules` (poller), `scheduledDispatch.conversationTaskQueue` = control's conversation queue; its own Temporal client identity (`temporal.tls` material; `temporal.authorization` optional, as rendered for the temporal-worker without the token writer) |
| Count | 1 task (a second one only changes poll concurrency; Temporal owns firing identity) |
| Stderr events | none at startup beyond `runtime.listening`; owner composition refusals exit 3 `RUNTIME_UNAVAILABLE` before any poller |

Render (`render-material.mjs`) needs a `schedule-worker` entry in `ROLES`, `RUNTIME_USERS`, `CONTAINER_NAMES`, `PATHS`
(`/run/meri/schedule-worker.json`) and a bundle with the files above; `assertProductCliGates` for the role is the cli.mjs gate in
the patch (`routines.enabled`, `routines.core.unattendedGrant`, `native` HTTPS non-loopback, `database`).

## 2. Configuration file keys (`validateConfiguration(…, 'schedule-worker')` with the patch)

```json
{
 "version": 1, "profile": "isolated-preview", "sourceEnabled": false,
 "limits": {"startupMs": 30000, "shutdownMs": 30000, "requestMs": 25000, "requestBytes": 131072},
 "http": {"hostname": "0.0.0.0", "port": 8083, "frontendOrigin": "<control public origin>"},
 "temporal": {"address": "<temporal>:7233", "namespace": "<ns>", "taskQueue": "meri-schedules",
  "tls": {"caFile": "/run/meri/temporal-ca.pem", "certFile": "/run/meri/temporal-client.pem", "keyFile": "/run/meri/temporal-client.key"}},
 "versions": "<RuntimeVersions, identical to control's>",
 "scheduledDispatch": {"enabled": true, "conversationTaskQueue": "<control temporal.taskQueue>", "maxConcurrentActivities": 4},
 "database": {"connectionFile": "/run/meri/database.uri"},
 "native": {"origin": "<control privateHttp.frontendOrigin>", "capabilityFile": "/run/meri/control-capability", "loopback": false, "maxResponseBytes": 2097152},
 "routines": {"enabled": true, "core": {"origin": "<Core origin>", "serviceSecretFile": "/run/meri/routines-service-secret",
  "unattendedGrant": {"issuer": "<Core signer issuer>", "kid": "<firing kid>", "publicKey": {"kty": "OKP", "crv": "Ed25519", "x": "<…>"}}}}
}
```

Notes: `requestMs` ≤ 30000 (schedule-service-configuration.mjs); native calls are capped at 10000 ms (native-client.mjs bound), which
must cover control's admission (three wire C grants plus SQL). `routines.core.unattendedGrant` is the SAME pin control carries
(control composes the occurrence operations from it); the cancellation-proof pin is control-only. `routines.task` is control-only.
Control's own config gains `routines.task {taskId, version}` (the generic routine task identity; lane-1 open input, now a public fact)
and must already carry `routines.core` with `unattendedGrant`.

## 3. Database role `meri_schedule_runtime` (GRANTS-PROPOSAL §4 plus the `meri_conversations` grants derived from the worker's SQL)

The worker composes: the schedule owner, the approved-instruction reader (`meri_intents.preparations`), the conversation store for
the dispatch's exact-binding read, the job lifecycle's lineage reads and the unattended stop's cancel append. Admission and
retirement run in CONTROL (`/v1/routines/occurrences/{admit,retire}`), so the worker needs NO `meri_product_budget` grant and no
INSERT on conversations/runs/initial inputs/bindings.

```sql
CREATE ROLE meri_schedule_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
COMMENT ON ROLE meri_schedule_runtime IS 'meri-first-chat-d2';
SELECT format('ALTER ROLE meri_schedule_runtime WITH LOGIN NOINHERIT CONNECTION LIMIT 10 PASSWORD %L', :'schedule_password') \gexec
GRANT CONNECT ON DATABASE capiro TO meri_schedule_runtime;
GRANT USAGE ON SCHEMA meri_schedules, meri_intents, meri_conversations TO meri_schedule_runtime;
-- §4 verbatim (schedule owner: readFiring, openOccurrence, settleOccurrence, readOccurrenceForConversation; instruction reader)
GRANT SELECT ON TABLE meri_schedules.projections, meri_schedules.intents, meri_intents.preparations TO meri_schedule_runtime;
GRANT SELECT, INSERT ON TABLE meri_schedules.occurrences TO meri_schedule_runtime;
GRANT UPDATE (state,updated_at) ON meri_schedules.occurrences TO meri_schedule_runtime;
-- conversation store (postgres-store.mjs readOptional; routines-run-control.mjs createRunStopper -> lifecycle.cancel = appendEvent)
GRANT SELECT ON TABLE meri_conversations.runs, meri_conversations.events TO meri_schedule_runtime;
GRANT INSERT ON TABLE meri_conversations.events TO meri_schedule_runtime;                       -- postgres-store.mjs:57 (run.status cancelled)
GRANT UPDATE (projection,projection_sha256,last_sequence) ON meri_conversations.runs TO meri_schedule_runtime; -- :58, and every runs … FOR UPDATE
-- a queued run cancelled before any claim records its no-authority evidence (appendEvent -> allocations.foreclose)
GRANT INSERT ON TABLE meri_conversations.native_allocations TO meri_schedule_runtime;           -- native-preparation-journal.mjs:97
-- job lifecycle lineage (scheduled-job-lineage.mjs, scheduled-job-lifecycle.mjs retired(): allocations.read, initialInputs.read, nextRuns.listRuns, lifecycle.controls/execution)
GRANT SELECT ON TABLE meri_conversations.native_allocations, meri_conversations.initial_inputs, meri_conversations.next_runs, meri_conversations.controls TO meri_schedule_runtime;
GRANT UPDATE (record_sha256) ON meri_conversations.native_allocations TO meri_schedule_runtime;  -- lock only: load() … FOR UPDATE (:65)
GRANT UPDATE (allocation_sha256) ON meri_conversations.initial_inputs TO meri_schedule_runtime; -- lock only: readRow() … FOR UPDATE (initial-input-journal.mjs:11)
```

The two lock-only column grants exist because PostgreSQL's `FOR UPDATE` needs UPDATE on at least one column; the worker never
changes those rows. If the packet wants the existing `lock_only_*` trigger pattern (first-chat-database.sql `MERI_LOCK_COLUMN_UPDATE_REFUSED`)
extended to these two columns, that is a one-trigger addition each. Readback: the role must have no privilege on
`meri_conversations.conversations`, `initial_run_bindings`, `checkpoints`, `next_runs` (UPDATE), any `meri_product_budget` table,
`meri_commands`, `meri_settings` or `meri_schedules.run_cancel_proofs`. Bootstrap: `first-chat-migrate.mjs` only hands passwords to
the ledgered bootstrap file, so the role joins the collision and readback lists there (GRANTS-PROPOSAL §4, "four things").

Control's existing grants already cover the admission it now hosts (initial_run_bindings, initial_inputs, conversations, runs,
events INSERT/UPDATE; `meri_schedules.occurrences` SELECT + UPDATE). Control's admission re-opens the barrier row the worker's
dispatch opened first (`openOccurrence` finds the same key and never INSERTs); an admit without that row would fail as
`SCHEDULE_ADMISSION_UNKNOWN` (no INSERT privilege), which is the intended fail-closed answer. Granting control `INSERT ON
meri_schedules.occurrences` is therefore not needed; do not add it.

## 4. Native capability and listener

The worker authenticates to control exactly like the temporal-worker: `Authorization: Bearer <control capability>`
(`/run/meri/control-capability`, the same marked control credential), matched against control's capability digest by the operation
application, on control's PRIVATE listener only (`privateHttp`, 8082; `/v1/routines/occurrences/{admit,retire}` are `/v1/` paths
of control-route-boundary.mjs, never public). No new secret, key or IAM entry. Core wire C (`POST /api/clio/routines/unattended-grant`)
is called by BOTH the worker (before_admission, before_start, before_stop) and control (before_admission for each admission phase)
under the routines service secret (`x-internal-service-secret`); Core's route does not exist at 32cf3ca7 and is the packet's
Core-side dependency (the consent migration lifts `CHECK(unattended_enabled=false)`).

## 5. Readiness, observability, rollback

- Control readiness now also requires `meri_schedules.projections/intents/occurrences` and `meri_conversations.initial_run_bindings/initial_inputs`
  once the operations are composed (`ROUTINES_SCHEMA_UNAVAILABLE` otherwise); `runtime.routines.occurrences.unavailable` on stderr
  names the missing candidate owners (template, retirement) when declared without them.
- Worker: `RUNTIME_UNAVAILABLE` exit 3 at startup covers a missing pin/native/database and an unavailable owner (nothing was opened).
- Rollback: scale the schedule-worker service to 0 (no routine fires; control's operations stay mounted and idle); the role and
  grants are additive and can stay.
