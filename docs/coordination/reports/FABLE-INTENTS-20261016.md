# Fable lane report: governed conversational write requests (INTENTS)

- Branch `fable/live-intents-20261016`, base `fable/live-base-20261016` @ `48a27c8d` (package three plus round-four repairs; candidate manifest g).
- Scope: owner decision 1 of [FABLE-OWNER-DECISIONS-20261015.md](FABLE-OWNER-DECISIONS-20261015.md) (P10 `meri_intents`, approved 15 Oct 2026), §3 of [FABLE-GENERAL-READ-TOOLS-20261015.md](../proposals/FABLE-GENERAL-READ-TOOLS-20261015.md), the scope ledger's `INTENT-ROUTE` gate, and the audit's "all governed non-read paths" requirement (`dot/meri-comprehensive-audit-20261015` README, Reconciled outcome matrix row "Institutional sources, memory and skills"; PACKAGE3-REVIEW "governed non-reads remain required").
- Out of scope by instruction: the four advanced features (bridge, takeover, Office editor, authenticated sites), deployment, migrations, contracts, lockfiles, image recipe.
- Evidence is **synthetic**. No model/provider call, PostgreSQL, Temporal, S3, AWS, network or deployment was used.

## Implementation outline

| Responsibility | Owner | Module |
| --- | --- | --- |
| Model loop and tool calls | Claude Agent SDK `query` (unchanged, `activity.mjs`) | — |
| Intent tool surface (names, descriptions, correlation, closed results) | **new** worker server, separate from `meri_reads`, never `readOnlyHint` | `apps/worker/conversation/intents/{catalog,tools,server,results,prepared,runtime,options}.mjs` |
| Which intents a run may list | existing capability policy (new default-off flag `governedIntents`) ∧ intent catalog (owner-backed rows) ∧ port availability | `capabilities/policy.mjs`, `intents/runtime.mjs` |
| Preparation (immutable proposal / draft) and its current authority | existing canonical owners: `commands/tool-interface.mjs` + task.create approval-metadata owner; `schedules/tool-interface.mjs`; artifact write owner (`createPostgresArtifactService`) | thin preparers `apps/control/intents/{command,schedule,document}-preparer.mjs` |
| Delivery replay / UNKNOWN | **new** control journal over a store port | `apps/control/intents/journal.mjs` |
| Port the worker calls | **new** control mount | `apps/control/intents/mount.mjs` |
| Approval and execution | existing: command executor (approval guard, fresh `command.execute` authority, journal), action-application execute route, schedule approved execution, artifact filing | unchanged |

Dependency direction: worker server → port (trusted composition) → control mount → preparer → canonical owner. The worker imports nothing from control at run time (tests only). No second authorization system: the mount and worker only refuse; every grant decision stays with the owners. No direct canonical-memory write (the three memory writes stay excluded; `save_memory` would use `memory.propose` and is unavailable today, see below). No second model loop.

## What was built

