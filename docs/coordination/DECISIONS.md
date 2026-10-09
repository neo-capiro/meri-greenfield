# Integration decisions

## D001 Repository and AWS destination

Accepted 9 October 2026 by the human owner in this chat: create private `neo-capiro/meri-greenfield`, using a separate Git repository and checkout; deploy independent Fargate development/staging resources in AWS account `967807252336`, region `us-east-1`. Authorized local checkout: `C:\dev\main\meri-greenfield-kickoff-20261009`. Use a new VPC, ECS cluster, IAM roles, database, buckets, KMS keys, secrets, logs and pipeline. Existing Capiro remains untouched and available. No cutover/production release is authorized by this decision.

The owner requires eventual connectivity to Capiro. Implement newly written trusted gateway connectors with narrowly authorized network paths and source principals, preserving canonical identity/data/memory. Source connections start disabled. Do not reuse the existing RLS-bypassing application role or expose source/provider credentials to conversation workers. Read-only endpoint/policy discovery continues; live access must pass the source-policy gates.

The owner requested notification when tooling integration begins. Notify in this chat at the transition from delegation qualification to SDK/browser/Office/tool qualification.

## D002 Development delegation

Use installed Hermes 0.20.0 CLI fallback. No active qualified Kanban dispatcher exists; do not create a second scheduler or alter unrelated profiles. The discovered query/quiet/checkpoint/explicit-session flags replace unsupported example flags. Load task briefs from Git through a thin launcher using argument arrays, captured scrubbed text logs, explicit cwd/base/session/turn/deadline records, one writer per worktree and no automatic retries. Keep approvals active; stdin EOF denies flagged actions. Local worktrees are editing boundaries and do not prove OS isolation. Development sessions have no infrastructure deployment authority.

## D003 Shared contract freeze

Independent review accepted the initial 0.1.0 contracts after three repairs. Ten boundary checks pass independently. Freeze the exact bootstrap commit with `contracts/v0.1.0`; dependents name its SHA. Contracts and root lockfile remain Codex-owned. Proposed changes require reviewed versioning and compatibility evidence before integration.

The wire contract separates immutable approved command producer provenance from the current execution attempt/worker/fence. Worker replacement does not change approved intent or idempotency identity. Contract fixtures establish local structure/hash/path checks only; current authorization, persistence, network/browser isolation and other service gates remain unproven.
