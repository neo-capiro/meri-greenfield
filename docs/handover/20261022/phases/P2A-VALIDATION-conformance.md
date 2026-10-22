**Verdict: CHANGES.** Two blocking defects: **F1** (answered owner refusals retire the shared proxy; reproduced) and **F2** (a real ECS replacement retires instead of re-proving, and nothing replaces a retired process; this needs a plan decision). Scope, the clean merge onto `3c56c3e9`, image gate 24/24, the proxy suites in the deployed image, the secret pins and the critical mutations all pass. The change list is in §4.

Validation of meri-greenfield **PR #196** "P2 PR-A: reuse owner/proxy proofs and recover partner generations", `feat/meri-p2-proof-reuse` @ `e76a0eae`, against `phases/P2-PLAN.md` §4, §5, §9 and §13.
- By adj-d3-readiness, 2026-10-21. Read-only: no edits and no GitHub comments.
- AWS: describes only. One ECR pull of the deployed proxy image, with the token piped into `docker login` and logged out after.
- Labels: **[R]** ran or read now, **[D]** derived from code, **[I]** inference.

## 0. Merge onto `main` @ `3c56c3e9` [R]

- **No conflict.** The PR is one commit on `96b6da6d`. `main` adds one commit, `3c56c3e9`, which touches only `apps/runtime/native-authority/remote-composition.mjs` and three runtime tests. The PR touches none of them.
- I validated the local trial merge `f9a7dc6c` = `3c56c3e9` + `e76a0eae` (WSL, never pushed). The base for every comparison below is `main` @ `3c56c3e9`.

## 1. Scope against §4 [R]

**Not touched (`git diff --stat` is empty):**
- IAM, `infra/**`;
- LiteLLM (`product/litellm-product-config.yaml`, `product/Dockerfile`);
- the CLI and the runner (`apps/runtime/*` except `apps/runtime/telemetry`);
- `apps/gateway/**`, so the budget logic, reserve's two Core joins and the UNKNOWN-hold rules are untouched;
- `packages/**`, `apps/control/**`;
- every wire codec (`owner-wire-codec.mjs`, `boundary_codec.py`).

There is no wire change, as PR-A requires.

**Files outside §4's PR-A list, and whether they are needed:**

| File | Change | Needed? |
|---|---|---|
| `owner-request-work.mjs` (new) + test | Request-owned pool. Evicts clients on abort; poisons only on a dirty or in-flight mutating client | **Yes.** This is how §3.2's owner row is built |
| `product-owner-facts.mjs`, `product-owner-placement.mjs`, `owner-native-currentness.mjs` (+ tests) | Drop their permanent quarantine on unsettled I/O; run on a per-request read-only `createOwnerRequestWork`. Currentness also drops a per-binding cache (cap 1024) that held no state | **Yes.** Otherwise one slow read still disables the owner (§3.2) |
| `owner-credential-delivery.mjs` (+ test) | No quarantine on a pending fetch or unanswered cancel; a late response body after the deadline is refused | **Yes** (§3.2). Changes delivery semantics; abort signals are still passed |
| `owner-request-telemetry.mjs` | Passes `canReadOutcome`, `close` and `readOutcome` through | **Yes.** Settle recovery on a fresh carrier |
| `owner-diagnostics.mjs` (+ test) | `pairReproven()` | **Yes** (§3.3, §3.7) |
| `apps/runtime/telemetry/turn-context.mjs` (+ test) | `background()`: renewer AWS calls are kept out of request attribution | **Yes** (§1, §5 test 20) |
| `refusal_diagnostics.py`, `service_entrypoint.py`, `uvicorn_tls_protocol.py` (+ tests) | The reproven raw line; readiness wiring (`service_ready = exchange.ready`) | **Yes**: this is where §4's "readiness reflects retire / re-proof" landed. See finding F3 |
| `owner-https-tls.test.mjs`, `owner-outcome-cancel.test.mjs`, `test/p2-composed-owner.mjs`, `test/p2-owner-fixture.mjs`, `test_pair_lease_composed.py` | New tests and fixtures | Yes |
| `host_composition.py` | Comment only (its planned job landed in `uvicorn_tls_protocol.py` / `service_entrypoint.py`) | Harmless |
| `request_admission.py` (listed in §4) | **Not changed** | Not needed: it makes no request-path currentness read |

**Verdict on scope:** within PR-A. Every extra file supports §3.2, §3.3 or the counts, and none widens behaviour beyond the plan.

## 2. Conformance (§3), with the findings that need action

Three read-only sub-reviews covered the proxy pair lease, the owner pair lease and the admission lease. I re-read and confirmed every finding below myself; the file:line references are at `e76a0eae`.

**What conforms [D]:**
- **§3.1:** one renewer per side, and the only discovery caller.
  - Period 10 s ±1 s; TTL 30 s on `time.monotonic` / `performance.now`; `TTL ≥ 2×renew` asserted in both languages.
  - A failed renewal keeps the lease.
  - The per-exchange discovery is gone: `_prove_pair` from `_send`, and both `taskLeaseReader.read` from `owner-https.mjs`.
  - A held socket checks the lease, its generation and both expiries.
