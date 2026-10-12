# Final independent fresh-runner capture review

12 October 2026 UTC. **ACCEPT_SOURCE_ONLY** exact source `a3c3c340218690ff1b02672ab50565014f51eae2`, tree `b4f70e4cb2edc6c2e894edbb3aaf3acb2869c2e4`, parent `6f0a8c57e47f1f352198c3bdd4ae092b8bc45946`. No remaining blocker was found in the allocated source review. This accepts no Windows runtime, complete executable closure, runner/build/security/image admission, G1 or deployment.

## Review scope and ownership

The dedicated detached worktree was created from the exact source with local Git lazy fetching disabled. The [review task](../tasks/CODEX-FRESH-RUNNER-CAPTURE-FINAL-INDEPENDENT-20261012.md) records exclusive NEW task/report/evidence paths. Canonical instructions, source/module ownership, initial collector, both repairs, author reports and retained evidence were inspected. No product source was edited.

`worker_runner_capture.py` remains the host/configuration and fixed local version adapter; `worker_runner_inventory.py` owns selected filesystem inventory and exclusive observation-file lifecycle. Existing builder/binding helpers supply canonical profile expectations and helper membership. The final repair changes only fallible initialization order in native version execution and adds two tests; the repaired inventory is byte-identical to its parent. No dependency, legacy tuple, authority, profile, pin, build recipe or executable build wiring changes.

Deadline preparation, buffers, EOF state and cleanup closure are now initialized before `Popen`; all operations after owned allocation are inside cleanup. The original clock attack, copied byte-identically, records **zero allocated children**. A separate independent fixture launches an actual local Python child, fails the next clock call, and proves the direct child is reaped and both parent handles closed.

## All original findings independently replayed

The original output attacks now both PASS: a foreign member causes refusal and owned-only cleanup preserves foreign membership, while corruption of an earlier artifact during a later fsync causes refusal. Completed output verification brackets exact membership and original owned file identities around full byte/hash readback. A further mutation during the final closure reread is detected and the owned slot is removed. Original path/link/reparse/hardlink, substituted-directory, bounded inventory and metadata-stability cases remain passing.

The original inherited-pipe fixture now exits with the explicit `VERSION_PIPE_EOF_INCOMPLETE; DESCENDANT_TEARDOWN_UNQUALIFIED` refusal in 1.139 seconds rather than hanging. Independent stdout-only, stderr-only and both-stream missing-EOF fixtures refuse in approximately 0.25 seconds each; the direct child is reaped and both unbuffered parent handles are closed. The adapter requires both stream EOFs and direct-child exit before returning success, preserves the canonical `--version` argv and exact four-variable scrubbed environment, and uses no reader threads. Existing overflow/timeout/physical-exit cases pass.

The collector owns only its direct child and parent handles. Review fixtures separately own, kill and reap their descendants. In particular, the original replay leaves its synthetic descendant after the direct script's bounded refusal; the reviewer supervisor cleans that group. This does **not** prove or imply collector process-tree cleanup. Windows PeekNamedPipe and available-byte read behavior remains unrun, requiring actual Windows qualification before any runtime admission.

## Actual independent checks

| Check | Physical result |
| --- | --- |
| Focused source unittest module | **27 PASS**, exit 0; 1.050 seconds; no failures/skips |
| Original byte-identical output controls | **2 PASS**, exit 0; 0.075 seconds |
| Original byte-identical inherited-pipe script | Expected bounded refusal, exit 1; 1.139 seconds; no external timeout |
| Original byte-identical initialization-clock control | PASS, exit 0; 0.095 seconds; zero children allocated |
| Final closure mutation + stdout/stderr/both pipe controls | PASS, exit 0; 0.865 seconds; actual owned child fixtures |
| Independent post-allocation clock failure | PASS, exit 0; 0.098 seconds; direct child reaped, both pipes closed |
| Inert import, help, missing configuration, wrong actual host | Expected exits 0, 0, 2, 2 |
| Thin CLI missing-EOF error mapping | Expected exit 2 and explicit unqualified-descendant message; injected source control |
| Assertion/evidence/legacy preservation | PASS, exit 0; original 25 method ASTs identical, 42 prior evidence files and seven legacy files byte-identical |

All eleven retained command receipts use fifteen-second external limits and expected physical exits. Owned process groups are absent, independent fixture descendants are killed/reaped, and owned TMPDIRs are empty/removed. The expected inherited-pipe script exit 1 records its explicit refusal rather than an unexplained test failure. No external timeout occurred in final replays. Supervisors use a Linux subreaper to reap only the owned fixtures; this is reviewer cleanup evidence, not a production mechanism.

Guarded import checks block process/socket/data-open/allocation/removal. Missing configuration and wrong actual Linux host allocate no capture output. Standard CLI help/refusal remains bounded and handled. No installation or network dependency acquisition occurred. Source fixtures use the local Linux primary Python 3.12 runtime; actual Windows Python 3.11.15 collector execution remains UNRUN.

Every original 25 test method and existing class helper is AST-identical to the parent; two cases were added. All 42 prior candidate evidence files are byte-identical, current author clock-repair raw streams/hashes are verified, and seven legacy source files remain unchanged. The two original independent HOLD reports are verified against their committed bytes: `c13a536d9d629cfc9a4f74a9c70d9cc744bfbd03` retains the three original findings, and `58b12c32be5dd596414a128bd84d63dd6b25112f` retains the clock initialization leak. Their failed receipts are not relabeled or replaced. Original attack-script copies remain byte-identical; final replay receipts are separate.

## Qualification limits retained

Selected runtime inventory remains explicitly incomplete. Existing bytecode, stdlib/installation ZIPs, non-Python stdlib data, venv/registry startup, native dependencies outside the selected sets, OS binaries and ACLs remain excluded. `-B` does not establish no bytecode reads. The full AWS CLI installation and whole Hermes environment remain unqualified. Optimistic stat/readback checks do not prove hostile atomic traversal or reverted-mutation detection; clocks/filesystem dependencies retain their documented trusted semantics.

Account/profile/caller metadata remains an expectation, with `callerObserved:false`; canonical STS is separate. This review executed no native AWS CLI, AWS API, provider, Docker, SQL, build, remote Git write, merge, deployment or production operation. All runner/build/scan/runtime/G1 and complete-closure admission flags remain false. Actual Windows process/pipe, filesystem/ACL/loaded-native and process-tree boundaries need runtime evidence before runner/build qualification. Source acceptance supplies no current execution approval, budget, credential or image authority.

Evidence is in [final-independent-review-20261012](../../qualification/candidates/fresh-runner-capture-20261011/final-independent-review-20261012/): eleven bounded receipts/raw streams and command index; byte-identical original attack scripts; independent closure/pipe and post-allocation cleanup controls; assertion/author-evidence preservation; and the review evidence index. The returned review commit contains only allocated NEW task/report/evidence and has the exact accepted source as parent. No product source was edited.
