# Codex proxy mandatory-owner cancellation repair

Source candidate only; independent owner review remains required. No server, database, AWS, provider, native worker, or Docker action was performed. This report does not advance G1.

The cancellation defect reproduced by the distinct review is repaired: a trusted observer, canonical state check, or sole request receive owner can no longer disappear through self-cancellation while a quiet upstream request remains authorized. The six original composed witnesses now pass unchanged. The original scheduling-sensitive 40 ms deadline test remains a retained failure; this is not an all-green canonical-suite claim.

## Source and scope

Dedicated worktree: `C:/dev/main/meri-greenfield-worktrees/g1-proxy-server-cancellation-repair`, branch `task/g1-proxy-server-cancellation-repair`. Base `92c5a9d430aa4e8d022b4b6697ff8ecd75662ce3`. The authorized exact seven-file original candidate `f8c122c19136976b94f34c90d4a7fc9f2933cacf` was copied by cherry-pick as baseline `5ce6ba95fc7d3cc2cc200e6c050e8e2330dab2f0`. The separate repair changes two runtime modules, their two tests, and this new report only.

Instructions and standards were read and a proportionate outline was saved before edits. No recursive agents or Hermes sessions were used. Original candidate and reviewer worktrees were not modified.

`RequestLifetime.spawn` now marks mandatory owners. Their completion callback publishes sticky denial before removing the task, including cancellation before the coroutine ever starts. The admission watcher is mandatory. `_bounded` distinguishes a completed canceled observer/state child from cancellation of its awaiting request owner and latches `FRESH_ADMISSION_CANCELLED` before raising the canonical `StateDenied`.

The receive pump latches `REQUEST_RECEIVE_CANCELLED` before propagating cancellation and is also a mandatory owner. Existing intentional close and whole-request cancellation publish their reasons before canceling children; the first reason remains sticky. There is no extra grant, budget authority, accounting mutation, refund, or replacement observer. Production deadline logic and timing bounds are unchanged.

| Final source | Bytes | SHA256 |
|---|---:|---|
| runtime/lifetime.py | 6346 | b72f0fbef2b25d96c56ea94545edbe09997bb79cab24772d2ea0e8c32a1d939a |
| runtime/server.py | 7775 | 1093488da47056efd0eca242c6a57d42803a9dc4d36505bce79445113f7884ad |
| test/test_lifetime.py | 9264 | d069237057e78f2e03e306e6fa8fe6f0d1295367cbef49ab5cd39323fe6f27f5 |
| test/test_server.py | 14181 | 4491023458ffd602437b81151c8b6bc8db0076e599a617ff0d6c8cabb2a9f873 |

Paths in this table are relative to `apps/proxy/qualification/`. The guard module, its 26-test file, and the original author report remain byte-exact. DATA reconciliation verified all seven original/baseline Git blobs and all 20 original test/helper function segments, including the original deadline test, without importing candidate code. Its final result is `.task-inputs/CODEX-G1-proxy-server-cancellation-repair-1/source-data-2/results.json`, 17168 B, SHA256 `9e0c90f80666ea0536f43ea3e7032a7f2427f22f2ffa48f2808894c6d6a33cec`.

## Preserved failures and focused qualification

All evidence paths below are under this worktree's `.task-inputs/CODEX-G1-proxy-server-cancellation-repair-1/`. Raw binary streams, machine envelopes, replacement environment, source hashes, installed-file hashes, and versioned harness sources remain present. Files were created exclusively.

The original distinct review `c1637345b62b6b05129a1960eb7ab64aacd902ae` and its 71-payload manifest were remeasured exactly. Its original canonical 44-test outcome remains 39 PASS / 5 timing ERROR, not corrected retrospectively. Its original six-control outcome and failures are copied unchanged. `independent.py` remains exactly 6702 B, SHA256 `7abd0c3dda7ba9800a5f308357f6663b3566c07846bd543b1d450f52bfc4798d`.