1. **`meri_intents` server (worker).** One tool per ledger intent name (`request_document`, `propose_schedule`, `propose_schedule_change`, `propose_task`, …) whose `operation` selects among that tool's available capabilities. Annotations `readOnlyHint:false, destructiveHint:false, idempotentHint:true, openWorldHint:false`. Descriptions derive from catalog descriptors and say the tool never applies a change. PreToolUse correlation as in `meri_reads` (event, tool-use ID, pinned session, new tool use, per-run ceiling of 8, one-time token bound to operation and argument hash). Delivery identity `sdk:sha256({tenantId, actorId, conversationId, sessionId, toolUseId, server})`: it omits run and attempt, so the same tool use replayed by a later attempt or a resumed session reaches the journal under the same identity; a fork (new session) is a new request. Results: the owner's prepared value plus a fixed "nothing has been changed; the user must approve" block, or one closed error text. A deadline or cancellation after the port call started is reported as **UNKNOWN**, recorded in the receipts, never retried.
2. **Intent catalog.** Exactly the 11 selected non-read capabilities the ledger routes through `INTENT-ROUTE`, reconciled with `scope-ledger.json` by a test:

   | Capability | Intent tool | Status |
   | --- | --- | --- |
   | `create_word`, `create_excel` | `request_document` | owner-backed: immutable draft via the artifact write owner (formats the document application admits) |
   | `schedule_task`, `update_scheduled_task`, `cancel_scheduled_task` | `propose_schedule`, `propose_schedule_change` | owner-backed preparer; **needs the trusted schedule-context owner (P-INT-6)**, which does not exist yet, so no composition can offer them today |
   | `create_task` | `propose_task` | owner-backed: command interface + task.create approval-metadata owner |
   | `create_powerpoint` | `request_document` | unavailable — ROUTE_GAP (document application admits only Word/Excel; DA-3, ARTIFACT-ADMISSION) |
   | `run_analysis` | `request_analysis` | unavailable — ROUTE_GAP (no governed analysis route; ANALYSIS-SANDBOX) |
   | `update_task` | `propose_task_update` | unavailable — OWNER_MISSING (no task.update proposal owner) |
   | `save_memory` | `propose_memory` | unavailable — OWNER_MISSING (no memory.propose proposal owner; MEMORY-PRODUCER for personal scope) |
   | `save_chat_attachments` | `propose_attachment_filing` | unavailable — OWNER_MISSING (no artifact.file proposal owner) |

   `list_scheduled_tasks` (also routed to `meri_intents` by the ledger) is a read; it is listed in `NOT_INTENTS` with its reason and never registered (P-INT-5). Unavailable rows are never registered, whatever the port offers.
3. **Control mount and journal.** `createIntentMount({binding, preparers, journalStore, now, limits, enabled})`, inert, default disabled; refuses foreign-binding preparers, unsupported owner kinds and duplicates. Each delivery is claimed before the owner is called and settled only on evidence: PREPARED replays the retained result, FAILED (owner refused before any effect) replays the refusal, PENDING/UNKNOWN answers UNKNOWN, changed content is CONFLICT. A lost claim acknowledgement prepares nothing (UNAVAILABLE) and later answers UNKNOWN; a lost settle acknowledgement withholds the result as UNKNOWN, and the retained result is the later replay answer. Nothing retries, deletes or redispatches.
4. **Preparers.** Command: builds a prepare-only interface per call whose executor and metadata read refuse; classifies effect `none` only before the metadata owner was reached or on its `NOT_STORED`. Schedule: refuses any context that already carries an approval, or a caller other than the run actor. Document: validates with `artifactValidators.request` and the document application's format admission before the owner; after the call any failure is UNKNOWN (the artifact owner's own delivery replay applies).
5. **Wiring.** `buildConversationOptions(…, readOptions, intentOptions)` merges the server beside `meri_reads` (servers by name, union of exact names, hooks by event, chained permissions, collision refused) and adds one prompt sentence only while mounted. `createConversationActivity({…, governedIntents})` builds the runtime only when the policy flag is on; the runtime is closed with the run.

Approval and effect stay with the existing controls: the command proposal becomes effective only through `executeApproved` (approval guard against the current decision for the exact `commandSha256`, fresh `command.execute` authority before effect, at effect, release and settlement), which the action-application execute route already exposes. Documents need no approval for an immutable draft; filing is separate.

## Audit and review items addressed

| Item | Result |
| --- | --- |
| Ledger `INTENT-ROUTE` (12 rows) | **Source path built** for the 6 owner-backed rows (3 of them waiting on P-INT-6); 5 rows explicitly unavailable with reasons; 1 read row redirected (P-INT-5). Gate stays open: composition, transport and live qualification remain. |
| Audit matrix "all governed non-read paths" / PACKAGE3 "governed non-reads remain required" | Conversational parity path exists for `create_task`, `create_word`, `create_excel` (and schedules once P-INT-6 exists), not just an HTTP button. Partial: see unavailable rows. |
| P10 requirements: prepare-only, approval before effect, fresh authority, UNKNOWN and replay, never `readOnlyHint`, no direct memory writes | Built and tested (below). |

## Files

