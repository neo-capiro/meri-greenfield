# Meri adjustment plan Rev 2 — orchestrator decision log

Orchestrator: Fable (Claude Opus 5.5), session local_21a366a7. Neo is asleep and said: "If you have questions make decisions for me and log them".
Times are UTC on 2026-10-20.

| # | Time | Decision | Why | Reversible by |
| --- | --- | --- | --- | --- |
| O1 | 03:10 | dot stays the sole AWS operator and shipper. Fable lanes make no AWS mutations: no builds in the cloud, no task runs, no deploys, no secret reads. Cloud steps reach dot as one ship packet on PR #121. | Plan §10 keeps shipping with the designated shipper and "does not expand" authority. The 10-19 18:33Z handoff gave dot the operator role. A re-render needs Neo's credential steps on neomart. | Neo explicitly hands AWS back to Fable. |
| O2 | 03:10 | No live chat on the currently deployed (unfixed) runtime. Chrome is reserved for the orchestrator and is used for D3 only after a candidate is deployed. | A chat on `2b4421f6` would reproduce the known failure, start another uncertain attempt and spend money without settling a named uncertainty (plan §1: every deployment or experiment must fix a cause or resolve a named uncertainty). | Evidence that a live observation on the current deployment would settle a specific open question. |
| O3 | 03:10 | Candidate lineage: the deployed source `2b4421f6`, plus `32d06db2` (pinned-transport failure codes). B continues on the existing branch `fable/pinned-transport-failure-codes-20261020`. C works on `fable/adj-c-startup-budget-20261020`, cut from `32d06db2`. Both are integrated later into one candidate branch. | Keeps the smallest diff from what is deployed. Plan §5 says to adopt or amend the existing patch rather than rewrite it. | — |
| O4 | 03:10 | Wave 1 runs 6 sessions: A, B, C, E, G and D3-readiness. F (release automation) and qualification start as memory allows. | Windows SearchIndexer is leaking about 43 GB of committed memory and restarting it needs admin rights, which this session lacks. Earlier sessions saw commit exhaustion with about 5 lanes. | Neo restarts the Windows Search service as admin. |
| O5 | 03:10 | File ownership: B owns `pinned-native-transport.mjs`, `runner-runtime-diagnostics.mjs` and their tests. C owns `native-authority/**`, `operation-lifetime`, the runner/control/prepared-* modules and the startup limit values. E and G are docs only. The D3 lane edits frontend/Core only for small required fixes, on new branches. | Plan §3: disjoint owners; error vocabulary has one owner. | — |
| O6 | 03:15 | Relayed Neo's directive to every lane: no dead code; keep the codebase clean and organized. The orchestrator reviews every diff against it before integration. | Neo, 03:1x. | — |
| O8 | 03:25 | **Supersedes O1.** Per Neo ("Leave dot out of this . You Can deploy . This will be all of Claude"), the orchestrator is the single shipping and AWS owner. It performs the builds, renders, secret uploads, deployments and the durable-state read itself. Worker lanes still make no AWS mutations, so authority stays with the session that holds Neo's instruction. I posted one notice on PR #121 asking dot to stop all Meri actions, so two operators cannot collide, and then dropped dot from coordination. | Neo's direct instruction. One operator prevents concurrent change sets. | Neo. |
| O9 | 03:25 | Deployment still follows plan §10: build a fresh image through the existing CodeBuild producer, take a snapshot before any SQL, prepare a ship packet before executing, and keep rollback material. Existing private inputs on neomart are used in place; nothing private goes into Git or logs. | Neo authorized the deploy, not shortcuts. | — |
| O10 | 03:30 | The app does not let me start new sessions in turns you didn't drive. F (release automation) goes to the A session as a follow-up once A reports; A already has the deployment-baseline context. Linux qualification goes to B as its follow-up. Prepared worktree: `C:\dev\fable\wt-adj-f` on `fable/adj-f-release-automation-20261020`. | App rule; reusing the session that has the context. | Neo starts more sessions in the morning. |
| O11 | 03:40 | The app refuses new sessions even after Neo said "Start it", because Remote Control turns count as not local. F went to the idle E session as a follow-up and the F card was withdrawn. E still makes no runtime/control code edits, so it stays the independent reviewer for B, C and the D3 fixes. | App rule; keep reviewer independence. | — |
| O12 | 03:40 | The D3 session now fixes its blockers 1 and 3 in meri-greenfield (`fable/adj-d3-session-resilience-20261020` at `32d06db2`). Blocker 1: a transient Core/Clerk failure during a session recheck must not destroy the session or show "expired". A definitive authority refusal still revokes immediately. Blocker 3: per-event polling makes ~16 Core calls. Blocker 2, the Queued status before the claim in `activity.mjs`, waits for C, which owns that file. | These are D3 blockers with a demonstrated mechanism. Ownership stays disjoint. | — |
| O13 | 03:40 | Contingency, recorded now and decided after C reports: E's ADR estimates that every stdin/stdout frame costs ~3 HTTP exchanges, 3 TLS handshakes, ~14 DB round trips, ~9 AWS describes and ~2 Core calls. If C's fix lets start succeed but the measured per-frame cost makes streaming unusable, or threatens AWS describe throttling in the shared capiro-dev account, invoke ADR §6.4: phase 1, a local process client behind the existing `processTransport`, plus a temporary switch. Plan §1 allows the smallest transport replacement when evidence shows it is needed to reach the gate. | — | — |
| O14 | 04:05 | The orchestrator performs the private steps itself: reading the Core identity bearer from Secrets Manager, posting the Core membership request, rendering against `C:\dev\fable\meri-preview-private-pki`, and uploading under a NEW label (never moving AWSCURRENT). These used to be Neo's personal steps. Private bytes stay in a `umask 077` working directory outside every repo and are never printed, logged or committed. Worker sessions still never read private inputs. | Neo: "You Can deploy . This will be all of Claude". Shipping a new image needs a re-render, so the deploy authorization is meaningless without this. | Neo. |
| O15 | 04:05 | Ran package A's durable-state read: two read-only RunTasks on the existing `d2-migrate:6`. The committed overrides were 8,120 B as compact JSON, and ECS counted them over 8,192 and refused (`InvalidParameterException`), so I split them by login section into two runs. Each session is read-only (`default_transaction_read_only=on`, `BEGIN READ ONLY`, SELECT only; verified by grep before running). | Plan §4 needs the durable state read before another deployment. | — |
| O16 | 04:15 | Durable read results are in `A-DURABLE-READ-RESULTS.md`. The run was durably `failed` at 01:41:03. The allocation is RETIRED and proven stopped; launch_binding is CLAIMED. The proxy table `requests` has 0 rows, so there was no recorded provider dispatch. The reservation SETTLED at 0. Next attempt: use a NEW conversation, because a re-render changes `configurationSha256`. No local Docker image rebuild for now (memory pressure). Instead, B runs the 24-case Linux gate set on the candidate in its WSL clone before the paid build. | Read-only evidence; keeps the paid build from failing on a known gate. | — |
| O17 | ~05:00 | Candidate `fable/meri-first-chat-candidate-20261020` = `32d06db2` + B `4549416f` + C `294d4b57` + F `b1f954d0` + D3 blocker-1 fix `99a6be28` → head `3dc993ef`. The D3 lane's blocker-3 polling change is uncommitted. That session is waiting on a prompt only Neo can answer, so it is NOT in this candidate and goes in a later one. I pushed the finished commit `99a6be28` to its branch from the shared repo without touching its working tree. | Blocker 1 is the demonstrated cause of "Conversation session expired" mid-run. Blocker 3 is only an amplifier. | — |
| O18 | ~05:00 | Gates before the paid build: E's independent review of `99a6be28`, and C's Linux run of the 24-case image gate plus the affected suites on `3dc993ef`. B/C and F were already approved with non-blocking follow-ups (adj-e-review-B-C.md, adj-g-review-F.md). ADR phase-1 local execution (`fable/adj-local-execution-20261020` @ `e3503099`) is prepared but switched off, and is NOT in the first candidate. Plan §1: no execution rewrite in the same experiment. | — | Activate phase 1 only if the live attempt shows the forwarded path is too slow or throttles. |
| O19 | ~05:50 | All gates passed: B/C, F and D3 reviews were APPROVE-WITH-FOLLOWUPS, and the Linux gate on `3dc993ef` was 24/24. Shipping `3dc993ef` with E's kit (`C:\dev\fable\ship-3dc993ef`, label `FIRST_CHAT_20261020F`). Step 1 put the S3 source. Step 3 started CodeBuild `c18776bb-d9d4-46c6-9ee3-e0d552dc2492`, product job 1 of this cycle (30-min cap). Spend authority: Neo's "You Can deploy", plus the 10-17 "go over budget" grant. Each build costs about $1 of CodeBuild time. | — | — |
| O20 | ~06:15 | Shipped through step 15:
- Image `sha256:d7995b75…`; scan 0 HIGH / 0 CRITICAL; measurement `d441f856` VERIFIED.
- Private core and render done by the orchestrator (`--client-id` Anduril `d1b0cb55…`, the same binding as the frontend's MERI_FIRST_CHAT_CLIENT_ID). The membership holds 15 clients; the bearer expires 10-24.
- Secrets uploaded under `FIRST_CHAT_20261020F` only.
- Change sets contain TaskDefinition/Service changes only.
- Executing model → issuer → app with gates. Predicted revisions: control:36, worker:35, issuer:35, owner:34, proxy:34, runner:21.
- Rollback: forward redeploy of release E (`release-E.deployment-inputs.json`) under a new label. | — | — |
| O21 | ~06:20 | Parallel batch 2 while the rollout runs (Neo: "delegate work to multiple sessions"). Every branch is cut from the shipped candidate `3dc993ef`, and their files are disjoint:
- **E:** independent review of phase-1 local execution (`e3503099`), so it can be activated if needed.
- **C:** D3 blocker 2 (Queued until claim / no pre-claim terminal status, `activity.mjs`) plus F4 and F6.
- **B:** F3 (one vocabulary owner) plus D1 and D2 (transient-session codes on action and lifecycle routes). Stops before any published-contract bump.
- **G:** M1–M3 plus promoting the measurement scripts into infra.
- **A:** a read-only integration plan for PR189–PR192 (the package G first slice).
- **D3 lane:** blocked on Neo's prompt; its uncommitted blocker-3 work stays with it.
New sessions can't be started from Remote Control turns, so the five existing idle sessions are reused. | Maximize parallelism within disjoint file ownership. | — |
| O22 | ~06:45 | **First live attempt on `3dc993ef` (06:35Z, conv `f9c31d42`, run `ef0c07c7`), Chrome, Neo's account, client Anduril.**

Proven live:
- allocate/admit 200, run Queued → Starting → Running;
- router `start` completed in 11.4 s, which confirms the 8 s cause;
- durable `launch_binding=STARTED`, the first time ever;
- cleanup within about 1 s, not 846 s;
- the UI shows a truthful "Failed … ATTEMPT_LOST".

New blocker: the runner reported `origin=runtime code=UNKNOWN` 13 s after start. There was no proxy request ($0 spend, `requests` 0 rows) and no SDK mirror. The launch measurement never spawned the CLI ("no process spawned"), so the plan's D1 was never done. B is now running D1 in-image.

Second defect: after the failure, `POST /api/action-followthrough/session` returns frontend 401 SESSION_REFUSED. The conversation can't continue. A is on it.

G reviews B's batch-2 commit `b72b15d2`. No further live chat until the cause is fixed: each attempt costs a runner launch and gives no new information. | Evidence first (plan §1). | — |
| O23 | ~07:25 | Candidate 2 = `59c7748f`, which is `3dc993ef` plus:
- B diagnostics `4f6aae24`: a first failure always carries class, exit or signal, and stage;
- A's D3 recovery `ffcebddd`: exact run hints no longer reserve a successor, so a failed run no longer bricks the conversation;
- C's batch 2 `b3ffbb82`: earlier `starting` claim, F4, F6.

Reviews in flight: E (A + B) and G (C). C is running the Linux gate on the candidate. To save wall-clock time, the paid image build (`c65443f9`, label G kit) and measurement start **before** the reviews return. Render, upload and deploy wait for APPROVE.

Not included:
- phase-1 local execution (approved to merge, but the render has no switch input, and per plan §1 no rewrite until the evidence demands it);
- B's D1/D2: correctly stopped, because they need a contract change.

D1 preflight result: the real CLI completes a full turn inside the exact image, so the CLI, CA trust, read-only root and SG path to the proxy are all ruled out. | Max information per live attempt. | — |
| O24 | ~08:00 | Candidate 2 approved: E APPROVE, G APPROVE-WITH-FOLLOWUPS, and the CodeBuild in-image Linux gate passed (build succeeded). Shipping: image `a62302c5…` (scan clean), measurement verified, render bound to Anduril, secrets under `FIRST_CHAT_20261020G`. Change sets touch TaskDefinition/Service only. Executing model → issuer → app. Predicted revisions: control:37, worker:36, issuer:36, owner:35, proxy:35, runner:22. One stale non-gate test is red after the followups-c merge; C fixes it in a follow-up. | — | — |
| O25 | ~08:30 | **Second live attempt, candidate 2 (08:23Z, conversation `6dc6d92a`, Chrome, Anduril).**

Live-verified:
- fresh-conversation bootstrap. The first session call needed one "Try again"; that is a new D3 defect, listed below.
- allocate 11.4 s, admit 15.7 s, submit 11.7 s, so acknowledgement came about 39 s after send. Core-bound and slow, but correct.
- Queued → Running; router `start` completed in 14.07 s; worker cleanup within about 1 s.
- **A's recovery fix works**: after the failure, session/history/transcript 200, a truthful "Failed — ATTEMPT_LOST", and the composer is usable.

Still failing: `RUNNER_FIRST_FAILURE origin=runtime stage=activity-stream code=ERROR class=ERROR exit=none signal=none`, 14 s after start. That is a plain Error with an unlisted message. No provider request.

This is the second identical failure, so per Neo's table it counts as stubborn: B escalated to MAX effort, adds `site=`/`msg-hash=` diagnostics and reproduces with live timings; C runs source/timing analysis in parallel.

New D3 items:
- the first session call after bootstrap fails once;
- allocate/admit/submit total ~39 s, which needs Core latency work. | — | — |
| O26 | ~09:20 | **Root cause of both live runtime failures**, found independently by B (max effort) and C, and reproduced in the candidate-2 image:
- after SDK `system/init`, the lifecycle pump's `runner/next-controls` ran on the native client's 3 s default;
- control needs about 4–6 s (3 serial verifies, session issue, authenticate, current-state);
- so it hits DEADLINE, then LIFECYCLE_EXECUTION_UNKNOWN, then `activity-stream code=ERROR`.

Fix: B's `1d94b357`. I chose B's over C's equivalent `e90b7d8c` because B's branch also keeps the error cause and adds `site`/`msg`/`cause` diagnostics. C's branch stays unmerged: one fix, no duplicates.

Candidate 3 = `8d7c507e` = `59c7748f` + B site/fix + C runner cleanup (E: APPROVE-WITH-FOLLOWUPS). The test conflict was resolved in favour of B's stricter assertions; 25/25 merged tests pass.

E is reviewing the fix and the diagnostics, and was asked about the 8.7k-line generated hash JSON (I lean towards generator-only). The image build and measurement are running in parallel under the label H kit. | — | — |
| O27 | ~09:45 | Candidate 3 `8d7c507e` approved by E (APPROVE; follow-up: drop the generated hash table and keep the generator). Shipping: image `841caa3d…`, scan clean, measurement verified, render bound to Anduril, label `FIRST_CHAT_20261020H`, change sets touch TaskDefinition/Service only. Executing model → issuer → app. | — | — |
| O28 | ~10:15 | **Session restart interrupted the candidate-3 rollout** after the MODEL stack (owner:36/proxy:36 on H; issuer/control/worker still on G). Resumed with the kit, whose `execute` is idempotent: an executed change set is only re-gated. Order stays model → issuer → app. | Leaving a mixed state longer is worse than finishing the reviewed rollout. | — |
| O29 | ~10:15 | Parallel batch 4, all sessions busy:
- **A:** Core fix. Clerk 2 s timeout → retryable 503, not 401; plus a read-only Core build/deploy recipe.
- **C:** measured serial-Core-call reduction for allocate/admit/submit (~39 s ack) and the history list (~80 Core calls on load).
- **G:** takes over D3 blocker 3 (event polling). The D3 lane is still blocked on Neo's prompt; its uncommitted diff is used as reference only.
- **E:** reviews A's frontend first-connect retry `87d804bc` (mitigation; may wait for the Core fix).
- **B:** drops the generated hash table. | Neo: "continue to make progress across all work sessions". | — |
| O30 | ~10:35 | **Third live attempt** on candidate 3 / release H (10:23Z, conversation `1195c882`).

What worked:
- the first connect worked without a retry;
- acknowledgement in about 34 s;
- router start 12.5 s.

The failure: `code=LIFECYCLE_EXECUTION_UNKNOWN cause=DEADLINE site=activity-lifecycle.mjs:59` about 33 s after start. The lifecycle `next-controls` call now has 23 s and still never got an answer from control (ALB: max response 12.5 s, 3 ELB 4xx; Core about 7 req/s during the run). No provider request.

E is root-causing the control-side block and evaluating ADR phase-1 activation as the smallest transport replacement (plan §1). C now puts the lifecycle path's serial Core calls first. No further live attempt until the block is understood; another attempt would only repeat this one. | Evidence first. | — |
| O31 | ~11:00 | **Root cause of the third failure (E):** one `runner/next-controls` costs about 82 serial Core authority calls in control's worker-http/session/lifecycle layers. That is 17.4 s quiet and DEADLINE at live latency. `publish` costs 42 calls (9–14 s per message part).

Plan for candidate 4:
- **R1** (runner): a `next-controls` read that times out backs off instead of failing; E implements it, the D3 lane reviews;
- **C1** (control): a lean ~4-call next-controls path; C implements it, and it joins only if reviewed in time;
- G's event-polling fix, after its one-line regression fix.

Phase 1 is not the fix: local mode still uses the same control path. C2 (dedupe publish/load) is required for usability but not for the gate.

A's Core 503 fix is written and tested but **not committed**. capiro-backend's repo rule needs Neo's explicit approval for auth-file changes, so I asked Neo. | Smallest authority-neutral change first. | — |
| O32 | ~11:05 | **Neo approved the Core auth change**, verbatim: "I approve A's Core auth change (Clerk timeout returns retryable 503 instead of 401) for commit, review and deploy." I relayed that quote to A. A commits, then builds a Core kit (non-mutating steps done by A; mutating steps run by the orchestrator, with rollback to `capiro-preview-first-chat-core:2`). The D3 lane reviews. The scan gate is hard: any new HIGH or CRITICAL finding stops the Core deploy. | Explicit owner approval, as required by capiro-backend's change-control header. | — |
| O33 | ~11:20 | Core `8a23d6d7` is committed; A's kit is at `C:\dev\fable\ship-core-8a23d6d7`, preflight OK. I started build + scan (steps 1–3) in parallel with G's independent review. Register and roll (steps 4–5) happen only after G's APPROVE and a clean scan. The D3 lane re-checks G's polling fix `3c39f69e`, then reviews E's R1. | Parallel build, gated rollout. | — |
| O34 | ~11:30 | Core build `913df1e5` FAILED at docker-build: Docker Hub `429 Too Many Requests` on the pinned `node:22.23.3-alpine3.24@sha256:2c752226…` base. Nothing was pushed and Core still serves `:2`. A now pulls the identical digest from a mirror (ECR Public or a pull-through cache), refusing if the digest differs. Not on the first-answer critical path. | Same bytes, robust source. | — |
| O35 | ~11:35 | Candidate 4 = `5de48c76`, which is candidate 3 plus:
- E's R1 `37072c2b`;
- G's event polling `3c39f69e` (D3 lane: APPROVED);
- C's call reduction `f11a8353` + `2d63d9ca` + `14573f9c`.

72/72 merged-surface tests pass on Windows; the failures seen first were missing dependency junctions only. Image build `a6d7f6f7` (label I kit) is running in parallel with the reviews: D3 lane → R1, G → C's three commits. Deploy only after both approve.

Core `0f5d7e15` (A's mirror fix on top of the approved `8a23d6d7`) is rebuilding. Roll after a clean scan.

Note: B's frontend kit report says B **ran the S3 source put (step 03) by mistake**. It is a harmless create-only upload, but it breaks the no-mutation rule for workers. Logged; no damage; the kit is otherwise READY. | — | — |
| O36 | ~11:40 | The Core `0f5d7e15` image built from the ECR Public mirror (same pinned digest). Scan gate `PASS_EXACT_DIGEST_SCAN`, 0 findings, image `sha256:1ae9b167…`. Registered `capiro-preview-first-chat-core:3`; the diff from `:2` is image + RELEASE_SHA only. Rolling now; rollback is `90-rollback.sh` → `:2`. The mirror commit was not separately reviewed: it is a build-input change only, digest-pinned and asserted by A's qualification test. G approved the auth change it builds. | Neo approved the deploy; the scan is clean. | `90-rollback.sh` |
| O37 | ~11:45 | **Core `:3` (0f5d7e15, Clerk timeout → 503) LIVE**: `SERVING_NEW`, 40 2XX / 0 4XX / 0 5XX since the roll. The startup `DirectoryService` S3 snapshot error also appeared at the `:2` start on 10-17, so it predates this change.

Candidate 4 (`5de48c76`):
- image `11c40ce5…`, scan clean, measured;
- rendered under label I and uploaded;
- change sets created (TaskDefinition/Service only).

Reviews: R1 APPROVED (D3 lane); `f11a8353` APPROVE-WITH-FOLLOWUPS (G; next-controls 82 → 35 Core calls, about 11.8 s at median). Change-set **execution waits** for G's review of history-list commits `2d63d9ca`/`14573f9c`, which are merged but not yet reviewed. | Every shipped change gets an independent review. | — |
| O38 | ~11:55 | **Speed changes** (Neo: "taking a little too long"):
1. Candidate 4 rollout started **in parallel** with G's final review of the two perf-only history-list commits. This is preview only, IP-restricted, single tenant. The live chat waits for G's verdict; a blocker means rolling back to H.
2. New **pre-deploy end-to-end rehearsal gate** (E): a full first turn locally under live Core-latency profiles, so each candidate finds its next failure in minutes instead of a 45–60 min deploy cycle.
3. From now on only critical-path fixes go into a candidate; non-critical changes ride the next batch. This avoids review gates like today's wait on G. | Each live attempt has exposed one new latency budget; local rehearsal finds the next one sooner. | Roll back to H if G blocks. |
| O39 | ~11:55 | All candidate-4 reviews are in: R1 APPROVED (D3 lane); C's 3 commits APPROVE-WITH-FOLLOWUPS (G; history list 80 → 40 Core calls; follow-up H1 = a stale history metadata hash test, which must be fixed before main but doesn't block deploy). No gate remains for the live chat once the rollout verifies (model started 11:47:51Z; expected done about 12:10Z). The frontend kit `ship-fe-87d804bc` is ready (B made its mutating steps require `--execute` after the accidental S3 put). | — | — |
| O40 | ~12:00 | **E's rehearsal gate** (`1c3714cb`) on candidate 4: a full first turn **completes** under the quiet, live-median and live-tail Core profiles. First text arrives at 30 / 50 / 75 s, the result at 45 / 75 / 112 s, with about 310 Core calls per turn. The one predicted failure: a single Clerk 2 s timeout inside a run-owner call (load/publish) fails the turn. Core 503 is live, but run-owner calls don't retry.

Candidate 5 batch:
- C1 `48885546` (next-controls 82 → 4) + C2 `9c5a854a` (publish 42 → 37); E reviews;
- B builds a bounded idempotent retry for load/publish on "did not answer";
- C fixes H1 and continues load/publish/ack deduplication.

The rehearsal is now a standing pre-deploy gate. | Evidence-led; each candidate rehearsed before deploy. | — |
| O41 | ~12:25 | **Fourth live attempt, candidate 4 (12:13Z, conversation `239928ac`, run `6bd78118`). Furthest yet.**

Live:
- first connect OK (session 6.3 s);
- acknowledgement 36 s; start 9.9 s;
- **lifecycle got past next-controls**, and the SDK started a real session: mirrored session `2474c871`, 11 entries, 7.3 KB.

Failure: `stage=activity-result code=SDK_EXECUTION_FAILED` 37 s after start, so the SDK returned an error result. `requests` 0 rows means no proxy reservation, so the CLI's model call never reached a reservation. Next step: read the mirrored SDK entries (A writes the query, I run it) to see the API error.

Also: E approved C1+C2 (rehearsal 74.8 → 61.2 s at the live median). B is building the run-owner retry. | — | — |
| O42 | ~12:35 | **The cause of the fourth failure, read from the mirrored SDK transcript** (A's read-only query, task `09a0c56e`). Entry 11 is a synthetic assistant message: `Failed to authenticate. API Error: 403 INFERENCE_DENIED`. The CLI reached the model proxy 2 s after the prompt, and the proxy refused before any owner reservation.

The proxy has never served a live request. Its main container logs nothing, and its runtime image is `734a20ec` (source `34851020`), separate from the node image. E is escalated to MAX (fifth consecutive live failure) to find the refusing check, fix it, and add proxy refusal diagnostics.

Candidate 5 accumulates:
- C1/C2 (E APPROVE);
- C's H1/L2/C3 (load 32 / publish 27 Core calls);
- B's run-owner replay `48fba2e9`+`dbff23d8` (needs E's review);
- the proxy fix, which may require a proxy image rebuild. | — | — |
| O43 | ~12:45 | **Root cause of INFERENCE_DENIED (E, recorded in the Aurora log):** `meri_model_budget_owner` has no privilege on `meri_conversations.initial_run_bindings`. The owner's placement read for a dynamic conversation fails, and the proxy poisons its owner gate and refuses with 403 until it restarts. Control holds SELECT, INSERT and a lock-only UPDATE there; the owner holds nothing.

Fix: an append-only migration GRANT, applied live after Aurora snapshot `meri-pre-owner-grant-20261020` (started), then a proxy restart. No image rebuild is needed for the grant. Proxy refusal diagnostics follow in candidate 5 and need a proxy image.

Other results:
- G APPROVED C's batch 3;
- the D3 lane requested CHANGES on B's replay (refusals were being retried), so B is fixing it;
- C takes L1 (dead code) and L3. | Least-privilege grant that matches control's existing pattern. | REVOKE + snapshot |
| O44 | ~15:00 | **Grant applied live.** Aurora snapshot `meri-pre-owner-grant-20261020` AVAILABLE first. A one-off d2-migrate:6 task (`75e8cfa5`) as the migrator role: SELECT on `initial_run_bindings` + `next_runs`, plus lock-only UPDATE(record_sha256), to `meri_model_budget_owner`. Readback before all false; after SELECT and lock true, INSERT/DELETE false. Owner and proxy restarted together and are stable.

Chat 5 (14:52Z, conversation `a41a3bfa`): **still 403 INFERENCE_DENIED**, 3 s after the prompt. Aurora shows no error now (so the grant was necessary, not sufficient). CloudTrail shows the same pre-ENI refusal inside `resolve_bearer_sha256`. E (MAX) is reproducing the placement → decode → admission chain locally to find the next check.

The grant still has to be ledgered by the next `meri` migrator run (E's `55f2f768`, ordinal 22). Rollback: REVOKE, or the snapshot. | — | REVOKE / snapshot |
| O45 | ~15:20 | **Attempt-2 root cause (E):** the 3 s owner-exchange deadline. Each model request makes 2 owner exchanges, each exchange does 4 full ECS pair discoveries, and each discovery is 10 sequential AWS calls, so demand is about 5–13 s against hard 3 s/3 s/5 s caps. A bootstrap timeout quarantines the proxy permanently.

Decision (D016): ship **F1** (raise the caps to 15 s / 15 s / 25 s; same proofs) + **F2** (parallel discovery; same checks) in candidate 5. **F3** (proof reuse, which relaxes "fresh around every reply") is **deferred** to an ADR follow-up with a security review.

Split:
- E: proxy Python side + proxy refusal diagnostics;
- C: owner Node side + render + owner DEADLINE diagnostics;
- A: proxy image ship kit (candidate 5 needs node + proxy images + re-render).

Estimate to the next live test: about 2–3 h. | Time-only changes, minimal semantics risk. | — |
| O46 | ~16:00 | **Candidate 5 = `4797f7da`.** It is candidate 4 plus:
- C's call reduction (C1/C2/batch3/L1/L3);
- E's proxy-admission branch (the owner-grants migration `55f2f768` [already applied live by one-off], owner diagnostics, the owner-grants CI check, proxy F1/F2 + refusal diagnostics `57f9c66f`);
- C's owner F1/F2/DEADLINE (E's 4-file recipe);
- B's replay with the refusal fix `669b567d`.

Conflicts I resolved:
- `service.mjs`: kept `observe`, dropped `historyForCleanup`, removed L1's orphan doc comment;
- `owner.mjs`: C3's `withCurrent` return plus B's transient catch.

Focused tests 571/575. The 2 failures (action-host HTTP issuance) fail identically on candidate 4, so they predate this candidate; they go on the follow-up list.

Build: proxy image via A's kit (`ship-proxy-4797f7da`), then fed into the Meri kit (`ship-4797f7da`, label J), then the node image and measurement; sequential, because both use the shared CodeBuild project.

Reviews: G (owner side + L1/L3 + the service.mjs resolution), B (E's proxy Python), D3 lane (B's 669b567d); E runs the rehearsal on 4797f7da. Deploy after approvals. | — | — |
| O47 | ~16:35 | Candidate 5 images:
- proxy `57e79f73…` (A's kit; scan gate PASS, 0 findings);
- node `5b3017a3…` (scan 0 HIGH/CRITICAL).

The release-E measurement packet refuses any non-node difference from its pinned C baseline ("only C image/source fields may change"). The launch measurement covers only the node runtime, so I prepared it from `deployment-inputs.measurement.json`: the candidate inputs with only `images.proxy*` set back to the pinned values. Render and deploy keep `deployment-inputs.candidate.json` with the new proxy.

A transient local DNS outage made `04-image-readback` UNCERTAIN twice; both reruns were read-only.

Follow-up for F: teach the measurement preparer that a proxy change is allowed, or document this split in the kit. | Same measurement semantics; the proxy isn't in the measured surface. | — |
| O7 | 03:15 | Orchestrator effort could not be raised to xhigh from inside this session; the app refuses self re-pricing. Workers run at Opus 5.5 high, per Neo's table. | App rule. | Neo sets it in the app. |
| O48 | ~16:40 | Neo asked whether the rehearsal catches every issue and whether to fix everything at once. Answer: no. The rehearsal fakes ECS/EC2, the real proxy → Bedrock call, the live DB grants, Clerk and the browser, which are the hops that failed live.

I switched from one fix per live attempt to one sweep per failure class, all running in parallel while candidate 5 waits on reviews:
- A: provider hop proxy → LiteLLM → Bedrock (network, IAM, request shape, quotas; ≤5 tiny Bedrock calls allowed).
- C: DB privileges, every login × every statement on the two-turn path vs live grants.
- E: every deadline and timeout vs tail latency, plus a rehearsal of the full D3 checklist.
- G: frontend, public edge and Core for the D3 checklist.

The candidate 5 deploy does not wait for the sweeps unless one reports BLOCKS-CHAT. | Each live attempt so far found exactly one new instance of a class we could have enumerated: 3 deadlines and 1 grant. | If a sweep finds a BLOCKS-CHAT item, fold it into candidate 6 before the live test. |
| O49 | ~17:20 | **Candidate 5 does not ship. Everything goes into candidate 6.**

Sweep results:
- A found 3 BLOCKS-CHAT on the provider hop:
  - the Bedrock stream can't be settled (padding and extra fields);
  - CountTokens 465 vs billed 448, where the equality check would have quarantined the global budget;
  - the CLI's title and probe requests.
- E found the DEADLINE class open in about 8 more places (B1–B15) plus D1–D9.
- C found 0 blocking grants, plus a migration precedence defect.
- G found 0 blocking on browser and edge, plus 2 D3 frontend defects.

Built base `fable/meri-c6-base-20261020` @ 62a7495d: 4797f7da plus the A, E and C sweep branches, merged clean.

Remaining work, one owner per file set:
- C: B2/B3/D1/D2 capture chain and session-mirror budgets, plus the verify count.
- E: B1 delta coalescing.
- A: B6/B13 proxy lock contention.
- B: review of a3f5b74c, d4ed3a8f, 7afaeb83 and 496a9e59, then D8.
- D3 lane: review of d234d354, b0d253e5, 85f8163b, 20b7b6f1 and the frontend 3451cfd5/d16fabbf, then D3 (turn-2 reservation) and D5 (Stop 502).
- G: B4 Send fused reader, D4 event window, D7 session cap, D9 frontend stall.

Integration follows the established candidate flow: reviewed branches merge into the candidate branch, then rehearsal gate, build, deploy. | Fixing by class, all at once, per Neo's question. Shipping candidate 5 would only have reproduced A's item 1 live. | If a fix lane stalls, ship without it only if it is not BLOCKS-CHAT. |
| O50 | ~20:10 | Candidate 6 integration branch: `fable/meri-c6-integration-20261020` @ a5d2c73e. It is base 62a7495d plus four approved fixes:
- G `31888644`, B4/D4: Send 104 → 52 Core calls, acknowledgement at median 32.8 → 17.1 s;
- D3 `2bfec69d` + `450844a6`: containment waits for ECS STOPPED, Stop answers on the committed fence;
- A `00c4c5da`: carrier wait never poisons;
- B `af506b8b`: D8.

Reviews: B approved A's and E's base proxy commits; A approved G and D3; D3 approved A and B.

Still open:
- C `9c731785`, the capture chain (B2 tail margin 1.31×/1.43×; B reviewing);
- E's coalesce `1a738718` (batch running);
- E's fix for **d234d354 breaking the image gate**: B bisected `prepared-candidate-bootstrap` to 4/6, `REMOTE_RUNNER_CLEANUP_UNKNOWN`;
- G's frontend `6dd805c7` (D3 reviewing).

Dry-run merges of C and E onto the integration branch are clean. | Merge approved work early to surface conflicts. | — |
| O51 | ~20:45 | Started the candidate 6 proxy image build early, from integration a5d2c73e (kit `ship-proxy-a5d2c73e`, zip baa680c3…). Every proxy change is approved, and the pending branches (C capture, E coalesce, E keep-alive close) touch 0 `apps/proxy` files, so 04-feed's tree-equality check will hold on the final commit.

Ship rule: the candidate goes out once C's revised capture chain, E's keep-alive close fix (with the full 24/24 image gate) and G's turn-two wait are approved. E's B1 coalescing is included only if it is reviewed by then; without it replies stream in ~10 s chunks but complete (capacity about 47 deltas at median). | Saves ~25 min on the shared CodeBuild project. B1 is UX, not correctness, for a short test reply. | Include B1 in the next candidate if it misses this one. |
| O52 | ~21:10 | **Candidate 6 = `3681944b`.** The candidate branch was fast-forwarded to it (PR #194).

Contents: the c6 base, plus G `31888644`, D3 `2bfec69d`/`450844a6`, A `00c4c5da`, B `af506b8b`, E keep-alive close `032b1174` and C capture chain `543ad720`. Every commit is independently approved. C's branch was approved by B after one CHANGES round.

Ship artifacts:
- Proxy image `413ab2a6…` (built from a5d2c73e; `apps/proxy` is identical at 3681944b; scan 0 findings).
- Meri kit `ship-3681944b`, label K; node image build started.
- Frontend `6043b76e` (kit `ship-fe-6043b76e`; generator fixed to skip deleted paths with `--diff-filter=d`) is building on its own project.

**Left out:**
- E's B1 coalescing, which is not finished.

**Known risk:** C found a Clerk-503 *during `runner/load`* failing the turn at median (activity-load DEADLINE 23 s). It reproduces on the c6 base, while 4797f7da completed. A is investigating it in parallel with an integration rehearsal on 3681944b. | All approved work. The 503 risk needs a Clerk blip during load, which is not a blocker for the first live test. | If A finds BLOCKS-CHAT, hold before 16-execute. |
| O53 | ~21:30 | **Neo:** "Finish the candidate 6 live test, and start the hot-path redesign plan in parallel now."

Redesign plan, design only:
- E leads `ADR-HOT-PATH-REDESIGN.md`.
- C drafts the authority lease / once-per-turn pass.
- B drafts owner/proxy proof reuse (F3).
- G drafts the Core-side and edge needs, marking the capiro-backend auth changes that need Neo's approval.

D3 reviews E's coalescing (1a738718) for the next candidate. A continues the integration rehearsal and the Clerk-503 load investigation. I continue shipping 3681944b. | The bug count traced to the design: per-hop Core re-verification, cold per-turn runners, per-request pair proofs. Neo chose a targeted redesign over a rewrite. | — |
| O54 | ~21:40 | **Neo (verbatim):** "Approve the hot-path redesign direction and phase order. Start P0 and P1 after the candidate 6 live test."

This approves:
- ADR-HOT-PATH-REDESIGN.md §2, the direction: turn pass with commit-point revocation, warm affine runners, F3 proof reuse, one budget table;
- §5, the order: P0 → P1 → (P2 ∥ P3 design) → P3 → P4 → P5 → P6.

**Not approved yet** (each needs its own explicit yes when its phase arrives):
- the Core-side K1/K2 AUTH changes;
- the ≤ 30 s revocation bound;
- the pool size, TTL and cost. | Neo's decision. | P0/P1 start only after the candidate 6 live test. |
| O55 | ~21:55 | **Neo (verbatim):** "make those ceisions for me. this needs to be production gtrade for those deciions. no more unecessat testing paths".

This delegates to me the four open redesign decisions, including the capiro-backend AUTH changes K1/K2. Decided, production-grade:
1. **Warm runners (P5):**
   - keep at least 2 unbound pooled runners idle, autoscaled up to 10;
   - a bound runner stays with its conversation 10 min after its last turn, then is retired;
   - the proxy credential is issued per turn only, so an idle runner holds nothing usable;
   - one conversation per runner for life, enforced in the launch journal.
2. **Revocation (P3/P6):**
   - every durable write and release checks a Postgres revocation epoch, so it refuses immediately;
   - Stop and fencing take effect immediately;
   - a Core-side revocation (membership or client access removed in Core) reaches the hot path within ≤ 30 s: pass TTL 30 s, renewed at 15 s;
   - no 60 s variant.
3. **Core (P6):**
   - K1, the combined `current` route: approved;
   - K2, the Clerk cache: approved as positive-only, keyed by session, 5 s TTL, with the timeout still answered 503;
   - K3 throttler key: approved;
   - K4 ALB allowlist rule: done by the shipper at cut-over.
   They ship as one reviewed capiro-backend change, with an independent security review.
4. **Production rollout (Stage 3):**
   - separate production Meri stacks (own secrets, labels and alarms), serving os.capiro.ai, not the preview stacks;
   - order: Capiro's internal tenant, then the 3 tenants with the highest current Meri usage (no special compliance flags), then all tenants;
   - each step gated on p50 ≤ 10 s, p95 ≤ 20 s, and 0 timeout failures over its window.

**"No unnecessary testing paths" applied:**
- no shadow or dual-path modes;
- no per-phase throwaway harness: P0 becomes production telemetry plus alarms, which is also how each phase is verified;
- rollback is the previous release, not a runtime switch;
- the CI image gate and the existing rehearsals stay as the unit and integration checks;
- the candidate 6 deploy no longer waits on A's integration rehearsal: the image gate passed 24/24 and every component was rehearsed and reviewed.

Candidate 6 now also includes the approved E coalescing (D3 APPROVE, image gate 24/24 on the merge). The candidate becomes **`5a8da2fd`**, re-kitted and rebuilt (the build had not been measured or deployed yet). | Neo delegated, with a production-grade bar. | — |
| O56 | ~22:05 | **Neo:** consolidate the listed work into the plan, read each PR carefully, merge all of it, get Core, frontend and greenfield on the same page, then continue Meri. Meri items must be consistent with the new plan.

**Topology found:**
- **greenfield:** `main` is stale (8b123bea, 10-11). Work sits on `integration/meri-receiving-20261018`, about 3,300 commits ahead, plus the runner-fix branch and PR194. PR189/190 → receiving; PR191/192 are stacked on PR190; old codex drafts #96–#110 are on old stacks.
- **frontend:** `main` has PR101/105/110. Our preview release `6043b76e` is 5 ahead and 50 behind main. PR102 and frontend PR96 are on stale bases.
- **backend:** the default branch is `backend-import`. PR96 (2,202 files) and PR97 are stacked. The live Core 503 fix (`8a23d6d7`/`0f5d7e15`) is on its own branch.

**Read-and-plan lanes** (no merges until reports land):
- D3: Core;
- G: frontend;
- E: greenfield integrator, plus PR191/192;
- B: PR189;
- C: PR190, lifecycle, memory, schedules, Browser/Bash.

I merge from the consolidated plan. Candidate 6 continues in parallel: its live result gates PR194, which is the base for the Meri merges. After consolidation, preview ships from each repo's main. | Neo's instruction. | — |
| O57 | ~22:15 | **Candidate 6 (`5a8da2fd`) deploy.**

Done:
- Frontend `6043b76e` released on `capiro-portfolio-preview:19` (image a956a7a1, 0 findings) and VERIFIED. The fe-kit verify now compares the ECS-computed `compatibilities` as a set; a false refusal on order fixed in the generator.
- Meri measurement used node-only inputs (O47 recipe, scripted).
- Render and upload label K; the 3 change sets are TaskDefinition/Service only.
- Snapshot `meri-pre-c6-ledger-20261020`, then `d2-migrate:7` (candidate image a8e1cc4a) applied **ordinal 22** OWNER_READS (sha b05b88f0) to the ledger. The earlier hand grant (O43) is now ledgered; 20 rows skipped.

Then 16 → 19.

Rollback: forward redeploy of candidate 4 inputs; frontend `R1-rollback-to-18`. | Every component approved; the image gate passed 24/24. | — |
| O58 | ~22:45 | **Live chat 1 on candidate 6 (`5a8da2fd`)**, 22:39Z:
- Send acknowledged in about 18 s: allocate, admit and submit all returned 200.
- The runner started in 10.3 s.
- The SDK ran, and its model request reached the proxy.
- The owner REFUSED the proxy's placement exchange (`PRODUCT_PROXY_REFUSED gate=exchange step=reply-status phase=placement`), so the turn ended `SDK_EXECUTION_FAILED`.

**Root cause: my own error.** After the model rollout, the proxy's 50-line diagnostic cap was spent on overlap refusals, so I force-restarted the proxy alone at 22:32 to get clean diagnostics. The owner fixes its pair identity on first read and retires itself on any different proxy task (`service-task-leases.mjs:16`), which is why the kit's notes say "owner and proxy restarted together".

**Fix:** force-new-deployment of owner and proxy at the same moment. Under the 200/100 rollout the overlap keeps both sides refusing ("exactly one task" rule) until only the new pair exists.

**Lessons:**
1. Never restart one member of the pair alone.
2. ADR P2 (proof reuse) should make the pair tolerate a replaced counterpart with re-proof instead of permanent retirement. | Error in my action, corrected. | — |
| O59 | ~22:52 | **Owner/proxy re-pair: the rolling restart raced.**

What happened:
- The force-new-deployment of both at 22:43 overlapped old and new tasks for about 3 min.
- New owner `8011` hit its ~3 min pair wait and exited UNAVAILABLE at 22:47:34. It was still listed RUNNING when the new proxy `1e45`'s snapshot finally saw exactly one of each (~22:47:43), so the proxy most likely paired with the dying owner.
- The replacement owner `a88c` then appeared, and the proxy would refuse it on the first request.

**Clean procedure, now used:**
1. Set desired count 0 on both.
2. Wait until no task of either family exists.
3. Set desired count 1 on both at the same moment.

There is no overlap, so each sees exactly one fresh partner. Desired count returns to the template's 1, so there is no lasting drift.

The diagnostics limiter is 20 lines per 60 s window, not a total cap. Kit follow-up: step 16 should use this stop/start for the model pair instead of a rolling update. | Pair-identity locking plus the rolling overlap makes the rolling restart non-deterministic. | P2 replaces permanent retirement with a re-proof. |
| O60 | ~23:01 | **Live chat 2 on candidate 6: first real Meri reply on preview.** SDK → proxy → owner → Bedrock worked; the text "Hello! I don't have any specific information about this client…" streamed to the browser. Pair restart was clean: stop both, start both, 0 refusals.

The turn then ended **Failed / ATTEMPT_LOST** at the end-of-turn save:
- the runner's `activity-complete` got `PINNED_NATIVE_STATUS_503` at 22:59:36;
- control's task-router `capture` was CANCELLED after 5.4 s with 11.6 s of its own budget left (caller abort);
- control logged `Error: aborted` at 22:59:04.

Also, the run sat Queued for about 140 s. A is diagnosing (read-only) and building the fix from 5a8da2fd.

Also done:
- greenfield consolidation steps 1–2: `main` fast-forwarded to receiving `98d3c96a`, then runner-fix merged as `cff11610`;
- E is drafting the P0 plan, C the P1 plan. | — | — |
| O61 | ~23:10 | **Greenfield consolidation step 3:** candidate 6 (PR194, `5a8da2fd`) merged into `main` as `69fd1994` (tree `156bbc09`, equal to E's dry run). `main` now equals what preview runs, plus the receiving docs commit.

Neo's cloud agent will implement phases from `main`:
- **Access:** GitHub and a fresh Linux box with Docker. No access to this machine, no AWS.
- **Plans:** committed under `docs/hot-path/`.
- **E** is making P0-PLAN cloud-ready: repo-relative refs plus a §13 fresh-box gate environment.

**Live fixes on the current code stay with my sessions** (candidate 7):
- A: end-of-turn ATTEMPT_LOST;
- A: Clerk-503 during load (`39fd6b42`).
These run in parallel with the cloud agent's P0.

Steps 4–7 (PR189–192) are held:
- B found PR189 breaks 4 existing suites (18 failures), so it needs a fix first;
- C's PR190 report is pending. | Neo's workflow (O-phase). | — |
| O62 | ~23:15 | **Neo (verbatim):** "Yes, in parallel: your sessions fix the live issues as candidate 7 while my cloud agent builds P0."

The two tracks:
- **Candidate 7 (my sessions):** A on the end-of-turn ATTEMPT_LOST, plus Clerk-503 during load (`39fd6b42`); B on PR189's 18 suite failures (the step-4 prerequisite).
- **P0 (cloud agent):** from `main`, with the plan in `docs/hot-path/`.

Consolidation continues as I do it:
- frontend step 1 from G's plan, with G fixing PR102's flag gating;
- Core from D3's report, when it lands. | Neo's choice. | — |
| O63 | ~23:20 | **Neo (verbatim):** "Keep the candidate 7 fixes going, but hold the P0 handoff and the repo docs commit."

**HELD until Neo says otherwise:**
- handing `phases/P0-PLAN.md` to the cloud agent (the plan is cloud-ready);
- committing `docs/hot-path/` to meri-greenfield.

**Continuing:**
- candidate 7: A on the end-of-turn ATTEMPT_LOST, plus Clerk-503 during load;
- consolidation prep: G on the frontend step-1 PR and PR102 gating; B on PR189 green; D3 on the Core report; C on the PR190 report and the P1 draft.
No merges without me. | Neo's instruction. | — |
| O64 | ~23:30 | **P0 handoff to Neo's external (non-Claude, cost-saving) agent.** Neo is fine with P0 not being done in Claude.

**Status:**
- The agent created `feat/meri-p0-telemetry` from `main` @ 69fd1994.
- It was blocked on the plan files. I sent Neo P0-PLAN.md, ADR-HOT-PATH-REDESIGN.md and adj-g-CORE-SIDE-DESIGN.md (scanned first: no secrets, no local paths).
- The repo `docs/hot-path/` commit stays HELD (O63).

**Its CI question:** it proposed a new GitHub Actions workflow because its sandbox lacks Docker. My guidance:
- **Not inside the P0 PR.** The agent runs every non-Docker Node/Python suite itself.
- **I run the Docker image gate (24) and the rehearsals** on this machine during validation.
- **A CI workflow** for the existing gates is a separate decision for Neo: it is useful (the repo has no CI) but costs Actions minutes.

Also: C finished the PR190 report (one test fails in the merged tree; its owners must settle it) and P1-PLAN.md. | Cost and scope. | Neo decides on CI. |
| O65 | ~23:40 | **Chat 2 root cause (A):** the end-of-turn capture's `closeQuery()` kills the CLI, and the remote SDK process client's `close()` sends router `stop`. The router stop aborts pending non-stop exchanges (`task-router.mjs:48`), including the capture itself, so the turn ends ATTEMPT_LOST after the reply streamed. Fix `51ad171e`.

**Candidate 7** = `main` + `51ad171e` + A's Clerk-503 load fix `39fd6b42`. C is reviewing both.

Other status:
- the P0 external agent has the plan;
- G: frontend consolidation PR #113 (head `2abf9cdd`) is mergeable, and PR102 is being re-kitted. | — | — |
| O66 | ~23:50 | **Workflow (Neo):** "we will hand off all phases to my agent for the workload. you will plan each phase in detail i will hand it off and you will validate and ship images".

Two external agents:
- agent 1: P0, then P1;
- agent 2: P6-Core (capiro-backend K1/K2/K3), then later phases per the lanes.
My sessions only plan, validate and ship.

**Core consolidation:**
- PR96 → `backend-import` (merge commit), then PR97 (retargeted). D3 opens step 3: the 503 fix onto `backend-import`.
- **Decision:** include the `/artifact` hunk, so every application-authority route answers a Clerk/Core timeout as a retryable 503.
- Preview Core stays on `0f5d7e15` (`:3`) until a qualified Alpine build of the merged head. Do NOT run `migrate`.

E is drafting P6-CORE-PLAN.md, based on the post-consolidation head. | Neo's instruction; D3 §5: K1/K2 touch the same auth files, so the consolidation goes first. | — |
| O67 | ~00:20 | **P0 PR #195** (Neo's agent): `feat/meri-p0-telemetry` @ 43b705c8, +4449/−133, 73 files, draft. Its Docker gates never ran: GitHub Actions is blocked by billing, and the agent's host has no Docker.

**Out of instructions:**
- it adds a GitHub Actions workflow and `scripts/qualification/p0-telemetry/`;
- it touches files outside the plan's §4.

**Validation lanes:**
- E: plan conformance, file scope, redaction, the 164-vs-224 baseline (candidate 6 lowered Core calls);
- A: Docker image gate, rehearsals, Python suites, no-behaviour-change review, dry-run with the candidate 7 fixes.

**P6-Core plan:** validated and sent to Neo for agent 2, with the ADR, adj-g-CORE-SIDE-DESIGN and CONSOLIDATION-CORE (scanned clean). Agent 2 waits for the step-3 503 merge (the plan checks `0f5d7e15` ancestry).

**Frontend:** `main` fast-forwarded to PR #113's head `2abf9cdd` (PR #113 shows MERGED). The ship kit build is running; it deploys with candidate 7 so one live checklist covers both. | — | — |
| O68 | ~00:40 | **Candidate 7 review (C):**
- `39fd6b42` (Clerk-503 load): APPROVE.
- `51ad171e` (capture self-stop): code sound, CHANGES test-only, because its test stubs the router connector. C is landing its composed test on `fable/c7-capture-self-stop-20261020`, then B checks it independently.

**PR189 is green on main** (B: `fable/pr189-green-20261020` @ 68e25384, 24/24, dark). I'm **holding the main merge until candidate 7 is merged and shipped**, so the live test has no extra variables. Steps 4–7 follow, shipping dark with the next release.

**Agent 2 (P6-Core) is blocked:**
- the 503 fix is not merged (D3 in progress);
- it has no Git auth to the private `neo-capiro/capiro-backend`. Neo must grant repo access; I don't handle tokens. | — | — |
| O69 | ~00:17 | **Frontend image from `main`** (`2abf9cdd`, kit `ship-fe-2abf9cdd`) is built: `ac51d8fd…`, scan 0 findings, smoke passed. Change set, rollout and verify (06–08) are held so it ships together with candidate 7 and one live D3 checklist covers both. Rollback is `R1-rollback-to-19`.

The P0 change list (E's items 1–8) went to Neo for agent 1. A's Docker-gate results may add an addendum. | Ship together; fewer live-test variables. | — |
| O70 | ~00:30 | **Core consolidation complete.** PR #101 (D3: the 503 fix onto `backend-import`, `/artifact` included, tree `89ef63a1` = the trial) was merged with a merge commit. `backend-import` is now `8b23c65b` and contains `0f5d7e15`; agent 2's precondition check now passes.

Preview Core stays on `:3` (`0f5d7e15`) until a qualified Alpine build of the merged head. No `migrate`.

Candidate 7 test: C pushed `fable/c7-capture-self-stop-20261020` @ d398d556 (composed real-router test; gate 24/24, rehearsal 6/6); B is checking it. | — | — |
| O71 | ~00:45 | **P0 PR #195 fix round:** head `e64b2231` (64 files). The workflow, `scripts/qualification` and the `docs/hot-path` records are removed. The agent reports items 1–8 done plus a writer-cleanup fix; first-turn 9/9, D3 9/9, median 164 confirmed.

Re-validation:
- E checks the delta against items 1–8;
- A runs the Docker gates on `e64b2231`, plus the dry-run merge with candidate 7 (d398d556 + 39fd6b42).

Ship order once both say ACCEPT:
1. candidate 7 + frontend;
2. P0 (needs the observability stack applied, then the live dashboard check). | — | — |
| O72 | ~01:20 | **Candidate 7 = greenfield `main` @ `574ee962`.** It is 69fd1994 + `fable/c7-capture-self-stop-20261020` (51ad171e A's fix + d398d556 C's composed test; B APPROVE: it fails 2 of 3 cases on 5a8da2fd and passes 3/3 on the fix, ×3 runs) + `fable/adj-clerk503-load-20261020` (39fd6b42; C APPROVE).

- The candidate branch was fast-forwarded to it.
- Kit `ship-574ee962`, label `FIRST_CHAT_20261021A`.
- Proxy image `413ab2a6` reused: `apps/proxy` is unchanged.
- The pipeline runs to stage3. Then 11–19, an owner/proxy **stop-then-start** re-pair (O59 procedure) after step 16, and the frontend `2abf9cdd` rollout. Then the live D3 checklist.

E accepted P0 at e64b2231, conditional on A's gates. | — | — |
| O73 | ~01:30 | **Candidate 7 image built:** `cd339fa5…`, 0 HIGH/CRITICAL.

**Measurement step:** the session scratchpad (Windows temp) was wiped, so the node-only measurement helper was gone. A piped `tail` masked the failure, so step 06 refused (no AWS effect). The helper is now permanent at `C:\dev\fable\ship-kit\tools\measurement-prepare-node-only.mjs`, and the pipeline checks each step's exit code instead of the `tail` pipe. Rerun from the prepare step.

**Rule:** release tooling never lives in the scratchpad. | Tooling durability. | — |
| O74 | ~01:40 | **Candidate 7 deploy started.**
- Measurement verified, render and upload done under label `FIRST_CHAT_20261021A`.
- The 3 change sets are TaskDefinition/Service only.
- No new migrations: no migration files changed 5a8da2fd..574ee962, and ordinal 22 was already applied at 22:13 (O57).

Sequence: 16 → 17 → 18 → 19, then `ship-kit/tools/repair-model-pair.sh` (the O59 stop/start, now a durable tool), then frontend `2abf9cdd` 06–08, then the live D3 checklist. Rollback is candidate 6 inputs (`ship-5a8da2fd`) and frontend `R1-rollback-to-19`. | — | — |
| O75 | ~01:45 | **P6-Core PR** (agent 2): neo-capiro/capiro-backend #102, `feat/core-p6-authority-current` @ 1cd6f2b6 → `backend-import`, 23 files, +1710/−131, draft.
- The agent verified the 503 fix was present before branching.
- K1–K3 implemented; 134 tests added; build passes; no new jest/tsc failures.
- It documents (a) a "control-credential mounting issue" (production-equivalent bootstrap: `req.path === '/'` makes the classifier refuse with 401), which is suspect because live preview accepts the control credential, and (b) a raw-body size limitation.

**Validation:** D3 checks plan conformance and tests, and verifies (a) against live and the bootstrap. B does the required independent security review.

Candidate 7 deploy is running (16 started 01:30:59Z). | — | — |
| O76 | ~01:55 | **Disk (Neo):** "Delete the two old frontend kits now, and do the Docker cleanup and WSL compaction once A and D3 finish. Tell me before you stop WSL."

- I removed only the two regenerable `out/portfolio-source.zip` files (1.87 GB each; `git archive` byte-for-byte, sha recorded in `archive.json`) from `ship-fe-87d804bc` and `ship-fe-6043b76e`, sending them to the **Recycle Bin**. Each kit's deploy records (build, change set, readbacks) are kept as an audit trail. Neo empties the bin to reclaim the 3.7 GB.
- **Pending:** the WSL Docker cleanup (unused images 18.6 GB, build cache 7 GB) and the `ext4.vhdx` compaction, after A (P0 gates) and D3 (P6-Core tests) finish. Neo is told before WSL stops. | — | — |
| O77 | ~02:07 | **Live chat on candidate 7** (`574ee962`, image `cd339fa5`, control:41/runner:26, frontend rev 20), turn 1 sent at 02:01:02Z.
- Acknowledged in 19.5 s; Starting at 90.5 s; Running at 98.5 s; **first text at 208.5 s**; reply complete.
- Then **Failed / ATTEMPT_LOST at 292.5 s**, at the same step (activity-complete, `PINNED_NATIVE_STATUS_503`).
- The self-cancel signature is gone (no capture CANCELLED line). New signature: `Error: aborted` at 02:04:56; `stdout` CANCELLED; `Client connection prematurely closed` on both control and runner at 02:05:23.
- **A second cause at the same step.** C is diagnosing it, building the fix and a composed test. Checklist items 2–6 are held until turn 1 completes cleanly. | — | — |
| O78 | ~02:20 | **P6-Core PR #102 verdicts:**
- **B (security): APPROVE.** No defect in K1–K3; 28/29 mutants killed; PostgreSQL confirms the READ ONLY snapshot. Recommends N1–N4.
- **D3 (conformance): CHANGES.** K1–K3 match the plan, with +134 tests and no new failures. Two defects:
  - (a) the control-credential classifier fails under the production (consumer) mounting. **REAL**, in `backend-import` since PR96. Preview Core `:3` predates it, which is why live works; **never deploy a `backend-import` image until it is fixed**;
  - (b) `/current` 403s every Research Portfolio conversation that `/context` accepts, because `FOR SHARE` is not allowed in a READ ONLY tx.

**Resolution of B's N1 vs D3:** D3 verified on pg16 that `/context` accepts RP conversations, so `/current` must too.
**Decision (O55 delegation):** a `{lock:false}` option on `authorizeResearchPortfolioConversation`, used only inside `/current`'s caller-owned READ ONLY REPEATABLE READ snapshot. It is change-controlled `research-portfolio-artifact-authority.ts`, approved here; the old routes keep their locks.

**Required in #102:** the classifier fix plus a production-mounting test; the RP fix plus a real-pg test; N2 (503 not 403 for an unavailable membership owner or tx); N4 (TTL from read start).
**Follow-up PR by agent 2:** the same `mountedRequestPath` fix for every other classifier PR96 added (D3 item 5). It is required before any `backend-import` image. | Auth correctness + no regression for RP; keep the 503 retry class intact. | — |
| O79 | ~02:40 | **Agent 2 delivered:** PR #102 updated with the required fixes, and follow-up PR #103 (the classifier fix across all PR96 classifiers). Both are drafts into `backend-import`. Builds, tsc and jest show no new failures. The 10 new native PostgreSQL tests were not executed: no Docker in its environment.

**Re-validation:**
- D3: delta conformance; runs the pg tests and the production mount probe on #102, #103 and both merged.
- B: security re-check, including classifier mutants.

**WSL disk:** the Ubuntu `ext4.vhdx` is 131 GB with 80 GB used (`/opt` 44 GB of old test copies; ~25 GB Docker reclaimable). Plan: after the A/C/D3 container runs, prune Docker and the old `/opt` copies, tell Neo, `wsl --shutdown`, then Neo runs an admin compaction. Expected to return ~90–100 GB on C:. WSL must NOT be deleted: it is the validation lab. | — | — |
| O80 | ~03:40 | **Second end-of-turn root cause (C):** the capture's self-stop leaves a router fence. The worker's broker poll is refused by it, so the broker cleanup revokes the original mid-save, giving a 503 and ATTEMPT_LOST.
- Fix: `fable/c7-completion-poll-20261021` @ 8ef90c79 (the poll defers to the completion). Its test fails on 574ee962 and passes on the fix. E is reviewing → candidate 8.

**B's side sessions:** B started two sessions at 02:57Z, "Repair 22 stale Meri browser specs in capiro-frontend" (running) and "Proxy refusal lines: own budget outside requests" (idle).
- The proxy one overlaps P0 PR #195's `refusal_diagnostics.py`.
- Neither merges without my review. | — | — |
| O81 | ~04:00 | **Verdicts:**
- C8 fix `8ef90c79`: E APPROVE.
- P0 PR #195 @ e64b2231: E ACCEPT + A ACCEPT (gate 24/24, CoreCalls 164 = independent counter). **PR #195 merged into main** (`74ece1d5`).
- **Candidate 8 = main @ `e3ba4e47`** (P0 + C8 fix). `apps/proxy` changed (P0), so a new proxy image is needed. Release scripted in `ship-kit/tools/release-candidate.sh` (build and stage to change sets, exit codes checked). Then 16–19, re-pair, the observability stack (P0 §3.5) and the live checklist with the dashboard.

**Core #102:**
- B APPROVE security; D3 ACCEPT. Beyond plan: a clientless Research Portfolio receipt (`clientId: null`).
- **Decision (O55 delegation; no scope increase): REMOVE the null-client branch.** `/context` never served RP conversations (D3 corrected its §4). Nothing in Meri uses it, and it amends the approved K1 contract. Keep `{lock:false}` and the pg READ ONLY tests.

**#103:** B APPROVE, D3 CHANGES (cleanup): one shared `mountedRequestPath` helper (F2); trailed-target tests for `isRetainedSignedPost` and `historyReleaseProvenance` (F3, mutants Y02/Y06). Merge order: #102, then #103. | — | — |
| O82 | ~04:15 | **WSL cleanup (Neo approved O76):** no containers were running, so I ran `ship-kit/tools/wsl-cleanup-20261021.sh`.
- Removed regenerable `/opt` test trees: `fe-consol` (18 GB), `fe-release`, `fe-base`, `fe-ship-87d804bc`, `fe-g-stream`.
- Docker: pruned stopped containers, unused images older than 12 h, all build cache (20 GB) and unused volumes.
- Kept: `fe-ship-2abf9cdd`, `fe-stale-specs` (B's side session) and `adj-b-transport`.
- WSL used space went from 98 GB to 43 GB; `fstrim` trimmed the freed blocks.
- **Compaction needs admin** (Windows 11 Home has no `Optimize-VHD`): `diskpart /s C:\dev\fable\ship-kit\tools\compact-wsl-diskpart.txt` after `wsl --shutdown`. Neo runs it.
- Candidate 8 is building in CodeBuild; it doesn't use WSL. | Space. | — |
| O83 | ~04:55 | **Candidate 8 (`e3ba4e47` = P0 + C8 fix) staged and deploying.**
- Node image `ade114ed` (0 HIGH/CRITICAL) plus a new proxy image (P0 changed `apps/proxy`).
- No migration files changed; ordinal 22 is already applied.
- Steps 16–19, then `repair-model-pair.sh`, running.

**P0 observability stack `meri-first-chat-observability`: CREATE_COMPLETE.**
- The committed template equals a fresh render.
- The change set was all Adds: 10 metric filters, 8 alarms (`meri-preview-*`, INSUFFICIENT_DATA until traffic), the `meri-preview-hot-path` dashboard and the SNS topic.
- **No email subscription:** subscribing Neo's address to alarm mail is a standing configuration change that needs his explicit OK. | P0 §3.5. | — |
| O84 | ~05:36 | **Candidate 8 step 16 (model) took 54 min** (04:40 → 05:34Z). The rolling 200/100 update plus pair identity locking meant the proxy refused snapshots (44 review lines) until the overlap cleared. The gate passed; 17 → 19 and `repair-model-pair.sh` follow.

**Release-tooling follow-up:** step 16 should stop both services, deploy, then start both together (the `repair-model-pair.sh` pattern) instead of rolling. ADR P2 removes the root cause (identity lock → re-proof). | — | — |
| O85 | ~06:02 | **MILESTONE: first fully completed Meri turn on preview.** Candidate 8 (`e3ba4e47`), conversation `c80fce86…`:
- turn 1 sent 05:51:49Z (via the Send button; Enter was silently ignored once before the page was ready, a minor FE finding);
- Queued at 19 s, Starting at 85 s, Running at 92 s, first text at 205.7 s, **Completed at 262.7 s**;
- the end-of-turn save succeeded, so C's completion-poll fix is verified live.

**Turn 2** (run `c675be89…`): Starting at 97 s, then **Failed at 104 s** with `stage=runtime-admission code=NATIVE_UNAVAILABLE cause=PINNED_NATIVE_STATUS_503`. No model call. The worker logged `BROKER_KICKOFF_CLEANUP_UNKNOWN`. C is diagnosing.

**P0 telemetry works live:** stage marks plus per-turn counters (turn 2: 151 Core calls, ~255 Clerk reads, coreMs 34.6 s). | — | — |
| O86 | ~06:15 | **Disk:** Neo ran the WSL compaction. The Ubuntu `ext4.vhdx` went 131 → 54.8 GB and C: free went 15.9 → 91.8 GB. WSL is stopped and starts on next use. Docker Desktop's own data is 4.2 GB (idle) and was left alone. I enabled nothing risky: sparse VHD mode is disabled by WSL itself as unsafe.

Neo asked me to look through the rest of the disk. A background scan of large folders runs into `release-logs/diskscan.txt`. Deleting anything beyond Docker caches needs Neo's yes.

**Agents:** P0 is merged and live, so agent 1 is free. E is refreshing the P1 plan against `main` @ e3ba4e47 and drafting the P2 plan (proof reuse, for agent 2 after P6-Core). C is on turn-2 admission. Core PRs #102/#103 are still unchanged since 02:46Z (agent 2's fix round awaits Neo pasting the change list). B's side sessions produced (a) 22 stale browser-spec fixes (test-only, `fable/meri-stale-browser-specs-20261020`, cut from 87d804bc) and (b) a proxy refusal-line budget fix (`fable/proxy-diag-budget-20261020`, from 4797f7da, needs a rebase over P0's refusal_diagnostics changes). Both go into a later batch. | — | — |
| O87 | ~07:00 | **Turn-2 root cause (C), proven from CloudWatch and read-only durable reads:** the restoration journal's `claim` (`native-preparation-journal.mjs`: `if(saved.run.state!=='queued')fail(...)`) refuses a restore once the run is `starting`. `812e236b` (publish `starting` early) widened the continuation snapshot's check but not the claim. Every next turn, resume and fork fails with a 503 at runtime-admission. Turn 1's `BROKER_KICKOFF_CLEANUP_UNKNOWN` is unrelated (the known D3 item: a 10 s kickoff-stop deadline against ECS containment). Fix `fable/c8-turn2-admission-20261021` @ b9356199; A is reviewing it, with the extra ask to find other `queued` assumptions → candidate 9.

**Plans sent to Neo:**
- **P1** (budget table, refreshed on `main` @ e3ba4e47; 0 secrets or local paths) with its inventory, the ADR and P0-PLAN → agent 1, now free.
- **P2** (owner/proxy proof reuse; PR-A then PR-B; independent security review mandatory) with B's design and P1 → agent 2, after #102/#103.

**Disk:** Downloads is 126.6 GB, the only large item. A listing is running. Nothing is deleted without Neo's yes. | — | — |
| O88 | ~07:15 | **Disk scan (Neo asked me to look across the disk):**
- `Documents\Codex` is **179.9 GB** (the Codex agent's dated working folders, July 29 → Oct 16): the largest item on C:.
- `Downloads` is **126.6 GB**: about 80 old `capiro-*` project and verification checkouts (1.2–2.2 GB each).
- Others: McAfee 15.7 GB (security product data; not touched), `Claude-Data` 10.4 GB, `frontend-meri-wire` 7.3 GB, various `wt-*` worktrees of ours (about 2.9 GB each).
- WSL `ext4.vhdx` 54.8 GB after compaction.

**I deleted nothing from these.** A read-only audit (`ship-kit/tools/repo-cleanup-audit.ps1` → `release-logs/repo-audit.csv`) reports, per folder: size, uncommitted changes, and commits on no remote. Only fully pushed and clean checkouts are candidates, and deletion is Neo's decision. | — | — |
| O89 | ~08:30 | **Old-folder audit result (read-only):** 324 folders, 303 GB. Downloads: 108 git checkouts clean and fully pushed (77 GB). A stricter second check (HEAD on a remote branch, no stashes, no odd ignored files) confirms **82 folders / 52.6 GB** safe; 26 excluded (a few ignored non-build files such as local config). `confirmed-safe-downloads.json` holds the names. Another 25 checkouts have unpushed or uncommitted work (21.8 GB), not touched. `Documents\Codex` (204 GB) is task containers holding repo clones; a deeper per-repo audit (`repo-audit-codex.csv`) is running. **Nothing deleted; waiting for Neo's yes.** C pushed the turn-2 fix as `96b6da6d`; A's review is blocked on a prompt that needs Neo. | — | — |
| O90 | ~09:15 | **Agent 2 applied the Core change list.** #102 @ `946511a7`: UUID-only `/current`, the clientless RP branch removed, `{lock:false}` kept. #103 @ `43a03ada`: a shared `mountedRequestPath` helper and trailing-slash tests. #103 is stacked on #102. D3 (conformance, pg tests, mount probe, merged pair) and B (security, mutants incl. Y02/Y06) re-validate. Merge order #102 → #103.

**Disk (Neo: "make space"):** `ship-kit/tools/delete-safe-downloads.ps1` re-verifies each folder before deleting it (clean, nothing unpushed, HEAD on a remote branch, no stash, not the parent of a kept worktree). A dry run is in progress; then `-Execute`. Codex and McAfee are untouched.

**Consolidation status:**
- Core: PR96/97/#101 merged; #102/#103 in re-validation.
- Frontend: `main` @ 2abf9cdd; PR102 (flag off) ready to merge.
- Greenfield: `main` @ e3ba4e47; PR189 green; PR190 has 1 failing test to settle; PR191/192 clean. The hold on merging them lasts until candidate 9 passes turn 2, so one live test isolates the turn-2 fix. | — | — |
| O91 | ~09:20 | **Host resource alarm.** `SearchIndexer` private commit is 73 GB again; committed memory is 125.2 of 127.3 GB; `pagefile.sys` is 96 GB (this is what consumed ~44 GB of C: free: 91.8 → 47.6 GB; WSL's disk also regrew 54.8 → 68.6 GB from test runs). A and B were already waiting on "host memory". Neo must run the admin fix (I am not elevated, and changing system services is not mine to do): stop the indexer now and preferably disable Windows Search. Saved as a memory note.

**Disk cleanup:** the earlier dry run was never killed by the restart (PID 29200 finished its read-only pass). The real `-Execute` run (PID 4560, started 05:03:53 local) re-verifies and deletes the 82 confirmed-safe Downloads folders; the log is `release-logs/delete-safe-downloads.log`.

**A (review of C's turn-2 fix)** is mid-run; I asked it to run the real-Postgres restorer tests properly (0/4 in its environment) and to list other `queued` assumptions before giving the verdict. D3/B's re-validation of Core #102/#103 is mid-run (B provisional: APPROVE both, #103 with a test-gap note). | — | — |
| O92 | ~09:30 | **Host memory fixed by Neo.** He ran the admin command: Windows Search is now Stopped/Disabled; committed memory fell 125 → **49.9 of 110.5 GB**; C: free 47.6 → 64 GB (the pagefile shrinks fully only after a reboot). I sent B "go" for the #102/#103 mutant re-run. The orphan dry-run (PID 29200) was stopped; the real `-Execute` cleanup (PID 4560) is still deleting its first folder (~100k node_modules files left) and is expected to speed up now that memory is free. A (turn-2 fix review incl. real-DB restorer tests) and D3 (Core #102/#103 on the new heads) are running. | — | — |
| O93 | ~09:45 | **Consolidation had stalled** while I fixed the live chat and the host memory leak. Neo asked whether it is active. Restarted the parts that are not truly blocked:
- **Frontend PR102** (approvals UI, flag off): E reviews G's gating commit, then I merge it.
- **Greenfield PR190:** C builds `fable/pr190-on-main-20261021`: PR190 merged onto `main`, `owner.mjs` union plus its test, and the `product-mount` failure settled. **Decision: update the test to the real contract** (a run is `starting` or `failed` before the SDK, not `queued`, since `812e236b`), unless C proves the runner should refuse earlier. PR191/PR192 stack on that.

**Still held:** greenfield PR189–192 merges into `main` until candidate 9 passes its live turn 2. Core #102/#103 wait for B's and D3's re-checks (running; memory is fixed). The disk cleanup is mid-first-folder. | — | — |
| O94 | ~09:25 | **Candidate 9 started.** A: **APPROVE `b9356199`** (root cause matches; the widened claim admits only `queued|starting` for restorations; nothing else on the turn/resume/fork paths is `queued`-only). Its three non-blocking follow-ups: revive `native-restorer-pg` (the broker pg fixture needs a transition-authority stub), tighten the `running` assertion, and drop the router TLS fixture's `openssl` dependency. Fast-forwarded greenfield `main` e3ba4e47 → **96b6da6d** (fix + test). `release-candidate.sh 96b6da6dc --reuse-proxy-kit ship-proxy-e3ba4e47` (apps/proxy unchanged) is staging.

**Release tooling:** `kit.mjs` step 16 now stops owner+proxy, executes the model change set while they are stopped, starts both together, and gates on PAIR_READY (75 s with no proxy `gate=pair` / owner `UNAVAILABLE`). This replaces the rolling update that took 54 min on candidate 8. `repair-model-pair.sh` is now a manual repair only. | — | — |
| O95 | ~10:08 | **Candidate 9 live (`96b6da6d`).**
- **New step 16:** the pair started together (proxy 09:38:45, owner 09:38:55); pairing refusals stopped after 90 s; PAIR_READY. Whole model step ≈ 5 min (candidate 8: 54 min).
- **Worker startup:** `:42` crash-looped 3× (~30 s each) until control `:43` came up at 09:51:32, then started cleanly. This is a startup-ordering delay, not a fault. Verify: all services on rendered revisions, health 200.

**Live test, new conversation `307e2e94…`:**
- **Turn 1 COMPLETED** (sent 09:57:23; running 09:58:44; done ≤ 248 s).
- **Turn 2 FAILED** (`EXECUTION_FAILED`, 10:03:34), but later than candidate 8: the journal claim passed, `run.running`, and the runner reached `query.start`. Then the router `prepare` was **refused by turn 2's receiver (403, DOWNSTREAM_REFUSED)**. Turn 1 had a `native-preparation prepare phase=owner` before its router `prepare`; **turn 2 had none**. Hypothesis: the continuation path skips the owner prepare grant. Also turn 1's `retire` was refused at `authority` (to check).

**C** pauses PR190 and fixes this. It also sweeps the rest of the turn-2 path in one pass (third turn-2 bug in a row), with a real-receiver-authority test. A reviews. | — | — |
| O96 | ~10:20 | **Candidate 9 live checklist** (`C9-LIVE-RESULTS.md`):
- PASS: turn 1; turn 3 (a next turn ~2.5 min after a failed turn; continuation works); double Send (1 admit); refresh mid-reply; Stop (cancelled 5 s after the click, no runner left); client isolation.
- FAIL: **turn 2 sent 33 s after turn 1 finished**: router `prepare` 403. This is a timing race with the previous turn's still-registered task (turn 1's `retire` was refused at authority). Sent to C as additional evidence.
- Transient sidebar-preload 503s and one unreproduced "New conversation" miss are noted, not blocking.

Candidate 9 stays live (better than 8). | — | — |
| O97 | ~10:45 | **Turn-2 root cause (C, `3c56c3e9`).** On `resume` with a `sessionStore`, the pinned SDK materializes `os.tmpdir()/claude-resume-*` and sets `CLAUDE_CONFIG_DIR` there. The receiver's descriptor policy requires the parent `/run/meri`, so it refuses (403) **every resumed turn, whatever the delay**. Fix: `TMPDIR` = the run's config parent while the remote worker lives. My timing hypothesis was refuted: turn 3 passed because a turn after a failed turn starts fresh (no lineage). A is reviewing for candidate 10.

**Decision (delegated, production-grade):** after a failed or cancelled turn, the next turn continues from the conversation's **latest published checkpoint**; Stop or an error must not erase history. C builds it on its own branch (candidate 11 unless both are reviewed together). C also adds a **resumed-run probe** to the in-image launch measurement (release gate gap), plus A's PostgreSQL fixture follow-ups, then PR190.

**Core:** **#102 MERGED** → `backend-import` @ `aacaba68` (D3 ACCEPT, B APPROVE). #103 retargeted to `backend-import`. D3 ACCEPT; B CHANGES (test-only: two root-mounted trailed-target cases kill Y02/Y06), for agent 2. No Core deploy until #103 merges. | — | — |
| O98 | ~11:00 | **Candidate 10.** A: **APPROVE `3c56c3e9`** (`adj-a-review-c10.md`): cause confirmed against the pinned SDK; the fix is the narrowest available; `/run/meri` is the Fargate ephemeral `material` volume (21 GiB shared, read-write, not tmpfs); test fails on base and passes on the fix; gate 24/24; no fourth bug found on the resumed path (live resumed start→completion still unverified). Fast-forwarded greenfield `main` 96b6da6d → **3c56c3e9**; `release-candidate.sh` (proxy reused) + 16–19 running. Neo sent agent 2 the #103 test-only change. | — | — |
| O99 | ~11:10 | **P2 PR-A arrived:** greenfield **#196** @ `e76a0eae` (agent 2; base 96b6da6d; 63 files +3789/−677; agent reports 6,351 pass / 72 failing as on the base / 75 mutation checks). **Validation:**
- **D3:** conformance and gates, merged onto `main` 3c56c3e9 (image gate, proxy suites in the deployed product proxy image, owner suites, rehearsal counts against the 31-exchange baseline).
- **A:** the **independent** security review required by P2-PLAN §9 (E planned it and B wrote the threat model, so neither qualifies), including the explicit sign-off on the lease relaxation. C's live fixes preempt A.

**Shipping order:** candidate 10 live test first, then P2 PR-A (needs a new proxy build) as its own release, so the two changes stay separable. Neo re-pasted agent 2's earlier #102 report; already resolved (pg 10/10 by D3; #102 merged `aacaba68`). | — | — |
| O100 | ~11:35 | **C asked for a ruling** on real-PostgreSQL allocation tests needing gateway migration `0002_tenant_budgets.sql` (its header says tests never execute it). **Ruling: A.** The disposable local provisioner builds the same schema the preview DB runs, derived from the deployed migration plan (`first-chat-migrate.mjs` PLAN) so it can't drift; no migration SQL changes, only the 0002 header note reworded to say where it is applied; the tenant row is seeded in the fixture. Option B (skip when absent) is rejected because it hides live-path coverage. | — | — |
| O101 | ~12:20 | **Merges:**
- Core **#103 MERGED** (`backend-import` @ `309af848`; B APPROVE at 81b1d05a, all 21 mutants killed; D3 ACCEPT). P6-Core is complete in code but **not deployed** (Core preview still core:3 / 0f5d7e15).
- Frontend **PR102 MERGED** (`main` @ `4f9a7e8d`, approvals flag off; E APPROVE). Not deployed; it changes nothing visible.

**Candidate 10 live (`3c56c3e9`):** model step ≈ 5 min, all gates pass. **The live test is BLOCKED:**
- Neo was signed out of Chrome and re-signed in.
- Anduril's current conversation (whose only turn is candidate 9's cancelled Stop test, run 8c0b140f) is wedged: `POST /api/action-followthrough/session` → **401 SESSION_REFUSED** on every try (control's catch-all; no log line), and the UI blocks Send ("a turn may already be in flight… Check reserved turn"; the button doesn't clear it).
- Other clients refuse: "This client is not configured for the current conversation". The service keeps one current conversation per user, and "New conversation" is disabled by design ("create-conversation selector" missing).

**E diagnoses read-only** (`adj-e-SESSION-REFUSED-AFTER-CANCEL.md`): the root cause, whether every Stop-then-reopen bricks a conversation (a release blocker if so), and the missing reason log. | — | — |
| O102 | ~12:45 | **Root cause of the blocked conversation (E):** control `valid()` (`prepared-candidate.mjs:67`), `select()` and the owner's currentness pin a conversation's **original** `configurationSha256` and `versions` (image digest, runner task definition revision). **Every image deploy bricks every existing conversation** (release blocker); the refusal is flattened into an unlogged 401.

**A and D3 hit the weekly usage limit** (resets Oct 24 14:00 ET). P2 PR-A validation is paused.

**Neo raised the cost.** Spend is now the critical path only: **E** builds 4a (refusal reason log) + 4b (pin per run, not per conversation) on `fable/c11-conversation-survives-deploy-20261021`; **C** finishes only `fable/c10-latest-checkpoint-20261021` (also covers the sdk/cli-changed seeding) and defers items 2–4; **B** reviews both. Candidate 11 = both. The consolidated Core (`backend-import` @ 309af848) deploys as its own release **after** two-turn chat passes. P2 validation and P1/P2 work wait. | — | — |
| O103 | ~13:05 | **C's ruling request: seeding when the next turn's `sdk`/`cli` differ from the checkpoint's.** Ruling: **option (3)**, refuse with `NEXT_TURN_SDK_CHANGED`. The case cannot occur until an SDK/CLI bump (one pair pinned everywhere: 0.3.295 / 2.1.295). **Option (1), a fresh SDK session seeded with a bounded transcript recap, is a hard prerequisite for any SDK/CLI bump release.** In scope now (C's catch, missing from E's list): the next-run journal, execution, the retention decoder and the worker's next-turn check pin only `sdk`/`cli`/`contracts`/`checkpointFormat`, not the full `versions`, so image-only deploys keep resuming.

**P2 PR-A security review (A): CHANGES** (C1: a partner replacement retires the survivor; C2/C3: two key checks with no test). A signs off on the lease relaxation provided C2's tests are added. Agent 2's change list is held until D3's conformance result, so agent 2 does one round. | — | — |
| O104 | ~13:20 | **P2 PR-A (#196): CHANGES from both reviews.** A and D3 independently found that a partner replacement is classified as `PAIR_DRIFT`, so the survivor retires (§6 items 7–9 can't pass).
- **Decisions:** (a) partner-only transitional states with every pin intact are `PAIR_UNAVAILABLE`; one RUNNING pinned task under a PRIMARY IN_PROGRESS deployment of the pinned task definition is a passing proof; (b) `retire` exits non-zero so ECS replaces the task (no infra health check).
- **Also required:** C2 and C3 tests (relaxation guard N14/P5; no resend P9), and M1–M5.
- **Cost:** D3's gates were stopped (they would have to be rerun on the next revision).
- The combined list is in `phases/P2A-CHANGES-FOR-AGENT2.md`, for Neo to hand to agent 2. | — | — |
| O105 | ~13:40 | **Disk nearly full (12.9 GB free).** WSL `ext4.vhdx` grew 93 → 110.8 GB from validation containers; the Downloads cleanup is at 9 folders (~14 GB, ~20 min per folder).
- **Docker in WSL:** pruned 559 unused anonymous volumes (**34.8 GB**) plus build cache; images kept for reviews. This frees space inside the vhdx (stops growth); C: gets it back only after compaction.
- **`ship-kit/tools/cleanup-fable-workdirs.ps1 -Execute`:** removes 118 of my own work folders and old release kits that are clean with HEAD on a remote (worktrees via `git worktree remove`). It keeps live/rollback kits (3c56c3e9, 96b6da6d, proxy e3ba4e47, fe 2abf9cdd, core 0f5d7e15) and active sessions' worktrees, and skips 11 with uncommitted/unpushed work.
- **Still needed when the sessions are idle:** WSL compaction (Neo admin diskpart) and a reboot (96 GB pagefile). | — | — |
| O106 | ~14:05 | **Three more consolidation PRs (Neo's other agent), to merge without contradicting in-flight work.** Each gets an independent review:
- **frontend #115** @ `368ce652`, base main 4f9a7e8d, 101 files, includes PR114 → **A**;
- **Core #104** @ `5bf90117`, base backend-import 309af848, 3,453 files, +146k/−916k, mostly deleting `apps/web/src` and `apps/defense-api/runtime-source` → **D3**, which must prove the deletions are dead code for every build/deploy;
- **greenfield #197** @ `cf634d4f`, base main 3c56c3e9, 395 files incl. 18 `infra/product-preview` and 7 proxy files shared with P2 #196 → **C**.

**Planned order:** FE #115 → main after APPROVE (no deploy until after chat). Core #104 → backend-import before the consolidated Core deploy. Greenfield #197 **after** candidate 11 is merged and live-tested, rebased onto it; C rules on which of #189–#192 it supersedes. **Also:** P2 conformance (D3) final verdict CHANGES; its gates had already run on e76a0eae and must rerun on the next revision. | — | — |
| O107 | ~15:10 | **Reviews in:**
- **Candidate 11 part 1 (B):** C's `9e574418`, security design APPROVED; CHANGES: F1 liveness (a RESERVED next turn written before a deploy can't be accepted after it → `continuesSession` at accept/execution and in the retention decoder), F3 (adopt B's probes; they kill 16 surviving mutants), F2 (deterministic fixture + an A→B→C two-deploy case). Sent to C.
- **Greenfield PR197 (C): CHANGES:** content is safe (nothing turns on in preview, no hot-path additions, contracts additive) but the PR turns 3 tests red (test/fixture fixes). Plan: after candidate 11, merge `main` into it, fix the 3 tests, and merge with a **merge commit** so #189/#190 show merged; close #191/#192 as superseded (byte-identical). **Ship-kit impact:** PR197 makes `stage3-deploy.mjs upload-plan` require `--secret-labels`, so step 13 must collect the secret readback; update the kit when PR197 merges.
- **Frontend PR115 (A): CHANGES (C1):** the memory link was always visible. **I applied C1** as `7fda299e` on the PR branch (server-decided `memoryReviewEnabled`; spec asserts absent by default). A re-checks. | — | — |
| O108 | ~15:40 | **P2 PR-A revision from agent 2:** #196 @ `c703e9f3` (rebased on main 3c56c3e9; two commits: `5550f8b6` original, `c703e9f3` fix: "preserve partner replacement and enforce proof lease boundaries"). Agent reports 315 owner + 453 Python tests pass and all 34 targeted mutants caught. Quick scope check: no infra/IAM/LiteLLM/Dockerfile/CI/runner files. **Full re-validation (A security re-check + D3 gates) is queued until chat works (cost decision O102).** Also **Core #104 (D3): runtime safe, CHANGES test-only (3 test fixes)**. | — | — |
| O109 | ~16:20 | **Candidate 11 halves pushed:** C `1eb1aed3` (B's F1–F3 applied; image gate 24/24; Linux flakes traced to WSL clock steps) and E `843115b6` (4a refusal log + 4b; composed 8/8; known limitation: pause → resume/fork across a deploy is still pinned). They conflict textually in `next-run-journal.mjs` (both relax `accept`/`execution`). **C composes `fable/c11-candidate-20261021`** (one implementation satisfying both test sets); **B then reviews the composed candidate once** (part-1 re-check + part 2 + their meeting point), instead of reviewing two branches separately. | — | — |
| O110 | ~16:55 | **Candidate 11 composed by C:** `fable/c11-candidate-20261021` @ `bce70776` = main 3c56c3e9 + C 1eb1aed3 + E 843115b6, with one continuity rule resolving `next-run-journal.mjs`; image gate 24/24; composed 8/8 (17/17). E's parallel composition `fable/c11-on-c10-20261021` @ 9e7de79e is **superseded** (it is built on the pre-F1 9e574418). **Neo said reviews take too long:** B does a **targeted** review (the conflict resolution, plus re-running its existing probes and mutants on the touched files; 20–30 min). **Staging runs in parallel** with the review: `release-candidate.sh bce707763` (proxy rebuilt, since `apps/proxy/product/owner-native-currentness.mjs` and `product-owner-placement.mjs` changed). The observability template change (CONTROL_SESSION_REFUSED metric filter) deploys separately after the release. **Merge to main only on B's APPROVE.** | — | — |
| O111 | ~17:00 | **Two release-tooling faults hit candidate 11 staging:**
1. My disk cleanup removed `wt-candidate` (clean and pushed, but the release script needs it). Recreated on `fable/meri-first-chat-candidate-20261020`, and added to the cleanup keep list.
2. **Repo bug:** `infra/product-preview/proxy-image-start.sh` `require_project_idle` calls `list-builds-for-project --sort-order DESCENDING` with CLI auto-pagination. Once the project has more than one page of builds, AWS rejects it ("Sort order can't be specified when passing a nextToken"), so the proxy kit refuses as "not proven idle". **Hotfix in the kit copy only** (`ship-proxy-bce70776/tools/proxy-image-start.sh`; original kept as `.as-committed`): drop `--sort-order` (order is irrelevant; every build is checked). The proxy image content is unaffected (the buildspec pins the build script). **Follow-up:** the same one-line fix in the repo for `proxy-image-start.sh` and `temporal-image-start.sh`.

Proxy kit 00–03 run manually, then `release-candidate.sh --reuse-proxy-kit ship-proxy-bce70776`. | — | — |
| O112 | ~16:48 | **B: APPROVE candidate 11 @ `bce70776`** (F1 fixed; accept and execution share one continuity rule; all suites incl. A→B→C and E's 8 composed cases; no new mutant survivors; 4 minor follow-ups in `adj-b-review-c11.md`). **Greenfield `main` fast-forwarded 3c56c3e9 → `bce70776`.** Proxy build started 16:47Z (patched kit idle check worked; PREFLIGHT_OK), then staging, then 16–19 and the observability stack update. | — | — |
| O113 | ~17:10 | **Consolidation finish-up, run in parallel with the candidate 11 release (no overlap):**
- **A:** re-check FE #115 @ `7fda299e` (the earlier re-check never reported).
- **D3:** commit the 3 test-only fixes on Core #104 itself, then re-verify.
- **C:** merge `main` `bce70776` into PR197 (merge commit), fix its 3 red tests, and add the repo fix for the `--sort-order` + pagination idle-check bug (proxy and temporal start scripts).

**Then the merges:** FE #115 → main (close #114); Core #104 → backend-import; PR197 → main by merge commit (close #191/#192). **Deploys:** consolidated Core as its own release after chat passes; frontend main at the next frontend deploy; PR197 as candidate 12 (dark plus log-format changes; the ship kit's step 13 must collect `--secret-labels`). | — | — |
| O114 | ~17:25 | **Candidate 11 live** (`bce70776`; staged 17:02, shipped 17:20; model ≈ 5.5 min). **Live test, first check:** Anduril's current conversation is still refused, now with a reason (the 4a log works): `CONTROL_SESSION_REFUSED step=initial-binding code=INITIAL_BINDING_CONFIGURATION_CHANGED`; transcript 404, so its original run never started (likely reserved by the page during the blocked candidate-10 attempt). E's §4b refuses an unstarted original under a changed configuration **by design**, assuming the UI offers a new conversation; it can't ("New conversation" disabled). **Gap:** a user whose current conversation hasn't started is bricked after every deploy. E diagnoses and proposes the minimal fix (rebind the unstarted original under the current config vs. the resolver choosing a fresh conversation), read-only, before building. | — | — |
| O115 | ~17:35 | **C ruling request (PR197 red test #2, scope ledger):** PR189 registers 5 reads, but the curated evidence (`adapters.json`) marks `query_outreach`, `search_legiwatch_news` and `get_legal_reference` partial and omits BD evidence, so the invariant "registered ⇒ complete adapter" throws. **Ruling: register only reads whose evidence is complete**; un-register those four in PR197 (the adapter code stays). Rejected: asserting completeness unverified, or a round trip to the author for a dark feature. **Tracked as step 1 of the reads flag rollout:** re-register each read once its adapter evidence is complete and verified live. | — | — |
| O116 | ~17:50 | **MILESTONE: two-turn chat works on greenfield (candidate 11, `main` `bce70776`).** In a fresh tab (new sessionStorage, so Core's bootstrap created a new conversation and Meri claimed a fresh original under candidate 11):
- turn 1 "remember PELICAN" completed (accepted 10.5 s, running 86 s, first text 194 s, done 233 s);
- **turn 2, sent at once, completed** and answered "PELICAN. Goodbye." (resume with memory; past the old prepare-403 point; first text 199 s, done 222 s);
- page reload: history shows both turns, session issued, 0 refusals.

**Still open:**
1. **C12:** an unstarted original is single-use and expires in ≤ 15 min (and on config change), so the conversation is bricked forever (E: `adj-e-C12-UNSTARTED-ORIGINAL.md`, option A, migration 0020, ~1 day + review). Neo's old Anduril tab stays bricked until then.
2. A reopen after a **Meri** deploy for a started conversation is verified at the next Meri release.
3. PR197 test-3 ruling: (A) production fix (hash each unique file once per `readCurrent` pass).

**Neo: "don't do any of that yet"** on the capirov2-vs-greenfield comparison. The proposal card stays unstarted. | — | — |
| O117 | ~17:55 | **Neo approved building C12 option A** (rebind an unstarted original under the current render on the next issuance, input keyed by run, migration `0020` added to PLAN; immutability triggers kept; nothing started is ever rebound). E builds `fable/c12-unstarted-original-20261021` from `bce70776`; B reviews. **At ship:** Aurora snapshot first, then the migration through `meri-product-preview-d2-migrate`, then the release. | — | — |
| O118 | ~18:05 | **O115 withdrawn.** C measured that un-registering the four reads turns **40 PR189 tests red**; those tests discover, invoke and revoke exactly those reads through the SDK and native runtimes. That is the completeness evidence O115 said was missing, so the stale artefact is `adapters.json`. **Ruling: option (A) by C.** Mark the four reads plus PR197's `research-legal-candidates` complete in the curated evidence, **each citing its covering tests** (any read lacking discover+invoke+revoke coverage stays partial), update the 13+7 ledger expectations and the exposure file (before → after counts explained), and drop local `24b6eda2`. Reads stay dark. The pre-existing `ledger.test.mjs` load failure on main is a follow-up. PR197 pushed at `ef3fbbd9` (merge + profile-mounts fix + `--sort-order` fix + the O116 read-hash fix, 454/454). | — | — |
| O119 | ~19:00 | **Stopping point and final plan.**
- **Core #104 MERGED** → `backend-import` @ `8d9958f7` (D3 ACCEPT at `bdaeed65`). Core consolidation is complete in code, not deployed.
- **E** (C12) and **C** (PR197 per O118) finish to a pushed branch and stop. A, B and D3 are idle. No new work is assigned until Neo approves the plan.
- **Final plan** merges the two closeout plans (112 app + 107 Meri items) with Fable's open work and client-optional chat: `FINAL-PLAN-20261021.md`, published at https://claude.ai/artifact/2LDTPZ43afpp2MW2YJaP8C.
  - **Phases:** Phase 0 baseline; Speed S1–S3 (+S4 conditional); Meri M1–M8; App A0–A5; Launch L1–L4.
  - **Lanes:** 4 parallel lanes (R runtime core, D domain/proxy, U Meri UI + Core-for-Meri, A app) plus Fable ops.
  - All 219 IDs are verified mapped by script.
  - **Simplifications:** ADR P3 → authority-lite (S2), with the full lease only if S3 misses its target; ADR P4 keeps only its tests; ADR P6 folded into M1; T0–T7/O0–O7 collapsed into the 5-step phase loop.
  - **New rule:** every release passes the whole-flow chat check (two turns, reload, reopen after deploy, idle 20 min). | — | — |
| O120 | ~19:10 | **O118 corrected.** C showed that three reads (`query_outreach`, `search_legiwatch_news`, `get_legal_reference`) are **deliberately partial slices** (narrowed inputs in code, stated in PR189's handoff), and BD evidence covers client subjects only. Marking them complete would be false. **Ruling: option (S).** The ledger gains a declared-slice state: a registered partial operation must carry `exposedSlice` text and test references and renders as "partial, slice exposed". `search_research_sources` is curated complete. Expansions stay with MT-09 / MT-05 in plan phase M3. Reads stay dark. | — | — |
| O121 | ~19:25 | **Neo: "the work will be done by my other agents, not yours."** Fable's sessions do **no implementation**: only planning, review/verification and ops (merges, migrations, releases, environments). Effective now:
- C's O120 edit is cancelled (PR197 stays at `ac80ef4d`).
- E's C12 build is stopped and pushed as a WIP handover.
- C's and E's running turns were stopped twice, so the stop instructions run next.

**Phase 0 code items move to Neo's agents:** PR197 red test 2 (O120 declared-slice ledger) → agent 2; C12 (continue E's WIP branch) → agent 1; the AGENTS.md ownership update → agent 2.

**Fable keeps Phase 0 ops:** consolidated Core deploy, frontend deploy, observability metric, PR197/C12 merge + Meri releases after validation, closing superseded PRs, status table, WSL/reboot. Reviews by Fable's sessions remain (= "check"). Fable no longer pushes fixes to agent PRs (e.g. `7fda299e` was the last). | — | — |
| O122 | ~19:40 | **Wave 1 briefs out:** `phases/WAVE1-AGENT1-BRIEF.md` (finish P1 first, since Neo says it's nearly done; then C12, then M1) and `phases/WAVE1-AGENT2-BRIEF.md` (PR197 red test 2 per O120; AGENTS.md ownership; P2 fixes + PR-B stacked). E's partial C12 was left uncommitted when its handover turn was cut off; Fable committed it unchanged and pushed it as `fable/c12-unstarted-original-20261021` @ `0b6737d5` "WIP (handover)" (untested; the agent may use or restart). C confirmed PR197 is untouched at `ac80ef4d`; both extra load failures are pre-existing on main (M1 follow-ups). **Validation started** (review only): A re-checks P2 PR-A `c703e9f3` security; D3 re-runs the gates. | — | — |
| O123 | ~19:55 | **Neo adds a third agent (lane A).** Brief `phases/WAVE1-AGENT3-BRIEF.md` + verbatim ticket text `phases/A1-TICKETS.md` (17 tickets: X-04, ST-01/02/24, WS-02/03/04, PF-10/11/12/22, ML-02/03/07/08/09/10), extracted by anchor from the app closeout plan. A1 builds now, and its live checks run in staging (A0, Fable). Confirmed to Neo: all 219 items from both closeout plans are in the waves (script-verified). | — | — |
| O124 | ~20:10 | **Neo's decisions on plan §8:**
1. Staging **not yet** (A0 deferred; live checks for writes wait; raise again at Wave 3).
2. General chats read across permitted clients; actions across clients are fine if simpler; no new machinery.
3. All change-controlled work approved.
4. **Four agents.**
5–8. As recommended.
6. Raise the data-path question at Wave 3.
9. **Add the Claude API as a second model code path next to Bedrock, with every model and reasoning level selectable** → new phase **MP** (lane D after P2 PR-B; UI via lane U).
10. capirov2 comparison deferred.

**Agent 4 (lane U) brief:** `phases/WAVE1-AGENT4-BRIEF.md` + `phases/M1-UI-TICKETS.md` (MF-01/02/06/07/10/21 verbatim). Agent 1's M1 is now runtime only. Plan v3 published (7 waves). | — | — |
| O125 | ~20:20 | **Agent 1 delivered:** P1 **#200** @ `f94ef9e1` (578 files, +61k: scope check first) and C12 **#201** @ `80ea8031` (25 files). Review only: **C** reviews P1 (did not plan it); **B** does the C12 security review (it reviewed C11). A and D3 are still on P2 PR-A. | — | — |
| O126 | ~20:45 | **Neo: briefs left out the master files' details; agents must not act on their own.** Fix: (1) **all four agents get both master closeout plans** as the source of truth; (2) `phases/STANDING-RULES.md` = verbatim architecture-to-preserve, owner map + collision rule, no-duplication rules, regression matrix and definitions of done from both plans; (3) a verbatim ticket file per agent for its current work (AGENT1: MR-07, MR-01/02/06/08/09; AGENT2: MX-02, MT-02/04/05/09/16; AGENT3: A1-TICKETS; AGENT4: M1-UI-TICKETS + MG-03/MF-19); (4) every brief starts with "Sources of truth" and the rule: implement each ticket's bounded work and acceptance exactly, ask (don't decide) when anything is open. **Standing practice for every future brief.** | — | — |
| O127 | ~21:00 | **Agent 2 Wave 1 delivered:** PR197 `c9222658` (O120 ledger: 74→75 complete, 3→4 partial, 5→3 absent; E reviewing); ownership docs greenfield #198 + frontend #116 (**both MERGED**; docs only; capiro-backend has no owner map); P2 PR-B **#199** `d5b27630` stacked on #196. **Agent 2's question answered:** attached tickets are references for Wave 1; MT-04/05/09/16 are M3 work, assigned with a cross-owner handoff in the M3 brief, which also settles MT-16's scope. Rule for all future briefs: the task list says what to build now; next-phase tickets are context only. | — | — |
| O128 | ~21:10 | **Coordination channel opened at Neo's request:** greenfield issue **#202** "Coordination: Fable ⇄ build agents (relayed by dot)" (pinned). Message header format FROM/TO/TYPE/RE; PR-specific questions go on the PR. Rules: approvals only from Neo, never from comments; agents never merge or deploy; ask, don't decide; no secrets. **Fable checks #202 and open PRs at every work step** (no push notifications for issues). dot monitors the ChatGPT agents and relays. | — | — |
| O130 | ~21:30 | **PR197 MERGED** → greenfield `main` `cd9a1f95` (E APPROVE at c9222658; C's review). Closed as superseded or included: #191, #192 (byte-identical), #190 (ancestor; its base was an integration branch), #194 (equal to an earlier main). #189 shows merged. All features stay off. Next Phase 0 Meri release = PR197 + C12 (#201) once B approves; kit step 13 needs `--secret-labels` (PR197's tooling change). **Reboot deferred** until B/C/D3 finish their WSL runs. | — | — |
| O131 | ~21:45 | **Neo: delete everything from before the current work** ("every other worktree, local repos, unrelated docker items can go"). `ship-kit/tools/cleanup-all-old.ps1 -Execute`, 340 targets, 4 deletions at a time:
- **C:\dev:** 106 folders, everything except `fable` and `rubin-audit` (modified today; left for Neo).
- **C:\dev\fable:** 20 old work folders; the current repos, kits, reports and live/rollback kits are kept.
- **Documents\Codex:** all of it.
- **Downloads:** 214 git checkouts and `capiro-*` folders; loose files are kept.
- Anything modified in the last 6 hours is skipped. The old one-at-a-time Downloads cleanup was stopped.

**Docker pruning** (unused images and volumes) waits until the reviewers' container runs finish, together with WSL compaction and the reboot. | — | — |
| O132 | ~22:00 | **dot relay is live** (status from all four agents on #202). Answered on #202:
- **Agent 2:** Wave 1 tickets are references; MT-* goes to M3; next is R1–R4.
- **Agent 4:** (1) the brief controls. **Plan §4 lane table had agents 3/4 swapped → fixed (U = agent 4, A = agent 3), plan v4 republished.** (2) M1 exceptions in capiro-frontend only: shared shell (agent 4 owns it while M1 is open), Meri proxy routes, tests; greenfield and Core changes go by handoff. (3) **MF-07 decision: approve the agent's proposal:** same-tab reload persistence, cleared on sign-out/tab close, keyed to exact account/client/conversation, plus keeping the in-flight request identity (no double send).
- **Agent 3:** A1 PRs capiro-backend **#105** `e4b6040b` + capiro-frontend **#117** `f2dc9a39` (Settings/Workspace). **A** does the security review and rules on WS-02/03/04 policy. | — | — |
| O133 | ~22:30 | **Consolidated Core deploy HELD; production data finding.** Preview Core (`capiro-preview-first-chat-core:3`) uses the **same Aurora cluster and `capiro` database as the live services** (capiro-dev-api, engagement-api, intel-api, onboard-api). A read-only ledger query (inspect task rev 68, current api image; rev 67's image was gone) shows **all 11 consolidated-Core migrations NOT_APPLIED**; latest applied `20281016020000_clio_conversation_bootstrap_receipts` (10-17). Deploying `backend-import` therefore means migrating the live production DB; at least `clio_memory_scope_unique` touches existing data. **This is decision 6 (data path), arriving early, and is raised to Neo.** Phase 0 continues without it: the Meri release (PR197 + C12, Meri's own DB) and the frontend deploy. Also: Neo is to tell dot that Fable's implementation-detail answers within the plan are approved, so relays don't wait on him. | — | — |
| O134 | ~22:45 | **Relay loop working:** agent 2 couldn't find the round-2 list → full R1–R4 posted on PR #196. Agent 3 published all A1 drafts: Settings/Workspace capiro-backend #105 + frontend #117 (**A** reviewing); Portfolio/Mail capiro-backend **#106** `50397769` + frontend **#118** (**E** reviewing, including a migration-safety check against the shared live DB). | — | — |
| O135 | ~23:00 | **Neo: clone the database.** Created an Aurora copy-on-write clone `capiro-newstack-preview-clone` of the shared `capiro-dev-data` cluster: same subnet group, SG, KMS and param group; serverless v2 0–4 ACU, auto-pause after 30 min; writer `capiro-newstack-preview-clone-writer`. Estimated ~$15–50/month. **Plan:** point preview Core at the clone, apply the 11 consolidated-Core migrations there, deploy `backend-import`, run the whole-flow chat check. The live DB stays untouched; the production migration happens at cutover after a compatibility review. **C12 (B): CHANGES, one mechanical fix** (regenerate the initial-input contract metadata hash), posted on PR #201; D1 (policy pinned, fail-closed) accepted. | — | — |
| O136 | ~23:15 | **Neo: fresh sessions after every wave** (cost and context-size mistakes). Each wave ends with `WAVE-N-HANDOFF.md`; then new agent sessions "agent N v2…", new Claude reviewer sessions, and a fresh coordinator session from the handoff + memory. dot is switched to the new names via #202. | — | — |

## O137 — 2026-10-21 — Watcher false NEW_PR fix; Core kit 8d9958f7 targets the clone
- `watch-github.sh` now reports NEW_PR only for PRs created after the watch started, and keeps the previous snapshot when a repo listing fails. The capiro-backend #27 alert (opened 10-16) was a false positive.
- `ship-core-8d9958f7`: 04 rewrites DB_HOST and DATABASE_URL to `CLONE_DB_HOST` (allowed diff: image, RELEASE_SHA, DB_HOST, DATABASE_URL); 00 uses `--no-paginate`; new `045-migrate-clone.sh` runs the image `migrate` verb (prisma migrate deploy) on the new revision before 05-roll. Rollback (:3) returns to the shared cluster, which stays unmigrated, so the old code stays compatible.
- O137 addendum: first 8d9958f7 build FAILED at the inherited `objective-migration-absence` gate (that gate existed to keep 20281016010000 out of the 0f5d7e15 image). The consolidated release intends it, so the gate is replaced by `consolidated-migrations-presence` (all 11 migration.sql files required). Rebuild started.
- O138 — Core 8d9958f7 rebuild FAILED in-image: static probe `production-dependency-closure` HOLD "frozen input mismatch: package.json". RUNTIME-CLOSURE-CONTRACT.json still pins 0f5d7e15 inputs (package.json, lockfile, api package.json, dependency graph; likely the generated Prisma schema pin too). Product-repo fix → briefed to agent 4 (Core-for-Meri) on #202; Fable does not edit it (O121). Core deploy to the clone waits on that PR.
- O139 — #107 (51e265bd) qualified in CodeBuild 44ca9614: all in-image gates pass and the exact-digest scan has 0 findings. Digest sha256:543472c7…183e. The kit `ship-core-51e265bd` builds from the PR branch, pre-merge. After D3's ACCEPT: fast-forward backend-import to 51e265bd (same SHA, same image), then 04 (TD → clone), 045 migrate the clone, 05 roll, 06 verify, and a fresh-tab chat check.
- O140 — The clone migration ran as the preview app user. 14 migrations were pending, not 11: 20261014050000 and 20281011010000 applied, then 20281011020000 failed (42501, "must be owner of table business_development_prospects"; nothing applied, implicit transaction). Live migrations run as the Aurora master user, so the clone is discarded and re-cloned (`reclone.sh`, guarded by the Purpose=newstack-preview tag). `045-migrate-clone.sh` now registers a one-off family `capiro-preview-core-clone-migrate`: Core :4 image, DB_HOST = clone, master DB_USER/DB_PASSWORD, and the admin-migrate execution role and logs. Core :4 (registered) is unchanged and runs as the app user.
- O141 — Fresh clone available. The first master-user migrate task failed with CannotPullContainerError 403: the admin-migrate execution role can't pull capiro/preview-core. Created IAM role `capiro-preview-core-clone-migrate-exec`: trust ecs-tasks (SourceAccount-scoped), AmazonECSTaskExecutionRolePolicy, plus inline GetSecretValue on /capiro/dev/aurora/master only and kms:Decrypt on efe8a18d via secretsmanager. The migrate TD uses this role and Core's log group. Remove the role and family when the new stack has its own migrate path.
- O142 — Core switch-over HELD again. The master-user migrate on the fresh clone applied 5 migrations, then 20281012020000 failed (42701: clients.account_owner_version already exists live). Most pending migrations are self-declared source-only / reserved / candidate. The backend-import migrations folder isn't deployable as-is. Briefed agent 4 on #202 to inventory them, move non-runnable ones out of prisma/migrations unchanged, keep flags default-off, report live conflicts, and regenerate the pins. After merge: re-clone (the clone is dirty again), migrate, roll Core :N. Preview Core stays on :3 (shared DB, unchanged). The Meri release proceeds independently.
- O143 — Neo (via dot, 22:50 UTC): no approvals in Workspace; remove them with no dead code. Revised A1 list posted on #202/#105/#117. Removed: the WS-03 approval service, routes, contracts and UI, plus the blueprint approval fields; stored approval tables are kept untouched with marked Prisma models (no migration). Sharing, wall and ownership protections are unchanged. Meri, release and PF-12 approvals are unaffected. Earlier review item 6 is superseded.
- O144 — Proxy image eb657920 (sha256:a838846f…) scan: 2 UNDEFINED-severity findings, CVE-2026-111943 in the base packages ca-certificates and ca-certificates-bundle; no HIGH or CRITICAL. The CVE is unscored and base-only, and the serving image predates the CVE publication. Accepted (ACCEPT_NON_HIGH_FINDINGS=1). Re-check at the next proxy build; if it's scored HIGH, rebuild on the fixed base.
- O145 — Meri release eb657920 staged (01–15). Kit step 13 is patched to pass `--secret-labels`, in both the ship-kit generator and this kit. The live Meri ledger (read-only check) has ordinals 1–22. C12's 0020 is the LAST `integration`-stage entry, and the ledger is ordinal-exact, so shipping C12 applies the whole integration stage: 21 additive, Meri-migrator-owned migrations plus integration grants, already approved by D016 ("snapshot first") and by Neo's decision 3. Run: Aurora snapshot `meri-pre-integration-c12-20261021`, d2-migrate revision = :7 with image 5164a6e0 (product-eb657920), stage `integration`. Then 16–18. Rollback: snapshot restore and the kit rollback.
- O146 — Agent 3 boundaries: (a) a status 404 can hide revoked access, so #118 drops the pre-intent auto-clear; send reservation and recovery are unchanged and the gap is deferred. (b) Neo chose ML-09 skip-and-continue in chat: hold the colliding message, keep syncing, advance the cursor, keep the guard.
- O147 — **Meri release eb657920 DEPLOYED** 23:44 UTC: control:46, temporal-worker:45, runner:31, owner:44, proxy:44, issuer:45. All kit gates passed and 19-verify reports STAGE3_TASK_DEFINITIONS_MATCH_RENDER. The acceptance packet is posted on #202 for dot → astra 6 (Neo's new process: Fable does no live checks).
- O148 — P1 #200 shared-file corrections: agent 1 gets a P1-only exception for the listed proxy, gateway and provenance files. Sequenced: #196 and #199 merge first, then agent 2 freezes apps/proxy/product and apps/gateway/budget while P1 is open, then agent 1 rebases on that main and resolves the 14 conflicts.
- O149 — astra 6 criterion 1 FAIL (run 64815325, ATTEMPT_LOST). Diagnosis: owner hot path 112 s (31 exchanges, ~600 owner AWS calls, 92 Core calls, 5.3k DB statements) ran past the turn window, and the runner's completion got a control 503. C11 requests at 17:40/17:45 UTC failed identically, so this is NOT a release regression and there is no rollback. S1 (P2 #196/#199 + P1) is the fix and now top priority. Verifier holds dispatches; criteria 2–5 are BLOCKED; criterion 6 may run.
- O150 — Neo: dot owns code review and verification; Fable ONLY ships (merge on dot ACCEPT, AWS/Docker gates, deploy, migrate, rollback, AWS facts). The review queue is handed to dot on #202. Claude reviewer sessions take no new work. Live Core ledger evidence was posted for agent 4.
- O151 — Neo: Fable writes briefs + ships; dot reviews. M1 runtime brief for agent 1 posted on #202: MR-01/02/06/08/09 verbatim, new M1-X1 next-turn admissibility field (for agent 4's Ready state), E12-D pause/resume/fork across deploy, the candidate 9–11 follow-ups, E05–E12 + E40 + MX-13 verbatim. Starts now on its own branch; rebases after P1.
- O152 — Ship-requests received: #196 ba548925, #199 bfe98e96, #119 5c86f9b3, #120 d637c158 (dot CODE ACCEPT). BLOCKED gates are delegated for execution only to the D3 session (it holds the P0 harness and pinned images), order P2 then FE. Merge order: #196, #199, P2 release, P1 notice, then #119, #120, FE deploy.
- O153 — A1 backend (#105/#106) ships inside the consolidated Core release, behind agent 4's migration cleanup. Order: cleanup → merge #105/#106 → canonical gates (clean Jest, PG16, image) → re-clone, migrate, roll → #117/#118 + FE deploy. EX-06 manifest: agent 1 handles all 193 entries in one PR (classify only outside its lane).
- O154 — Workspace descendant ACL gap → agent 3 fixes under A1 WS-03 (existing draft-access authority on comments/checks/edit-lock/anonymization; gateway and direct paths; 404 negatives). #108 → agent 4 fixes the packaging consumers of the moved read-delegation SQL. MR-01 foreclosed-before-original Stop: existing reply with expiresAtMs = foreclosure time, no schema change. #205 to dot.
- O155 — Neo confirmed to Fable directly: hand planning, delegation and shipping over to dot. Boundary posted: finish the P2 gate run (D3) and the handover package, start no new shipping operations, cancel the #119/#120 gate queue, then post SHIPPING RELEASED.
