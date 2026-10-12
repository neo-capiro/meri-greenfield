# Independent fresh-runner repair review

12 October 2026 UTC. **HOLD_SOURCE** exact `6f0a8c57e47f1f352198c3bdd4ae092b8bc45946`, tree `2c7bb223cfbf7096e02b074efe638ccf15dece32`, parent `4b8bbe7c110db70079f011a2407d7d616e8ebfbd`. The three original defects are repaired in source controls; one newly exposed initialization cleanup defect remains.

The [review task](../tasks/CODEX-FRESH-RUNNER-CAPTURE-REPAIR-INDEPENDENT-20261012.md) names the isolated frozen review and allocated documentation/evidence ownership. No product edits, remote Git/network, AWS/native AWS executable, actual Windows or provider execution occurred. Initial HOLD `c13a536d9d629cfc9a4f74a9c70d9cc744bfbd03` remains immutable and separate.

## Remaining blocker F4 — clock initialization after child allocation bypasses cleanup

`native_version()` allocates `Popen`, then evaluates `end = clock() + seconds` before entering its cleanup try/finally. A clock throwing at that initialization point leaves the owned direct child running and both parent pipe handles open. The independent actual local Python-child fixture prints `childrenAllocated:1`, `directChildStillRunning:[true]`, `stdoutClosed:[false]`, `stderrClosed:[false]`. Its expected-cleanup assertion fails, physical exit **1**. The review fixture finally kills/reaps/closes its own child; the group is absent afterward. No AWS executable was launched.

Required repair: perform fallible deadline preparation before owned process allocation, and keep post-allocation initialization under owned cleanup. Preserve direct-child and parent-handle teardown on later clock/pause/inspection failures. Initialization failure cleanup is required by implementation standard 16; this is not a request to weaken the boundary or widen admission.

## Original repairs verified

Final output verification now brackets exact expected membership and original owned file identity around a fresh complete readback. The original foreign-member and earlier-artifact mutation controls, copied byte-identically, both PASS against this frozen repair. A separate mutation during the final reread also refuses and cleans the owned slot.

Native version execution uses unbuffered handles and readiness polling, with no buffered reader threads. Both streams must reach EOF and the direct child must be reaped. The original inherited-pipe attack now produces `VERSION_PIPE_EOF_INCOMPLETE; DESCENDANT_TEARDOWN_UNQUALIFIED` in 1.13 seconds, physical exit **1**, without external timeout. Separate stdout, stderr and both-stream fixtures refuse in approximately 0.251 seconds each, with direct child reaped and both parent handles closed. Exact minimal four-variable environment and canonical `--version` arguments are preserved.

Collector ownership remains explicitly **direct child only**. The original replay's descendant remains after the direct script exits; the reviewer owner kills/reaps the owned fixture group. Additional fixture groups are independently cleaned and reaped. This establishes no collector process-tree cleanup guarantee. Actual Windows PeekNamedPipe behavior remains unrun.

## Actual checks and preservation

| Independent check | Physical result |
| --- | --- |
| Source unittest module | 25 PASS, exit 0; 1.000 seconds; original 21 method ASTs unchanged |
| Original output negative controls | 2 PASS, exit 0; 0.075 seconds |
| Original inherited-pipe script | Expected bounded refusal, exit 1; 1.130 seconds, no external timeout |
| Final closure mutation plus individual pipe controls | PASS, exit 0; 0.859 seconds |
| Clock initialization cleanup control | FAIL, exit 1; 0.123 seconds; reviewer cleaned the leaked owned child |
| Author raw streams and source/legacy preservation | PASS, exit 0; 14 streams, three current source hashes, seven legacy files verified |

Each replay has a 15-second external supervisor bound; the clock control has a ten-second bound. Raw outputs and failures are retained. All owned supervisor groups are absent and temporary roots are empty/removed. Existing 21 method bodies and other class helpers are AST-identical, with four new cases added. Exactly the same three allocated Python paths change from the parent. Canonical builder/binding/legacy metadata and source wiring are unchanged.

The work uses Linux primary Python 3.12 for source fixtures. Actual Windows Python 3.11.15 capture, loaded-native/OS/ACL behavior, complete executable closure and runner/build admission remain UNRUN. Selected inventory, existing bytecode/ZIP/startup omissions and false coverage flags remain explicit. No STS/authentication, credentials, build approval or image admission is supplied. All runner/build/scan/runtime/G1 flags stay false.

Evidence is in [repair-independent-review-20261012](../../qualification/candidates/fresh-runner-capture-20261011/repair-independent-review-20261012/): original scripts/replay receipts, independent closure/pipe controls, `clock-initialization-control.py` with failure receipt/raw output, preservation proof and review index. This review commit contains only the allocated NEW task/report/evidence and has the exact frozen source as parent. A later fix requires its own exact-source review; this HOLD must remain visible.
