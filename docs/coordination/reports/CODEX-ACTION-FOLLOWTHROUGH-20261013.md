# Recommendation follow-through and task evaluation execution

**ACCEPT_SOURCE; runtime HOLD.** Integrated source `d8e86c2b49f91e22a6a6868fce4ba0ca6e707328` passed **514/514** local checks, including independent reviews and the composed user workflow. This continuation stacks on PR40 `cacbe543941db52cc8dcf085bf96c1919e8c155f`; it does not activate production operations or close G1.

## Implemented product outcome

A caller can select a retained recommendation, inspect and explicitly edit its task title/due date, then prepare an immutable task proposal through the existing command interface. Viewing, drafting and preparing do not create a task. The existing separate approval guard and command executor continue to own approval and mutation. A root composition test subsequently supplies an explicit synthetic approval, observes one task effect through the existing executor and verifies that replay does not repeat the effect.

`apps/control/action-followthrough/selection.mjs` validates selection, editable fields and retained evidence correlation. `index.mjs` composes the canonical retained-result read and command interface under one finite lifetime. Current reader and command producer bindings must agree; the selected client comes from trusted configuration. Defaults come from the retained title and deadline, without silent truncation, rounding or owner assignment. Same-run task-attempt A-to-B recovery is supported; cross-run/fork reuse is outside this slice.

The recommendation wrapper is supporting retained evidence, not approval-bound provenance or a durable source-to-task relationship: the unchanged command hash binds task fields. Reading a retained result is not a live source refresh. Each explicit preparation can allocate a new proposal because the existing interface has no stable caller intent key. Unknown or late outcomes do not authorize automatic retries.

The missing concrete approval metadata producer is now implemented in `apps/control/commands/approval-metadata/`. Its small entry point composes binding validation, policy-governed immutable metadata ownership and a PostgreSQL adapter. The trusted preparation-policy callback supplies existing scope, approver and expiry decisions; this source does not invent approval policy or issue approval decisions. Fresh policy is required before preparation/release/read. Immutable records are inserted/read through the borrowed pool; submitted uncertainty remains `UNKNOWN`, and a known stored record withheld by release policy remains `STORED_NOT_RELEASED`. Neither outcome creates a task or proves rollback. The allocated migration is source only and has not been applied.

`evals/task-lookup/execution/` implements the evaluator's observation producer. Admission validates independently pinned gold-free projections, all three splits and explicit host run bindings. Execution invokes actual task lookup/read composition, records current-authority callbacks and failures, binds traces by hash and supplies the unchanged scorer. Unsupported, failed, denied and cancelled cases retain their denominators. Only typed `correct-tool` replay executes; `original` and `correct-evidence` remain explicitly ineligible. This is not prompt routing, an SDK model run or evidence of real-user quality. Qualified real requests remain **0**.

These are nine new production files including one SQL migration, with separate workflow, binding, metadata ownership, infrastructure and evaluation responsibilities. Existing contracts, source owners, registry, tests and lockfiles are unchanged. No frontend code was edited.

## Independent acceptance

| Component | Accepted production source | Independent review commit | Focused result |
| --- | --- | --- | --- |
| Recommendation workflow | `0715c71025a72312917c7cc0714951be814f7ae3` | `968c64b9e4228506d467055e6f9188edac369190` | 25 author + 30 independent pass |
| Approval metadata owner/store | `924979b527b1b8c7f3f7883ceddd2cf78eebd63f` | `f139463d8e27822421e269bb00ac5816b35a6776` | 25 author + 51 independent pass |
| Typed evaluation execution | `33a0d21b005d32d9c27de5f3a7939b77588921db` | `7306b55f49445c4cfe29f0f04bad94cbfe059d9c` | 25 author + 43 independent pass |

All three authors and reviewers used exclusive paths. Root integrated only accepted production freezes and their reviewed evidence. Independent reviews retain the original defects, negative controls, fixture preimages, raw failed output and repair reasons. The root audit verifies that all nine production files exactly equal these accepted source pins, all **10,183/10,183** tracked PR40 entries retain their original mode/blob and all **154** members of the six component evidence manifests match their byte counts and hashes.

## Root checks and preserved failures

Evidence lives in [`action-followthrough-20261013/integration`](../../qualification/candidates/action-followthrough-20261013/integration/). Every capture records exact command, source, raw stream hashes, bounded process group and cleanup observation.

