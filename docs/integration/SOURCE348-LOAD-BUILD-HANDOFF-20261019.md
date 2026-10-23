# Source348 load repair: source-only image handoff (2026-10-19)

> Historical evidence only, superseded on 23 October 2026 by the [Codex workflow](../handover/20261022/CODEX-VALIDATION-AND-SHIPPING.md). The generated image-proof pipeline and its old qualification launchers/comparator helpers have been removed. Commands, roles, holds and source pins below describe the dated run; recover removed scripts from Git history only to inspect that evidence. Do not execute these procedures for a current release.

## Pins and status

The exact repaired **code** commit is `de104e80d0876ac62bccbafb81055b0832cfc953` on `diagnostic/source348-load-amplification-20261019`, based on `34851020aa0d73fead4db59ba6e26a098e2d0313`. This handoff lives on a separate docs successor; its commit is not the reviewed code pin. Use the exact code commit in any new source seal and image request unless a later code commit receives its own review and seal.

The load repair is source-tested and independently reviewed. It has **no new image, in-image measurement, build receipt, live receipt readback, or deployment qualification**. A separate three-second `runner/publish` bottleneck described below **blocks a build recommendation** for this source pin. Do not reuse the historical N21 runner hash `7402dabf...`, source archive, runtime values, or build receipt for this candidate. Do not treat disabled or unbuilt source as a shipped capability.

The paid-build gate is closed: the existing **$600 reservations are fully allocated**. Reconcile actual usage and unused reservations, then obtain the ordinary build authorization before starting CodeBuild. This handoff creates no new budget or chargeable scope.

## Exact changed inputs and review

The two repair commits change these production files: `apps/control/conversations/{service,lifecycle/service}.mjs`, `apps/runtime/{conversation-runner,native-client}.mjs`, `apps/worker/conversation/activity.mjs`, and `packages/runtime/runner-load-budget.mjs`. They also add the focused `apps/control/conversations/test/load-amplification.test.mjs` plus its five import-only stubs, and the source proposal document. The runtime Dockerfile's `COPY apps` and `COPY packages` include all six changed production files. `.dockerignore` excludes the new test stubs from the image, but the source archive and member manifest still bind the complete Git commit.

| Input at exact code commit | SHA-256 / size |
| --- | --- |
| `apps/runtime/conversation-runner.mjs` Git blob | `c12f6f731173918e3894bb07dc0df21e0c851a683a3639b2371c0faf0e5856ca` / 15,380 bytes |
| `apps/runtime/Dockerfile` | `e7e0427aca562ba0747ca0874ff284915af2ce40f32f4d5330857824e8d43022` |
| `infra/product-preview/image-build-source.py` | `c373ff556873823e1fd7cb5a00945ed2f70f41acb74c96d2d9756d0f12bf461d` |
| `infra/product-preview/image-build-producer.py` | `a1002c79952fb8c5f3ee81443ca645ee9bce58d074bfd93bbcd83518947cdae8` |
| `infra/product-preview/runtime-packages.lock.json` | `5dc3b335d8dc7f0377c75852c28addc1a2517bb4bcc05e2125d0e1e31a97bdea` |

The runner worktree bytes match the Git blob obtained with `git cat-file blob de104e80:apps/runtime/conversation-runner.mjs`; remeasure the runner **inside the resulting image** and retain its measurement receipt. `first-chat/render-material.mjs` independently hashes the runner at `nodeRuntimeSourceCommit` and rejects a supplied pin mismatch.

The focused Node 22 fixture passed **22/22**. Its real worker HTTP/native client path completed a 62-call dynamic load with a synthetic 300 ms Core delay per call in about 18.7 seconds. It substitutes grant/SQL and unavailable local SDK/AWS/Temporal imports; the 300 ms path calls the native client directly, while nested runner wiring is checked separately with a synthetic clock. It proves neither live Core tails nor DB pool latency. Independent production review found the initial five-second lease reserve too short; `de104e80` reserves eight seconds. Re-review confirmed that shutdown margin, while a later path audit found the same-cutoff availability gap and downstream three-second bounds recorded below. Test review identified a weak `!== 200` assertion and missing unattended deadline cases; the committed test uses concrete 403/408 assertions and covers parked Core/store deadline and cancellation. The exact test command is `node --test apps/control/conversations/test/load-amplification.test.mjs`; in a checkout missing local dependencies, set `MERI_DIAGNOSTIC_IMPORT_STUBS=1` and `MERI_DIAGNOSTIC_DEPS_ROOT=<existing dependency checkout>` first. Those stubs affect imports only.

## Candidate proof and image recipe gates