- **§3.1.1:** the `PAIR_UNAVAILABLE` / `PAIR_DRIFT` split, in both languages; an observed drift wins over a concurrent timeout. The quarantine is renewer-scoped, with a 30 s cool-down and recreate.
- **§3.1.2:** the post-handshake proof.
  - **Proxy:** `_connect` takes the lease, then binds, connects, handshakes and runs `_evidence`. `prove_socket` then starts a new read and matches generation, task/IP/ENI/createdAt and the peer and local IPs.
  - **Owner:** binds at TLS `secureConnection`. It refuses a proof whose start is earlier than the handshake (`owner-pair-lease.mjs:129-130`).
  - A stale generation gets 403 and a closed socket, without poisoning the gate.
- **§3.3 classification and order** (`pair_lease.py:143-180`, `owner-pair-lease.mjs:57-87`):
  - own identity changed → drift; a seen taskArn or a backward createdAt → drift; a pin failure → drift (inside the discovery);
  - the 4th re-proof in 10 min → retire;
  - the old lease is nulled, every close listener runs (sockets, sessions, bridges), then `generation++` and install;
  - `PAIR_REPROVING` until a post-handshake proof; readiness stays true for 30 s, then false;
  - one `reproven` health line plus the diagnostic, outside the refusal budget.
- **§3.4 admission lease:**
  - per-lifetime receipts; `_consume` no longer pops;
  - bound to its own lifetime by a weakref map, so it can't be presented in another;
  - expiry `min(receipt, read + 10 s)` on the monotonic clock; same source bytes; same runner peer tuple;
  - the generation close clears every receipt;
  - the 5 s watch renews it; an answered refusal cuts at once; a no-answer keeps the lease until expiry, and a watcher then cuts;
  - the owner reserve is unchanged; settlement keeps `require_current=False`.
- **§3.6/§3.7:** constants in `budgets.py` and `owner-pair-lease.mjs`; `reproven` plus the four codes in both vocabularies; secret-pin tests are table-driven (`turn-lines.test.mjs:74-81`, `test_telemetry_lines.py`).

**Findings.**
- **F1:** answered owner refusals spend the proxy's carrier-reset quota, so 4 in a minute retire the whole proxy. **Bug, must fix.** [D, confirmed in code; reproduction in §4]
  - `owner_https.py:390-393` marks `_sent_channels[channel] = connection` before every write and never clears it after a successful exchange.
  - `_send`'s handler resets the carrier on **any** failure past the lease step, and the reset counts as "sent" (`:264-282`, `:415-416`). That includes a reply rejected at `reply-status`, such as an answered 403. The 4th in a rolling minute calls `abort()`.
  - The owner answers every refused dispatch with 403 and `connection: close` (`owner-https.mjs:276-277`).
  - `owner_channel.py` also resets on errors raised before any byte left (`:436-438`, `:552-555`, `_sent` set at `:441`).
  - So ordinary refusals (a revoked grant, a stale capability, a currentness denial), or a `PAIR_UNAVAILABLE` raised at the lease step, can retire the shared proxy for every user. §3.2 limits the quota to read-only timeouts after send.
- **F2:** a real partner replacement or deploy almost always retires instead of re-proving, and a retired process never restarts on this infrastructure. **Plan-level; must be decided before shipping.** [D + R live config]
  - **The code is as the plan's drift table says.** Both discoveries map `desiredCount/runningCount ≠ 1`, `pendingCount ≠ 0`, zero or two RUNNING tasks, and a non-PRIMARY or non-COMPLETED rollout to `PAIR_DRIFT` (`service_pair_discovery.py:118,129-131,356-360`; `service-pair-discovery.mjs:72-77,171-172`). These checks are unchanged from the base, where they only refused that one exchange. Now they retire.
  - **What ECS does [I]:** a Fargate replacement passes through `runningCount 0 / pendingCount 1` for tens of seconds. A rolling deploy runs two tasks, so `maximumPercent 200` is seen as `runningCount 2` or two RUNNING tasks. A 10 s renewer will see both states, so §1's "re-proven within 30 s" won't happen live.
  - **Live configuration [R, ECS describe]:** `meri-product-preview-proxy:41` and `meri-product-preview-owner:41` have **no container health check**, and neither service has a load balancer.
  - **`retire()` does not exit the process on either side.** The proxy keeps answering `not-ready` (`service_entrypoint.py:99-104`); the owner keeps refusing (`owner-pair-lease.mjs:38-49`).
  - So the plan's "fail readiness, ECS replaces the task" never happens. **A retired process stays up and serves nothing until someone restarts it.**
  - **Required decision:** (a) treat partner-only transitional states (count, pending or rollout in progress, with every pin of the observed tasks intact) as `PAIR_UNAVAILABLE`; and (b) make `retire` exit the process non-zero, so the essential container stops and ECS replaces the task, or add an ECS container health check on readiness, which is an infra change. Without (a) and (b), §6 acceptance items 7-11 will fail.
