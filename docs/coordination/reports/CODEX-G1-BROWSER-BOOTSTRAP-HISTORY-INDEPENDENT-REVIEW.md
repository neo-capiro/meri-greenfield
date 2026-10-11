# Independent bootstrap managed-history source review

Subject `2bc914e7fc159784310709a94d276e4bf0c8ef04`, direct parent
`8586f6279eac5a43132d4df3a7dbb6962c808009`. This reviewer did not author the
candidate. Dedicated review worktree:
`C:/dev/main/meri-greenfield-worktrees/g1-browser-bootstrap-history-review`,
branch `review/browser-bootstrap-history`. Only this report is a tracked change.
AGENTS and implementation standards were read; the outline precedes DATA work in
`.task-inputs/browser-bootstrap-history-review-1/OUTLINE.md`.

**Verdict: no blocking defect established within the explicit partial source
decoder scope.** Suitable for the integration owner's source consideration,
subject to its independently allocated targeted checks. This review supplies no
runtime, capture-origin, ASL execution, mutation or deployment admission. I did
not import the candidate, execute tests, or replay the author's successful suite.

## Scope, continuity and organization

I fully read the four-path diff and current wire decoder, lifecycle reconstruction,
test and author report, plus canonical binding/activation/workflow and the two
JSON parser leaves. Actual changed paths are exactly:

- `infra/browser-enforcement/fixture-volume-history-wire.mjs`
- `infra/browser-enforcement/fixture-volume-history.mjs`
- `infra/browser-enforcement/fixture-volume-history.test.mjs`
- `docs/coordination/reports/CODEX-G1-BROWSER-BOOTSTRAP-HISTORY-SOURCE.md`

Independent Git/DATA verification confirms all four current files equal candidate
Git blobs, the candidate has the stated parent and clean status, and six protected
files equal both candidate and base Git: binding, activation, workflow, template,
json-records and protocol. The author's 69 sealed payloads, four owned records,
six protected records and pinned Node identity rehash correctly. All 100 actual
author evidence files were preserved as ordinary copies, including the original
seal, later postcommit captures and commit readback. Ten source/report files were
separately copied and hash-compared. These counts describe different sets, with
intentional overlap; they are not 179 distinct behavioral checks.

The actual production import closure has seven modules: history, history-wire,
binding, activation, workflow, json-records and protocol. The unchanged template
is separately protected, not an eighth decoder dependency. Ordinary imports form
an acyclic graph. New wrappers are small and use canonical descriptor/workflow
owners; raw capture validation and observed Task/ownership reconstruction each
retain one private implementation. No parser, authority registry, timer, service
client or generic orchestration framework was added. Module initialization is
inert by source inspection; this review did not run an import probe.

The legacy wire core is raw-byte equal after reversing its one expected-input
parameter substitution. The legacy reconstruction/result body is raw-byte equal
after reversing only `return` into a local result variable. Its key insertion
order, schema, sourceGuardLiteralFalse=true, options and error behavior remain.
The old synthetic builder and all 24 original test callbacks are preserved; the
complete original 14,242-byte marker-to-EOF segment remains an exact prefix of the
new corresponding segment, including its original final newline. Imports before
that segment change to compose the new APIs. No old assertion was removed.

## Explicit bootstrap boundary

`decodeFixtureBootstrapHistoryCapture` accepts exactly descriptor, pins,
definitionRaw, inputRaw and pages as own DATA fields. It rejects the legacy binding
option and arbitrary graph, compiler, profile or admission selectors. It validates
the descriptor through `validateFixtureBootstrapDescriptor`, derives the binding
from its original clocks/ownerBindingId and obtains the expected whole graph/input
from `compileFixtureBootstrapWorkflow` and `fixtureBootstrapInput`. The validated
descriptor is a detached deeply frozen canonical value, not a borrowed mutable
descriptor or permission receipt. Getters/symbols and mismatched nested descriptor
DATA are refused by existing canonical validation.

Both profiles enter the same private raw decoder. The old public API still chooses
only the legacy canonical graph/input; the new API chooses only bootstrap products.
Coherently updated raw hashes cannot substitute the other profile's graph or
input. Definition/input Buffer bounds and hashes, duplicate-key and finite JSON,
fixed execution name/ARN, numeric immutable version ARN shape and start receipt
matching, alias/redrive refusal, complete typed forward-page chains, aggregate
bounds, contiguous IDs/parent bounds, detail envelopes, no truncation and original
T0/create window/C900 remain enforced. Source commits and role/version pins remain
external inputs. Their syntax and consistency checks do not authenticate their
origin or prove deployed code/IAM identity.

