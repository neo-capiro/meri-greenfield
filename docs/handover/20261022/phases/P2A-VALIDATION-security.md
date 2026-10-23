# P2A independent security review: greenfield PR #196 `feat/meri-p2-proof-reuse` @ `e76a0eae`

> **HISTORICAL (2026-10-23).** Wave 1 material for layers that Wave 2 item 0 deletes (the owner/proxy pair, budget reservations, per-operation authority, P1/P2/S2). Do not send or implement it. See `../STANDING-REQUIREMENTS.md` and `../source-of-truth/SUPERSEDED-BY-ITEM-0.md`.

adj-a, 2026-10-21. I neither wrote nor planned P2. I did not edit the PR, comment on GitHub or push anything.

**Labels:** [R] run here; [D] derived from source; [L] live AWS read (read-only `DescribeServices`).

**Tree reviewed:** `e76a0eae` merged onto `main` `3c56c3e9`. The merge is clean (local `bce689c3`, not pushed).

**Inputs:** P2-PLAN §1, §3.1–3.4 and §9; ADR §2.4; `adj-b-PROOF-REUSE-DESIGN.md` §3.

**Verdict: CHANGES.**
- **The security properties hold.** Goals (a)–(e), the partner-steering question, the monotonic lease, close-before-install and the UNKNOWN hold all check out in code, and 24 of my 28 mutants are caught.
- **I sign off the relaxation, conditional on C2** (§7).
- **Three changes are required:**
  - **C1:** a liveness defect that defeats the PR's main operational goal, a partner restart.
  - **C2 and C3:** two load-bearing checks that no test pins.

## Required changes (for agent 2)

### C1. A partner's replacement is classified as drift, so the observer retires instead of re-proving

**Severity:** liveness and goals. Fail-closed, so not a security weakness. It needs a plan amendment from E (§3.1.1).

**What happens [R][D].** Both discoveries classify the partner service's transitional states as `PAIR_DRIFT`:
- `serviceObservation` (`desiredCount/runningCount/pendingCount ≠ 1/1/0`, non-COMPLETED rollout, non-PRIMARY deployments with counts);
- `member` (`ids.size !== 1`);
- `taskObservation` (`lastStatus !== 'RUNNING'`);
- the same rules in `service_pair_discovery.py:118-131,158`.

Once a generation exists, `PAIR_DRIFT` retires the observing process. My scenario test, a renewal during a partner replacement on the real lease holders:

| Observation | Owner (Node) | Proxy (Python) |
| --- | --- | --- |
| partner service 0 running / 1 pending | `PAIR_DRIFT`, `available:false` | `PAIR_DRIFT`, `available:false` |
| partner ListTasks returns no RUNNING member yet | `PAIR_DRIFT`, `available:false` | `PAIR_DRIFT`, `available:false` |

**Why it always happens live [L].** `meri-product-preview-owner` and `-proxy` both run ROLLING, `maximumPercent 200`, `minimumHealthyPercent 100`.
- **A forced restart** briefly shows two RUNNING tasks and a PRIMARY IN_PROGRESS deployment beside the old ACTIVE one.
- **A crash or StopTask replacement** shows 0 running / 1 pending, then a PENDING task.

Both phases last tens of seconds, so a 10 s renewer will observe them.

**Consequences:**
- The §1 row "A partner task replaced (same revision): re-proven within 30 s" and the §6 acceptance items 7–9 cannot pass.
- Every partner replacement retires the survivor too, and the pair converges only through the startup waits, which is today's "restart together" behaviour.

