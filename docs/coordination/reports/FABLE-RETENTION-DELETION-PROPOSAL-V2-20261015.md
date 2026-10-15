# Retention and deletion, revision 2: design for dot (approval gate before code)

Base `215930c8092577e84da563b1496d1cca9a4ad4d7` (dot's handoff pin). Author: Fable. Status: PROPOSAL, no code, no migration source, no schema allocation taken. Supersedes [revision 1](FABLE-RETENTION-DELETION-PROPOSAL-20261014.md), which dot held on 15 October with four defects: it did not distinguish immediate access removal from permanent deletion, it did not handle versioned S3 objects or restored backups, it reused migration `0009` (now allocated to next runs), and it lacked a reference inventory and explicit owner decisions. Each defect has a section below. Nothing here is executed against a product database or bucket by Fable.

## 1. Two operations, not one: suppression and purge

Revision 1 collapsed "delete" into one tombstone. The product needs two distinct, separately journaled operations:

| | Suppression (immediate access removal) | Purge (permanent deletion) |
|---|---|---|
| Trigger | tenant or owner request, policy breach, revocation, legal hold release | retention period elapsed after suppression, or explicit purge order |
| Effect | every read, replay, restore, listing and continuation of the record is refused with one closed code (`RETENTION_SUPPRESSED`) from the moment the journal row commits | bytes are destroyed: exact object versions deleted, SQL rows removed, backups reconciled |
| Reversible | yes, by the same owner with a receipt (`RELEASED`), unless a purge has started | no |
| Latency | one transaction | a journaled multi-step effect with UNKNOWN handling |
| What it does not do | touch bytes, backups or object versions | run without a committed suppression first |

A purge is only admitted over a record that is already suppressed and whose suppression is older than the configured cooling period; a purge never starts from a live record. This gives the product a safe immediate answer to "remove this now" that cannot destroy data by mistake, and a slow destructive answer that is always preceded by the fast one.

## 2. Reference inventory (what a conversation record is)

Every table below holds bytes or references that a suppression must cover and a purge must destroy or reconcile. The inventory is from the migrations at the pin (`apps/control/conversations/migrations/0001` to `0009`, `apps/artifacts/migrations/0001`); nothing else holds product data.

| Class | Table or store | References held | Suppression effect | Purge effect |
|---|---|---|---|---|
| Conversation and runs | `conversations`, `runs` | run projection, request, continuation envelope (checkpoint and source request bytes) | reads refused; `accept`, lifecycle `begin` and next-run `reserve` refused | rows removed last, after every dependent class |
| Events | `events` | transcript events, checkpoint receipts | listing and reconnect refused | rows removed |
| Lifecycle controls and checkpoints | `controls`, `checkpoints` | checkpoint proofs with `opaqueSession` object id and version id and workspace entries with object ids and version ids | restore (`restorer`) refused by the tombstone check added to `execution()` | rows removed; referenced object versions purged (section 3) |
| Completion checkpoints | `completion_checkpoints` (0009) | completion proof with the same object references | completion readback and next-run selection refused | rows removed; object versions purged |
| Next runs | `next_runs` (0009) | reservation lineage to the completion checkpoint | `reserve`, `selectRun`, `currentRun` refused | rows removed |
| SDK session mirror | `sdk_sessions`, `sdk_session_streams`, `sdk_session_entries`, `sdk_session_batches` | session transcript bytes (immutability triggers) | `runner/session/load` and `list-subkeys` refused | rows removed under the trigger amendment |
| Selected outputs and reads | `selected_outputs`, `selected_reads` | artifact or skill output references and read receipts | replay and retained reads refused | rows removed |
| Native journals | `native_executions`, `native_allocations`, `native_restorations`, prepared-launch columns | allocation, restoration and launch facts; no object bytes | claims refused for the conversation | rows removed after any UNKNOWN liability is resolved by its owner |
| Artifact versions and objects | `meri_artifacts.versions`, `heads`, S3 immutable versions | object id, exact version id, sha256 | version reads and head resolution refused; signed delivery refused | exact object versions deleted, rows removed |
| Uploads and previews | artifact objects under their prefixes | same | same | same |
| Workspaces and browser state | task-local filesystems | none durable | already ephemeral per task; a suppressed conversation cannot launch a task | nothing to purge |
| Telemetry and logs | log groups (shipping owner) | conversation and run ids, never transcript bytes | not suppressed (identifiers only) | retention is the log group's own policy, owner decision 6 |
| Backups | database snapshots and bucket versioning (shipping owner) | everything above | not reachable by product reads | reconciliation after any restore (section 4) |

A suppression is one row per tenant and conversation (or artifact) in a new `meri_conversations.retention` journal; the per-class effects are enforced by one check in each existing owner's canonical read path, under the existing conversation lock, not by per-row flags.

## 3. Versioned objects: exact-version deletion, no delete markers

The S3 adapter writes immutable versions and reads by exact version id. A delete marker (an unversioned `DeleteObject`) would hide the current version and leave every historical version in place, so revision 1's "versioned delete markers" was wrong. The purge must:

1. Enumerate the exact version ids held by the record (from the checkpoint proofs, completion checkpoints and artifact rows in the inventory), never by listing the prefix.
2. Issue `DeleteObjectVersion` per exact `objectId` and `versionId` through the borrowed client under the KMS key, and record each response (version id, delete marker flag, request id) in the purge receipt.
3. Read back each version (`HeadObject` with the version id) and require the closed `NoSuchVersion` outcome before the purge row moves to `EXECUTED`; a timeout or any other outcome leaves the row `UNKNOWN` and the next sweep reads back before retrying.
4. Treat bucket object lock and legal hold as owner inputs: a version under retention lock makes the purge `BLOCKED` with the lock expiry in the receipt; the product never attempts to lift a lock.

The deletion role needs `s3:DeleteObjectVersion` on the product prefix only, listed in the W03 packet when approved; it does not need `s3:DeleteObject`, `s3:PutBucketVersioning` or any lock permission.

## 4. Backups and restores: rollback-safe reconciliation

A database restore or a bucket point-in-time restore can revive rows and versions that were suppressed or purged after the backup point. The journal is the source of truth, so:

1. The retention journal is written in the same database as the records it governs and is itself never purged; a purge row is retained with its receipt forever (it holds identifiers and hashes, not bytes).
2. After any restore, before any route is enabled, the shipping owner runs the reconciliation workflow: it reads every `SUPPRESSED`, `PURGING`, `UNKNOWN` and `EXECUTED` row and re-applies the effect, re-issuing exact-version deletes for `EXECUTED` purges whose versions reappear and re-asserting suppression for `SUPPRESSED` rows.
3. If the restore point precedes the journal row itself (the row is gone), the reconciliation reads the retained purge receipts published to the evidence bucket (write-once, versioned, outside the restored scope) and re-inserts the rows before re-applying them. This is the rollback-safe part: a restore can never silently un-suppress or un-purge.
4. Revoked access is never restored by a backup because authority is read from the current grant and context, not from the backup; this is already true at the pin and stays an acceptance control.

## 5. Migrations: fresh allocation, nothing reused

Migration `0009` is allocated to next runs (completion checkpoints and sequence ranges). This proposal requests, and does not take, two fresh allocations from the central owner:

- `meri_conversations` `0010_retention.sql`: the `retention` journal (tenant, conversation or artifact id, class set, state `SUPPRESSED | RELEASED | PURGING | UNKNOWN | BLOCKED | EXECUTED`, policy id, cooling deadline, receipt hash, hashes of the enumerated references) and the trigger amendment that admits a delete on the immutable tables only inside a transaction that holds a matching `PURGING` row.
- `meri_artifacts` `0002_retention.sql`: the same journal shape for artifacts and the trigger amendment on `versions`.

No product or Temporal migration is executed by Fable; source only, after allocation.

## 6. Owner decisions required before any source is written

1. Cooling period between suppression and purge (product and legal).
2. Retention periods per class, as plain configuration with a policy id (product and legal).
3. Whether a tenant-initiated suppression is self-service or owner-mediated (product).
4. Evidence-bucket publication of purge receipts (shipping): bucket, prefix, write-once policy.
5. Object lock and legal hold posture of the product bucket (shipping).
6. Log group retention and whether conversation identifiers in logs are in scope (shipping and legal).
7. Migration allocations `0010` and artifacts `0002` (central owner).
8. Schedule ownership: sweeps as Temporal schedules under the existing schedules owner, one deterministic workflow per class (dot).

## 7. Acceptance list (controls before any ACCEPT)

- Suppression refuses every read, replay, restore, continuation, reservation and claim in the inventory with the closed code, in the same transaction order as the owning journal.
- Purge is refused over a live record and over a suppression younger than the cooling period.
- Purge deletes exact versions only, reads back `NoSuchVersion`, and leaves `UNKNOWN` on any other outcome; a delete marker in a response fails the purge.
- UNKNOWN liabilities in the native journals block purge until resolved by their owner.
- Reconciliation after a simulated restore re-applies suppression and purge, including the case where the journal row itself is gone.
- Cross-tenant isolation of sweeps and of the journal.
- One real-bucket run by the shipping owner for the versioned delete and readback; local controls through the injected S3 handler as in `s3.test.mjs`.
- The §10 retention and deletion row of the evidence matrix.

## 8. Decision requested

Dot records ACCEPT, HOLD or edits on sections 1 to 7. On ACCEPT and allocation, Fable writes the journal, the per-owner suppression checks, the adapter surface and the controls as bounded slices with receipts.
