# Retention and deletion: design proposal for dot (approval gate before code)

Base `c6053e24b465be677cc5980533009b4aab03beab` (PR86). Author: Fable. Status: PROPOSAL, no code, no migration source, no schema allocation requested yet. HANDOFF §8 and §10 require retention and deletion across transcripts, events, uploads, browser state, workspaces, previews, artifacts, telemetry and backups, and require that an authorized restore cannot revive revoked or deleted access. The §8 coverage map found no owner, control or surface for this at PR86. This proposal records the shape before any source is written, as the handoff requires for an architecture or scope change.

## 1. What exists at PR86

- Immutability is enforced in SQL: `meri_conversations.sdk_session_entries` and `sdk_session_batches` carry `BEFORE UPDATE OR DELETE` triggers that reject mutation; `meri_artifacts.versions` carries the same; the native allocation and execution tables preserve identity on update. Conversation `events` and `runs` have no trigger but are read with checksums that refuse corruption or holes.
- The S3 adapter (`apps/artifacts/storage/s3-objects.mjs`) issues only immutable-version put, head and get commands; it has no delete, no retention and no object-lock surface.
- Owned filesystem cleanup exists per task: output workspaces, LibreOffice profiles and task directories are removed by their owners on failure or close; the supervisor workspace is per task.
- Replay and inspection owners deny release on revoked current authority but keep historical accounting readable ("current revocation denies replay and retained reads while historical accounting remains available", `document-replay.test.mjs`).

So today nothing is ever deleted from the product schemas or the object store, by design, and nothing can be: a retention policy needs new owners, new tables and a new adapter surface, and the immutability triggers must stay in force for everything a policy does not explicitly tombstone.

## 2. Proposed shape (reusing existing owners)

1. Data classes and their canonical owners. Transcripts and events (`meri_conversations.runs`, `events`), SDK session mirrors (`sdk_sessions`, `sdk_session_entries`, `sdk_session_batches`), checkpoints and restorations (native journals plus S3 immutable versions), artifact versions and objects (`meri_artifacts.versions` plus S3), uploads and previews (artifact objects under their own prefixes), workspaces and browser state (task-local filesystems, already ephemeral per task), telemetry (log groups, owned by shipping), backups (database and bucket backups, owned by shipping). Each class gets exactly one deletion owner; none is deleted by a worker.
2. Tombstones instead of row deletion. A new `meri_conversations.retention` journal (one row per data class and conversation or artifact, with policy id, due time, decision, receipt hash) and a `meri_artifacts.tombstones` table record the decision first; physical deletion follows only from a committed tombstone, the same two-phase pattern the allocation and launch journals use. Rows with an UNKNOWN liability (uncertain budget settlement, parked completion acknowledgement, UNKNOWN launch or restoration) are never tombstoned until the liability is resolved by its own owner.
3. Physical deletion as a journaled effect. Object deletion uses versioned delete markers through the borrowed S3 client under the KMS key, recorded with the exact version id in the tombstone receipt; SQL rows are removed by the deletion owner inside the same transaction that marks the tombstone `EXECUTED`, with the immutability triggers extended to admit a delete only when a matching `EXECUTED` tombstone exists in the same transaction. Lost acknowledgements leave the tombstone `UNKNOWN` and the next sweep reads back before retrying, never re-deleting blindly.
4. Scheduling. Sweeps run as a Temporal schedule through the existing schedules owner (`apps/control/schedules`), one deterministic workflow per data class, with the same lock and uncertainty handling the schedule lifecycle controls already prove ("actual PostgreSQL composition prevents second dispatch of same intent").
5. Restore cannot revive access. Every restore path (checkpoint restoration, document replay, history reconnect) already rechecks current authority; the proposal adds one check: the target's tombstone state. A restore of a tombstoned or executed-deleted record is refused with a closed code, and backups restored by shipping are followed by a reconciliation sweep that re-applies executed tombstones before any route is enabled. Revoked access is never restored by a backup because authority is read from the current grant and context, not from the backup.
6. Policy values. Retention periods per class are owner inputs (product and legal), recorded in configuration as plain data with a policy id; the code admits only the fixed set of classes and refuses unknown ones.

## 3. What this changes and what it needs

- New migrations: `meri_conversations` 0009 (retention journal and trigger amendment) and `meri_artifacts` 0002 (tombstones and trigger amendment). Migration source needs central allocation before it is written (HANDOFF §9), and execution needs the trusted migration owner.
- New S3 adapter surface: versioned delete with receipt, behind the same borrowed-client and immutable-version conventions as put/head/get; `s3.test.mjs`-style controls through the injected handler, one real-bucket run by shipping.
- New schedule workflows and one deletion owner per class in `apps/control`; no new service, no new credential; the deletion role needs `s3:DeleteObjectVersion` on the prefix only, added to the W03 packet when approved.
- Controls to add before acceptance: tombstone before delete, UNKNOWN liability blocks tombstone, lost-ACK sweep readback, restore refusal on tombstone, backup reconciliation, cross-tenant isolation of sweeps, and the §10 retention/deletion row of the evidence matrix.

## 4. Decision requested

Dot records ACCEPT, HOLD or edits on the shape above. On ACCEPT, Fable requests the migration allocations and writes the journals, owners, adapter surface and controls as bounded slices with receipts; nothing is executed against a product database or bucket by Fable.
