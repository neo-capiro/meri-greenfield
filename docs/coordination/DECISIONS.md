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

## D004 Bedrock synthetic model qualification

Accepted by the human owner in this chat on9 October2026: use Bedrock (superseding a briefly selected new Anthropic credential), through a new trusted proxy role, with synthetic data only and a **$10 aggregate Bedrock model-test limit**. Application/Fargate resources stay in us-east-1. After AWS profile discovery, the owner explicitly allowed the US-only profile's destination regions us-east-1/us-east-2/us-west-2. No global profile or real source data is authorized by this test decision.

Selected qualification candidate: `us.anthropic.claude-sonnet-4-6`, profile ARN `arn:aws:bedrock:us-east-1:967807252336:inference-profile/us.anthropic.claude-sonnet-4-6`; foundation model `anthropic.claude-sonnet-4-6` in those three regions. Read-only GetFoundationModelAvailability returned agreementAVAILABLE, authorizationAUTHORIZED, entitlementAVAILABLE and regionAVAILABLE. This does not prove invocation. Newer Sonnet5.5 returned agreementNOT_AVAILABLE and is not selected; no Marketplace activation/terms acceptance was attempted. Existing Capiro secrets are not needed or reused.

Before live calls: freeze current pricing/token limits, enforce aggregate admission/accounting outside the agent, pin gateway implementation/image and IAM to only the selected profile/models, qualify short-lived inference-only task credentials and denied direct upstream/admin paths. No worker gets Bedrock authority. Provider/model errors stop the attempt; no quota retry loop. Proxy and production Temporal design evidence is in docs/qualification/PROXY-TEMPORAL-DECISIONS.md; proposed alternatives are not accepted implementations or G1 evidence. Production model/data-region decisions remain a later release gate.

## D005 Dedicated isolated browser-host qualification

Accepted by the human owner in this chat on9 October2026 after baseline3's verified Chromium namespace EPERM: **qualify a new isolated browser host**, keeping application/control services on Fargate. This explicitly permits a browser-host exception to the earlier all-Fargate requirement; it does not authorize modifying current Meri/Capiro or changing application/control placement.

Prepare the smallest bounded synthetic qualification host in the approved new environment/account/region. Independently review the exact host/kernel/container/sandbox prerequisites and cloud change set before launch. Preserve nonroot browser execution, actual browser AND renderer sandbox, no worker provider/source credentials, denied metadata/admin paths and measured cleanup. No privileged/no-sandbox/unconfined shortcut is authorized. Public navigation and source/provider access are not implied by the closed-network baseline. The exception does not pass G1 or waive scan findings; production host isolation/recovery/capacity remain subject to later gates.