**Fix (both languages, the partner's service only):**
- **Return `PAIR_UNAVAILABLE`** (no lease, no generation) for these states, but only when every deployment and every listed task is on the pinned task definition and image:
  - (a) desired 1, running 0, pending ≤ 1;
  - (b) no RUNNING-desired member yet, or a member whose `lastStatus` is PROVISIONING, PENDING or ACTIVATING;
  - (c) a same-revision rolling deployment: PRIMARY IN_PROGRESS on the pinned task definition and the draining deployment on the pinned task definition, including two RUNNING pinned members.
- **Keep `PAIR_DRIFT`** for:
  - anything that contradicts a pin (another task definition, image, roles, subnet or SG, a public IP);
  - a RUNNING task outside the pinned service;
  - a deployment on another task definition;
  - any change to our own service.
- **Decide (E):** whether a single RUNNING pinned task under a PRIMARY IN_PROGRESS deployment of the pinned task definition is a passing proof. If it isn't, re-proof waits for COMPLETED, which can exceed `PAIR_REPROOF_MS`.
- **Tests:** scripted ECS sequences in both languages, under the live max200/min100 shape:
  - StopTask: RUNNING → gap → PENDING → RUNNING;
  - force-new-deployment: two RUNNING → one.

  Each must end in exactly one `reproven` and no retirement. Keep the existing drift cases (another revision or image, a foreign task).

**Security assessment of the fix:**
- **Neutral.** `PAIR_UNAVAILABLE` never installs a lease or a generation.
- **Held sockets** keep only their existing monotonic TTL (≤ 30 s), and their peer is the proven old task.
- **A new socket** still needs a full passing proof started after its handshake, which no transitional state can give.
- **Two RUNNING pinned tasks** stay inside T5's accepted ≤ 30 s window, and the same image cannot hold a different identity.

### C2. "Every reply inside a valid socket-bound lease" is implemented but no test pins it

**Mutants that survive [R]:**
- **N14:** removing the owner's post-dispatch `assertBound(socket)` (`owner-https.mjs`, after `dispatch(...)`).
- **P5:** removing the proxy's post-reply `self.pair_lease.require(generation=generation)` (`owner_https.py` `_send`).

Both survive every suite.

**Why it matters:** this is the one guard the relaxation (§7) rests on. Without it, a reply is accepted up to one exchange bound after the lease's monotonic expiry: up to `maxRequestMs` (≤ 15 s) on the owner and `max_exchange_ms` on the proxy.

**A generation change** is covered separately: close-before-install destroys the socket. **A plain monotonic expiry in flight** is not covered by any test.

**Tests to add (both sides):**
- While a request's owner work or reply read is in flight, advance the monotonic clock past `expiresAtMonoMs`, leaving the wall clock unchanged.
- **Owner:** answers 403 and closes the socket, with no reply body.
- **Proxy:** refuses the exchange and returns no `OwnerReply`.

Mutation-check each test with N14 and P5.

### C3. "A frame is never resent after a timeout" is untested on the real exchange's entry point

**Mutant that survives [R]:** P9, a resend inside `ProductOwnerHttpsExchange.__call__` after `OwnerExchangeUnavailable`/`TimeoutError`.

**Why the existing tests miss it:**
- `test_read_timeout_resets_only_its_carrier…` calls `_send` directly.
- `test_reserve_timeout_retains_unknown_and_never_retries_reserve` uses `FakeExchange`.

So no test covers the path the bridge actually calls.

**Test to add:** drive a reservation frame through `ProductOwnerHttpsExchange.__call__` so that it times out after the request bytes were written. Assert:
- exactly one POST reaches the scripted owner socket;
- the carrier is reset;
- `OwnerExchangeUnavailable` is raised;
- a later bridge reserve for the same request sends nothing.

## The nine checks

### 1. Goals (a)–(e) [D][R]: hold

- **(a) No exchange without a valid socket-bound lease:**
  - **Owner:** every request `await s.binding`, then `ensure()`, then `assertBound(socket)`. That is `assertConnection` (generation equal, not REPROVING, monotonic and wall expiry) plus `assertProductServiceTaskLease` (socket IPs, certificate pins, bound task ARNs, `expiresAtMonoMs ≤ checkedAtMonoMs + 30 s`). It runs before dispatch and again after (C2). Health routes are behind it too.
  - **Proxy:** `_send` runs `require(deadline)` and the connection's generation must equal the lease's (and not REPROVING) before any byte, and `require(generation)` after the reply (C2).
  - Mutants N1, N2, N13, P1, P2, P4 and P7 are killed.
- **(b) No new socket without a proof after its handshake** that binds the peer IP:
  - **Proxy** `_connect`: lease, bind to lease proxy IP, connect to lease owner IP, `do_handshake`, `_evidence` (TLS 1.3, ALPN, peer = owner IP:8444, local = proxy IP, leaf and issuer pins), then `prove_socket`. Its `renew()` takes the serializing lock and starts a fresh read; it compares generation, identities and both socket IPs.
  - **Owner** `secureConnection`: records `handshakeAtMonoMs`; `bindSocket` checks the pre-proof lease names `socket.localAddress/remoteAddress`, then `proveConnection` queues a fresh discovery that must start after the handshake and match the identities.
  - Mutants N7, N13, P6 and P7 are killed. N6 survives as an equivalent mutant (see "Not blocking").
- **(c) Definitive drift retires:**
  - **Owner:** `retire()` drops the lease and aborts the renewer; subscribers run `closeGeneration()` and `serviceGate.poison()`; readiness goes false.
  - **Proxy:** `retire()` closes every carrier; `available`/`ready` go false and feed `service_ready`; readiness fails, so ECS replaces the task.
  - Mutants N11, N12 and P12 are killed. C1 is the over-trigger.
- **(d) UNKNOWN is never dropped, and "not dispatched" is never inferred:** see §5.
- **(e) A slow or failed exchange refuses only that request:**
  - **Proxy:** the bridge's `_abort` no longer poisons and resets only its carriers (≤ 3 sent resets per rolling minute, else retire).
  - **Owner:** read-only work runs under `createOwnerRequestWork(readOnly)`, which evicts clients on abort. A request timer or `aborted` destroys only that socket. `onUnresolvedMutation → poison` remains for dirty or in-flight writes (mutant N10 is killed).

### 2. The replacement-vs-drift table cannot be steered by a partner [D]

- **Owner:** `install()` takes the identity (taskArn, IP, ENI, createdAt) only from `discovery.read()`. That reads DescribeServices, ListTasks, DescribeTaskDefinition, DescribeTasks and DescribeNetworkInterfaces through the owner's own `ecsClient`/`ec2Client` (task role). `proveConnection` only **compares** the socket's kernel addresses and the generation; it never installs them.
- **Proxy:** `_install` takes its input only from `self._reader.read()` (its own boto3 clients) or the startup observation from the same reader. `prove_socket` and `socket_ready` compare and never install.
- **Nothing from an HTTP body, a header or a certificate feeds a generation.** The replacement rule itself (a new, never-seen ARN; `createdAt` not going backwards; our own identity unchanged; ≤ 3 per 10 minutes) is pinned by mutants N8, N9, N12, P10, P11 and P12.
- **AWS state cannot be steered by a partner either [D]:** the ECS/EC2 statements in `infra/product-preview/model-proxy-template.mjs` are describe/list only (`ecs:DescribeServices`, `DescribeTasks`, `ListTasks`, `DescribeTaskDefinition`, `ec2:DescribeNetworkInterfaces`). The PR changes no infrastructure.

### 3. The lease cannot outlive its monotonic expiry, wall-clock changes included [D][R]

- **Owner:** `valid()` refuses when `mono >= expiresAtMonoMs` **or** `wall >= expiresAtMs`. `expiresAtMonoMs = mono + min(maxLeaseMs, pair.expiresAtMs − wall, pins.expiresAtMs − wall)` is mapped once, so a wall step back cannot extend it. `assertProductServiceTaskLease` also bounds it at `checkedAtMonoMs + 30 s`.
- **Proxy:** `require()` checks monotonic and wall time before and after any synchronous proof, and `expires_mono = min(checked_mono + ttl, at + absolute − now)`.
- **Admission receipts:** `read_at + min(10 s, expiresAt − now)` on the monotonic clock, generation-bound. An expiry watcher denies at expiry.
- Mutants N1, N2, P1, P2, P13 and P14 are all killed. The tests cover wall steps of ±5 s and a starved renewer.
- **An in-flight exchange crossing expiry:** see C2.

### 4. A generation change closes every old socket and session before the new one serves [D][R]

- **Owner:** `install()` first sets `lease = null` and `reprovingAt`, then calls `notify('replacement')`. `closeGeneration()` then aborts every controller, closes every session, admission channel and initial admission, and destroys every socket. All of this happens synchronously, **before** `generation++` and the new lease. A listener that throws retires the holder.
  - The new generation refuses requests with `PAIR_REPROVING` until `proveConnection` passes on a new socket.
  - Sessions carry their generation, and a mismatch fails (mutant N5 is killed).
  - Mutants N3 and N4 are killed. Both make the TLS replacement test hang to its timeout rather than fail an assertion (see "Not blocking").
- **Proxy:** `_install`, under the lease lock, sets the lease to `None` and runs the close listeners:
  - `ProductOwnerHttpsExchange._close_generation` shuts down and closes every socket and connection;
  - `owner_channel` clears the carriers and invalidates every bridge;
  - `owner_startup` drops authorities and the admission reader.

  Only after that does it increment the generation. Install listeners then swap the policy and IPs, and `_send` refuses REPROVING until `socket_ready` follows a post-handshake proof.
  - Mutants P3 and P4 are killed.
  - I found no lock-order inversion: renewer `lease._state` → `exchange._state`, and no path takes them the other way round.

### 5. No path drops an UNKNOWN hold [D][R]

- **The PR touches no hold-mutating code.** `gateway/budget/*` and the settlement and reconciliation modules are unchanged.
- **Proxy:**
  - a reserve timeout raises `StateDenied` with no retry (but see C3 at the transport);
  - a SETTLE timeout after send raises `SettlementCommitUncertain`, and only the read-only `read_outcome` may follow, on a fresh carrier of the same generation (mutant P8 is killed);
  - `OwnerExchangeUnavailable` still documents "never means not dispatched".
- **Owner:**
  - closing a session or socket evicts its DB clients, and any dirty transaction or in-flight write poisons the gate (mutant N10 is killed);
  - a COMMIT acknowledged before the reply leaves the hold UNKNOWN committed, and the refused proxy does not dispatch;
  - `readOutcome` is SELECT-only (`readOnly` refuses writes), answers only `SETTLED`, and crosses sockets only when the old socket is destroyed and the generation is the same.
- **A generation change** drops sessions, including those that could read an outcome. The ledger hold stays UNKNOWN until reconciliation, which is fail-closed.

### 6. T1–T10 against the code [D]

| # | Finding |
| --- | --- |
| T1 | Owner replaced: held sockets die. On the proxy, a never-seen owner ARN with non-decreasing `createdAt` makes a new generation after a close-first, and a post-handshake proof before serving. **Works only once the gap is not drift (C1).** |
| T2 | Proxy replaced: the owner mirror is the same (`clientPolicy` task ARNs now per socket from the lease generation, not the startup constant). **Same C1 caveat.** |
| T3 | IP reuse: the new-socket rule is on both sides; a reused IP on a foreign or unlisted task is drift before any HTTP byte (proxy tests `post_handshake_reused_ip…`, owner `post-handshake canonical proof retires…`). |
| T4 | Revision change: the partner's task definition or image differs → drift → retire. It is never re-pinned. |
| T5 | Second task, SG, subnet or public IP: drift (mutant N11 is killed). C1 narrows only the same-revision rolling case to UNAVAILABLE. |
| T6 | Stolen key: certificate pins plus IP binding plus a post-handshake proof per socket; leases are socket-generation-bound. |
| T7 | Stale currentness: the admission lease is ≤ 10 s monotonic; an answered refusal cuts at once; reserve's two owner joins are unchanged (the budget module is untouched). |
| T8 | Replay: receipts are bound to a lifetime, source, peer and generation; sessions to a generation; the cross-socket path is `readOutcome` only, with the original socket destroyed. Read ids are still single-use. |
| T9 | Clock steps: monotonic TTLs; wall caps only shorten (§3). |
| T10 | Starved renewer: every use checks monotonic expiry; an expired lease costs one bounded synchronous proof per request, refused as `PAIR_UNAVAILABLE` on failure without poisoning. |

### 7. The relaxation: my sign-off

**Signed off (adj-a), conditional on C2.**

**The change:** from "fresh proof around every reply" to "every reply inside a valid socket-bound lease".

**Reasons:**
1. **On a held socket, the peer is fixed by TLS 1.3 mutual authentication** to the two pinned certificates and two private IPs, and the socket was admitted by a proof that started after its handshake. A later proof could only discover service-level drift (T4/T5). None of that changes who answered on this socket or what the owner committed.
2. **The money gate is not relaxed.** Reserve's in-transaction currentness join still precedes every provider send, and UNKNOWN holds bound the cost of any in-flight exposure.
3. **The window is bounded and monotonic:** ≤ 30 s from the last proof (detection normally ≤ 10 s), immune to wall-clock steps, and generation-bound, so a replacement or retirement closes every socket before the next generation serves.
4. **The window is no wider than today's.** Today's per-exchange proofs run only on traffic, so an idle pair's drift window is unbounded. The background renewer bounds it.

**The condition:** the guard that makes reason 3 true for a reply in flight, the post-reply lease check, must be pinned by tests on both sides (C2). Today it is correct but survives deletion on both sides.

### 8. Mutants (my own; scripts in this session's scratchpad `p2a/`) [R]

**How I ran them:**
- **Node:** the owner suites (`owner-pair-lease`, `service-task-leases`, `service-pair-discovery`, `owner-https`, `owner-https-tls`, `owner-request-work`, `owner-channel`, `owner-outcome-cancel`, `owner-entrypoint`) plus my scenario file. Runtime image `meri-p0-runtime:e64b2231a3b2` with the merge overlaid and `openssl` added. Baseline **148/148**.
- **Python:** `test_pair_lease`, `test_pair_lease_composed`, `test_owner_https`, `test_owner_channel`, `test_owner_admission`, `test_service_pair_discovery`, `qualification.test_lifetime` and my scenario. Run in the pinned-requirements proxy test image, uid 10001, root-owned `go-w` tree, with the runtime image's `node_modules` and `openssl` for the composed suite. Baseline 111 tests, with one flaky composed error (see "Not blocking").
- **Isolation:** one container at a time, and each mutant restored from a pristine copy.

| Mutant | Property | Result (failing tests) |
| --- | --- | --- |
| N1 drop the monotonic check in `valid()` | expiry | **killed** (2) |
| N2 lease TTL +60 s | expiry | **killed** (4 + TLS suite timeout) |
| N3 replacement without the close notify | generation close | **killed** (TLS replacement test times out; aborted-request test) |
| N4 HTTPS subscriber does not `closeGeneration` | generation close | **killed** (same pattern) |
| N5 session generation unchecked | generation close | **killed** (1) |
| N6 accept a proof started before the handshake | new socket | **survived**, equivalent: `read()` always starts a new discovery |
| N7 socket peer IP unchecked in `proveConnection` | new socket / T3 | **killed** (1) |
| N8 seen-partner (flip-flop) allowed | partner steering | **killed** (2) |
| N9 `createdAt` going backwards allowed | partner steering | **killed** (1) |
| N10 unresolved mutation not poisoned | UNKNOWN | **killed** (1) |
| N11 two RUNNING tasks → UNAVAILABLE | drift fields | **killed** (1) |
| N12 own identity change accepted | drift fields | **killed** (4) |
| N13 no post-handshake proof (`bindSocket`) | new socket | **killed** (3) |
| N14 no post-reply `assertBound` | relaxation guard | **SURVIVED** → C2 |
| P1 drop the monotonic checks in `require()` | expiry | **killed** (3) |
| P2 lease TTL ×3 | expiry | **killed** (2) |
| P3 replacement without close callbacks | generation close | **killed** (1) |
| P4 generation close keeps sockets | generation close | **killed** (11) |
| P5 no post-reply `require(generation)` | relaxation guard | **SURVIVED** → C2 |
| P6 socket IPs vs fresh proof unchecked | new socket | **killed** (1) |
| P7 socket proof reuses the pre-handshake lease | new socket | **killed** (10) |
| P8 SETTLE timeout not UNCERTAIN | UNKNOWN | **killed** (composed lost-settle + settle-timeout test) |
| P9 `__call__` resends after a timeout | UNKNOWN / no retry | **SURVIVED** → C3 |
| P10 seen-partner allowed | partner steering | **killed** (2) |
| P11 `createdAt` going backwards allowed | partner steering | **killed** (1) |
| P12 own identity change accepted | drift fields | **killed** (4) |
| P13 admission receipt with no monotonic expiry | expiry | **killed** (4) |
| P14 admission receipt TTL ×3 | expiry | **killed** (2) |

**Plus the C1 scenario:** both languages, partner gap → `PAIR_DRIFT` and retirement.

### 9. Image gate

Not run here, per the brief (D3 owns conformance and gates on this head).

## Not blocking (LATER)

- **N6 is an equivalent mutant.** The owner's `proofStartedAtMonoMs < handshakeAtMonoMs` guard cannot trip, because `read()` never shares an in-flight discovery. Keep it as defence in depth; a test that made `read()` coalesce would pin it.
- **A regression can hang the owner TLS suite instead of failing it.** Under N2, N3 and N4, `owner-https-tls.test.mjs` hung until my 900 s cap, because its sockets keep the process alive. Add per-test timeouts (or `--test-force-exit`) so a regression fails fast.
- **Two tests flake under host load:** `test_lost_settle_ack_recovers_read_only_on_new_tls_carrier` (composed) errored in 2 of 3 full-module runs and passed 3 of 3 alone. `test_exchange_clock_starts_once_the_carrier_is_held` behaved the same way. This is timing under contention, but it is the UNKNOWN recovery path, so stabilise it.
- **Lease age is anchored at the proof's end on both sides,** as on base. The oldest fact can be 30 s plus the proof duration (owner ≤ 15 s). The final service and membership re-read happens at the end, so this is acceptable; document it.
- **The Python renewer stops at generation 0 on `PAIR_DRIFT`** without retiring (startup only). Requests then fall back to synchronous proofs, which is fail-closed. Consider retiring, or leaving it to the startup wait explicitly.
- **`createOwnerRequestWork` classifies SQL by its first verb,** so a mutating `SELECT fn()` would count as a read. Today's owner statements are plain INSERT/UPDATE. Keep it that way, or classify by statement id.

## Evidence

- **Scratchpad `p2a/`:** `run.sh`, `mutants.json`, `apply.mjs`/`apply.py`, the scenario tests `zz-adj-a-gap.test.mjs` and `test_zz_adj_a_gap.py`, and the outputs `base.out`, `run.out` (N1–N2), `run2.out` (N3), `run3.out` (N4–N13, P1–P14), `run4.out` (N14), `diag*.out`.
- **Merge worktree:** `C:\dev\fable\wt-adj-a-p2a` (detached, local only).
- **Live read:** `aws ecs describe-services --cluster capiro-dev --services meri-product-preview-owner meri-product-preview-proxy`. Both are ROLLING 200/100, revision 42, COMPLETED.

---

## Re-check: `c703e9f3` merged onto `main` `bce70776` (local merge `6463b954`, not pushed): **CHANGES**

adj-a, 2026-10-21. This is a targeted re-check of agent 2's response (`5550f8b6..c703e9f3`), not a re-review. Same method as above: my mutant set is extended to the new code and run one container at a time. Labels as above.

### Fixed and verified

| Item | Result |
| --- | --- |
| **C1, main states** [D][R] | Partner-only `PAIR_UNAVAILABLE`, with no lease and no generation, for: a gap; a PROVISIONING, PENDING or ACTIVATING member; and a same-revision rolling with two pinned members. Drift is kept for every pin contradiction: a drainer on another revision (N17/P17 killed), the own service (N18/P18 killed), a public IP, SG or subnet, and a foreign row. A transitional observation never issues a proof (N15/P15 killed). **O104 is implemented:** one RUNNING PRIMARY-started pinned task under PRIMARY IN_PROGRESS is a passing proof. The StopTask and force-new-deployment sequence tests exist and pass in both languages (`service-pair-replacement.test.mjs`, `test_service_pair_replacement.py`). |
| **Retire exits non-zero** [D][R] | The owner calls `onRetire → process.exit(3)` and the proxy calls `on_retire → os._exit(78)`, after sockets, sessions and health are handled. The proxy's health line goes through `os.write` on the duplicated stderr fd, so `os._exit` loses nothing. N19 and P19 are killed (`test_production_proxy_retirement_exits_process_from_renewer_thread` asserts 78). |
| **C2** [R] | **N14 is killed** by `in-flight owner work cannot return after monotonic lease expiry`, and **P5 is killed** by `test_reply_read_cannot_return_after_monotonic_lease_expiry`. **My conditional sign-off on the relaxation is now unconditional,** for the reasons in §7. |
| **C3** [R] | **P9 is killed** by `test_reservation_timeout_after_native_write_is_never_resent_by_call_or_bridge`. |
| **M1, M3, M4, M5** [D] | As listed. M1: bind first, then publish, under `_receipt_lock`. M3: `read_at` is taken at read start. M4: the retire reason is `CARRIER_RESET_LIMIT` or `PAIR_REPROOF_LIMIT`. M5: retries back off 1→10 s with jitter. |
| **M2** [D] | It now starts a fresh read, but see R3. |
| **Baselines** [R] | Node owner suites (including `service-pair-replacement`) **0 failures**. Python 151 tests: one failure, `test_next_tick_reads_again_after_an_unanswered_renewal`, which fails **1 of 3 runs alone** (R3). |

### Mutants (38 = my previous 28, two updated for the new code, plus 10 new) [R]

- **Node, 19 mutants:** 15 killed.
  - **N6 survives as before** (equivalent).
  - **N5 survives.** **Correction:** at `e76a0eae` I recorded N5 as killed. That kill came from `real TLS with mismatched peer identity…`, which never touches sessions; it was a host-load flake. N5 was always a survivor.
  - **N11 survives** (new). With two partner tasks now allowed for rolling, nothing pins "≥ 3 RUNNING partner tasks is drift".
  - **N16 survives** (new, benign; below).
- **Python, 19 mutants:** 18 killed, excluding the M2 flake.
  - **P16 survives** (benign, like N16).

**Survivors that need no change:**
- **N6** is equivalent: `read()` never shares a discovery.
- **N16/P16** drop the "started by the PRIMARY deployment" condition on a passing proof. Outside stale-count snapshots this is unreachable. Where it is reachable, the "proof" names the same old pinned task the lease already holds, so it is a renewal, not a new identity. Optional test.

### Required changes for agent 2

**R1. A new pinned partner task that appears during a proof still retires the survivor (C1 is incomplete; both languages).**

**What happens [R]:**
- In both discoveries, the final services/members re-read classifies any member, or any PRIMARY deployment id, not seen in the first read as `PAIR_DRIFT`.
  - Node: `service-pair-discovery.mjs`, "a new final ARN stays drift".
  - Python: `service_pair_discovery.py:477-487`, "an unseen final member retains the drift fence".
- So when the replacement is placed while a renewal is in flight, the survivor retires. My scenarios on the real lease holders, with the PR's own replacement fixtures:

| Scenario | Node | Python |
| --- | --- | --- |
| StopTask: gap at the first read, replacement listed (PENDING) by the final read | `PAIR_DRIFT`, retired | `PAIR_DRIFT`, unavailable |
| force-new-deployment: stable at the first read, the new task and deployment present by the final read | `PAIR_DRIFT`, retired | `PAIR_DRIFT`, unavailable |

**How often [I]:** a proof takes about 1–1.5 s of each 10 s renewal period, so roughly 10–15 % of one-sided restarts would still retire the survivor and cascade. §6 items 7–9 would pass or fail by chance. The existing mid-proof tests cover only members **leaving** (stable→gap, rolling→replaced).

**Fix:**
- **For the partner only:** when the final service observation itself passes every pin check, a final member or PRIMARY deployment not seen in the first read means `PAIR_UNAVAILABLE`, not drift. `serviceObservation` / `_service` already drift on any deployment on another revision and on every pin contradiction.
- **Keep drift** when the final read contradicts a pin, and for the own service.
- **Security:** an uninspected task never contributes to a proof (no lease, no generation). The next renewal inspects it in full, so nothing is admitted on unread facts.
- **Tests (both languages):** both mid-proof races above. Each ends without retirement, and the following renewals reach exactly one `reproven`.

**R2. Pin the partner count boundary (mutant N11).** Add a test in both languages: three distinct RUNNING members in the partner service mean `PAIR_DRIFT` (T5), also when the service observation itself is otherwise a pinned rolling deployment.

**R3. An older admission read answered late must not replace a newer receipt (M2 follow-up; Python).**
- **What happens [R]:** `test_next_tick_reads_again_after_an_unanswered_renewal` fails 1 of 3 times alone (`receipt.read_id` is the first read's, not the second's). When the unanswered first read's reply arrives after the second read's, `ProductOwnerAdmissionReader._install` publishes it last, so the lifetime's current receipt becomes the **staler** read.
- **Impact:** expiry is fail-safe (M3 made its `read_at` earlier, so it expires sooner). But for up to one tick it can expose older admission facts in place of fresher ones.
- **Fix:** `_install` refuses a receipt whose read began before the current receipt's read (compare `read_at_mono`, or a per-lifetime read sequence), and the test becomes deterministic.

**R4. Pin the owner's session-generation check (N5; defence in depth).** `owner-https.mjs` `session.generation !== s.lease.generation` is unpinned. Close-before-install clears every session, but an `open` in flight during a replacement can re-insert its session after the clear. Add a test: a session whose `open` completes after a replacement is refused on any new-generation socket.

### Not blocking

N6, N16/P16 (above).

**My old "partner gap with no member listed" scenario** now reports drift only because its old fixture (`servicePairFixture`) returns unrequested DescribeTasks rows, which the new code rightly treats as foreign. The PR's replacement fixtures filter correctly.

### Evidence

- **Scratchpad `p2a/`:** `recheck.sh`, `mutants.json` (38 mutants), `zz-race-tail.mjs`, `test_zz_adj_a_race.py`, `re-node.out`, `re-python.out`, `m2.sh`/`m2.out`.
- **Merge:** `c703e9f3` onto `bce70776` (local `6463b954`). The worktree is removed; reproduce it with `git merge c703e9f3` on `bce70776`.
- **Cleanup:** WSL tars and containers are removed.

---

## Re-check round 3: `aa721c24` (directly on `c703e9f3`): **CHANGES**

adj-a, 2026-10-21. This is a focused re-check, run in fresh trees of `aa721c24` in the runtime image (Node) and the pinned proxy test image (Python, uid 10001).

**R1–R4 are fixed [R].**
- **R1:** my mid-proof races give `PAIR_UNAVAILABLE` with no retirement in both languages.
- **R2:** three partner tasks are drift.
- **R3:** the ordering guard holds. The test passes 10 of 10 runs alone.
- **R4:** the session generation check is now pinned.
- **All 13 targeted mutants are killed** by the intended tests (7 Node, 6 Python).

**Diff [D]:** production changes are R1 and R3 only. The test edits are R1's intended reclassification and the new R2/R4 tests.

**New and remaining items** (detail in `P2A-CHANGES-ROUND3-FOR-AGENT2.md`):
- **F1 (reproduced):** four answered owner 403s within a minute retire the proxy (`os._exit(78)` in production). Answered refusals count against `CARRIER_RESETS_PER_MIN`, and the bridge marks `_sent` before any write.
- **T1:** `test_owner_https::test_post_handshake_final_membership_and_deployment_pins_send_no_http_bytes` fails in both modes. It still expects drift where R1 now returns unavailable.
- **T2:** the `node`-dependent suites must skip, not fail, when their tools are missing.

**Baseline [R]:**
- **Node:** 203 tests, 0 failures.
- **Python:** 156 tests, 2 failures. Both are T1.

**Evidence:** scratchpad `p2a/` (`recheck-r2.sh`, `mutants-r2.json`, `r2-node.out`, `r2-python.out`, `f1.sh`, `f1.out`, `test_zz_adj_a_f1.py`).
