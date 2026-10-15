# Migration allocation authority and pending retention requests

Read-only audit against `b5be44d5141ae5fd3830aed789cb7ad525506c4e`, tree `efc4b7bf87480d65fc4e6090c2a83b8e6d9dcf4d`. This report is separate from the contracts/worker provenance slice. It grants no reservation and authors or executes no SQL.

## Exact allocator and records

The central integration/release Codex owner retains allocation authority. The parent coordination thread assigning this audit is `01a0ff18-26cd-7609-beba-87726d0300c6`; this delegated Dot source owner has received metadata/candidate ownership and an allocation check, not transfer of central allocator authority.

Authoritative role assignments: [deployment plan](../../plans/MERI-DEPLOYMENT.md), section7's Integration and release row (line116) and central reservation instruction (line118); [continuation instructions](../../handover/20261011/CONTINUATION-INSTRUCTIONS.md), One integration owner (line9); root [AGENTS](../../../AGENTS.md), central allocation/one-owner rule (line19). Historical external-worker directions in those documents do not authorize new external delegation. Individual central task briefs record specific allocations; no consolidated authoritative reservation registry or later central reservation for the three pending IDs was found in the pinned repository.

Examples of explicit allocation records, unlike directory occupancy: `docs/coordination/tasks/CODEX-USABLE-REQUEST-BATCH-20261013.md` for conversations0001, `CODEX-DURABLE-SKILLS-20261013.md` for lifecycle0002, `CODEX-NATIVE-DOCX-FLOW-20261013.md` for SDK sessions0004/selected reads0005 and product budget0001, and `CODEX-ACTION-FOLLOWTHROUGH-20261013.md` for approval-metadata0001. Searches included coordination tasks/reports, handovers, deployment instructions and all migration source paths. This audit does not create a new parallel allocation authority.

## Collision and reservation disposition

| Namespace / source path | Pinned state and required decision |
| --- | --- |
| `meri_conversations`, `apps/control/conversations/migrations/0001`–`0008` | Existing occupied source IDs; historical task records contain feature allocations. Do not reuse. |
| `meri_conversations`, `apps/control/conversations/migrations/0009_next_runs.sql` | Occupied next-run/completion/range source; header says ID allocation to be confirmed by central owner. Central confirmation/reassignment remains pending. Do not edit/reuse for retention. |
| `meri_conversations`, proposed `apps/control/conversations/migrations/0010_retention.sql` | Retention V2 request only. No file collision or central reservation found at this pin. Not allocated. |
| `meri_artifacts`, `apps/artifacts/migrations/0001_versions.sql` | Existing occupied artifact source. Do not reuse. |
| `meri_artifacts`, proposed `apps/artifacts/migrations/0002_retention.sql` | Retention V2 request only. No file collision or central reservation found at this pin. Not allocated. |

Qualification proxy state0001–0003, SDK fixture state0001, schedules0001, task-lookup0001, commands0001, approval-metadata0001 and product budget0001 are distinct namespaces/owners, not reservations for the requested conversation/artifact IDs. Source directory presence establishes occupancy, not allocation or execution authority.

Evidence of pending0009: `FABLE-HANDOFF-TO-DOT-20261014.md` lines9,48–50,67 explicitly requests confirmation/reassignment; `DOT-HANDOFF-TO-FABLE-20261015.md` lines56,99 preserves its source-only/unallocated status. `FABLE-RETENTION-DELETION-PROPOSAL-V2-20261015.md` lines3,63 calls0009 already allocated without an accompanying central record; treat that assertion as unsupported and correct it in Fable's owned report. Its section5 requests, and explicitly does not take, product0010/artifact0002. Retention V1's0009 proposal collides with existing next-run source regardless of central reservation status.

Forwardable action for the parent integration owner: confirm/reassign conversations0009 and separately decide whether to reserve the exact conversation0010/artifact0002 paths above for Fable's policy-configured retention work. Before SQL authorship, record namespace, exact ID/path, purpose, author ownership and source-only limits in an explicit central task/allocation record, checking any newer concurrent reservations. This audit does not pre-empt that decision. A reservation would still not authorize product database execution; the trusted migration/shipping owner needs separate runtime binding and execution authority.

Independent read-only audit agreed on this disposition. No migration source, reservation, database, provider, credential, trust, image or cloud action occurred.
