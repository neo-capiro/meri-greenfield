# P2 PR-A (#196): change list for agent 2

**PR:** `feat/meri-p2-proof-reuse` @ `e76a0eae`.
**Reviews:** security by A (`P2A-VALIDATION-security.md`, CHANGES; the relaxation is signed off once item 3 lands) and conformance by D3 (`P2A-VALIDATION-conformance.md`, CHANGES; scope OK).

**What to do:**
- **Rebase onto `main`** (currently `3c56c3e9`; it merges cleanly).
- **Push to the same branch,** keep it a draft and don't merge.
- **In the PR description,** list each item below with its test and the mutation that turns that test red.
- **No AWS, IAM, LiteLLM, CLI, runner or wire change.**

## Required

### 1. A partner's replacement is not drift (both languages)

**The defect:** today a partner's transitional ECS states are `PAIR_DRIFT`, so the survivor retires on every partner restart, and §6 items 7–9 cannot pass. The places: Node `serviceObservation`, `member` and `taskObservation`; Python `service_pair_discovery.py:118-131,158`.

**Return `PAIR_UNAVAILABLE`** (no lease, no generation) for the **partner's service only**, and only when every deployment and every listed task is on the pinned task definition and image, in these states:
- (a) desired 1, running 0, pending ≤ 1;
- (b) no RUNNING member yet, or a member whose `lastStatus` is PROVISIONING, PENDING or ACTIVATING;
- (c) a same-revision rolling deployment: PRIMARY IN_PROGRESS plus a draining deployment, both on the pinned task definition, including two RUNNING pinned members.

**Decision (orchestrator, O104):** exactly one RUNNING pinned task under a PRIMARY IN_PROGRESS deployment of the pinned task definition **is a passing proof**. Don't wait for COMPLETED.

**Keep `PAIR_DRIFT` for:**
- anything that contradicts a pin: another task definition, image, roles, subnet or SG, or a public IP;
- a RUNNING task outside the pinned service;
- a deployment on another task definition;
- any change to the side's **own** service.

**Tests:** scripted ECS sequences in both languages, under the live shape (ROLLING, maximumPercent 200, minimumHealthyPercent 100):
- StopTask: RUNNING → gap → PENDING → RUNNING;
- force-new-deployment: two RUNNING → one.

Each must end in **exactly one `reproven` and no retirement.** Keep every existing drift case.

### 2. `retire` exits the process non-zero

A retired side must stop its process with a non-zero exit, so the essential container stops and ECS replaces the task. No infra or health-check change.

**Tests:** both languages assert the exit after `retire`.

### 3. Pin the post-reply lease check (relaxation guard)

Mutants N14 and P5 survive every suite today:
- **N14:** delete the owner's post-dispatch `assertBound(socket)` in `owner-https.mjs`.
- **P5:** delete the proxy's post-reply `self.pair_lease.require(generation=generation)` in `owner_https.py` `_send`.

**Test:** while a request's owner work or reply read is in flight, advance the **monotonic** clock past `expiresAtMonoMs` and leave the wall clock unchanged.
- **The owner** answers 403 and closes the socket, with no reply body.
- **The proxy** refuses the exchange and returns no `OwnerReply`.

Mutation-check them against N14 and P5.

### 4. Never resend after a timeout, on the real entry point

**Mutant P9 survives:** a resend inside `ProductOwnerHttpsExchange.__call__`.

**Test:** drive a reservation frame through `ProductOwnerHttpsExchange.__call__` (not `_send` and not `FakeExchange`) so that it times out **after** the request bytes are written. Assert:
- exactly one POST reaches the scripted owner socket;
- the carrier is reset;
- `OwnerExchangeUnavailable` is raised;
- a later bridge reserve for the same request sends nothing.

### 5. Small correctness fixes (from conformance)

- **M1:** `owner_admission.py` `_install` publishes `state.receipt` (`:351`) before binding it to its lifetime (`:353`). Order it as: bind first, publish second, retire the old receipt last. Add a test that a concurrent `check()` never sees `ADMISSION_LEASE_EXPIRED` for a valid receipt.
- **M2:** `lifetime.py:162-177`: after an unanswered renewal, the next tick must start a fresh read, not await the leftover task.
- **M3:** `owner_admission.py:242`: take the admission lease's `read_at` when the read **starts**, not after the reply.
- **M4:** `pair_lease.py:268`: `retire()` reports the actual reason (reset exhaustion or the re-proof limit), not always `PAIR_DRIFT`.
- **M5:** `owner-pair-lease.mjs:150`: on `PAIR_UNAVAILABLE`, back off (bounded, with jitter) instead of retrying every 1–2 s forever.

## Not required now

- **M6** (a SETTLE after a re-proof can't read its outcome): it fails closed. No change.
- The review's "LATER" items.

When done, report the head sha. Validation and gates are run again on that revision.
