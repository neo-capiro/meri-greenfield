# Proxy cancellation repair independent review

Outline before candidate review. Canonical run/peer/grant authority and accounting remain the existing ingress/state/guard boundary. `lifetime.py` owns mandatory authority/deadline task supervision; `server.py` owns the single receive task, bounded request channel and ASGI cancellation/closure. Review the closed repair's exact diff, retained failures and source/evidence pins, then replay the original six independent controls and focused new composed cancellation controls with denied real network/process dispatch. Verify sticky denial precedes cancellation, including cancellation before a mandatory coroutine's first step, quiet upstream, blocked sends and full queues.

The reviewer did not author the repair. Dedicated review base `92c5a9d430aa4e8d022b4b6697ff8ecd75662ce3`; original f8 candidate/c163 blocked review remain preserved. The outline was written before the CLOSED candidate was copied/read. Sole tracked output is this report; ignored evidence only. No AWS, provider, database, server, install, native/container invocation, recursive delegation or runtime/G1/refund acceptance.

## Decision

PASS for the bounded cancellation source repair at `dd7c6dd9e9a94b719aad5d23dfe4c1ecf3747ed2`, parent `5ce6ba95fc7d3cc2cc200e6c050e8e2330dab2f0`. The original three self-cancellation failures now deny and finish the cooperative synthetic request. No additional source blocker was identified in this delta. This is not an all-green canonical-suite verdict: the author's unchanged original 40 ms test failure remains retained and unresolved.

This review does not authorize deployment, inference, release, physical termination, refunds, or G1 completion. Actual LiteLLM callback/client composition, continuous trusted ECS/socket-peer renewal, TLS, database concurrency, and provider accounting remain unqualified.

## Exact source and evidence

The exact seven-file original f8 baseline and all 20 original test/helper function bodies matched raw Git. The repair changes exactly two runtime modules, their two tests, and its new author report. Three other original files, plus the six protected ingress/body/state/test files, remain raw-exact. The reviewer copied the baseline and candidate into the dedicated review worktree, producing source-equivalent local commit `cc6d2ebcf33d62f1e480b4202d3668d285e6db8d`; source comparisons bind the author SHA above, not local cherry-pick identity.

| Candidate member | Bytes | SHA256 |
|---|---:|---|
| runtime/lifetime.py | 6346 | b72f0fbef2b25d96c56ea94545edbe09997bb79cab24772d2ea0e8c32a1d939a |
| runtime/server.py | 7775 | 1093488da47056efd0eca242c6a57d42803a9dc4d36505bce79445113f7884ad |
| test/test_lifetime.py | 9264 | d069237057e78f2e03e306e6fa8fe6f0d1295367cbef49ab5cd39323fe6f27f5 |
| test/test_server.py | 14181 | 4491023458ffd602437b81151c8b6bc8db0076e599a617ff0d6c8cabb2a9f873 |

Table paths are relative to `apps/proxy/qualification/`. The author report is 9780 B, SHA256 `d1ae6f4f8299d3d58c7a841f1283d4e1c16c953abc2b9ced8159f8ae9d18ec65`. All 134 payloads in the 53814 B author manifest `31c8ed40fd033e8a37aafef10c863d7304c953708e22f8b7f49d809e3733a25c` were remeasured. Its final commit readback is 18620 B, SHA256 `e6454ccf6b1e4be7837a1986a4649489ee501819e6e281004862eaecc015333e`.

Ignored evidence is under `.task-inputs/cancellation-review-1/` and `cancellation-review-2/` in this review worktree. `cancellation-review-2/seal.json` enumerates the finite retained files, raw Git streams, source records, author evidence, envelopes and results. This evidence assumes trusted local checkout/filesystem access; hashes do not attest runtime provenance or concurrent authority by themselves.

## Source findings

`lifetime.py:86–100` registers a done callback for mandatory tasks. It publishes sticky denial before dropping their owned references, including cancellation before the coroutine's first step. Completion, an ordinary exception, and unexpected cancellation all make a mandatory watcher unavailable. Existing first-reason semantics keep intentional owner closure and whole-request cancellation from being overwritten by those callbacks.

`lifetime.py:103–114` now distinguishes a completed canceled admission child from cancellation of its awaiting owner: it latches `FRESH_ADMISSION_CANCELLED` and raises canonical `StateDenied`. Initial admission and renewal both use this path. Whole-request cancellation still propagates through the server's outer handler, which publishes `REQUEST_CANCELLED` before `close()` cancels children.

`server.py:84–88,138` latches receive-owner cancellation and supervises the pump as mandatory. The watcher still starts before body/upstream handling. No authority SQL, peer identity comparison, grant/budget state, accounting mutation, original monotonic deadline, timeout value, channel capacity, or body/event limit changed. Existing guard composition remains explicit/private; this review does not establish a default LiteLLM enforcement assembly.