New: `apps/control/intents/{mount,journal,faults,command-preparer,schedule-preparer,document-preparer}.mjs`, `apps/control/intents/test/{fixture,mount.test,schedule-preparer.test,document-preparer.test}.mjs`, `apps/worker/conversation/intents/{catalog,tools,server,results,prepared,runtime,options}.mjs`, `apps/worker/conversation/intents/test/{fixture,intents.test,catalog.test,options.test}.mjs`, `docs/coordination/proposals/FABLE-INTENTS-PROPOSALS-20261016.md`, this report.

Changed: `apps/worker/conversation/{activity,options}.mjs`, `apps/worker/conversation/capabilities/policy.mjs` (flag), `apps/worker/conversation/test/capabilities.test.mjs` (default policy now includes `governedIntents:false`; `{governedIntents:'yes'}` refused), `apps/worker/conversation/test/legacy-tools-excluded.test.mjs` (scans the intent surface; one new test), `scripts/qualification/local-baseline/dependency-ownership.test.mjs` (two reviewed entries for `zod`/MCP SDK, same reason as the reads modules).

No contract, UIEvent, Run contract, lockfile, migration directory, Dockerfile or candidate manifest changed. **No file hashed by the assembled-image source proof changed** (`source-proof.test.mjs` 5/5).

## Tests

Node v24.22.0, root user, `MERI_REVIEW_SOURCE_ROOT=$PWD`, dependencies installed with `npm ci --ignore-scripts --no-audit --no-fund` per the clean-checkout lock list. All synthetic.

| Command | Base `48a27c8d` | Final |
| --- | --- | --- |
| every `apps/worker/conversation/**/*.test.mjs` except `intents/` (26 files, `--experimental-test-module-mocks`) | 266/266 | 266/266 |
| plus `apps/worker/conversation/intents/test/*.test.mjs` | — | 283/283 (+16 intent tests, +1 guard test) |
| `apps/control/test/commands-*.test.mjs`, approval-metadata tests, `schedule-tool-interface.test.mjs`, `action-application/*.test.mjs` | 324/324 | 324/324 |
| plus `apps/control/intents/test/*.test.mjs` (`MERI_DOCUMENT_PYTHON=$(command -v python3)`) | — | 345/345 (+21) |
| `legacy-tools-excluded.test.mjs` (43-name guard) | 6/6 | 7/7 |
| `scripts/scope-ledger/ledger.test.mjs` | 15/15 | 15/15 |
| `scripts/general-reads/inventory.test.mjs`; `cli.mjs --check` | 11/11; exit 0 | 11/11; exit 0 |
| `scripts/qualification/local-baseline/dependency-ownership.test.mjs` | 1/1 | 1/1 (failed 0/1 before the two review entries were added: it caught the new `zod`/MCP SDK imports) |
| `scripts/qualification/assembled-image/source-proof.test.mjs` | 5/5 | 5/5 |
| Dependent control/runtime files that import `activity.mjs`/`options.mjs` (13 files + skills pipeline) | 8/30 | 8/30, identical failure names (host: no Docker daemon, no PostgreSQL sockets, root UID, Codex-host Python) |

Required cases (all synthetic):

- **Prepare-only:** proposal returned, zero source fetches, zero command-journal claims, zero budget reservations; exactly one pending metadata row; journal PREPARED (control `mount.test`, worker `intents.test`).
- **Approval required before effect:** unapproved, other-content approval and revoked approval all refused with zero fetches; approved → `observed`, one fetch; repeat → same result, no second effect.
- **Authority revoked between prepare and approve:** revoked capability and a stale writer fence both refused with zero fetches/reservations; preparation itself rechecks current policy (refusal prepares nothing and replays).
- **Replay/idempotency:** same delivery → identical proposal, one owner call; changed content → CONFLICT; same tool use from a second runtime (later attempt / resumed session) → same proposal; run/attempt do not change the delivery, tenant/actor/conversation/session do. Documents: same delivery → the artifact owner's replay, one generation.
- **UNKNOWN after a lost acknowledgement:** metadata stored then lost ACK → UNKNOWN, recorded, replay UNKNOWN, one owner call; lost claim ACK → nothing prepared, later UNKNOWN; lost settle ACK → UNKNOWN, then retained result; owner still running at the deadline → UNKNOWN; worker-side deadline after the port call started → UNKNOWN.
- **Cross-tenant denial:** foreign-binding preparer refused at mount construction; same delivery ID in another tenant is not a replay; argument-borne authority refused before the owner; foreign availability snapshot mounts nothing; foreign-tenant, same-tenant foreign-actor and foreign-conversation results withheld; schedule caller other than the run actor refused.
- **Exclusion guard:** 43 names absent from the intent surface (tool names, operations, `NOT_INTENTS`), deferred names offered by a port are never registered and refused by the mount.

