# Runtime process completion fixture repair

Parent: `3532541665c62940cd83d98503b3d1d4a0ae718b`. Local-only branch `dot/runtime-completion-fixture`. Source review: ACCEPT_SOURCE. Linux process regression: NOT RUN here. No push, PR, image operation, provider, database or cloud action.

The independent Linux validator reported that353 passed its transition/PG/typecheck/source groups, but the runtime process test failed because the synthetic native fixture returned404 for the now-required `/v1/runner/checkpoint/complete`. This candidate repairs that fixture; it does not change the runner or completion contract and does not claim that rerun has passed.

## Scoped implementation and ownership

Only `apps/runtime/test/process-fixture.mjs` and `apps/runtime/test/process.test.mjs` change among existing source files. Reuse the canonical `createNativeCheckpointApplication`, `createNativeCompletionCapture`, `createTaskCheckpointSource` and assembled conversation store. The fixture supplies explicitly synthetic current-authority, session, stop-inspection and immutable object ports. The canonical owners retain identity/context/versions/scope/original-expiry checks, one-shot capture, byte readback and atomic checkpoint/completed publication. No second completion implementation or fabricated completed response is added.

The successful process case retains its completed and APPLIED steering assertions, validates the canonical capture receipt and exact synthetic workspace file SHA, and checks the checkpoint capture boundary followed by exactly two final journal events. Exact completion HTTP replay reuses the recorded request and task credential, proving unchanged checkpoint/proof identities and entire event history with one capture. The new refusal regression proves the mounted route returns503 on current-authority refusal, with zero captures/completion rows, no verified/completed event and the real failure state. It distinguishes refusal from the old404 gap. Promise listeners are registered before the completion-triggering control request to avoid losing a fast IPC result.

Root allocated the two paths to an implementation owner and retained evidence/commit ownership. A separate Codex reviewer independently inspected the final diff against the production protocol, requested exact completion replay and nonempty workspace evidence, then accepted the final source. Root also reviewed the canonical owner chain and both final file hashes. No product, contract, migration, placement, runtime recipe or dependency changes are included. All45 existing runtime proof rows remain unchanged; `source-proof.json` binds those and the two changed test hashes.

## Verification and required follow-up

Locally, both `node --check` commands pass, `git diff --check` passes, and all5 existing runtime source-proof tests pass with zero skips. Checks used existing Windows Node24.19.0. Execution of the modified process suite is NOT RUN: it requires Linux UID/workspace/signal semantics and the pinned dependencies; local ignored dependency-junction creation was denied by the filesystem sandbox, and no dependencies were installed or copied. No process fixture was started here and no runtime pass is claimed.

Run in the existing approved isolated non-root Linux validator, using the exact proposed commit/tree, Node24.21.0, existing locked dependencies and a task-owned private TMPDIR, with the validator's external deadline/process cleanup:

```sh
node --check apps/runtime/test/process-fixture.mjs
node --check apps/runtime/test/process.test.mjs
node --test --test-isolation=none --test-concurrency=1 apps/runtime/test/process.test.mjs
node --test --test-isolation=none --test-concurrency=1 apps/runtime/test/runtime.test.mjs apps/runtime/test/process.test.mjs
node --test --test-isolation=none --test-concurrency=1 scripts/qualification/assembled-image/source-proof.test.mjs
```

Require zero failures/skips/cancellations and retain full logs plus positive owned-process/temp cleanup. Keep any new failure visible; do not weaken completion assertions. Broader353 Linux evidence does not automatically transfer to this candidate. The fixture's native/task/session/object ports remain synthetic, so a passing suite would still not establish actual SDK/native physical-stop, durable shared-service, image or live acceptance. Runtime base remains HOLD independently of this fixture.