1. `run-checks.py` / `child.py`, output `checks-1`: both children exited 1 before candidate tests. Instrumentation had replaced `subprocess.Popen` with a function, breaking Windows asyncio's subclass declaration. These are harness failures, not failed candidate controls. Both streams and the original harness remain unchanged.
2. `run-checks-v2.py` / `child-v2.py`, output `checks-2`: the scoped lifetime/server suite ran 22 methods, 20 PASS / 2 FAIL, in 4.271 test seconds (5.000 child seconds, 120-second external bound). All four new cancellation/close/request methods passed, including four composed cancellation/error subcases. The unchanged independent witness child passed all six controls in 0.391 seconds. Its stdout SHA256 is `e7a06aa0f1e8ba98ef40d5ceacef721214b9d076e02153be2e5cd662a6c8f3c6`.
3. `run-checks-v3.py` / `child-v3.py`, output `checks-3`: only the newly added deterministic deadline boundary method and the previously blocked private guard composition method were run. Both passed, 3.874 test seconds / 5.000 child seconds, 120-second bound. No six-witness or unchanged 26-guard-suite replay occurred. Result SHA256 is `aaaaf14f8e7176a3d176422857b3c6e5dd411453682e9f9d7f916efb7d6c59ae`.

Supervisors were invoked with the bundled Python executable and `-I -B`; each child used the source-bound transport spike environment's Python 3.11.15 with `-I -B`. The exact child argument arrays, UTC timestamps, exit codes, stream byte counts/hashes and timeouts are in the envelopes. Overall result files alone are not substitute test verdicts.

The two retained v2 failures are specifically:

- `LifetimeTests.test_original_deadline_not_reset_by_observer_renewal`: its unchanged expectation was `ORIGINAL_DEADLINE_EXPIRED`; actual sticky reason was `FRESH_OBSERVATION_TIMEOUT`. `_bounded` selects the original-deadline reason when its post-wait clock is at or after that deadline. The failure contains no timestamp proving that condition. It remains a timing limitation, not an established after-deadline priority defect. The new deterministic test scopes a fake clock to the lifetime module only, exercises real pending `_bounded` operations before/at the same original 40 ms boundary, verifies both literal reasons, and verifies the original deadline remains unchanged through three real observer calls. Asyncio and `PeerLease` retain their own real clocks. No deadline, expectation, or production branch was widened or replaced.
- `ServerTests.test_actual_caller_private_context_explicitly_wires_native_guard`: real upstream import reached `aiohttp.helpers -> platform.system -> uname -> win32_ver -> _syscmd_ver -> subprocess.check_output`, which the v2 harness denied before process creation. The v3 harness keeps the original `Popen` class and rejects every process in its audit hook. Only the exact inspected CPython `_syscmd_ver` code's denied attempts receive the `OSError` that its existing fallback catches. Three such attempts were physically denied; no `ver` process ran. All other subprocess attempts remain hard failures. The actual private-context/real guard test then passed without synthetic upstream module replacement.

Final source has 23 lifetime/server methods. Across the retained scoped and targeted captures, 22 distinct methods passed; the unchanged original 40 ms method retains its failure. Counts overlap across captures and the six witnesses; they must not be summed as independent assertions or presented as a fresh 23/23 or 49-test canonical PASS.

## Provenance and limits

Each check measured 10658 installed-file records before and after against the independently retained installed snapshot. These include the historical tokenizer cache exceptions; this is a measured installed Windows environment, not a pristine wheel or production Linux qualification. Eleven critical upstream seam files additionally matched the pinned LiteLLM 1.104.2 wheel and provenance. Relevant source/helper records were unchanged during each run (20 in v1/v2; 21 in v3, including the inspected CPython platform source). This is a finite recorded boundary, not a complete Python interpreter execution-closure proof.

The v3 network record reports three denied standard-library process probes, one denied pinned urllib3 IPv6 import probe, four exact-code Windows asyncio socketpair events, and `unexpected=[]`. The witness child reports only two exact-code socketpair events and no unexpected access. Socketpair exceptions serve the event loop and do not authorize application connectivity. No DNS, AWS, provider, database, application server, or native operation was admitted.

The fixed raw witness still measures the full-body-channel limitation: two queued body events plus one held by the sole pump prevent reading a subsequent disconnect. The independent admission watcher continues and revocation still finishes the request while that channel is full. Queue capacity, body/event bounds, and body ownership are unchanged; no body data is discarded. Disconnect visibility is not claimed in this state.

Pending cancellation-resistant iterators or state threads retain strong quarantine references and sticky readiness denial. These tests use synthetic authority and cooperative release for cleanup; cancellation is not proof of physical termination, and UNKNOWN liabilities are not refunded. Direct-child timeouts and post-capture stream-size checks do not establish process-descendant containment or an in-flight memory cap. Filesystem/source comparisons assume a trusted checkout.

Actual upstream LiteLLM callback/client assembly, continuous trusted socket-peer/ECS provenance, TLS, production database behavior, deployment, real CountTokens/provider usage, and global durable budget proof remain open. Root owns independent review, integration, runtime admission, and all remaining G1 decisions. Current Meri is untouched.
