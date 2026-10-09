# H00 independent review

Task: independent review of H00; do not implement or repair its code.
Base/result under review: a398b9ea1aeb0515fd0f2e6db1ac9629f2ac2550.
Implementation dependency/base: 7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3 (contracts/v0.1.0).
Branch: hermes/h00-review.
Absolute worktree: C:\dev\main\meri-greenfield-worktrees\h00-review.
Owned write path ONLY: docs/coordination/reports/H00-REVIEW.md. Do not edit implementation, contracts, fixtures, dependencies, task briefs or configuration. Do not create temporary/scratch files outside that report. Use in-memory commands and reject any internal verification nudge that conflicts with this scope.

Read-only evidence additionally permitted: C:\dev\main\meri-greenfield-kickoff-20261009\docs\coordination\private-evidence\H00-stage1 and H00-stage2 process.json and scrubbed logs, plus parent task briefs H00-HERMES-QUALIFICATION.md and H00-STAGE2.md. No other repository, home credential/configuration, live source or infrastructure access.

Inspect the exact implementation commit diff, the assigned stage1/stage2 acceptance criteria, and evidence. Independently run node --test evals/qualification/hermes-session.test.mjs and npm run check:contracts, preserving each exit status. Recompute fixture hash59fcee0913c875fb8cf45adfa4fe2d71a02c2446152c9560181236b0d8914362. Verify only the three owned implementation paths changed; base ancestry, immutable contract files, no migration, no source connectivity and no deployment.

Verify explicit session20261009_145356_5c1d2a resumed from stage1 with the same cwd/branch/base and unchanged fixture/test bytes. Stage1's parent exited0 but supervisor terminated one unidentified remaining descendant; verified job/readers cleanup is recorded. Do not invent that child's identity or relabel the first process result clean. Stage2 parent exited0, remaining count0, all cleanup confirmed. Stage1 also created/deleted an external temp script, acknowledged in the worker report; inspect the repair/continuation evidence and do not treat the stage1 ad-hoc ledger as authoritative checks. Stage2 made no additional temp-file edit according to its handoff; inspect logs rather than assume.

Write a concise review report naming this exact SHA, checks/hash/scope findings, whether the bounded editing/checkpoint/explicit-resume/commit workflow is acceptable, and any required repair. A surviving process, changed dependency/contract, extra repository writes, failed checks, fabricated resume or repeated scope violation blocks acceptance. The report must distinguish host-user editing boundaries from filesystem sandboxing and local fixture checks from Fargate/application/source-policy gates. The original scope deviation and unidentified-but-contained descendant stay visible even if final bounded workflow is accepted.

Do not commit or push; Codex owns review integration. Return ready-for-review verdict plus report path and explicit reviewer session ID. Runtime60 minutes/max30 turns/one attempt. External actions: existing provider requests and allowed local read/check/report operations only; no installs, recursive delegation, browser/source/network/cloud operations, global configuration changes or approval bypasses. Stop after handoff.
