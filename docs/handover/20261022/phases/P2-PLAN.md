# P2: owner↔proxy proof reuse, partner re-proof and fewer exchanges (implementation plan)

**Audience:** an implementer who has only this repository (GitHub) and a Linux box with Docker. **No AWS access is needed, and none may be used.** No knowledge of earlier work is assumed.

**This is the security boundary between the owner (the budget writer) and the proxy (the only Bedrock caller).** It needs an **independent security review** before it ships (§9). The implementer must not review their own PR, and neither may the planner.

**Companion files** (committed beside this plan in `docs/hot-path/`):
- `ADR-HOT-PATH-REDESIGN.md`: §2.4 is this phase. §7 records the decisions: stage 3 is in P2.
- `adj-b-PROOF-REUSE-DESIGN.md`: the source design. Its threat model (§3) is the reviewer's checklist.
- `P1-PLAN.md`: the budget table P2's new numbers belong in (§3.6).
- `P0-PLAN.md`: the telemetry the acceptance uses.

**Base:** `main` @ **`e3ba4e47`** (candidate 8, with P0 merged). Every `file:line` below was checked there. If `main` has moved, re-locate a reference by its function or constant name. All paths are under `apps/proxy/` unless shown otherwise.

**What you deliver: two pull requests into `main`, in order:**
- **PR-A** (stages 1 and 2, plus partner re-proof and the failure rules): no wire change.
- **PR-B** (stage 3, the exchange collapse): a wire-contract change, rebased on PR-A after it merges.

**Why two:** PR-A carries almost all of the latency win and the deploy fix. PR-B is a protocol change that is easier to review alone. Both go to the same independent reviewer. The shipper deploys each, owner and proxy together, and checks §6 live.

## 0. Ten-minute orientation

**The pair.** Every model request goes runner (the Claude CLI) → **proxy** (Python, LiteLLM, `product/*.py`) → **owner** (Node, `product/owner-*.mjs`) → Bedrock.
- The proxy may call Bedrock only after the owner has reserved budget.
- They talk over a dedicated mTLS (TLS 1.3) channel: the proxy connects to the owner's private IP on port 8444.
- **Before trusting the other side,** each runs a **pair proof**: an ECS/EC2 discovery showing that both sides are the single RUNNING task of their pinned service.
  - Owner: `service-pair-discovery.mjs` `createProductServicePairDiscovery`.
  - Proxy: `product/service_pair_discovery.py` `ProductServicePairDiscovery`.
- **One proof** is 10 ECS/EC2 calls in four phases: DescribeServices, ListTasks ×2 and DescribeTaskDefinition ×2, then DescribeTasks, then DescribeNetworkInterfaces, then DescribeServices + ListTasks ×2 again.
- **The pins** are rendered per deploy (`serviceTasks`, `parseProductServicePairConfiguration`):
  - the task definition ARN (a revision), the image digest, the task and execution roles, the subnets and security groups, `deploymentRevision`;
  - the two certificate SHA-256s.

**Today, per exchange** (one HTTP POST on that channel):
- **Proxy:** `product/owner_https.py` `_send` (`:231`) proves the pair **before and after** (`_prove_pair`, `:239`, `:260`, `:275`). **Any** exception calls `abort()` (`:150`), which retires the pair reader and every socket: the proxy serves nothing until restarted.
- **Owner:** `product/owner-https.mjs` reads `taskLeaseReader.read` before (`:208`) and after (`:223`) every POST and checks it with `assertProductServiceTaskLease` (`:37`). An aborted request or a timer calls `retire()` (`:129`, `:193`, `:206`, `:222`), which poisons the owner's service gate.
- **One model request is about 31 exchanges.** The owner re-reads the pair and Core currentness around each one.

**The permanent retirement P2 removes:**
- **Owner:** `product/service-task-leases.mjs:13-19` remembers the pair identity from the first read (`identity??=current`). Any later different identity sets `retired=true` forever.
- **Startup pinning:** `owner-entrypoint.mjs:201` pins `clientPolicy.ownerTaskArn/proxyTaskArn` from the startup read.
- **Proxy:** the same rule in `service_pair_discovery.py:340-346` (`self._identity`), and the exchange is constructed for one owner IP (`ProductOwnerHttpsExchange.__init__`, `owner_ipv4`).
- **So if either task is replaced** (a crash, a scale event, a one-sided deploy), its partner is dead until it is restarted too. That is why the two services must be restarted together, and why deploys are slow and racy.

