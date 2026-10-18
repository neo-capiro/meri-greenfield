# First-chat source audit and repair packet — 18 October 2026

## Boundary and observation

Audit base: deployed Meri source `107af36b89686bb8545b200e05a39f2c4733b56b` (N21). This packet covers source corrections and focused local checks. It does not qualify a new image, change live configuration, deploy, issue a model request, operate the failed run, or establish a provider billing outcome.

The fresh Anduril run `64c90145-0350-4d20-8a2e-52472da8b140` in conversation `4a7f09d3-4733-45ba-b833-3e2c981b713f` produced a runner task that exited 3. Its only runner log line was `RUNTIME_UNAVAILABLE`; the saved authenticated transcript remained queued with only the initial prompt. This observation locates the failure before an acknowledged starting publication on the ordinary activity path, but the deployed log discards the exception. The precise historical failure step remains unknown. An exited task alone is neither original-attempt settlement nor proof of no external provider use.

## Source findings and narrow repairs

| ID | Source finding at the deployed pin | Repair owner and acceptance |
| --- | --- | --- |
| W1 | `infra/product-preview/first-chat/render-material.mjs:421` configures `/workspace/<conversationId>`. `apps/runtime/Dockerfile:66–68` creates only `/workspace`, which the runner task mounts as an initially empty task-local volume. `apps/runtime/conversation-runner.mjs:84–87` requires the child in `assertRunnerWorkspace()` before binding bootstrap, remote listener, or activity. Product poststart creates material under `/run/meri/poststart`, not the workspace child. The missing child is a strong source-supported explanation for queued plus exit 3; it is not an observed filesystem read from the failed task. | `111c1b6d50b398626b1f934612ca676f22100340` adds a trusted direct-child initializer after authenticated poststart materialization; the existing runner preflight independently verifies it. It requires private non-root ownership and canonical no-symlink parent/child identity, refuses existing children, and cleans up only a verified empty child it created. Focused synthetic checks: 31 passed, 1 existing POSIX-only skip. |
| D1 | `apps/runtime/cli.mjs` catches runner import/execution failures and emits only `RUNTIME_UNAVAILABLE`. This hides preflight, activity-load, publication, SDK, and cleanup distinctions; the queued history cannot retroactively identify the step. | Source commit `51b758aa893899dca9276cf13b83e1ee7b07e968` adds a single fixed-stage/allowlisted-code failure line. Successor `8c7ac3e5a762cd2198514b40180b265bf98896f3` captures the first activity failure before generic translation and cleanup replacement. No messages, stack traces, causes, credential values, or dynamic text reach stderr. Focused synthetic tests: 39/39 on Node 24.19.0. New instrumentation will diagnose a future run only after a compatible image is deployed; it cannot recover the old cause. |
| P1 | `apps/proxy/product/owner-wire-codec.mjs:103,120,122,156` caps input at 8,192 and output at 256 while the canonical gateway envelope allows 65,536 and 8,192 (`apps/gateway/model-proxy/product-envelope.mjs`). The Python `boundary_codec.py` uses those canonical limits and the owner route calls the narrower decoder (`owner-channel` imports and calls). A valid reservation can therefore pass while valid settlement/capture is refused. | `a4cb26f0ebbefb2a3ab974e68780e845089328f7` derives all seven owner decoder limits from the canonical envelope and preserves shape, hash, binding, usage equality and completeness checks. Before the fix, a real Python encoded `(counted=12, maximum=8192, output=16)` reservation passed while settlement and capture both returned `PRODUCT_OWNER_WIRE_REFUSED`; the canonical gateway settlement passed. After the fix all four pass. Exact envelope, old-limit crossings, over-limit rejection and smaller request maximum also pass. Focused checks: 57 Node and 13 Python tests. |
| S1 | Public Stop in `apps/control/conversations/lifecycle/service.mjs:99–102` durably fences the run and asks Temporal to cancel, but does not directly invoke the native `execution/kickoff/stop` owner. `apps/control/conversations/recovery-workflow.ts:7–16` schedules automatic stop reconciliation after execute failure/loss with a finite 85-second schedule-to-close retry window and then closes. A later Temporal `NOT_FOUND` cannot by itself retire an original or revoke grants. | `ffa1f711a90df24a77a2168425931eb099a2a536` attempts Temporal cancel and the existing native stop-only owner independently after the durable fence, including an already terminal run, closed workflow, and caller disconnect. The shared adapter verifies exact original binding, execution hash and receipt; no start or redispatch path is exposed. Repeat Stop retries cleanup. An unproven effect or failed final authority readback returns internal `LIFECYCLE_STOP_UNKNOWN`/`UNKNOWN`; the frozen public HTTP route returns 502 `CONVERSATION_UNAVAILABLE`, never a success. `90391c04e31137a685f72abd4552a39e5152e503` repairs the synthetic restart fixture for Windows and the current two-grant fact. Focused author checks: 92 lifecycle, 20 registry, 6 Temporal, and 8 restart tests passed. |

The four repairs have separate source ownership: poststart workspace, runtime diagnostics, proxy owner codec, and lifecycle/stop composition. The runtime diagnostics and workspace source may share the final runner image, but they do not change the model loop. The Stop correction must reuse the native stop-only operation already called by the Temporal reconciliation activity; no new cancellation transport or authorization path is introduced.