`decodeFixtureBootstrapVolumeHistory` selects the same private ownership core. It
retains exact native Task resource/region/arguments/ancestry and deadline limits,
record-before-create/delete, one create and at most one first delete, strict
complete inventory/paging, retained singleton ID, tags/key/AZ/size/encryption,
unattached state and fresh available direct ownership before delete. An uncertain
create ACK is retained as its actual failed/timed-out outcome; no CREATED receipt
is manufactured. Empty or failed absence observations cannot become physical
absence. UNKNOWN and ambiguous deletion remain UNKNOWN.

The new output has a separate bootstrap schema and fixed profile, descriptor and
ownerBindingId. `sourceGuardLiteralFalse=false` identifies the structural graph
profile only. It does not assert AdmissionGuard executed or passed. Both outputs
keep cleanup UNKNOWN, absenceWireQualified=false, physicalAbsenceProven=false and
runtimeAdmitted=false. The new limitations expressly state the reconstruction is
partial observed Task/ownership DATA, not complete ASL replay or source admission.

## Retained actual checks, not reviewer re-execution

I read both wrappers and binary TAP captures and verified their raw hashes,
envelopes, source snapshots and counts. The first run at
`2026-10-11T02:12:23.248705Z` through `02:12:23.566368Z` exited 1, **35 PASS / 1 FAIL**.
Only case 34 failed: the common new refusal regex did not match the canonical
`DuplicateKeyError: duplicate JSON member`. The raw stack shows the scanner
correctly rejected duplicate `events` members. This was an assertion diagnostic
mismatch, not a duplicate-key parser acceptance. The original source snapshots
match the first envelope's three owned-source hashes.

Independent DATA comparison confirms the only first-to-final source repair is
that one test assertion, now requiring exact error name and message. Both
production files are byte-identical across runs; old 24 test bodies are unchanged.
The corrected run at `02:12:54.503597Z` through `02:12:54.835875Z` exited 0,
**36 PASS / 0 FAIL / 0 SKIP**, elapsed 0.343 seconds. Both captures contain 36 named
cases: original 24 plus 12 new grouped tests, not one test per nested mutation.
Both runs' eleven measured source/runtime/helper records are stable.

Corrected stdout: 8,088 bytes, SHA256
`7d67e53fdcea59e27b2d93e31f6322eacf0438ed1454dd2c09696c101fb7d545`;
stderr empty. Corrected envelope: 13,340 bytes, SHA256
`97269ed8b06d81c957ad879f4745bdd77ebe1bc7787ec9a23e6515e1aca455d8`.
Node executable SHA256:
`3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`.
Wrappers use fixed Node/test argv, shell false, DEVNULL stdin, replacement
environment, 120-second direct-child timeout and binary captures. Envelopes are
written before outcome assertions; splitlines handles CRLF for verdict parsing.
The 2 MiB cap is checked after buffered capture. No streaming memory bound,
process-tree guarantee or OS isolation is inferred. The first wrapper traceback
is transcript evidence, not a claimed additional binary capture.

## Qualifications and next owner gates

The synthetic builder deliberately omits the bootstrap AdmissionGuard,
GuardExecution, Initialize and many Assign/Choice/Wait transitions. The decoder
does not evaluate JSONata, reconstruct full ctx state or enforce every graph edge.
State-enter/Task evidence is constrained, but it is not a full successful ASL path
proof. A plausible synthetic capture is therefore accepted as partial DATA, as
documented; its MANAGED provenance label cannot independently prove AWS origin.

Later bridge/admission code must verify actual immutable publication/definition,
input/original clock, fresh caller/IAM/KMS and raw captured origin, and must consume
the explicit bootstrap result without inventing SOURCE9 nonce/caller/CREATED ACK.
This source does not establish physical absence, controller-loss survival, host
teardown, browser/renderer sandboxing, live service response compatibility or G1.
No existing consumed run, operational reservation, T0 or current Meri resource was
changed. Root owns source acceptance and any future runtime action.

Independent finite DATA result:
`.task-inputs/browser-bootstrap-history-review-1/results.json`, 97,252 bytes,
SHA256 `cd0c05e04e57ac9a6b7d7d3dc47613a86e347ed53b1e4951f2c7f3c77a45e2c4`.
It binds 25 read-only Git commands/50 raw streams, exact source comparisons and
both original outcomes. Author seal: 32,110 bytes, SHA256
`6d0a4f899f2471e4764eaa5e51bfcbc4e42b1a16db863f824935bef3d66f99e5`.
The final independent seal adds this report's raw Git identity and complete local
copies. No candidate suite, native binary, service or cloud action was invoked by
this reviewer; bounded Git and Python DATA helpers were used.