**Live numbers today** (candidate 8, one model request at 2026-10-21 05:55Z, from P0's own lines):

| | Measured |
| --- | --- |
| Owner exchanges (`meri.model.request.ownerExchanges`) | **31**: admission 21, capture 7, operation 3 |
| Sum of exchange time (`ownerExchangeMs`) | 121 s |
| Proxy ECS/EC2 calls | **≈ 650**: 156 attributed to the request (DescribeTasks 78, DescribeNetworkInterfaces 78), plus ≈ 493 discovery calls the proxy's parallel discovery threads report as background (DescribeServices 123, DescribeTaskDefinition 124, ListTasks 246, `meri.process.rollup` 05:54-05:55) |
| Owner ECS/EC2 calls (`meri.turn.counters.aws`, one request) | **609**: 61 pair discoveries |
| Owner Core calls (`core`) | **93**: identity 47, context 46 |
| Owner DB statements | **5 405** |
| Proxy bootstrap / settle | 6.5 s / 10.1 s |

B's source-derived model (`adj-b-PROOF-REUSE-DESIGN.md` §1-§4) predicted 20 exchanges and 414/400 calls. **Live is higher, and the live numbers are the baseline.**

## 1. Goals with numbers

For one model request with a 20 s stream (B's §4 shape), on preview, measured with P0 telemetry:

| Number | Today (measured) | After PR-A (stages 1+2) | After PR-B (stage 3) |
| --- | --- | --- | --- |
| Owner exchanges per request | 31 | **≤ 13** (B §4 stage 2) | **≤ 7** = 3 (ADMIT, RESERVE, SETTLE) + 1 per 5 s of stream |
| Pair discoveries on the request path, each side | ≈ 61-78 | **0** | 0 |
| Proxy ECS/EC2 calls attributed to the request | ≈ 650 | **≤ 10**: runner ENI reads only, 1 at bootstrap + 1 per 5 s, each DescribeTasks + DescribeNetworkInterfaces | ≤ 10 |
| Owner ECS/EC2 calls attributed to the request | 609 | **0** | 0 |
| Owner Core calls per request | 93 | **≤ 12** (B §4) | ≤ 12: ADMIT 2 + RESERVE 2 + 2 per 5 s |
| Background pair discovery, each side | on traffic only | **1 per 10 s** ≈ 1 ECS/EC2 call/s per process, independent of load | same |
| Owner path before the first token (bootstrap + reserve exchanges) | 57.5 / 107 s (B's model); live bootstrap alone 6.5 s | **≈ 3.3 / 5.1 s** median / tail (B's model) | same latency, fewer moving parts |
| `ownerExchangeMs` per request | 121 s | **≤ 5 s** at median | ≤ 4 s |
| A partner task replaced (same revision) | partner dead until both restart | **re-proven within 30 s** (§3.3), then serving | same |
| A partner on another revision, or failing any pin | refused (retired at the next exchange) | **refused and retired within 10 s,** even when idle | same |

**Correctness goals (must hold in every stage):**
- (a) no exchange without a valid, socket-bound pair lease;
- (b) no new socket without a proof completed **after** its TLS handshake that binds the socket's peer IP to the pinned task;
- (c) definitive drift retires the process;
- (d) an UNKNOWN budget hold is never dropped, and no path infers "not dispatched";
- (e) a slow or failed exchange refuses that request only.

## 2. What changes, in one table

| Area | Today | P2 |
| --- | --- | --- |
| Pair proof on the request path | before and after every exchange, both sides | none. A **socket-bound pair lease** renewed in the background every 10 s, TTL 30 s (§3.1) |
| A new socket | proof before connect, owner proof per POST | proof **before** connect **and** a second proof **started after** the handshake, matching the socket's IPs. The owner does the same on accept. |
| A replaced partner (same revision) | permanent retirement | **re-proof:** a new pair generation after a full two-sided proof, old sockets and sessions dropped first (§3.3) |
| A different revision / pin failure | retire at the next exchange | retire within 10 s (background drift detection) |
| In-request currentness | ~10 full exchanges per request | the request lifetime's **admission lease**, renewed by the existing 5 s watch (§3.4) |
| Reserve / settle | OPERATION + POLL + REPLY each, nested capture, process-wide `_claim()` held 6-12 s | PR-B: one RESERVE and one SETTLE exchange carrying both frames (§3.5) |
| A failed exchange | proxy `abort()` / owner poison: the whole process stops | refuse that request. Read-only: reset its carrier (≤ 3/min). Reserve/settle: keep the UNKNOWN hold. Poison only on drift or unresolved **mutating** owner work (§3.2). |

## 3. Design

### 3.1 The socket-bound pair lease (PR-A, stage 1)

**One renewer per process per side:**
- the only caller of the pair discovery;
- it holds the latest successful proof as a lease `{generation, owner:{taskArn,ip,eni,createdAt}, proxy:{…}, checkedAtMonoMs, expiresAtMonoMs, expiresAtMs}`.

**Renewal:**
- **Period:** every **10 s** (jittered ±1 s).
- **TTL:** **30 s**, the existing `max_lease_ms` / `maxLeaseMs` cap.
- **The TTL runs on the monotonic clock** (`time.monotonic()` / `performance.now()`). Absolute caps (`pins.expiresAtMs`, issued expiry) keep their wall-clock checks.
- **A renewal that is unavailable** (timeout, throttle, no reply, unsettled SDK work) changes nothing: the old lease stays valid until its monotonic expiry. Retry with jittered backoff ≥ 1 s.

**An exchange on a held socket** checks only:
- `nowMono < lease.expiresAtMonoMs`;
- the lease's generation equals the socket's generation;
- the pins are unchanged.

There is no discovery on the request path.

**Replaced:**
- proxy: `owner_https.py` `_send`'s `_prove_pair` calls (`:239`, `:260`);
- owner: `owner-https.mjs`'s two `taskLeaseReader.read` calls (`:208`, `:223`).

The owner's `assertProductServiceTaskLease` (`:37`) keeps its field checks, but runs against the lease attached to the connection (§3.1.2), not a fresh read.

**When the lease expired without a successful renewal:** the next exchange makes **one synchronous proof** bounded by that request's deadline. If it fails as *unavailable*, refuse that request (`PAIR_UNAVAILABLE`) and don't poison.

#### 3.1.1 Splitting the discovery's refusal

Today every failure collapses into `fail()` / `_deny()`. Split it into two codes:

| Code | Meaning | Examples | Effect |
| --- | --- | --- | --- |
| `PAIR_UNAVAILABLE` | no answer we can judge | an SDK timeout, a throttle, a missing page, unsettled work | renewer: retry; synchronous proof: refuse that request |
| `PAIR_DRIFT` | an answer that contradicts the pins | wrong task definition or image digest; `desiredCount/runningCount ≠ 1`; a second RUNNING task; non-PRIMARY or non-COMPLETED rollout (unless `allowPrimaryInProgress`); a public IP; SG or subnet mismatch; the deployment id changing between the two service reads; the **own** task changing | retire (§3.2) |

The split goes through both discoveries:
- `service-pair-discovery.mjs` (the observation functions `serviceObservation`, `definitionObservation`, `taskObservation`, `networkObservation`, and the `read()` body);
- `service_pair_discovery.py` (`read`, `:245-351`, and its observation helpers).

**Keep the quarantine on unsettled SDK work** (the `finally` in each `read`), but make it renewer-scoped: the renewer recreates its discovery after a bounded cool-down (30 s), instead of the process staying quarantined.

#### 3.1.2 The new-socket rule (closes IP reuse, threat T3)

**Proxy** (`owner_https.py` `_connect`, `:211`), for every new socket, whether at startup or after a carrier reset:
1. Require a **valid lease** whose owner IP is the target.
2. Connect and handshake. The existing `_evidence` checks stay (TLS 1.3, ALPN, peer = owner IP:8444, local = proxy IP, leaf and issuer pins).
3. **Then run a full proof that starts after the handshake.** Its owner IP, ENI and task must equal the socket's peer and the lease's owner. Only then mark the socket usable for that generation.

**Owner** (`owner-https.mjs`), on a connection's first request, does the same from its side:
- a lease whose proxy IP equals `socket.remoteAddress`;
- a proof started after the TLS accept, matching it;
- the connection is then bound to that lease generation.

A connection whose generation is not current is refused (403, the socket closed, the service gate **not** poisoned).

### 3.2 Failure semantics (PR-A)

| Situation | Today | P2 |
| --- | --- | --- |
| Carrier busy, nothing sent | plain refusal | unchanged |
| Lease missing or expired; the synchronous proof is `PAIR_UNAVAILABLE` | process poisoned | refuse the request (`PAIR_UNAVAILABLE`); the renewer keeps retrying |
| Background renewal unavailable | n/a | nothing, until the lease expires |
| `PAIR_DRIFT` (renewal or synchronous proof) | poisoned at the next exchange | **retire:** close every socket, refuse every new exchange, fail readiness (ECS replaces the task). Detected within 10 s, even idle. |
| Read-only exchange (placement, admission, watch read) times out after bytes were sent | `abort()`: process poisoned | **reset that carrier:** close its socket and reconnect with the §3.1.2 proof. At most **3 resets per rolling minute** per process, else retire. Refuse that request. |
| RESERVE or SETTLE times out after bytes were sent | poisoned; hold UNKNOWN | refuse the request and **keep the UNKNOWN hold**. Reset the carrier. A reserve is never retried. SETTLE goes through the existing `read_outcome` path on a fresh carrier. |
| Owner: aborted request or read-only bounded overrun (`owner-https.mjs:193,206,222`, `owner-channel.mjs` bounded work) | owner poisoned | abort that request's work, discard its pool client, close its socket. **Poison only for unresolved mutating DB work** (`BudgetCommitUncertain`, the quarantine rule in `gateway/budget/product-model-settlement.mjs`). |

**Budget accounting stays fail-closed:**
- a hold whose outcome is unknown stays UNKNOWN and counts until settled or reconciled;
- no path infers "not dispatched";
- the owner never retries inference.

### 3.3 Partner re-proof replaces permanent retirement (PR-A)

**The rule:** a partner that is **replaced** is re-proven and served. A partner is rejected **only when the proof fails.**

**Replacement vs drift.** On a renewal, compare the new proof with the lease:

| Observation | Classified as | Action |
| --- | --- | --- |
| Same owner and proxy identity (taskArn, IP, ENI, createdAt) | renewal | extend the lease |
| **Our own** task identity differs | `PAIR_DRIFT` | retire (impossible while we run; never trust it) |
| The partner's identity differs, **and** the new observation passes every pin (the full discovery above, both service reads agreeing on one deployment id), **and** `new.createdAt ≥ old.createdAt`, **and** the new taskArn was never seen by this process | **replacement** | re-proof (below) |
| The partner differs and any pin fails (other revision, image, roles, network, count) | `PAIR_DRIFT` | retire |
| A previously seen partner taskArn returns, or `createdAt` goes backwards | `PAIR_DRIFT` | retire |

**Re-proof, in this order:**
1. **Close the old generation first.** Mark the old generation closed, refuse new exchanges on it, close every socket and session bound to it, and drop its lease.
   - In-flight requests on it fail as refusals.
   - Reserve and settle keep their UNKNOWN holds (§3.2).
2. **Install the new generation** from the new proof:
   - the owner updates `clientPolicy.ownerTaskArn/proxyTaskArn` (`owner-entrypoint.mjs:201`) through a generation holder, not a constant;
   - the proxy constructs its exchange carrier set for the new owner IP: a new `ProductOwnerHttpsExchange` generation, or a generation field on it; re-locate its construction in `owner_startup.py` / `main.py`.
3. **Serve again** only after the first new socket passes the §3.1.2 post-handshake proof on both sides.

**Bounds:**
- **A re-proof must complete within `PAIR_REPROOF_MS` = 30 s** (one TTL) of the replacement being observed. Until then the side refuses requests with `PAIR_REPROVING`, and its readiness stays true.
- **If it does not complete,** fail readiness and keep trying until the pins' absolute expiry.
- **At most 3 re-proofs per rolling 10 minutes** per process, else retire. A deploy legitimately replaces both partners in sequence, so a 1-per-5-min limit would block convergence.
- **Every re-proof** emits one `meri.health` line (`component:'pair'`, `transition:'reproven'`, §3.7) and one fixed-vocabulary diagnostic line, **outside** the 20/min refusal budget.

**What this removes:** the "restart owner and proxy together" rule. A one-sided restart or replacement re-proves in ≤ 30 s.

**What it does not do:** accept another revision. Revisions are pinned per deploy. A partner on a new revision means a new deploy, and this process is the one being replaced.

### 3.4 The admission lease (PR-A, stage 2)

**Today:** every request-path currentness check is a full exchange:
- `qualification/runtime/lifetime.py` `refresh` (`:124`);
- `native_auth.py`, `host_observation.py`, `request_admission.py`;
- the capture callback reads.

Admission receipts are single-use: `owner_admission.py:254-256` `_consume` pops them.

**P2:**
- **One lease per request lifetime:** every request-path `refresh()` / `current()` reads the **latest successful admission receipt** of its own `RequestLifetime`.
- **Valid while:**
  - `nowMono < min(receipt.expiresAtMono, readAtMono + 10 s)`;
  - same source digest;
  - same runner peer.
- **`_consume` stops popping:** a receipt is reusable within its own lifetime only, never across lifetimes.
- **The existing 5 s watch** (`lifetime.py` `_watch`, `:153-157`, `poll_seconds`) renews it, unchanged.
- **A renewal the owner answers with a refusal** cuts the request at once.
- **A renewal with no answer** lets the request run until the lease expires (≤ 10 s), then cuts it.

**Unchanged:**
- **The budget gate:** reserve's two Core currentness joins on the **owner** (`gateway/budget/product-model-budget.mjs`); the second runs inside the transaction, right before the UNKNOWN hold is recorded. That stays the authority before any provider send.
- **Settlement** keeps `require_current=False`.

### 3.5 Exchange collapse (PR-B, stage 3)

**Three exchanges per request, plus the watch:**

| Exchange | Replaces | Owner work, in order | Why it is safe |
| --- | --- | --- | --- |
| **ADMIT** (`meri.proxy.admit/1`) | placement read + admission resolve + session check + OPEN | placement resolve; admission read (facts + 2 currentness joins); open the session | Nothing the owner does depends on the runner ENI read, which the proxy runs after ADMIT and before reserve |
| **RESERVE** (`meri.proxy.operation/2`, claim + capture in one body) | OPERATION + POLL + REPLY | compare claim with capture first (as today, `gateway/model-proxy/product-reservation-bridge.mjs`), then the 2 currentness joins (the second in the transaction), then commit the UNKNOWN hold | The capture challenge carries no owner nonce, and both snapshots come from the proxy's `_source()` (B §1.3). The proxy still produces the capture from the host observation at send time, never by echoing the claim. |
| **SETTLE** (`meri.proxy.operation/2`, settlement + complete capture) | OPERATION + POLL + REPLY | compare, then settle or `commit-uncertain` | Same. `read_outcome` stays a separate exchange, only after `UNCERTAIN`. |

**The wire:**
- Bump the contract in `product/owner-wire-codec.mjs` and `product/boundary_codec.py`.
- **No dual-shape window:** pins are rendered per deploy and P2 retires on any revision mismatch (§3.3), so an old proxy can never pair with a new owner or the reverse. Remove the old frames in the same PR, and refuse a frame of the other version with `PRODUCT_OWNER_WIRE_REFUSED`.
- **`_claim()`** (`owner_channel.py:499`) is then held for one exchange (≈ 1 s instead of 6-12 s), so concurrent requests stop queueing behind each other.

### 3.6 Numbers, and where they live

| Constant | Value | Notes |
| --- | --- | --- |
| `PAIR_LEASE_TTL_MS` | 30000 | the existing cap |
| `PAIR_RENEW_MS` | 10000 | ±1000 jitter |
| `PAIR_REPROOF_MS` | 30000 | |
| `PAIR_REPROOFS_PER_10_MIN` | 3 | |
| `CARRIER_RESETS_PER_MIN` | 3 | |
| `ADMISSION_LEASE_MS` | 10000 | |
| `PAIR_RENEWER_QUARANTINE_COOLDOWN_MS` | 30000 | |

- **If P1** (`docs/hot-path/P1-PLAN.md`) has merged, add them to `packages/runtime/hot-path-budgets.mjs` as `background` entries (expiry ≥ 2 × period), and render the proxy's copies through its `budgets` block.
- **If not,** put them in `product/budgets.py` and one Node module (`product/owner-pair-lease.mjs`), and leave P1 to absorb them.
- **Either way:** no other literal, and both languages assert `TTL ≥ 2 × renew`.

### 3.7 Telemetry (one vocabulary change)

P0's `meri.health` line has a closed `transition` set: `quarantined`, `poisoned`, `retired`, `unavailable`.
- **Add `reproven`** in `apps/runtime/telemetry/turn-lines.mjs` and `product/telemetry_lines.py`. The secret-pin and schema tests are table-driven and cover it once added.
- **Add the codes** `PAIR_DRIFT`, `PAIR_REPROVEN`, `PAIR_UNAVAILABLE` and `PAIR_REPROVING` to the vocabularies (`turn-vocabulary.mjs`; `HEALTH_CODES` in `telemetry_lines.py`).
- **No new line type.** Renewals are not logged per success: the rollup's background `aws` counts show them.

## 4. File-by-file change list

### PR-A (stages 1-2, re-proof, failure rules; no wire change)

**Proxy (Python, `apps/proxy/product/`):**
- `service_pair_discovery.py`:
  - the `PAIR_UNAVAILABLE` / `PAIR_DRIFT` split;
  - remove the permanent `_identity` retire (`:340-346`) in favour of returning the observation and letting the renewer classify it;
  - keep the read lock.
- **New `pair_lease.py`:** the renewer (one task on the service loop, or one thread with a stop event), the lease, replacement classification (§3.3), generations, rate limits, health lines.
- `owner_https.py`:
  - `_send` checks the lease instead of `_prove_pair`;
  - `_connect` adds the post-handshake proof (§3.1.2);
  - the carrier holds a generation;
  - `abort()` only on drift;
  - per-carrier reset with the 3/min bound;
  - reserve/settle timeouts keep UNKNOWN.
- `owner_startup.py`, `main.py`, `host_composition.py`: start and stop the renewer; build the exchange per generation; readiness reflects retire and the re-proof bound.
- `owner_admission.py` (`_consume`, `:254`): a receipt reusable within its lifetime.
- `qualification/runtime/lifetime.py`, `native_auth.py`, `host_observation.py`, `request_admission.py`: request-path `refresh()`/`current()` read the lifetime's admission lease.
- `budgets.py` (or the rendered block, §3.6); `telemetry_lines.py` (§3.7).

**Owner (Node, `apps/proxy/product/`):**
- `service-pair-discovery.mjs`: the split; the renewer-scoped quarantine.
- `service-task-leases.mjs`: replace "first identity forever" with generations and §3.3's classification; keep retire on drift.
- **New `owner-pair-lease.mjs`:** the renewer and the lease holder (mirrors `pair_lease.py`).
- `owner-https.mjs`:
  - per-connection lease binding (§3.1.2) instead of the per-POST reads;
  - `assertProductServiceTaskLease` checks the bound lease;
  - aborted or read-only overrun closes that request, not the gate (§3.2).
- `owner-channel.mjs`: read-only bounded overruns stop poisoning. Mutating unresolved work still poisons.
- `owner-entrypoint.mjs`: `clientPolicy` task pins through the generation holder; start and stop the renewer; keep the startup pair wait (`readStartupPair`).
- `apps/runtime/telemetry/turn-lines.mjs`, `turn-vocabulary.mjs` (§3.7).

**Infra:** none (the same ECS/EC2 read APIs; no IAM change). If P1 has merged, the rendered `budgets` block gains §3.6's values.

### PR-B (stage 3, wire)

- `owner-wire-codec.mjs`, `boundary_codec.py`: the ADMIT and `operation/2` frames; remove the replaced frames.
- `owner_channel.py`, `owner-channel.mjs`: ADMIT, RESERVE, SETTLE handlers; `_claim()` scope.
- `owner_startup.py`, `bearer_eni_admission.py`: placement via ADMIT; the runner ENI read after ADMIT.
- `gateway/model-proxy/product-reservation-bridge.mjs`: compare claim and capture from one body.
- `apps/gateway/budget/product-model-budget.mjs`: **unchanged logic.** It is called from RESERVE.

## 5. Tests

**New and changed tests, both languages.** Name them after the property; each must fail when its property is removed (a mutation check: break the code locally, see red, revert).

**Pair lease and re-proof** (`test_pair_lease.py`, `owner-pair-lease.test.mjs`, extending `test_service_pair_discovery.py`, `service-pair-discovery.test.mjs`, `service-task-leases.test.mjs`, `test_owner_https.py`, `owner-https.test.mjs`, with `test/service-pair-fixture.mjs` scripted replies):
1. **No exchange without a valid lease.** An expired lease, a starved renewer, or a wall-clock step forward or back does not extend the TTL (monotonic). The exchange sends no bytes.
2. **No new socket without the post-handshake proof.**
   - The proof is started after `do_handshake()` / TLS accept, and must match the peer IP, ENI and task.
   - A proof that finished before the handshake does not count.
3. **Replaced partner task** (same pins, new taskArn, IP, ENI and createdAt):
   - classified as a replacement;
   - old sockets and sessions are refused, then closed;
   - the new generation serves only after the post-handshake proof;
   - re-proof completes within `PAIR_REPROOF_MS`;
   - one `meri.health` `reproven` line.
4. **Reused ENI / IP:** the old partner's IP now belongs to a task outside the pinned service, or a second task, or a non-member.
   - The new-socket proof fails, and no exchange is sent to that IP.
   - If the discovery shows two RUNNING tasks, it is `PAIR_DRIFT`.
5. **Changed revision:** the partner runs another task definition ARN or image digest. `PAIR_DRIFT`: retire, readiness false, **never re-pinned.**
6. **Other drift:** count ≠ 1, a public IP, an SG or subnet change, a deployment id changing between the two service reads, our own task changing. Each is `PAIR_DRIFT` and retires.
7. **Flip-flop:** a previously seen partner taskArn, or an older createdAt, is `PAIR_DRIFT`.
8. **Rate limits:** a 4th re-proof within 10 min retires; a 4th carrier reset within 1 min retires.
9. **Unavailable is not drift:** throttles and timeouts during renewal leave the lease valid until expiry. After expiry, one synchronous proof per request; on failure, refuse that request only.

**Failure semantics** (`test_owner_https.py`, `test_owner_channel.py`, `owner-https.test.mjs`, `owner-channel.test.mjs`, `gateway/budget/product-model-settlement.test.mjs`):

10. **Read-only timeout after send:** the carrier resets, the request is refused, and the process keeps serving the next request.
11. **RESERVE / SETTLE timeout after send:** the hold stays UNKNOWN, there is no retry, and SETTLE resolves via `read_outcome` on a fresh carrier. **The UNKNOWN hold is never dropped.**
12. **Owner:** an aborted read-only request does not poison the gate; unresolved mutating work still does.

**Admission lease** (`test_owner_admission.py`, `test_request_admission.py`, lifetime tests):

13. A receipt is reused within its lifetime, refused across lifetimes, and expires at `min(expiresAt, readAt + 10 s)`.
14. An answered refusal cuts at once; a no-answer cuts at lease expiry.
15. Reserve still makes its two owner-side joins, the second in the transaction.

**Wire (PR-B):** `owner-wire-codec.test.mjs`, `test_owner_wire_envelope.py`, `test_complete_capture_codec.py`, `test_boundary_codec.py`.

16. Golden ADMIT / `operation/2` frames.
17. Old-version frames refused.
18. Claim/capture mismatch refused before any owner work.
19. `_claim()` released after one exchange.

**Counts** (both PRs):

20. A composed proxy↔owner test over the scripted discovery and real TLS (extend `test_owner_https.py` with the Node owner, or the existing composed fixtures) runs one request and asserts:
    - PR-A: ≤ 13 exchanges, 0 discoveries attributed to the request on either side, ≤ 12 owner Core joins;
    - PR-B: ≤ 7 exchanges.

**Existing gates that must stay green:**
- **The image gate:** `infra/product-preview/image-build-producer.py` `LINUX_ONLY_TESTS`, 24/24 (§13.2).
- **Every proxy suite** in the pinned-requirements image (§13.3), and every owner Node suite (`apps/proxy/product/*.test.mjs`).
- **The first-turn and D3 rehearsals** (§13.4). They don't exercise the proxy, but they guard shared modules.
- **P0's telemetry secret-pin tests** in both languages, with `reproven` added.

## 6. Acceptance on preview (the shipper checks these after deploying each PR)

**On a two-turn chat, from P0 telemetry:**
1. **Owner exchanges per model request** (`meri.model.request.ownerExchanges`): ≤ 13 after PR-A, ≤ 7 + 1 per 5 s of stream after PR-B.
2. **Request-attributed proxy `aws`:** only DescribeTasks / DescribeNetworkInterfaces, ≤ 2 + 2 per 5 s.
3. **Owner request-attributed `aws` is 0** (`meri.turn.counters`).
4. **Background `meri.process.rollup` `aws`:** about 60 ECS/EC2 calls per minute per side, at idle and under load alike.
5. **Owner `core`** per request ≤ 12; **`ownerExchangeMs`** ≤ 5 s at median.
6. **The first-text time** (`meri.turn.summary.firstTextMs`) improves by at least the owner-path delta.

**One-sided restart** (the deploy fix):
7. Restart **only** the proxy service: the owner logs one `reproven` and serves within 30 s.
8. Then restart **only** the owner: the proxy does the same.
9. No turn fails outside that window.

**Drift (revision):** a deploy that changes one service's task definition:
10. The old partner retires within 10 s (`meri.health` `retired`, code `PAIR_DRIFT`).
11. ECS replaces it, and the new pair serves.

**Alarms:**
12. `meri-preview-proxy-owner-unavailable` and `pair-refusals-sustained` stay OK after the first 2 minutes.
13. `budget-quarantine` stays OK.

## 7. Out of scope

- **Core authority changes** (P6) and the owner's Core join count beyond what the leases remove.
- **Accepting a partner on another revision.**
- **New ECS/EC2 API calls or IAM changes.**
- **Bedrock, LiteLLM** (`product/litellm-product-config.yaml` is SHA-pinned in `product/Dockerfile:44`), **the CLI and the runner.**
- **Budget values,** other than §3.6's new background constants.
- **The owner's 5 405 DB statements per request:** a follow-up. P2 will lower it as a side effect of fewer exchanges, but it does not target it.

## 8. Rollback

- **Redeploy the previous owner and proxy images together,** one change set. P2 adds no schema and no persistent state; leases and generations are in-process.
- **After PR-B,** owner and proxy must roll back together (the wire version). §3.5 guarantees a mixed pair refuses rather than corrupts.

## 9. Validation checklist and the independent review

**The shipper:**
- [ ] diff limited to §4 per PR; no IAM, LiteLLM, CLI or runner change;
- [ ] §5's tests present, and each mutation-checked: the PR description says which edit turned it red;
- [ ] the image gate 24/24; proxy and owner suites name-equal to the base apart from new tests; the rehearsals equal;
- [ ] P0 secret-pin tests pass with `reproven`;
- [ ] **independent security review approved** (below);
- [ ] after deploy: §6 items 1-13, with the Logs Insights output in the validation report.

**The independent security review (required, PR-A and PR-B):**
- **Who:** someone who did not write or plan the change, given ADR §2.4, B's threat model (`adj-b-PROOF-REUSE-DESIGN.md` §3, T1-T10) and this plan.
- **What they confirm:**
  - goals (a)-(e) in §1;
  - the replacement-vs-drift table in §3.3 cannot be steered by a partner. Every field it trusts comes from the AWS read the side itself made with its own task role;
  - the lease cannot outlive its monotonic expiry;
  - a generation change closes every old socket and session before the new one serves;
  - no path drops an UNKNOWN hold;
  - **the relaxation from "fresh proof around every reply" to "every reply inside a valid socket-bound lease" is acceptable** (B §3, "Residual difference"). That relaxation needs their explicit sign-off.
- **The implementer requests the review in the PR description** and does not merge or ship.

## 10. Base branch, conflicts, effort

**Branches:**
- `feat/meri-p2-proof-reuse` (PR-A) from `main` @ `e3ba4e47`;
- `feat/meri-p2-exchange-collapse` (PR-B) from PR-A's merge.

**Conflicts:**
- **P1** (`docs/hot-path/P1-PLAN.md`) edits construction-time numbers in `service-pair-discovery.mjs`, `owner-https.mjs`, `owner-entrypoint.mjs`, `owner_https.py`, `service_pair_discovery.py`, `main.py`. Whichever merges second rebases. P2 reads its constants by P1's table id when P1 is in (§3.6).
- **The turn-2 admission fix** on `main` (shipper's team) touches `apps/runtime/native-authority/*`, not these files. Still, rebase onto the latest `main` right before each PR and re-run §13.2-§13.4.

**The PR description lists:**
- the §13 commands and their summary output;
- a pre-existing-failures table against the base;
- each test's mutation check;
- the security-review request.

**Effort:** about **1.5–2 weeks** (ADR §6):

| PR | Days | Breakdown |
| --- | --- | --- |
| PR-A | 6–7 | renewer and leases ×2 languages, 3; re-proof and failure rules, 2; admission lease, 1; tests and gates, 1 |
| PR-B | 3–4 | wire and handlers 2; tests 1–2 |

The security review is extra calendar time.

## 11. Parallel work

| Work | Interaction |
| --- | --- |
| P1 budget table | shared files (§10); rebase |
| P6-Core (capiro-backend) | none; another repository |
| Turn-2 admission fix | different files; rebase |

## 12. Who validates and ships

The Meri shipper:
- validates against §5-§6, re-running the proxy suites in the **deployed product proxy image** (which you cannot pull: it is built from a private assembly image, §13.3);
- obtains the independent review;
- deploys owner and proxy together;
- checks §6 live.

## 13. Environment: a fresh Linux box

**The validated harness:** P0's, which ran its gates end to end (adj-a, 2026-10-21). It is in `main`'s history at `43b705c8`, `scripts/qualification/p0-telemetry/`. Copy it out; don't commit it.

### 13.1 Prerequisites and the harness

- Ubuntu 22.04/24.04, Docker 24+, git, Python 3.13, Node 24.19+, `openssl`, 16 GB RAM, 40 GB disk.
- One container at a time.

```bash
git clone https://github.com/neo-capiro/meri-greenfield.git && cd meri-greenfield
git switch -c feat/meri-p2-proof-reuse e3ba4e47
mkdir -p ~/p0h && for f in verify.py evidence.py in-image.sh proxy-tests.sh proxy-test.Dockerfile; do
  git show 43b705c8:scripts/qualification/p0-telemetry/$f > ~/p0h/$f; done
```

Run each mode on a **committed** checkout of your branch and of the base (`--side base`):

```bash
python3 ~/p0h/verify.py proxy   --source . --output ~/p2-out/head-proxy   --side head   # every proxy Python module
python3 ~/p0h/verify.py runtime --source . --output ~/p2-out/head-runtime --side head   # runtime image, gate, owner Node suites, rehearsals
python3 ~/p0h/verify.py infra   --source . --output ~/p2-out/head-infra   --side head   # host render tests
```

### 13.2 The image gate

The `runtime` mode builds `apps/runtime/Dockerfile` (the owner runs from this image too) and runs the 24-case gate exactly as the build does:
- the 10 `FIXTURE_PATHS` read-only;
- `--read-only --network none --cap-drop ALL`, uid 1000;
- the build reporter.

**Pass:** `"observedCases":24`, `"failedCaseIds":[]`, `{"B":6,"R":6,"W":12}`.

### 13.3 The proxy: the pinned environment you can build

**The deployed proxy image cannot be built here.** `apps/proxy/product/Dockerfile` starts `FROM ${PROXY_ASSEMBLY_IMAGE}`, a private, digest-pinned assembly image. Its build-time check (`:44`) pins:
- LiteLLM 1.104.2, httpx 0.28.1, boto3/botocore 1.43.111, uvicorn 0.51.0, h11 0.16.0, prisma 0.11.0;
- the LiteLLM config SHA.

**Use the harness's `proxy` mode instead:**
- it builds `proxy-test.Dockerfile`: `python:3.13-slim`, plus the Node 24 binary from the pinned Node image;
- it installs `apps/proxy/qualification/linux/requirements.lock` with `--require-hashes --only-binary=:all:`;
- so it gets the **same pinned package versions** without the private image;
- it runs every module (`apps/proxy/product/test/test_*.py`, `apps/proxy/product/test_*.py`, `apps/proxy/qualification/test/test_*.py`) by dotted name;
- it runs as uid 10001 on a root-owned, `go-w` copy of the tree. The reviewed-file checks refuse world-writable or foreign-owned files, so never bind-mount the checkout.

**One module at a time:**

```bash
bash ~/p0h/proxy-tests.sh meri-p0-proxy:$(git rev-parse --short=12 HEAD) . 1800 \
  apps.proxy.product.test.test_owner_https apps.proxy.product.test.test_service_pair_discovery
```

**Known on the base:**
- `test_model_proxy_material` errors without a repository `node_modules`;
- `test_aws_counter` and `test_bedrock_transport` need `AWS_EC2_METADATA_DISABLED=true` (ECS sets it at the task level). Pass `-e` through a wrapper or record them as pre-existing.

**The shipper re-runs the proxy suites in the deployed product image** before shipping.

### 13.4 Owner Node suites, rehearsals, `openssl`

- **The `runtime` mode runs the owner Node suites** (`apps/proxy/product/*.test.mjs`) and the rehearsals in the runtime image.
- **Suites that import `apps/runtime/native-authority/test/router-tls-fixture.mjs`** need `openssl`, which the runtime image lacks. Run them on the host after the `infra` mode's `npm ci` installs:

  ```bash
  MERI_REVIEW_SOURCE_ROOT=$PWD node --experimental-test-module-mocks --test --test-concurrency=1 <files>
  ```

- **Rehearsals with non-empty `hostClockSteps`** that fail on timing are void: re-run them.

### 13.5 Compare against the base

Run §13.1-§13.4 on `e3ba4e47` and on your branch. In the PR, list every failing test with its base result. **"No new failure" is the bar.**
