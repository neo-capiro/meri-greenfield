# Independent fresh-runner capture source review

12 October 2026 UTC. **HOLD_SOURCE** for exact source commit `4b8bbe7c110db70079f011a2407d7d616e8ebfbd`, tree `ab24ae120482c386d40e2daf85950bb5bdd274f2`, parent `19d64a1b5446337ad10a0068229164133756a073`. Three independently reproduced gaps prevent source acceptance. The original 21-case suite passes; its existing negatives do not cover these gaps.

## Allocated scope and reviewed ownership

The dedicated detached review worktree uses local Git objects with lazy fetching disabled. AGENTS.md, implementation standards, author task/report, exact three Python module/test paths and retained evidence were inspected. The [review task](../tasks/CODEX-FRESH-RUNNER-CAPTURE-INDEPENDENT-20261012.md) allocates only this new report/task and its evidence directory; no product source was edited.

`worker_runner_capture.py` composes configuration/host checks, local version execution and observations. `worker_runner_inventory.py` owns selected membership, hashing, file/stat checking and owned result writing. The test module uses synthetic filesystems and actual local Python-child fixtures. Helpers derive from canonical builder membership plus the binding and two new owners. Legacy source, profiles, authorities, pins, tuples and executable build wiring remain untouched. Responsibility separation is coherent; no agent loop, SDK replacement or cloud action was added.

Host/configuration refusal precedes capture inventory, subprocess dispatch and output allocation on the actual CLI path. Inert imports, minimal version environment, fixed `--version` command, selected runtime coverage labels and false admission flags are correct within the reviewed scope. Selected files receive regular-file/link/reparse/hardlink guards, streamed bounds and before/open/after checks; selected directories and membership are rescanned. These optimistic observations do not establish hostile atomic filesystem traversal, reverted-mutation detection, complete executable closure or actual Windows behavior.

## Blocking findings and independent reproductions

### F1 — Earlier output artifact can change after its readback while success is returned

`write_result()` verifies each artifact immediately after writing it. During a later artifact's fsync, the independent fixture changes the earlier `first.json` from `b'{}'` to same-length `b'{]'`. No final whole-artifact readback occurs: the function returns normally. The expected-refusal assertion fails. Final directory verification checks only device/inode, so it cannot observe this content mutation.

This allows successful capture to return a file set inconsistent with the bytes/hash metadata computed for those artifacts. A downstream consumer might detect the mismatch, but that does not substantiate the producer's successful verified-output claim. Required repair: before success, recheck every declared artifact's original owned identity, bytes and hash after all writes, preserving foreign/substituted files on failure. Keep the producer's complete final readback distinct from later intake verification; do not waive this gap as downstream responsibility.

### F2 — Unexpected output membership is accepted on the success path

During the first artifact's fsync, the independent fixture creates `foreign.txt` inside the newly allocated output slot, then lets fsync succeed. `write_result()` returns normally and retains the unexpected member. Its success path never enumerates and compares the output directory against the expected artifact set. The existing foreign-file test covers only a separate fsync failure.

Required repair: verify exact output membership and plain-file identity on the completed success path. Unexpected members must cause refusal; cleanup must remove only originally owned files whose identity still matches, preserving foreign membership and reporting incomplete cleanup. Both output controls are actual owned temporary-filesystem mutations, not mocked hash results; the reviewer outer fixture removes only its own test resources.

### F3 — Inherited pipes can hang subprocess cleanup beyond its bounds

The canonical-command launcher was replaced only within the source test by an owned local Python fixture. That version child starts an owned descendant inheriting stdout/stderr, prints a synthetic version and exits. The descendant keeps its pipes open. Reader joins time out, but `native_version()` then calls `stream.close()` before proving reader completion. Closing the buffered stream blocks on the reader's lock while that reader remains blocked in `read()`.

The eight-second faulthandler record shows the main thread at `worker_runner_capture.py:104` in cleanup and both reader threads at line 77 in `consume`. The external ten-second supervisor must terminate the group: physical exit **-9**, `timedOut:true`. Linux subreaper supervision kills and reaps the owned descendant; the process group is absent afterward and TMPDIR is empty. No actual AWS executable or Windows child was run. This fixture demonstrates an unbounded adapter cleanup path; it does not assert that a particular AWS CLI release actually spawns such a descendant.

Required repair: use supported bounded process/reader teardown that can end inherited pipe ownership before performing potentially blocking close or join. Bound the complete owned subprocess/reader lifecycle, retain physical-exit evidence and do not leave daemon readers or owned descendants running. A platform-specific implementation still needs actual Windows qualification; Linux source controls cannot establish Windows cleanup.

## Actual independent checks and retained failures

| Check | Physical result |
| --- | --- |
| Original focused source unittest module | 21 PASS, exit 0; 0.266 seconds |
| Guarded inert import | PASS, exit 0; process/socket/data-open/allocation/removal guards active |
| CLI help | Expected exit 0 |
| Missing configuration and wrong actual Linux host | Expected exits 2; no output slot allocated |
| Output membership and later-artifact mutation controls | **2 FAIL**, physical exit 1; expected refusal not raised |
| Inherited-pipe subprocess/reader control | **TIMEOUT**, physical exit -9; ten-second owned supervisor bound |
| Author raw streams/source hashes and legacy preservation | PASS, exit 0; 24 raw streams, three current source hashes and seven legacy file hashes verified |

All five standard independent command receipts use a 30-second external limit and expected physical exits. The two additional probe commands use ten-second external limits. Every recorded process group is absent afterward; owned test TMPDIRs are empty and removed. The retained failure scripts, raw stderr and timeout stack are evidence and have not been rewritten to pass. The collector's own 60-second deadline cannot interrupt the blocked cleanup path in F3.

The local primary Python runtime is Linux Python 3.12; actual Windows Python 3.11.15 execution remains **UNRUN**. No dependency installation or network acquisition occurred. Author final and earlier 20-case stdout/stderr bytes match their recorded hashes; only the current three source hashes are asserted against the frozen current source. The author's historical nonexistent-path Git read failure remains retained and was not repeated. Product diff from the author's base contains exactly the three allocated new Python paths; all other changes are documentation/evidence.

## Preserved qualification limits

This collector measures an explicitly selected runtime inventory, not the full executable closure. Existing bytecode, installation/stdlib ZIPs, non-Python stdlib data, venv/registry startup, native libraries outside the selected sets, OS binaries and ACLs remain excluded. `-B` does not prove no bytecode reads. The full AWS CLI installation and whole Hermes environment remain unqualified. Target account/profile/caller fields are expectations; `callerObserved:false`, and canonical STS remains separate. No credential source was read and no AWS API/native AWS CLI, provider, Docker, SQL, build, merge, deployment or production action occurred.

All runner/build/scan/runtime/G1 admission flags remain false. This HOLD grants no runtime, image, security, source-pin, budget or shipping authority. Repair and fresh independent review must precede source publication or actual shipper execution. Actual Windows filesystem, loaded-native, process teardown and full runtime admission remain separate gates even after these source defects are fixed.

Proofs are in [independent-review-20261012](../../qualification/candidates/fresh-runner-capture-20261011/independent-review-20261012/): command receipts/raw streams, `output-negative-controls.py` with both failures, `inherited-pipe-control.py` with timeout receipt and stack, `preservation-author-evidence.json`, and the review evidence index. The returned review commit contains only allocated new task/report/evidence and retains the exact source commit as its parent.