Reverted-fix proofs (guard removed → named file fails; restored → passes):

| Guard | Reverted | Restored |
| --- | --- | --- |
| R1 schedule preparer refuses an approval-bearing context | 6/7 | 7/7 |
| R2 mount returns the replay instead of re-preparing | 8/10 | 10/10 |
| R2b journal answers an existing entry | 5/10 | 10/10 |
| R3 post-call failure stays UNKNOWN | 8/10 | 10/10 |
| R4 `readOnlyHint:false` | 9/10 | 10/10 |
| R5 mount refuses a foreign-binding preparer | 9/10 | 10/10 |
| R5b worker withholds a foreign actor/conversation result (first attempt did not isolate the check: the canonical integrity check already blocks cross-tenant approval; same-tenant foreign actor/conversation cases were added) | 9/10 | 10/10 |
| R6 unavailable catalog rows never registered | 9/10 | 10/10 |
| R7 deadline after the port call is UNKNOWN | 9/10 | 10/10 |
| R8 an applied/executed result is withheld | 9/10 | 10/10 |

Test-side fixes during development (no product change): a late-attached rejection, deterministic IDs shared by two synthetic compositions, a reused tool-use ID, a frozen result mutated in a test, a deep-equality on option closures, and excluded names written as literals in new tests (the scope-ledger scan flagged it; the tests now derive them from the catalog's deferred originals).

## Unrun checks and why

- Real SDK `query` with a model choosing the intent tools: no model/provider call is authorized. The in-memory MCP client models tool listing and calls; the SDK's native PreToolUse delivery is modelled by invoking the hook.
- Real PostgreSQL journal store and approval-metadata table: no migration ID allocated (P-INT-M1); the metadata owner runs on its existing scripted pool fixture.
- Control ↔ task transport and production startup composition (P-INT-9): not built; no composition supplies the port, so nothing is live.
- Schedule intents end to end: the trusted schedule-context owner does not exist (P-INT-6); tests use the contract fixture's resolved context with a recording lifecycle stub. Temporal unrun.
- Native DOCX/XLSX: the document test uses the synthetic-local store and the TXT format; native Office qualification is ARTIFACT-NATIVE. That file needs `MERI_DOCUMENT_PYTHON` (or the Codex-host Python path), like the existing document suites.
- Desktop approval card from a conversation: needs event admission (P-INT-8).

## Proposals for dot

P-INT-1 result shapes, P-INT-2 availability facts, P-INT-3 policy flag and prompt sentence, P-INT-4 per-run ceiling, P-INT-5 `list_scheduled_tasks` read route, P-INT-6 schedule-context/proposal owner, P-INT-7 metadata owners for task.update/memory.propose/artifact.file, P-INT-8 surfacing prepared proposals, P-INT-9 composition/transport, P-INT-M1 journal table SQL. Exact text: [FABLE-INTENTS-PROPOSALS-20261016.md](../proposals/FABLE-INTENTS-PROPOSALS-20261016.md).

## Residual risks

- Concurrent duplicate deliveries: the second concurrent call sees PENDING and answers UNKNOWN even if the first then succeeds; a later replay returns the result. Conservative by design.
- The journal's PENDING/UNKNOWN entries have no reconciler: an UNKNOWN delivery stays UNKNOWN. The owners' own records (metadata row, artifact delivery) are the evidence a future reconciler would read; none is built here.
- A command proposal stored by the metadata owner but not released (UNKNOWN) is a pending proposal without an approval card until P-INT-8.
- Availability is a 30-second listing fact; a revoked grant is caught by the owner at preparation and at execution, not by the listing.
- The document preparer trusts the composition to bind the artifact write port to current authority and the right credential, as the document application does today.