## Detection latency and reconciliation

`apps/control/conversations/workflow.ts:6` allows the execution activity a 30-minute start-to-close window with 30-second heartbeat timeout and no activity retry. While the broker sees `preparing`, `apps/runtime/temporal-worker.mjs:33` emits heartbeats. A runner readiness failure can therefore remain preparing until the original expiry or the activity window; this is a latency risk, not a claim about the exact failed task's Temporal history. The automatic recovery workflow's 85-second window is finite. Source-only fixes cannot establish whether its stop activity ran or succeeded for the fresh run.

For that run, the next permitted read-only diagnosis needs the exact original seven-field binding and expiry, the authorized Temporal workflow/activity history, allocation `physicalStopProven` and launch state, grant/reservation state, configuration digest, and any private-stop refusal stage. If authorized Temporal history shows `reconcileConversation` succeeded, compare a fresh authenticated transcript run state before any manual action. `apps/runtime/reconcile-run.mjs` requires the preprovisioned temporal-worker configuration, native control capability, private CA and an authorized Linux execution context. Neither a browser bearer nor a Core route issues that capability. No alternate executor is assumed; if these readbacks are unavailable, keep settlement UNKNOWN and the run held. The previously proposed browser Stop click was rejected by automatic approval review before execution while original/provider settlement was unknown; it was not retried.

## Other audit paths and remaining qualification

Source reviews of the signed issuer contract and SDK parent-directory/import closure found no additional deterministic mismatch at this pin. Local Node 24.19.0 imported the qualified `runner-poststart-cli.mjs` and `conversation-runner.mjs` with the matching lockfile dependencies; that disproves a local import failure only. Read-only ECS metadata confirms runner task definition `:14` used UID/GID `1000:1000`, a writable task-local `/workspace` mount, a read-only root filesystem, and no initializer dependency, at image digest `sha256:198e4be625e3da8d2450d2ca83b6bacf32fcf3aca04813a3782c8e0a37093abc`. WSL was unavailable and the accessible Docker daemon was Windows, so a same-Linux-image smoke was not available locally. This report does not claim image-level proof or change the separate ARM64 image lane.

The combined source has passed focused checks and diff review. Next qualify a compatible Linux image and configuration under the deployment owner's existing plan. A fresh authorized chat must verify startup, streamed output, saved history/reload, stop settlement and the strict proxy envelope before launch. The approved launch split keeps critical functional, desktop and security checks before launch and a larger labelled corpus later. No disabled or merely source-prepared capability counts as active.

## Source integration record

Combined successor branch: `dot/first-chat-source-repairs-20261018`, based directly on deployed `107af36b89686bb8545b200e05a39f2c4733b56b` in a dedicated worktree. It cherry-picks the independently reviewed source commits without conflict:

| Source author commit | Combined commit | Scope |
| --- | --- | --- |
| `51b758aa893899dca9276cf13b83e1ee7b07e968` | `ac341842` | Runner fixed-stage diagnostic baseline. |
| `8c7ac3e5a762cd2198514b40180b265bf98896f3` | `b55c92c6` | Activity failure before generic translation. |
| `a4cb26f0ebbefb2a3ab974e68780e845089328f7` | `38962c0b` | Canonical owner wire envelope. |
| `111c1b6d50b398626b1f934612ca676f22100340` | `6bfbb712` | Authenticated runner workspace initialization. |
| `90391c04e31137a685f72abd4552a39e5152e503` | `957245ef` | Restart fixture prerequisites. |
| `ffa1f711a90df24a77a2168425931eb099a2a536` | `aa269b74` | Public Stop original reconciliation. |

Combined focused checks on Node 24.19.0: 50/50 runner startup, diagnostics and bounded cleanup; 37/37 native registry, Temporal and restart cases; 21/21 Stop races. The actual Python encoder to Node owner decoder regression passed 4/4 on Python 3.12.14 and Node 24.19.0. Initial combined runner and Stop invocations failed at import before affected test bodies because this fresh worktree lacked two ignored dependency junctions; matching local dependency trees were linked after lockfile hash verification, with no install or package change. Author-specific early failures and their corrections remain in their handoffs/implementation notes. All 27 changed `.mjs` files passed Node syntax checks; the combined diff passed `git diff --check`. The final source commit/tree are in the publication receipt for this branch.

The combined checks used these explicit test files, with `--test-concurrency=1` and `--experimental-test-module-mocks` for the runner set:

```text
apps/runtime/test/{runner-workspace,runner-workspace-startup,runner-poststart-bootstrap,runner-runtime-diagnostics,activity-runtime-diagnostics,cli-product-runner-pin}.test.mjs
apps/worker/conversation/test/cleanup-activity.test.mjs
apps/control/conversations/test/stop-races.test.mjs
apps/runtime/test/{restart-retirement,reconcile-activity,prepared-temporal,prepared-run-registry}.test.mjs
python -m unittest apps.proxy.product.test.test_owner_wire_envelope
```

No image, configuration or live deployment pin was produced by this source audit. The failed run remains held pending authorized readback and validated settlement.