| Check | Result | Actual scope |
| --- | --- | --- |
| Composed workflow | 3/3 pass | Actual workflow, metadata owner/store and existing command executor; inert policy/SQL/HTTP ports |
| Official `pg@8.23.1` compatibility | Pass | Actual Pool construction with canonical 5000/6000 timeout configuration; zero connections/SQL; empty owned pool closed |
| Initial combined run | 437 pass / 3 loader failures | One original tracked fixture omitted by sparse checkout; no behavioral assertion failed |
| Identical combined command after exact fixture restoration | **514/514 pass**, no skips/cancellations | 22 new/consumed workflow, metadata, lookup, command, contract and evaluation modules; 61.507 seconds |
| Original-entry and source/packet audit | Pass | 10,183 preserved entries, nine exact reviewed production files, six manifests/154 members |

The omitted fixture was `docs/qualification/candidates/vertical-source-20261012/command-tool-review/fixture.mjs`. It was materialized directly from Git, without source or assertion edits. `combined.*` preserves the failed capture; `sparse-fixture-restoration.json` records the correction; `combined-restored.*` preserves the successful replay. Its tested source is `d8e86c2b49f91e22a6a6868fce4ba0ca6e707328`, with zero source diff and stdout SHA256 `07731cb2a0df8a95b3b2ae9b165c273f26792216d37e7b32c8cb1fcf0f93a942`.

The root composition also verifies that a preparation-policy denial stores nothing and causes no task effect; revocation after insertion retains a withheld metadata record with no task effect. This distinguishes storage outcome from approval and mutation authority.

The earlier 694/694 original-suite evidence remains at `docs/qualification/candidates/task-slice-20261012/integration/consolidated-final-pr39.json`; it was not rerun or reattributed to this source. PR40's prior 131/131 evidence is also preserved. Authored source whitespace checks pass. Raw failure streams with original assertion whitespace remain byte-for-byte evidence.

Official driver materialization used the unchanged canonical manifests, official npm registry, disabled scripts/audit and no new credentials. All 14 installed versions match the existing lock. The materialized directory `/tmp/meri-pg-8.23.1-action-followthrough-20261013` is intentionally retained for the existing owner; no other checkout was silently linked to it. The [portable driver handoff](../../qualification/candidates/action-followthrough-20261013/integration/PG-DRIVER-HANDOFF.md) explains reproduction from published manifests. Driver availability does not admit SQL execution.

## Portable integration contracts and activation prerequisites

- Workflow API and binding/expiry semantics: [author handoff](CODEX-ACTION-FOLLOWTHROUGH-WORKFLOW-20261013.md) and [independent review](CODEX-ACTION-FOLLOWTHROUGH-WORKFLOW-REVIEW-20261013.md). Wire the implemented `createActionFollowthrough` to the existing application owner and current-authorized retained reads; no route or UI was activated here.
- Metadata API, preparation-policy receipt and borrowed-pool ownership: [author handoff](CODEX-ACTION-FOLLOWTHROUGH-METADATA-20261013.md) and [independent review](CODEX-ACTION-FOLLOWTHROUGH-METADATA-REVIEW-20261013.md). Current identity/policy/approval brokers and real PostgreSQL validation of the new schema/store remain necessary. The schema was not installed.
- Evaluation API and exact execution limitations: [execution README](../../../evals/task-lookup/execution/README.md) and [independent review](CODEX-ACTION-FOLLOWTHROUGH-EVAL-REVIEW-20261013.md). Approved real corpus/gold, current source and runtime ports, independent adjudication and separate SDK routing/model measurements remain necessary. Synthetic typed replay cannot close the original reliability, quality or isolation gates.
- PR40's six real PostgreSQL cases have already been relayed to the native owner with its existing isolated fixture. Native evidence is an independent workstream; this report introduces no duplicate fixture approval gate and makes no claim about results not returned here.

Public 0.1/private 0.2 separation and the canonical ledger remain intact: **139 original capabilities, 96 selected and 43 deferred**. All **97** current operation descriptors remain unimplemented/pending, with null handlers and zero retries. This operational count does not redefine the original capability denominator. G0 remains accepted; **G1 remains OPEN**, G2–G7 unentered.

No database connection, SQL execution, migration installation, cloud image/resource/security/network change, customer access, provider/model call, infrastructure spend or main merge occurred here. Existing Aurora selection and separate native/frontend ownership are unchanged. Claude Agent SDK, Temporal, AI SDK/Elements and governed proxy responsibilities remain as adopted in R2. No legacy Capiro implementation or host artifact skill was copied. Root cleanup is recorded in `cleanup.json`; source, original branches, failures and other owners' resources are preserved.
