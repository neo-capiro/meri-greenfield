---
name: reference-meri-preview-rollout-traps
description: Meri first-chat preview ECS/CFN rollout traps learned 2026-10-19 (AZ rebalancing vs max100, pinned revisions burned by rollback, issuer refuses unpinned control/worker, overlap restarts)
metadata:
  type: reference
---
Meri product-preview rollout (capiro-dev, stacks meri-first-chat-model/issuer/app), learned 2026-10-19:

- **AZ rebalancing blocks max100.** Live ECS services have `availabilityZoneRebalancing: ENABLED`; UpdateService with `maximumPercent <= 100` fails (400). Fixed by a separate change set flipping control to `DISABLED` first (control is DISABLED now). Worker is still ENABLED.
- **A failed/rolled-back update burns revisions.** Rendered material pins exact task-definition revisions (issuer→control/worker, control→runner, owner/proxy→own pair, owner admission includes runner ARN). Rollback deregisters the new revisions and ECS never reuses numbers, so recovery = full five-role re-render + Neo upload under a NEW label (e.g. `FIRST_CHAT_20261019B`) + new change sets. Never mix bundles or hand-edit.
- **Issuer admits only pinned revisions.** `apps/runtime/temporal-issuer/task-authority.mjs` readCurrent: the service's single PRIMARY deployment must be on the pin and COMPLETED. So ISSUER→APP has a built-in control/worker outage until APP lands; run APP immediately after issuer gate. Old/overlapping tasks get `RUNTIME_UNAVAILABLE` exit 3.
- **Expected one-restart patterns:** first owner task loses its 180 s startup pair window during model overlap (`PRODUCT_OWNER_UNAVAILABLE` ~184 s); first worker task refused while old worker task overlaps. Replacement must still pass the full gate (dot reports these, never waives).
- **What startup proves:** control `runtime.listening` ⇒ DB login + schema (`to_regclass` queries) + issuer authorization. Owner DB pool is lazy (not proven). Core authority is per-call (only a real chat proves it).
- Git Bash mangles `/meri/...` log-group names — export `MSYS_NO_PATHCONV=1`.

Related: [[project-meri-greenfield-fable-shipping]], [[feedback-meri-dot-pr121-coordination]]
- **Build-gate traps (2026-10-19):** producer runs LINUX_ONLY_TESTS in-image with a hard 180 s cap and an EXACT case set (B01-B06/R01-R06/W01-W12 via image-build-test-reporter.mjs) — adding/removing a Linux-only test fails `LINUX_CASES_UNPROVEN`. Reproduce locally free: WSL2 Ubuntu-24.04 + `docker.io docker-buildx` (BuildKit required), rebuild from sealed archive, bind-mount FIXTURE_PATHS. Re-render after a new image also needs `runtime-values.preparationIntent.runnerSha256` = git blob sha of conversation-runner.mjs at the image commit.