- **F3:** proxy readiness requires a valid lease, so after the lease expires every request is refused `not-ready` before the planned synchronous proof (§3.1) can run. **Deviation.** [D]
  - `service_ready = exchange.ready` → `pair_lease.ready` requires `now < lease.expires` (`pair_lease.py:101-108`; `uvicorn_tls_protocol.py:196`; `service_entrypoint.py:99`).
  - It fails closed and recovers when the renewer succeeds again (it retries every 1-2 s). Either let readiness ignore lease expiry so `require(deadline_ms=…)` runs, or amend the plan. The owner behaves the same (`owner-https.mjs:137`).
- **F4:** §5 test 12's mutating half has no channel-level test. [D]
  - Every former poison test in `owner-channel.test.mjs` was flipped to "available".
  - Only the adapter unit test (`owner-request-work.test.mjs:24-32`) shows that unresolved mutating work poisons. My mutation O1 (§4) quantifies this.
- **F5:** §5 test 20 (the composed count) runs with **both renewers stopped** and scripted Core. [D]
  - So "0 request-path discoveries" doesn't show that background renewals stay out of the request.
  - "12 Core joins" counts currentness calls at the port, not Core HTTP calls.
  - The numbers (13 exchanges, 0, 12) are still a fair PR-A check of the request path itself.
- **Minor; not blocking, list for agent 2:**
  - **M1, admission `_install` race:** it publishes `state.receipt` (`owner_admission.py:351`) before binding the receipt to its lifetime (`:353`), and drops the old one only after the swap (`:356`). A loop-thread `check()` in that window can deny a valid request (`ADMISSION_LEASE_EXPIRED`). Bind first, publish second, retire the old one last.
  - **M2:** after an unanswered renewal, the next watch tick awaits the leftover finished task instead of making a fresh read (`lifetime.py:162-177`), so one slow reply can cost a whole tick.
  - **M3:** the admission lease's `read_at` is taken after the reply (`owner_admission.py:242`), not when the read starts. It can outlive Core's check by up to `max_exchange_ms`.
  - **M4:** `retire()` always reports `PAIR_DRIFT` (`pair_lease.py:268`), including for reset exhaustion and the re-proof limit.
  - **M5:** the owner renewer retries every 1-2 s for good on `PAIR_UNAVAILABLE` (`owner-pair-lease.mjs:150`), so during an AWS throttle it keeps polling at that rate.
  - **M6:** a SETTLE after a re-proof can never read its outcome (`owner_channel.py:661`). It fails closed (the UNKNOWN hold stays), which is narrower than §3.2's wording.
  - **For the security review (A):**
    - `_consume` with a lifetime skips `validate_capture_admission_lease` (`owner_admission.py:304-306`);
    - read-outcome may cross to a fresh socket of the same generation (`owner-https.mjs:189-191`).

## 3. Gates as the shipper would run them [R]

*These gates had already finished when the orchestrator's stop order (O104) arrived, so they are recorded as run. They apply to `e76a0eae` only, and the next revision must rerun them.*

All runs were on the trial merge `f9a7dc6c` (head) and on `main` @ `3c56c3e9` (base), one container at a time, in WSL2 Docker, linux/amd64. The P0 harness is `scripts/qualification/p0-telemetry/` @ `43b705c8`, copied unchanged to `phases/p2a-harness/`.

### 3.1 Runtime image (P0 harness `runtime` mode, `apps/runtime/Dockerfile`)

| Check | Base | Head | Equal or better? |
|---|---|---|---|
| **Image gate** | **24/24** (B6 R6 W12), `gateValid` | **24/24** (B6 R6 W12), `gateValid` | Yes |
| owner (`apps/proxy/product/**/*.test.mjs`) | 218/218 | 266/271 in the image. All 5 failures are `spawnSync openssl ENOENT` (the runtime image has no openssl CLI, §13.4). On the WSL host with openssl: **271/271** | Yes |
| telemetry | 47/47 | 49/49 | Yes |
| first-turn rehearsal | 6/6 (clock-step retry) | 6/6 (clock-step retry) | Equal |
| D3 rehearsal | 9/9 (clock-step retry) | 9/9 clean | Equal |
| control | 46/47 | 46/47, same test | Equal |
| changed-tests | 1 fail | same 1 fail | Equal |
| worker | 6 fail | 5 fail. The base-only failure ("late SDK iterator is bounded by deadline…") is a flake; the other 5 are identical | Equal |
| runner-diagnostics | 2 fail | 3 fail in the first run | Equal after rerun ↓ |

- **Runner rerun:** I ran the runner-diagnostics group twice more per side.
  - Head's extra failure ("a CLI ended by SIGTERM after initialize…") **passed in both head reruns**.
  - Base had its own one-off failure ("SDK initialization milestones…").
  - The stable failures are identical on both sides: `native-start-router-budget.test.mjs` and `pinned-native-transport.test.mjs`, at file level.
  - The PR touches no runner file, so this is a timing flake, not a regression.