The older `scripts/qualification/assembled-image/candidate-manifest-fable-20261015h.json` is stale for **19 of 45** paths at `de104e80` (the same set was already stale at source348). The repair changes one of those proof paths, `apps/runtime/conversation-runner.mjs`, from source348 SHA-256 `177a982b7b710eb1c13cdd372f44c8ba4043fbc429d0646e299b22dea0e992c2` to the hash above. The other candidate mismatches require individual review; do not mechanically replace hashes. The stale paths are:

```text
apps/control/conversations/postgres-store.mjs
apps/runtime/Dockerfile
apps/runtime/config.mjs
apps/runtime/control.mjs
apps/runtime/conversation-runner.mjs
apps/runtime/native-authority/checkpoint-http.mjs
apps/runtime/native-authority/prepared-kickoff-http.mjs
apps/runtime/native-authority/prepared-runtime.mjs
apps/runtime/native-authority/remote-composition.mjs
apps/runtime/native-runner-gateway.mjs
apps/runtime/prepared-candidate-config.mjs
apps/runtime/prepared-candidate.mjs
apps/runtime/remote-conversation-runner.mjs
apps/runtime/task-bootstrap.mjs
apps/runtime/temporal-worker.mjs
apps/runtime/test/prepared-candidate-bootstrap.test.mjs
apps/runtime/test/prepared-candidate-config.test.mjs
apps/runtime/test/prepared-candidate-fixture.mjs
apps/runtime/test/prepared-temporal.test.mjs
```

`node --test scripts/qualification/assembled-image/source-proof.test.mjs` returned **4 passed, 1 failed**; the first failure is the stale `postgres-store.mjs` row. That proof also asserts the Dockerfile is unchanged from candidate h, while its current `e7e0427a...` bytes differ from the historical `8d4ac642...` pin. A fresh candidate requires an intentional proof-rule review of those already changed Dockerfile bytes. The assembled-image candidate proof is separate from the canonical full-source image seal.

The existing revision-2 Node recipe is `infra/product-preview/image-build-source.py seal/verify`, `infra/product-preview/image-build-recipe.mjs`, `infra/product-preview/image-build-producer.py`, and `apps/runtime/Dockerfile`. For an exact reviewed code commit, it requires a new archive and member manifest, immutable S3 `versionId` and SHA-256 for each, the five file hashes above, fixed Node 24/base-image digests, runtime user, project/repository pins, and a new `product-<sourceCommit>-<32 hex>` tag. The request has 16 exact fields and the offline checker caps its buildspec at 25,600 bytes. No image source seal was created on this Windows checkout because its `python` shim returned access denied; use a supported operator environment.

Reproducible **offline** source steps, from a clean checkout at the reviewed code commit, with absent output paths and a separately reviewed revision-2 request:

```text
git status --short
git rev-parse HEAD
python3 -I -B -S infra/product-preview/image-build-source.py seal --repository . --commit de104e80d0876ac62bccbafb81055b0832cfc953 --archive <new-absolute-archive.zip> --output <new-absolute-members.json>
python3 -I -B -S infra/product-preview/image-build-source.py verify --request <reviewed-request.json> --archive <new-absolute-archive.zip> --manifest <new-absolute-members.json>
node docs/handover/20261017/fable-shipping/scripts/check-product-buildspec.mjs <reviewed-request.json>
```

The request must bind the newly uploaded immutable archive/manifest versions. Seal/verify and the offline checker do not start a build. The separately authorized build uses the tracked `start-build.template.json` only after the budget, source proof, request, and immutable object review gates clear. Do not pass private credentials in the command line or this handoff.

## Minimal rebuild set and live checks

This repair changes no `apps/proxy` file relative to source348, so a **Node image only** is the minimal rebuild set **after the source blocker below is resolved** and **if** the currently deployed proxy digest/source remains approved. The committed deployment-input template pins older proxy source `e2723ed`, whose files differ from current HEAD for changes outside this repair; that template by itself cannot prove current proxy eligibility. Keep the image lane's ARM64 decision separate. No proxy, Core, frontend, or other image is authorized by this handoff.

