# Optional SessionStore consolidation — source candidate

11 October 2026 UTC. **SOURCE CANDIDATE FOR INDEPENDENT REVIEW; G1 OPEN.**
This record accepts no transport/storage durability, native SDK mirroring,
runtime, image/security, build or release. Exact inputs and writable paths are
in the [task](../tasks/CODEX-SESSIONSTORE-CONSOLIDATION-20261011.md).

## Integrated source and module boundaries

At the initial source freeze, all nine PR2 candidate paths were copied byte-exact from
`65d9c750639e0d370985827983f24019a3f585ab` into newer reviewed base
`a5c41c7afdd9ec235ac3a0184a96e4c457ef2f90`. Newer fixture, driver, observer,
contract and source code is preserved. Original candidate reports retain their
historical authorship, checks, failed runs and limits.

`bound-session-store.mjs` owns one optional qualification adapter's ordered,
bounded queue, injected transport, deadline, uncertainty and mirror-close state.
It forwards the immutable canonical RunBinding on every call. The trusted
transport must authenticate execution and reject stale generations atomically
at commit. No worker-side predicate supplies that authority. Only a confirmed
`SESSION_WRITE_REJECTED` permits later dispatch; unknown failures/timeouts stop
dispatch. There is no retry of an uncertain write. `settleObservedCalls()`
describes only promises already observed by this adapter, not SDK flush,
subprocess quiescence, transcript completeness or durable checkpoint commit.

`verify-session-store.mjs` separately verifies an externally trusted immutable,
quiesced expected transcript inventory. It reuses canonical SDK restore checking
and public hashing; main/subagent ordered opaque content, repeated UUID-less
records and compaction fields are preserved. Its receipt explicitly says
`session-mirror-readback-only`. Nothing connects the adapter to a live SDK driver,
network, storage, product orchestrator or frontend.

The existing canonical native-file module changes only ancestor observation.
Full metadata remains required for the entire owned config namespace and
selected files/subdirectories. Borrowed ancestors retain repeated device/inode,
owner/mode and link/type/realpath checks; unrelated sibling membership changes
above configDir are tolerated. Ancestor replacement and owned mutation still
refuse. Trusted caller ownership/quiescence and no hostile filesystem replacement
remain prerequisites. Atomic openat traversal, reverted mutations and Windows
reparse completeness remain unproved. No guard asserts native writer shutdown.

## Checks and failures retained before source-pin advancement

Pinned local Node is `24.19.0`, SHA256
`bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`.
Already restored local dependency trees were physically copied into the dedicated
worktree; no install, lock change or network dependency acquisition occurred.
Checks use owned temporary paths and bounded processes; raw streams/envelopes
are retained under the [evidence directory](../../qualification/candidates/sessionstore-consolidation-20261011).

| Check | Actual result |
| --- | --- |
| New unrelated-sibling positive case against original native module | Expected FAIL `SOURCE_CHANGED`; retained control |
| Original native cases + new native boundary cases + SessionStore cases | 37 PASS; zero failures/skips |
| Static + native + boundary + SessionStore group before pin update | 129 PASS / 1 FAIL of 130 |
| Existing SDK evidence group before service dependency restoration | 339 PASS / 4 FAIL |

The static failure is a real source/context closure dependency: unchanged
`probes/static.test.mjs:963` detects the native-file record still pinned at
11,588 bytes although the candidate file is 12,049 bytes. Assertions are preserved.
The parent subsequently allocated only this native record and the related
`interruptionPackaging` provenance in `component-pins.json`. The exact source
candidate was frozen and sent for independent review before that separate
source-pin advancement. Root owns the independent review/acceptance decision.
No historical image evidence will be replaced and no build authority transferred.

Three initial SDK-suite failures are missing `@aws-sdk/client-s3` imports because
the service's accepted dependency tree had not yet been copied. That tree is now
restored without changing source. The fourth is the unchanged shared Linux procfs
diagnostic returning `NAMESPACE_STAT`, outside its asserted refusal vocabulary.
Its exact baseline reproduction and subsequent bounded checks remain to be
recorded; this candidate does not edit that parser or its tests. The historical
PR2 broader parallel scanner failure is also retained in the original report;
the scanner is a separately owned module and has not been weakened or edited.

Original code/layout, new source integrity, existing assertion preservation,
bounded physical process exit and owned temporary cleanup are recorded in the
evidence. The first proof helper used the mistaken filename `image_inventory.py`
and stopped before emitting the preservation/cleanup records. The locally frozen
candidate `09b962f86e52b9559c46b19c80d8c25fcd3410f5` was committed afterward;
its retained checks and product bytes did not change. The corrected helper
verifies all nine candidate blobs and eleven unchanged protected files, and
removes an owned synthetic workspace remnant from the earlier failed SDK run.
The correction and initial failure are separately recorded. A missing local
native blob was recovered through the approved GitHub
connector and verified as Git blob `ac138c990adeae889c1a4624acab523324669c37`.
An earlier ordinary local Git read attempted promisor lazy retrieval and was
blocked before transfer; subsequent object reads explicitly disable lazy fetch.

## Bounded follow-up after local dependency restoration

The same frozen source subsequently passed all **369 existing SDK evidence
cases**, with zero failures/skips, after physically restoring the missing service
dependencies. Original command selection and concurrency-one behavior are
preserved. The actual procfs diagnostic also passed its one focused replay; the
earlier `NAMESPACE_STAT` failure remains visible and is not considered a parser
fix or host/runtime qualification. Both procfs source/test bytes match the base.

