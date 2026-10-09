# H00 Hermes session qualification

Objective: qualify the installed Hermes development workflow with real edits, checks, filesystem checkpoint, explicit session resume and a reviewable commit before assigning production implementation.

User-visible outcome: a verified delegation path; no claim of application/Fargate readiness.

Base commit: 7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3. Reviewed contract-freeze commit; tag contracts/v0.1.0.
Branch: hermes/h00-qualification. Absolute worktree: C:\dev\main\meri-greenfield-worktrees\h00. Dedicated worktree only; no second writer.
Dependency commits: W01 contract freeze and repository bootstrap 7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3, accepted by Codex after independent review. Repository/account choices accepted by owner.

Owned paths: `evals/qualification/hermes-session.fixture.json`, `evals/qualification/hermes-session.test.mjs`, `docs/coordination/reports/H00-HERMES-QUALIFICATION.md`.
Paths requiring Codex approval: every other path, including contracts, shared tests, package.json, lockfile, AGENTS.md, infrastructure and plans.
Adopted components: installed Hermes 0.20.0; Node 24.19.0; frozen JSON Schema contracts 0.1.0; Ajv 8.20.0; ajv-formats 3.0.1; canonicalize 5.1.0. Do not install/upgrade anything or change profiles.

Required behavior: use synthetic data only, current working directory is the assigned worktree, read AGENTS.md and packages/contracts/README.md. Create a fixture using frozen WorkspaceManifest and ApprovalProposal contracts. Test a valid portable workspace and unchanged command; test rejection of traversal and mutated command arguments/attachment versions. Reference the existing contracts without editing them. The fixture may use deterministic UUIDs. A passing fixture proves local delegation only, not source policy or Fargate compatibility.

Stage 1: edit fixture/test; run `node --test evals/qualification/hermes-session.test.mjs` and `npm run check:contracts`; persist the report with results and a SHA-256 of the fixture. STOP without committing, state `partial-awaiting-explicit-resume`, and return the handoff. Do not launch/resume another session yourself.

Stage 2 (Codex sends a separate follow-up with the explicit session ID): verify same cwd/branch/base and unchanged fixture hash from stage 1; rerun checks; update report with resume evidence and exact outcomes; commit only owned paths; return result commit and ready-for-review handoff. Never use `--resume latest`.

Acceptance: Codex verifies each process/cwd/session/deadline and filesystem state; a separate Hermes reviewer checks the exact result commit and task criteria read-only; Codex independently reruns meaningful checks, inspects diff and confirms no out-of-scope paths before integration. Root lockfile/contract changes, live source access, unverified resume, missing commit, failed checks or missing stage-1 hash block acceptance.

Runtime/turn budget: maximum 60 minutes for each explicit session, maximum 40 turns, one attempt initially; no automatic retries. Checkpoint/handoff before interruption when possible. Provider/auth/quota failures block the task and require inspection.
External actions authorized: existing configured model provider requests for this session; local Git/edit/test operations within owned task paths. No infrastructure, deployment, source data, credential retrieval, remote pushes, emails/messages, browser work, recursive delegation or global configuration changes.

Known constraints: Windows local worktrees are editing boundaries, not a filesystem/credential sandbox. Local Docker daemon unavailable. CLI examples in the plan differ from installed help; Codex uses supported chat query arguments and captured text logs, with explicit session ID on stderr. Approval gating must remain enabled; stdin EOF denies flagged actions. No bypass flags.

Handoff fields: task and explicit session ID; status; base/result commit; changed files; behavior; checks with exact outcomes; scrubbed evidence paths; policy/migration effects (none expected); unresolved risks; process/worktree state; next command.