- **Owner Node suites, by name** (`tap-names.py` on the two TAP logs):
  - 0 status changes on shared names.
  - 16 names removed and 69 added.
  - Each removed name is a rename that flips "quarantines / poisons the shared service" to "refuses only its request" (§3.2), or "never caches a read" to "reuses a valid held-connection lease" (§3.1). Each has a counterpart among the added names.
  - The proxy Python tests have 13 such renames, for 29 in all, which matches the PR's count. Every renamed rejection case keeps a test (for example `…reversed_clock…` now lives in `test_discovery_returns_replacement_for_lease_owner_and_refuses_reversed_clock`).
  - **Name-equal apart from new tests and the intended semantic renames.**

### 3.2 Proxy Python suites (§13.3)

The P0 harness `proxy` mode reports *unverified* on **both** sides: `test_aws_counter` raises `OFFLINE_ENV_REQUIRED` at import without `AWS_EC2_METADATA_DISABLED`, which aborts the single unittest process. That is a harness defect and is equal on both sides. Instead I ran every module in its own process (`proxy-modules.py`), as uid 10001 on a root-owned go-w tree, with `AWS_EC2_METADATA_DISABLED=true` as ECS sets it.

| Image | Base | Head | Head-only failures |
|---|---|---|---|
| Pinned P0 proxy image (`python:3.13-slim` + `requirements.lock` + node) | 40 modules, 364 ran | 42 modules, 408 ran | `test_pair_lease_composed` 2/2 |
| **Deployed product proxy image** (`meri-product-preview-proxy:41`, `qualification-worker@sha256:39ae50cd…`, pulled read-only) | 406 ran | 450 ran | `test_pair_lease_composed` 2/2 |

- **Common failures, identical on both sides:**
  - `test_aws_counter` and `test_bedrock_transport` in the pinned image (environment);
  - `test_owner_wire_envelope`, 7 failures in the deployed image (no node there).
- **`test_pair_lease`:** 12/12 in both images.
- **`test_pair_lease_composed`** fails because of the environment, not the code:
  - it spawns the Node owner (`p2-composed-owner.mjs`);
  - in the pinned image that dies with `Cannot find package 'ajv'` (no workspace `node_modules`);
  - in the deployed image it fails with `FileNotFoundError: 'node'`.
  - Rerun in the pinned image with the installed head tree mounted read-only: **2/2 OK** (22 s).
  - So this test **cannot run in the deployed proxy image**, where it errors instead of skipping (change C7).
- **Secret pins:** `test_telemetry_lines` (9/9) and `test_refusal_diagnostics` (7/7) pass in both images. `turn-lines.test.mjs` passes in the runtime image (telemetry 49/49).
  - Both are table-driven over `PAIR_DRIFT`, `PAIR_REPROVEN`, `PAIR_UNAVAILABLE` and `PAIR_REPROVING`, with `transition: "reproven"`.
  - Both assert that `taskArn` and IP pins are never serialized.
  - **P0 secret-pin gate passes with `reproven`.**

### 3.3 Rehearsals and counts against the live baseline

| Per model request | Live baseline (P2-PLAN §1) | PR-A target (§1 table) | This PR, measured | Source |
|---|---|---|---|---|
| Owner exchanges | ≈ 31 | — | **13** (warm 20.2 s request, 4 watch renewals) | composed test, asserted `len(calls) == 13` [R, 2/2 pass] |
| Request-path pair discoveries / proofs | 61 owner discoveries | 0 | **0** on both sides | composed test [R] |
| Owner ECS/EC2 calls attributed to the request | 609 | 0 | **0** request-path | composed test, scripted AWS [R]; renewers stopped (F5) |
| Proxy ECS/EC2 calls attributed to the request | ≈ 650 (156 attributed + ≈ 493 background) | ≤ 10 | 0 request-path discoveries | composed test [R]. Runner ENI reads are not exercised there |
| Owner Core currentness joins | 93 | ≤ 12 | **12** (scripted port count, not Core HTTP) | composed test [R] |
| Background discovery | ≈ 60 calls/min/side | one renewer per side per 10 s | — | not measured: needs live §6 acceptance |

- **The P0 rehearsals are equal to base:** first-turn 6/6, D3 9/9.
  - They are scripted, and they report `awsCalls: 0` on both sides, so they can't measure exchange or AWS counts.
  - The only executable per-request count is the composed test. It is in-process, with scripted AWS and Core and with **renewers stopped**.