The nested remote runner derives the load budget from the configured request/shutdown limits and the original execution expiry, passes it to the actual native client and activity, and selects it only for literal `runner/load`. The source-rendered control limit is 25,000 ms, its HTTP listener 26,000 ms, and pinned HTTPS has a 30,000 ms ceiling. Fable reports [live control 25 seconds, shutdown 10 seconds, and ALB idle 120 seconds](https://github.com/neo-capiro/meri-greenfield/pull/121#issuecomment-6270775610); the owner task `limits.maxRequestMs` is 3,000 ms on a separate currentness/proxy path, not the control load or publish envelope. Load gets at most `min(23,000 ms, control requestMs - 2,000 ms)` and ends by `original expiry - shutdownMs - 8,000 ms`. Runtime preparation gets a fresh three seconds but is clipped to **that same cutoff**. A load ending near the cutoff leaves no runtime-preparation headroom, a fail-closed availability gap that a successor should fix with distinct stage cutoffs. Other native operations remain at three seconds.

**Downstream source blocker:** the next preclaim `runner/runtime` uses a three-second client/activity window while its source makes three task-verifier passes, or six serial Core identity/context calls, plus DB/ECS work. The first `run.status:starting` publication uses the same three-second native client limit; worker HTTP, action-session issuance/rechecks, and conversation-service freshness make **at least 35 serial Core calls** before the publication can return, and a fresh dynamic context can add more. The `running` publication follows before Query starts and has the same bound. Fable's separate, uncorrelated Core observation began about 14:03:37 UTC: 33 serial identity/context/membership calls used 8.2 seconds of processing over 15.5 seconds, with a 3.9-second gap; status codes were not retained. Those counters do not prove the exact Meri publish latency, but they make a successful three-second publication implausible at the observed rate. A longer load window alone is insufficient to qualify first chat. Resolve the publish fanout/budget and its original-lease reserve in a separately reviewed source successor, then run a focused no-model load, runtime, and starting/running publish path before requesting a build. Giving both runtime and publication the full 23-second allowance would require about 48 seconds of preclaim reserve after load, which can fit the reported 900,000 ms configured run window but must be compared with the exact issued original expiry and startup headroom before selecting a cap. The present commit deliberately does not claim that repair.

Cancellation flows through the activity lifetime, native fetch, and pinned HTTPS socket teardown; control worker HTTP has an independent deadline and joins its service lifetime to the request signal. Server and service check the lifetime before returning, so late Core/store results cannot produce a successful load in the source fixture. Whether the deployed Hono adapter raises the server request abort signal immediately on socket close still needs runtime qualification. A DB read need not physically abort for the response to fail closed.

At control, each task-authority recheck clips the worker operation to its receipt expiry. Core identity and context receipts must have fresh `checkedAtMs` and future `expiresAtMs`; context resolution also checks current run and selected client. Core membership admission/recheck requires active status and the same principal/revision. The action session expiry is the **minimum** of identity, context, membership admission, its prior expiry, and configured TTL; authentication/current-state re-resolve and cannot extend the original session. Basic load rechecks identity/currentness/retention around journal and store reads and before release. The local contract checks valid expiry ordering, **not a minimum lease length**. A source-rendered session maximum of 300,000 ms does not establish the actual Core receipt lease. For the synthetic ~19-second load to be viable, read back the original execution lease and Core identity/context/membership receipt remaining time under the live route, along with correlated Core/DB latency. A shorter receipt must refuse the load. None of these live receipt measurements is supplied here.

The reported rendered `nativeCandidate.runtime.deadlineMs` expired at 2026-10-19T13:22:48.590Z before deployment. A different-conversation dynamic initial run replaces that static runtime binding/deadline with the newly issued intent expiry; `proposeInitialExpiry` caps it at `min(now + runWindowMs, allocation.schedule.expiresAt)`. The expired static original itself is unusable. Fable read back `runWindowMs=900,000`; read back the nonsecret allocation schedule expiry and the **fresh conversation's** admitted/issued original expiry before relying on the dynamic path. The historical failed run's terminal DB state remains unverified.

Core source `fable/core-integration-20261018` at `3ea1c077d134066c09d974eed60240b4c0d27b63` has separate 60-second artifact/read-delegation/workload JWT and 30-second workload-proof limits. **None sets the identity/context/membership receipt TTL used here**; those receipts are clipped by the live Clerk JWT/session and possible impersonation expiry. Fable cited Core branch commit `5c105cfe` in the PR121 readback; the separate source audit here inspected later `3ea1c077...`. The reported deployed Core image `46acfc07...` has unverified source provenance. Obtain read-only running ECS Core container `imageDigest` and task-definition image/`RELEASE_SHA`, exact ECR digest plus OCI revision label, and the matching successful build receipt with full commit, versioned S3 archive/checksum, buildspec hash, and pushed digest. Correlate these to the reviewed Git tree before attributing source TTL behavior to the deployed image. Do not expose token or secret bytes.

The source repair does not settle the prior failed run. The recovery workflow may already have called the stop owner; compare authorized Temporal activity history and a fresh authenticated transcript before any manual reconciliation. A stopped ECS task is not settlement evidence.