All **seven original deterministic provider/config assertions** pass when
executed directly through Node against the actual SDK reference store. This
replay did not invoke the Promptfoo CLI and does not qualify that CLI/runtime.
Original provider/config/test bytes are unchanged. The unchanged image-inventory
suite independently passed **25/25** on its own. Inspection confirms its separate
full-ancestor metadata contract; no scanner change is included. Its historical
broader parallel refusal remains recorded in the original report. That older
whole-worker parallel command has not been replayed here and is not claimed green.

An earlier derived report incorrectly counted the initial focused group as
127 passing cases. Its actual raw output is 129 PASS / 1 FAIL of 130; the newer
base has 93 static cases, while the older PR2 report covered 91. Raw outputs are
unchanged; the count correction and old derived record remain retained.

## Separate source-only native pin refresh

The pin-only update binds `interruptionPackaging.sourceCommit` to frozen source
`09b962f86e52b9559c46b19c80d8c25fcd3410f5` and its native-file record to
12,049 bytes / SHA256
`543e05c230bf614cd5cf73f2d69877f1311ec0faf9d7ca205429161a75b842e1`.
Every other component/image field remains identical to the reviewed base.
Status remains `SOURCE_ONLY`; the metadata describes bytes and conveys no
independent acceptance, new build authority or historical image admission.

With original assertions preserved, the complete focused group passes **130/130**,
with zero failures/skips. The fixed SDK source-pin checker verifies **19 records**.
The unchanged canonical context assembler produces **53 members / 994,568 bytes**,
manifest SHA256 `94216667decf5e4feed05914b3f295148d9437ee1c00b224ca4e92625b5b876f`,
with `commitAuthority:false`. The owned generated context was verified and removed;
only its manifest/receipts remain. Optional SessionStore modules are source fixtures
and remain outside that existing runtime context; no driver/image adoption is implied.
No original test assertion or parser refusal was weakened to obtain these passes.

## Independent HOLD and inert-admission repair

Independent review established an adapter blocker in frozen `09b962f`, unchanged
at `cf9eb76`: `scopedSessionKey` reread caller properties after validation. A
changing `projectKey` getter returned an authorized value for validation and
`foreign-project` for transport; the probe observed two reads and actual foreign
project dispatch. The previous `JSON.stringify`/deep-equality admission also
executed an entry getter twice. Original reviewer script, stdout/stderr and
receipt are retained byte-exact under `inert-admission-repair/`. Earlier green
source tests did not cover these effects and do not override that HOLD.

The repair introduces the cohesive `session-store-data.mjs` owner. It checks
`util.types.isProxy` before inspecting descriptors, accepts ordinary plain JSON
and arrays, rejects accessors/non-JSON descriptors, and serializes only captured
data values. Iterative encoding preserves opaque nested JSON without caller
`toJSON`, getter or recursion-limit behavior. Repeated aliases and UUID-less
entries retain JSON semantics; cycles and existing unsafe values still refuse.
Exact encoded-byte budgets remain enforced. Key admission snapshots each own
field once and uses the same frozen authorized values for scope and transport.
The options record is also inspected before destructuring.

Trusted executable dependencies have a separate boundary: only required method
descriptors are captured, class instances remain supported, original receivers
are preserved, and later method replacement cannot change dispatch. No generic
dependency cloning is introduced. Thrown code accessors cannot masquerade as a
confirmed pre-commit rejection; they produce uncertainty without executing code.
Queue/deadline/no-retry semantics and authoritative commit fencing remain intact.

The same inert JSON owner admits returned transcripts/subkeys, mirror events
and expected snapshot inputs. Snapshot verification captures trusted methods
once and reuses the canonical restore verifier on admitted return data. The
existing 32 MiB aggregate entry budget, session/subagent inventory and all
original sixteen SessionStore assertion bodies remain unchanged. Sparse arrays,
hidden/symbol fields, custom prototypes, accessors, proxies and invalid JSON
inputs now refuse explicitly; these intentional stricter admissions cannot
execute transport effects. The outer snapshot serialization budget allows
finite wrapper overhead while preserving the original aggregate entry budget.

Actual repair checks: **44/44** native/SessionStore cases (the original 37 plus
seven adversarial groups), **137/137** static/source cases, and **7/7** direct
original provider/config assertions; zero failures/skips. New cases verify
changing-key, constructor/binding, nested entry/toJSON/proxy, stable key and
captured class-method behavior, returned data/error-code, expected snapshot and
mirror-event boundaries. Getter/trap counters stay zero; rejected key/expected
inputs cause zero transport calls. Previous 369-case SDK evidence checks belong
to the earlier source stage and were not rerun or represented as fresh repair
acceptance. Every fixed runtime-context member, native helper and component pin
is byte-identical to `cf9eb76`; no native source/pin or image authority advances.

Independent root acceptance of the repaired source remains pending. No SDK
query, durable transport, runtime replacement, provider/cloud action or release
is qualified by this repair.

## Remaining qualification

Actual SDK append/mirror behavior, authenticated durable transport, SDK/process/
subagent/tool quiescence, native layout completeness, workspace/transcript binding,
immutable fenced publication, new-task resume and stale-worker effect denial
remain unrun. Receipt flags stay `completeRecoveryCheckpoint:false` and
`sessionStoreQualified:false`. No model/provider/AWS/cloud/account/customer/source
action, remote Git write, merge, deployment or cutover occurred in this allocation.