## Once-only checks and retained failures

The reviewer supervisor used verified Python 3.12.14 with `-I -B`; three children used the measured Python 3.11.15 transport environment with `-I -B`, shell false, replacement environment, raw binary streams, 120-second direct-child bounds and exclusive outputs. Execution interval was 2026-10-10T20:55:24.856933Z–20:55:26.478202Z. Each selected child ran once against the repaired source.

| Independent run | Actual outcome | Child seconds | Retained raw evidence |
|---|---|---:|---|
| Original six controls, byte-identical 6702 B witness | 6 PASS / 0 FAIL | 0.422 | stdout 1897 B, e7a06aa0f1e8ba98ef40d5ceacef721214b9d076e02153be2e5cd662a6c8f3c6; stderr empty |
| Five focused newly added methods | 5 PASS / 0 FAIL | 0.953 | stderr 1075 B, c0393aab724976529ab8e3f7a05cf706774ad4565f253665df2dcda4fe0c277a; stdout empty |
| Four reviewer-authored fixed-literal controls | 4 PASS / 0 FAIL | 0.250 | stdout 778 B, 3ab232ce7d5dd60050dce921d52d4aa68c1efc011d0b284743013b076eecb9a1; stderr empty |

Counts are separate scopes and overlap in behavior; they are not a fresh 15-test canonical suite. The selected methods include a four-subcase composed cancellation/error method. No unchanged 44/26-test broad suite or original 40 ms failure was replayed.

The original six demonstrate quiet-upstream observer error, observer cancellation, canonical state cancellation and receive cancellation, plus the existing full-body-channel limit and independent revocation path. The four new controls independently fix synthetic bindings and prove: initial observer cancellation prevents all body/upstream work; initial canonical state cancellation does likewise; cancellation before a mandatory coroutine's first step denies without entering it; and a preexisting sticky denial survives whole-request cancellation while the cooperative upstream finally runs and task ownership clears. These controls import production entrypoints directly, not candidate fixture helpers.

All three process/network records have `unexpected=[]`. Only the exact-code Windows asyncio socketpair exception was reached (2, 10 and 2 events respectively); these local event-loop plumbing events do not grant application connectivity. Real application process, DNS, socket/network dispatch remained denied. The inspected pinned urllib3 IPv6 and CPython platform-probe denial classifications were not reached by these selected children. No AWS, model/provider, database, HTTP server or native application was invoked.

The 10658 historical installed-file records matched before/after, as did 22 source/helper/runtime-seam records. Historical tokenizer/PYC exceptions remain part of that measured Windows environment; this is not a pristine-wheel or complete interpreter closure claim.

The first reviewer preflight exited 1 before candidate imports or children because the copied commit-readback expected SHA had an extra terminal `14` (66 characters). The actual 64-character raw SHA above was independently measured. The old supervisor, source and failure record remain in namespace 1; namespace 2 changes only that expected pin and retains the same child/witness bytes. The failure record's initial prose says 65, while its measured `expectedLength` is 66; `preflight-failure-erratum.json` preserves that clarification. This was reviewer instrumentation, not a source repair or unchanged test replay.

Author failures also remain unchanged: first harness Popen replacement failed before tests; the later 22-method run was 20 PASS / 2 FAIL; its denied CPython platform probe was subsequently handled by a narrow still-denying instrumentation repair and that private-guard control passed. The original scheduling-sensitive 40 ms case still expected `ORIGINAL_DEADLINE_EXPIRED` but observed `FRESH_OBSERVATION_TIMEOUT`. Its retained capture contains no timestamp proving the post-wait clock was already at the original deadline. The deterministic focused method passes both before-D and at-D branches and repeated-renewal deadline identity; it does not erase the original failure or prove its cause.

## Remaining boundaries

The unchanged witness measured two queued body events plus a third held by the sole pump: a following disconnect remains unread while the upstream does not consume. The watcher continued (seven observations in the nonrevoked control), and revocation finished the request with the upstream finally running while the channel was full. This establishes separate authorization behavior, not disconnect visibility under saturated backpressure. Queue size was not increased and body data was not discarded.

Quarantine/readiness behavior is cooperative source preparation. Cancellation or a canceled coroutine is not proof that a Python thread, provider operation or remote request physically stopped; no UNKNOWN liability is refunded. Arbitrary cancellation or tampering by trusted in-process code is not a sandbox boundary. Actual TLS/LiteLLM/native deployment and continuous peer provenance remain open.

Direct-child kill/wait supervision does not prove descendant containment. Stream limits are checked after capture rather than enforced as an in-flight memory/output cap. No runtime timing SLA, physical cleanup, provider settlement, security waiver, or G1 pass follows from this source decision. Original blocked review and all failed historical captures remain intact.
