# S2 authority-lite — source candidate, activation held

Base: verified M1 merge `14853f347edc7bcc9dc645a26bc1817d66f2512f`,
tree `7b7440d4cec44cc3b8832fe2143417db9facabe1`. Branch:
`feat/meri-s2-authority-lite`. Brief6343478137 and O2086351318492 govern
this change. Core source contract is `ca4de503fb6ec09caf0daf8b976a0f649c6b9665`:
authority DTO/builder blob `bcd59cc48c026d90e2306f62e093e5749392f140`,
controller blob `904b0d3e90c1786a8d73081f309db27c0b7a5a04`, Clerk cache blob
`7840f8f409758d4874da991dce95cac359e2b4c7`. Source pins do not prove deployment.

## Implementation and owners

- Existing fixed authority HTTP transport consumes Core's closed `/current`
  request/receipt. Answered401/403/409 stay distinct;503/network/timeout stay
  unavailable. No redirect, credential fallback, broad retry or Core change.
- `run-current-authority.mjs` owns O208 positive receipt reuse: process memory
  only, full RunBinding including attempt/worker/writer fence, client, originating
  session fence, credential digest and matching revisions. No sharing across
  control processes. A fresh read sends revision preconditions when available.
- Age is strictly monotonic `now - sendStart < 20000`, with sendStart captured
  before the network request. Reuse never refreshes age. Current requests have
  at most3s; response completion cannot move sendStart. Core's120s receipt
  expiry is checked as an expiry, never used as the revocation-age bound.
- A fresh read removes its prior positive before awaiting Core. Refusals and
  unanswered reads are never cached or covered by stale positives. Generation
  checks prevent older concurrent success from repopulating after a refusal.
  Entries and pending keys are bounded; no background timer or persistence.
- Native identity context projects one consistent snapshot into existing
  identity, membership and context validators. The canonical context/run owner
  still reads local current run before and after. Each port recheck checks age
  again, so a local await cannot carry a19.9s receipt past20s.
- Canonical sessions keep their identity/member/context pins and original
  expiry. Issuance and authentication (effect admission) call current fresh;
  standalone read-current rechecks may reuse. Transition admission also makes
  a fresh current observation; existing transition checks remain.
- Task verification still validates capability, operation and current admitted
  allocation before Core, then takes its later fresh local snapshot. A task grant alone never permits reuse: control late-binds its canonical
  originating-session borrower to the exact process-local transport, and each
  recheck compares the opaque session and clips its expiry. Without that
  provenance a fresh observation is required. Only next-controls is treated as read-only reuse; every other operation is fresh.
- Current tool/intent authority consumes current through the originating session
  relay; missing canonical session provenance permits fresh observation only.
  Command, approval preparation and artifact admission never reuse. Existing
  grant, selected-client, live-bearer and reserved-secret substitution checks stay.
- Document/analysis intents borrow the exact originating run session via the
  canonical owner. They mint/revoke no per-intent session. All before/after
  currentness, native expiry, retention and UNKNOWN/idempotent receipt checks
  remain. A trusted optional absolute deadline is carried into the runtime
  document application so borrowing cannot outlive the native relay's expiry.
- Generic non-conversation membership consumers retain their canonical route.
  Telemetry adds authorityFresh/authorityReuses and CurrentAuthorityFresh/
  CurrentAuthorityReuses to existing owner/control counters. Actual CoreCalls
  and coreMs remain actual fresh network activity, not reuse counts.
- Agent2's MX-01 SessionRefusals alarm is already on the base; no infra, alarm,
  schema, generated, security configuration or credential-file change here.

## Source evidence and retained failures

Evidence directory: `/dev/shm/agent1-v3-s2-evidence/`.

Diagnostic runs, not final exact-head qualification:

| Selection | Result | Disposition |
| --- | --- | --- |
| Initial receipt owner |9/9| Source-only scripted Core/clocks |
| First broad composition |273/281| Two files lacked required source-root env; six telemetry span/export failures retained |
| Initial S2 session fixture |0/5| Test supplied a three-method membership owner where the existing session contract requires two; corrected the fixture projection |
| Session + intents |20/22| Originating-session invalidation expectation changed to zero remaining sessions; real native-expiry propagation gap fixed |
| Intermediate targeted |29/38| A new trusted-deadline parameter shadowed an existing options variable; corrected. Kept client-roster refusal classification |
| Corrected current-authority + intents |24/24| All effect, expiry, revocation, retention and replay assertions remain |
| Expanded affected selection |453/459| Six old task-fixture split-DTO failures; fixture updated to pinned current shape |
| Corrected task verifier |11/11| Includes real local child/HTTP with scripted SQL/Core; not native PostgreSQL/Core qualification |
| Telemetry base comparison |3/9| Same six span/export failures at base14853f34 with the same installed dependencies; no telemetry SDK repair in S2 |