- **[I]** On that evidence the request path drops from 31 exchanges and ~1,259 attributed ECS/EC2 calls to 13 and 0. Proving the live numbers, and that renewals stay out of request attribution, needs §6 live acceptance after deploy (it can't be run read-only).

### 3.4 Mutation spot-checks (§5): one guarded line reverted in a scratch copy, then the named tests rerun

**Python**, in the pinned proxy image. The unmutated baseline is green and the restored final run is green.

| Id | Guard reverted | Result |
|---|---|---|
| P1 | **Lease expiry:** `self._mono() >= lease.expires_at_mono_ms` removed (`pair_lease.py:230`) | **red**: `test_lease_checks_monotonic_expiry_even_after_wall_steps_and_renewer_starvation` |
| P3 | **Generation change:** `self._lease = None` before close callbacks → `pass` (`:157`) | **red**: `test_replacement_closes_generation_before_install_and_needs_fresh_socket_proof` |
| X1 | **Held socket ignores generation** (`:232` → `if False:`); not in the PR's table | **red**: same test |
| B5 | **Generation change closes old bridges:** `bridge._invalidate_generation()` → `pass` (`owner_channel.py:252`) | **red**: `test_generation_change_invalidates_old_bridge_and_source_before_new_request` |
| P4a / P4b / P4c | **Replacement vs drift:** own task changed, seen partner ARN, backward createdAt → not drift | **red**: each its own subTest of `test_own_replacement_old_partner_return_and_backward_created_at_retire` |
| B2 | **UNKNOWN hold:** reserve retry guard `self._state != "NEW"` removed (`:593`) | **red**: 7 tests incl. `test_reserve_timeout_retains_unknown_and_never_retries_reserve` |
| B3 | **UNKNOWN hold on settle timeout:** `if self._sent and self._generation_current():` → `if False:` (`:661`) | **red**: `test_settle_timeout_preserves_unknown_then_reads_outcome_on_fresh_carrier` |

**Node**, on the WSL host (Node 24.19, openssl present). It runs on the host because `owner-https-tls.test.mjs` needs the openssl CLI.

| Id | Guard reverted | Result |
|---|---|---|
| N1 | **Lease expiry:** `mono>=lease.expiresAtMonoMs` removed (`owner-pair-lease.mjs:54`) | **red**: "no valid lease means no exchange; …monotonic TTL" |
| N3 | **Generation change closes old sockets:** `notify('replacement',old)` → `void old` (`:71`) | **red by hang**: the run hit its 900 s timeout and never passed. A hang is a weak kill (change C6) |
| X2 | **Connection ignores generation** (`:53`); not in the PR's table | **red**: "replacement closes old sockets and sessions first; …" |
| N4 / N6 / N5 | **Replacement vs drift:** own identity, seen partner ARN, backward createdAt | **red**: "own task/ENI retires…", "a previously seen partner ARN…", "older replacement retires…" |
| O1 | **UNKNOWN never dropped (owner):** `if(outstanding.some(…dirty\|\|mutating))onUnresolvedMutation()` → `if(false)` (`owner-request-work.mjs:45`) | **red, but only in the adapter unit test** ("unresolved mutation and transaction commit poison…"). `owner-channel.test.mjs` and `owner-outcome-cancel.test.mjs` stay green (24 → 23/24). This confirms F4 |

The Node baseline and the restored final run are both green (24/24) once `MERI_REVIEW_SOURCE_ROOT` is set. That variable is the explicit source root that `owner-channel.test.mjs` asserts on; my first host run omitted it.

**F1 reproduced** (`repro_refusal_quota.py`, a scratch test on the PR's own `test_owner_https.exchange()` fixture; not committed):
- A valid pair lease, and an owner that answers every exchange with HTTP 403.
- Trace: attempts 1-3 `StateDenied PRODUCT_OWNER_HTTPS_DENIED, available=True`; attempt 4 `StateDenied, available=False`; attempt 5 `PairProofError PAIR_UNAVAILABLE`.
- **Four answered refusals in a minute retire the shared proxy.**

### 3.5 The agent's host matrix (6,351 passed / 72 failed / 23 skipped)

- **[R] The PR's 72-row table** lists every failure as `fail | fail` (base | head): 72 of 72 rows, 0 new.
- **The group totals agree with my independent counts where the suites overlap:**
  - owner 218 → 271;
  - telemetry 47 → 49;
  - control 46/1;
  - proxy Python 385 → 429 (my per-module count is 364 → 408 pinned, 406 → 450 deployed; the module set and environment differ).
- **What I could not reproduce:** the agent's matrix ran on the Windows host at `96b6da6d` / `e76a0eae` (tree `a88a315b`), not on the merge. Its 57 runtime and 3 contracts failures are host-environment failures that I can't reproduce under WSL or Docker.
- **[D] What makes up for it:** the merge adds only `3c56c3e9`, whose files the PR doesn't touch, and every suite I ran was name- and status-equal to its base apart from new tests and the intended renames. So I accept "failing names identical to base" **for the suites I ran**. For the remaining host-only groups (contracts, infra, rebase-regressions, runtime host) it rests on the agent's record.

## 4. Verdict: CHANGES

The scope is clean, the merge onto `3c56c3e9` is clean, the image gate is 24/24, the proxy suites are equal or better in the deployed image, the secret pins hold, and every critical mutation goes red. Two defects block shipping: **F1** (ordinary owner refusals retire the shared proxy; reproduced) and **F2** (a real ECS replacement or deploy retires instead of re-proving, and a retired process is never replaced on this infrastructure). F2 needs a plan decision before agent 2 can fix it.

**Exact change list for agent 2:**

1. **C1 (F1), the refusal quota.** Count a reset toward `CARRIER_RESETS_PER_MIN` only for a **read-only exchange that timed out after its request bytes were written and before any reply status was read**.
   - **Proxy (`owner_https.py`):**
     - In `_send`, classify the failure step. Do not count `reply-status` or later: an answered reply, including 403 with `connection: close`, closes and discards that carrier uncounted.
     - Do not count failures at `lock`, `lease`, `connect`, `handshake` or `proof`.
     - Clear `_sent_channels[channel]` once a reply status has been read.
   - **`owner_channel.py`:** set `_sent` only after the write has completed. Errors raised before the write (`:436-438`, `:552-555`) must not reset as sent.
   - **Tests:**
     - commit my reproduction as a test: 5 answered 403s leave `available` True;
     - 4 post-send read-only timeouts in a minute still retire;
     - a mutating timeout poisons through its own path, not through the quota.
2. **C2 (F2). RULED by the orchestrator on 2026-10-21: (a) yes; (b) yes, `retire` exits the process non-zero; no infra health check.** The original options read:
   - (a) Partner-only transitional states become `PAIR_UNAVAILABLE` (the lease is kept until expiry; the renewer retries) when every pin of each observed task is intact: `desiredCount/runningCount ≠ 1`, `pendingCount ≠ 0`, 0 or 2 RUNNING partner tasks, or a rollout that is not PRIMARY/COMPLETED. These live in `service_pair_discovery.py:118,129-131,356-360` and `service-pair-discovery.mjs:72-77,171-172`. Two RUNNING tasks of **different** revisions, or a pin mismatch, stay `PAIR_DRIFT`. Add tests for a replacement observed through `running 0 / pending 1` and through a 200 % rolling overlap; both must reach `PAIR_REPROVEN` within 30 s.
   - (b) `retire()` must lead to replacement. Either the process exits non-zero after it emits its health line (proxy `pair_lease.retire` → the entrypoint stops uvicorn and exits; owner `owner-pair-lease.mjs:42-49` → `process.exit`), so ECS replaces the essential container; or the plan amends §4 to add a container health check on readiness (an infra and task-definition change, outside PR-A).
     - **Recommended:** exit.
     - Add a test that retire ends the process with a non-zero code.
3. **C3 (F3), readiness and lease expiry.**
   - Readiness should report `false` only for retired and for `REPROVING` past 30 s, not for an expired lease. Expiry must then reach `require(deadline_ms=…)`, so a request makes its one bounded synchronous proof as §3.1 says.
   - Change `pair_lease.ready` and the owner's readiness at `owner-https.mjs:137`.
   - Alternatively, amend §3.1 to "fail closed until the renewer succeeds" and say so in the PR.
4. **C4 (F4).** Add a channel-level test in `owner-channel.test.mjs` (or `owner-outcome-cancel.test.mjs`): an unresolved **mutating** owner statement (RESERVE/SETTLE transaction commit unacknowledged) poisons the shared service, and a later request is refused. My O1 mutation must turn it red.
5. **C5 (F5).** Add a variant of the composed count test with **both renewers running** (10 s ±1 s, which the fixture may compress) across a request longer than one renewal period. Assert that request-attributed AWS calls stay 0 while background renewals happen, and that `turn-context.background()` keeps them out of the request rollup.
6. **C6, N3 hang.** Make "replacement destroys the old physical socket…" / "real TLS accepts only a post-handshake proof…" fail fast (bounded wait plus assert) when old-generation sockets are not closed, rather than hanging until the runner's timeout.
7. **C7, deployed-image test.** Make `test_pair_lease_composed` skip with a stated reason when `node` or the workspace `node_modules` are absent, as the qualification image lacks them; otherwise §13.3's "proxy suites in the deployed image" stays red there. Record in the PR that its 2/2 evidence comes from the pinned image with the installed tree.
8. **C8 (M1), `owner_admission._install`.** Bind the receipt to its lifetime, then publish `state.receipt`, then retire the old receipt (`:351-356`). Add a test with a concurrent `check()`.
9. **C9 (M2-M5).**
   - **M2:** a new watch tick starts a fresh read instead of awaiting the leftover task (`lifetime.py:162-177`).
   - **M3:** take `read_at` when the read starts (`owner_admission.py:242`).
   - **M4:** `retire(code)` with `PAIR_UNAVAILABLE` (reset exhaustion) or a re-proof-limit code instead of always `PAIR_DRIFT` (`pair_lease.py:268`); the vocabulary stays the four codes.
   - **M5:** bound the owner renewer's `PAIR_UNAVAILABLE` retry with backoff up to the 10 s period (`owner-pair-lease.mjs:150`).
10. **C10, documentation only.** M6: state in the PR that a SETTLE after a re-proof keeps the UNKNOWN hold, with no outcome read across generations. Also fix the P0 harness proxy mode (set `AWS_EC2_METADATA_DISABLED=true` or run per module) in a separate P0 follow-up, not in this PR.

**For A (security review), not for agent 2 unless A agrees:**
- `_consume` with a lifetime skips `validate_capture_admission_lease` (`owner_admission.py:304-306`);
- read-outcome may move to a fresh socket of the same generation (`owner-https.mjs:189-191`).

**Re-validation after the changes:** F1 repro green; the C2 tests; O1 kills a channel-level test; N3 fails fast; the composed tests with renewers; then the image gate, owner, telemetry and proxy-per-module runs again on a fresh merge onto current `main`.

**Artifacts:** `phases/p2a-harness/`: `proxy-modules.py`, `one-module.sh`, `mutate.py`, `mutate-host-node.py`, `o1-rerun.sh`, `runner-rerun.sh`, `tap-names.py`, `mutations.json`, `repro_refusal_quota.py`. Raw outputs are in WSL `/opt/p2a/out/`.

---

## 5. Re-run on `c703e9f3` merged onto `main` `bce70776` (2026-10-21) — **CHANGES**

**Tree.** PR #196 is now two commits on `3c56c3e9`: `5550f8b6` (PR-A, rebased) and `c703e9f3` "fix(proxy): preserve partner replacement and enforce proof lease boundaries".
- I made a local trial merge onto `main` `bce70776` (= `932ff491`, never pushed). It is **clean**; git auto-merged `owner-native-currentness(.test).mjs` and `product-owner-placement(.test).mjs`, which `main` also touched.
- Base for every comparison: `bce70776`.
- WSL Docker, one container at a time; P0 harness @ `43b705c8` (`phases/p2a-harness/`).

### 5.1 Scope [R]

- **65 files, all inside PR-A's area.** `git diff --name-only bce70776 932ff491` has no path under:
  - `infra/`, `apps/gateway/`, `apps/control/`, `packages/`;
  - `apps/runtime/` (outside `apps/runtime/telemetry/`);
  - no Dockerfile, no LiteLLM file, and neither `owner-wire-codec.mjs` nor `boundary_codec.py`.
- **Compared with the `e76a0eae` list,** the only new files are two test files: `service-pair-replacement.test.mjs` and `test/test_service_pair_replacement.py`. Nothing was dropped.
- **The delta commit's non-test changes** are `main.py` and `owner-entrypoint.mjs` (exit on retire), `pair_lease.py`, `owner-pair-lease.mjs`, `owner_https.py` (retire reason), `service_pair_discovery.py` / `service-pair-discovery.mjs` (transitional partner states), `owner_admission.py`, `lifetime.py`, `owner-https.mjs` and `telemetry_lines.py`.
- **Still within PR-A.**

### 5.2 Gates [R]

| Gate | Base `bce70776` | Head `932ff491` | Result |
|---|---|---|---|
| **Image gate** | 24/24 (B6 R6 W12) | **24/24** | ✓ |
| **Owner Node suites** | 220/220 | 308/317 in the runtime image. The 9 failures are all `spawnSync openssl ENOENT` (no openssl CLI in the image, §13.4). Rerun in the **same head runtime image with openssl added**: **317/317** | ✓ |
| Owner names | — | 0 status changes on shared names; 16 removed, all the intended "quarantine → refuse only its request" renames already reviewed in §3.1; 113 added | ✓ |
| telemetry | 47/47 | 49/49 | ✓ |
| first-turn rehearsal | 6/6 (clock-step retry) | 6/6 (clock-step retry) | equal |
| D3 rehearsal | 9/9 (clock-step retry) | 9/9 (clock-step retry) | equal |
| runner-diagnostics | 2 fail (2 files) | the same 2 | equal |
| worker | 5 fail | the same 5 | equal |
| changed-tests | 1 fail | the same 1 | equal |
| control | 2 fail | 2 fail; one name differs | equal (flaky). A second run on both sides failed base 3 / head 2. The 500 ms load-budget cases vary run to run on both sides; test 47 is the only stable failure on each. The PR touches no control file |
| **Proxy suites, deployed product proxy image** (`qualification-worker@sha256:39ae50cd…` = `meri-product-preview-proxy:42`), one process per module, uid 10001, `AWS_EC2_METADATA_DISABLED=true` | 40 modules, 406 ran; 1 failing module | 43 modules, **474 ran**; 2 failing modules | ✓ (environment only) |

In the deployed proxy image:
- `test_owner_wire_envelope` fails 7 tests on both sides (that image has no node).
- Head's new `test_pair_lease_composed` fails 2/2 for the same reason.
- Everything else passes, including `test_pair_lease` 13/13, `test_service_pair_replacement` 16/16, `test_owner_https` 24/24, `test_owner_admission` 32/32 and `test_owner_channel` 21/21.
- The composed test passes **2/2** in the pinned head proxy image with the runtime image's installed `node_modules` (24.5 s).

### 5.3 Counts per model request [R]

- **The composed test asserts and passes:**
  - **13 owner exchanges** for a warm 20.2 s request with four 5 s watch renewals: the PR-A target is ≤ 13, so the target is met;
  - **0 request-path pair discoveries on either side** and 0 new pair proofs;
  - **12 owner Core joins** (`test_pair_lease_composed.py:212-216`).
- **Compared with the live baseline:**

  | Per model request | Live baseline | This revision |
  |---|---|---|
  | Owner exchanges | 31 | 13 |
  | Request-path ECS/EC2 calls | ≈ 650 + 609 | 0 |

- **Limits:**
  - This is still in-process, with scripted AWS and Core and the renewers stopped (F5).
  - The P0 rehearsals are scripted and report `awsCalls: 0` on both sides, so they can't measure this.
  - Live numbers need §6 acceptance after a deploy.

### 5.4 P0 secret pins with `reproven` [R]

Both are table-driven over the four pair codes with `transition: "reproven"`, and both assert that `taskArn` and IP never serialize:
- `turn-lines.test.mjs`: telemetry 49/49 in the runtime image;
- `test_telemetry_lines` 9/9 and `test_refusal_diagnostics` 7/7: deployed proxy image.

**Pass.**

### 5.5 Agent 2's change list [D]

- **Done, confirmed in code; the tests named are in the suites above and pass:**
  - **(1) partner replacement:** transitional partner states become `PAIR_UNAVAILABLE` (`service_pair_discovery.py:140-165`, with Node equivalents); `test_service_pair_replacement` 16/16 and `service-pair-replacement.test.mjs` are in the owner suite.
  - **(2) retire exits:** proxy `on_retire=lambda: os._exit(78)` (`main.py:347`); owner `onRetire:()=>process.exit(3)` (`owner-entrypoint.mjs:193`). Both run after sockets and sessions close and the health line is written.
  - **(3)/(4)** are owner/proxy tests in the suites above ("in-flight owner work cannot return after monotonic lease expiry…").
  - **M2** (`lifetime.py:173`), **M4** (`retire(reason)` with `CARRIER_RESET_LIMIT` / `PAIR_REPROOF_LIMIT`) and **M5** (owner retry backs off 1-10 s) are done.
- **I did not re-run mutations this time.** The brief asks for gates.

### 5.6 Blocking: F1 is still present, and exit-on-retire now makes it a process restart [R]

- **Not fixed.** My §4 C1 (answered owner refusals spend the proxy's carrier-reset quota) was **not in `P2A-CHANGES-FOR-AGENT2.md`**, and the code is unchanged:
  - `_send` still marks `_sent_channels[channel]` before the write (`owner_https.py:390-393`);
  - every failure past the lease step resets as "sent" (`:415-416`, `:264-276`), including an answered 403 rejected at `reply-status`.
- **Reproduced on `c703e9f3`.** `repro_refusal_quota.py` in the pinned head proxy image: 403 answers 1-3 leave `available=True`; **the 4th sets `available=False`** (`abort('CARRIER_RESET_LIMIT')`).
- **Why it is now worse.** With item (2), `retire` now calls `os._exit(78)`. So four ordinary owner refusals within a minute **end the shared proxy process**, for example a revoked grant, a stale capability, a currentness denial, or a `PAIR_UNAVAILABLE` raised at the lease step. ECS then replaces it, and the owner sees a partner replacement.
- **Before:** a stuck, refusing proxy. **Now:** a restart loop driven by user-visible refusals.

## 6. Verdict on `c703e9f3`: **CHANGES**

Exact change list for agent 2:

1. **F1, required.**
   - **Proxy (`apps/proxy/product/owner_https.py`):**
     - In `_send`, count a reset toward `CARRIER_RESETS_PER_MIN` only for a read-only exchange that timed out after its request bytes were written and before any reply status was read.
     - After `step = "reply-status"` has been reached (an answered reply, including 403 + `connection: close`), close and discard that carrier without counting.
     - Failures at `lock`, `lease`, `connect`, `handshake` or `proof` never count.
     - Clear `_sent_channels[channel]` once a reply status has been read.
   - **`owner_channel.py`:** set `_sent` only after the write completes (`:436-443`, `:552-555`).
   - **Tests:**
     - commit the reproduction as a test: 5 answered 403s leave `available` True and `on_retire` uncalled;
     - 4 post-send read-only timeouts in a minute still retire with `CARRIER_RESET_LIMIT`;
     - a mutating timeout poisons through its own path.
   - Mutation-check it against `if sent:` → `if True:` and against removing the reply-status exemption.
2. **C7, required for §13.3 to read green in the deployed image.** `test_pair_lease_composed` should skip with a stated reason when `node` or the workspace `node_modules` are absent, as `test_owner_wire_envelope` should. Today both error there.

**Still open from §4, not blocking unless the orchestrator says so:** F3 (readiness requires an unexpired lease), F4 (no channel-level test that unresolved mutating owner work poisons) and F5 (the composed count runs with renewers stopped).

**Cleanup:** `/opt/p2a` is removed after this run, along with the containers and the p2a images. The scripts stay in `phases/p2a-harness/` (new this run: `owner-openssl.sh`, `composed-and-repro.sh`).