The new tests cover19.9/20.0s, revoked/403/401/409/503/timeout cases,
cross-run/conversation/principal/session/fence/credential/revision separation,
fresh write admission, no age refresh, send versus receive time, three-second
request bound, concurrent late-positive refusal, composed local checks, session
borrowing, fixed status transport and truthful separate counters.

Mutation evidence:17 designated tests each have an intended assertion failure
under a loader-only fault. One earlier composition fault failed via the typed
SESSION_AUTHORITY_UNAVAILABLE path; it was retained and not counted as an
assertion kill. A separate force-fresh-on-read fault caught by the read-reuse
assertion supplies that test's assertion proof. No timeout counts as a kill.
A task-origin mutation additionally proves that a grant alone cannot enable reuse.
Original and reviewed mutation summaries and all raw logs are retained.

Final exact-head source results will be recorded in the PR handoff, without
rewriting earlier failures or making a recursive evidence-only source change.

## Qualification still required

Fable-run: native PostgreSQL16 with the exact fixture, fresh source-bound image,
targeted/full image suites, first-turn/D3 and base/head comparison. Live after
copied-DB cutover: owner `meri.turn.counters` CoreCalls<=30, coreMs<=3000 and
revocation<=30s. Source call counts and scripted clocks are not live acceptance.

M1's inherited78PG failures, combined387/389, timing2/20 on both sides in the
prior alternating experiment, N21 environment limits, WSL clock-step unverified
rehearsals and historical incomplete/unknown timeouts remain preserved. M1 merge
does not mean deployment. Main remains frozen except#209 until cutover; S2 has
no merge/deployment authority. P1 and C9 remain sequenced after S2. STOP2/6.

## Originating revision-pin follow-up

At prior candidate c87cebfa8b91bf2dea4cbdd56281b42375d5d5aa, the exact
affected selection finished502/513, exit1,125488ms, zero skips/cancellations.
All11 failing names reproduce at base14853f34 (7/18 in the three failing files):
old mounting-context/native-reference fixtures and schema-readiness fixtures,
including the original cleanup failure. Their raw outputs remain retained. No
assertion or production readiness guard was changed to remove them. All17 new
tests passed, and17/17 exact-head loader faults were caught by assertions.

The follow-up retains the originating session's frozen three Core revisions
in private process memory. Canonical session and task consumers pass those
expected revisions on every fresh call and recheck, including after a cached
positive was invalidated; the cache key includes them. The private borrower
returns that proof to the existing relay only. Sessions without this provenance
are observed fresh and cannot enable task reuse. A new assertion in the origin
test covers warm503 invalidation followed by a changed-context200: the old
session pins still refuse it. Transport also refuses a200 that violates an
explicit revision precondition, rather than relying solely on Core's409.
Public session receipts and persistent schemas are unchanged.

The follow-up head needs its own exact-head qualification. Earlier c87 receipts
do not carry over. All native/image/live gates and acceptance holds remain.

## O214 history currentness follow-up

Decision6352459577 adds the native history adapter to this same PR. The adapter
uses one fresh `/current` per row/invocation with the canonical membership
admission's available membershipRevision precondition. Identity/context revision
pins are not invented from local stored policy scopes. Stored scopes, principal,
configured client, membership roster, freshness, cancellation and deadline checks
remain. No history receipt cache exists: no reuse across rows/requests/principals.
Fresh observations contribute to the existing authorityFresh counter.

Read-only transcript now performs its single Core observation inside the existing
final serving fence, as list already does. Both earlier local retention checks
remain; the final check after Core remains too. Next-turn's initial/pre-effect/
post-effect/final-release observations are unchanged. The bounded four-reader
list pool still settles every started read and withholds the whole page after a
refusal, rather than skipping refused rows or releasing partial content.

Wire/classification boundary: adapter errors retain401/403/409 and mark503 or a
Core timeout transient, all with the owned CONVERSATION_UNAVAILABLE domain code.
The existing frozen public history envelope stays CONVERSATION_UNAVAILABLE503;
no shared error/status contract or frontend change is included. Thus the409
revision-drift assertion is at the current transport/native-adapter boundary,
not a new public history409 status. This distinction must remain visible in
review and Fable's qualification; no claim that preview history is repaired.

O214 diagnostic:79/80, exit1, one retention-count assertion expected2 but observed3
for transcript: retaining both earlier local checks plus final post-Core retention
requires3. The assertion is strengthened to exact `[0,0,1]` Core-observation counts
at those three checks (list remains `[0,1]`), preserving suppression/error/no-content
assertions. Corrected selection80/80 before the final telemetry assertion; raw
outputs remain under `o214/`. Final exact-head results go in the PR handoff.
Prior7f6c2d73 source accept and502/513 qualification remain historical, not carried
to this new source head. All M1 and S2 failed/incomplete evidence above is retained.
Fable owns exact-head native/image/PG/rehearsal/base-head gates and live acceptance.
STOP2/6 and A2 HOLD; no UI/model/acceptance execution is authorized here.
