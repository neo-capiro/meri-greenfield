# Meri first-chat preview: single live change set (for Neo's approval)

Prepared by Fable, 17 October 2026, on source `01e11077` (PR #133, receiving on root `59856683`). This is a **proposal**. Nothing in it has been created, run or granted. Each stage below needs its own explicit approval, recorded in PR #121, before any write. Core activation, the shared public listener and the `capiro.ai` DNS zone are dot's resources: those rows are requests to dot, not actions Fable takes.

Account `967807252336`, region `us-east-1`, cluster `capiro-dev`, VPC `vpc-0ac26cfac7ed972be`, private subnets `subnet-0920665f91c905f01` / `subnet-0e38bd390f8961fef` / `subnet-06db79cd21239de19`, Aurora PostgreSQL 16.11 `capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv` (SG `sg-059b4e4de0b1dcca5`, database `capiro`). Placement follows Neo's decision: separate Meri services in the existing VPC, Meri-owned schemas and roles in the existing Aurora, no new VPC.

## Current facts (read-only, 17 Oct about 11:00 UTC)

- **No Meri product resource exists yet.** There are no ECS services or task-definition families named `meri-product-preview-*`, no Meri security groups, no `meri.internal` or `temporal.meri.internal` Cloud Map namespace, no Meri KMS key and no Meri secrets. Everything below for Meri is **new**.
- Existing and reused:
  - Cluster, subnets, NAT `nat-016e7d15424ca9f8a`, VPC endpoints (shared SG `sg-01def4e5c0fe44d4a`), Aurora.
  - ECR repository `meri-greenfield/qualification-worker`.
  - Public ALB `capiro-prod-alb` HTTPS listener; Core rules 1–3 and the retained guard are untouched.
  - Public zone `capiro.ai` (`Z085985135X6Q5QT98ZBK`).
- Bedrock inference profile `us.anthropic.claude-sonnet-4-6` is **ACTIVE**.
- Clerk: frontend, Core and Meri resolve to one instance, `ins_3CPnW3zHGlQuLXj2bJpDpmo9fVB`, issuer `https://clerk.app.capiro.ai` (see frontend PR #64 comment).
- Images:
  - Meri Node runtime: `meri-greenfield/qualification-worker@sha256:6617b23650cc8cce973beac90c13f7c8231ccf3fbab4d4b4c44b26aea35c180c`, build `398713a3`, zero findings. Control, Temporal worker, runner and the issuer all run from this image.
  - Proxy assembly and product images: Build B, pending dot's technical-hold review.
  - Temporal server derivative image (`temporal-launch.Dockerfile`): **unbuilt**.

## Blocking decisions and source gaps (must close before Stage 3)

| # | Item | Why it blocks | Recommendation |
|---|---|---|---|
| D1 | **Model envelope.** `apps/proxy/qualification/runtime/bedrock_body.py:29-37` caps each call at 8,192 input / 256 output tokens with no thinking | The Claude Agent SDK's own system prompt exceeds 8k tokens, so every real first-chat call would be refused | Raise to 64k in / 8k out on the pinned Sonnet profile, still without thinking. Enforce a per-run cap of **$2** and a preview-wide cap of **$25/day** in the canonical `meri_product_budget` store. This is a source change plus tests; Neo picks the numbers |
| D2 | Grants SQL. `infra/product-preview/existing-database-grants.sql` is comments only | There are no executable role or grant statements for the `meri_*` schemas | Fable writes the exact SQL (roles NOLOGIN plus three LOGIN users) for review before Stage 1 |
| D3 | Temporal server image. `temporal-launch.Dockerfile` is unbuilt | The five Temporal roles have no image | One more qualification build (about $4), same envelope as Build A |
| D4 | Certificate authority custody | Runner, issuer clientAuth, control HTTPS, Temporal mTLS and proxy↔owner mTLS each need a CA and leaves | Use **self-managed CAs**: keys generated offline by Fable, stored only as exact-version Secrets Manager values, never in Git or logs. AWS Private CA costs $400/CA-month (general) or $50 (short-lived), so it is not proposed. Neo approves key generation explicitly |
| D5 | Control private path (8082) for runner poststart | The source needs a private route from runner tasks to control | Use a direct Cloud Map name and SG rules, as the issuer does, with no internal ALB. The older proposal's internal ALB (about $16/month) stays a fallback |
| D6 | Issuer ECS/EC2 API egress | No ECS API endpoint exists, so the path goes through the NAT and needs TCP 443 egress to `0.0.0.0/0` from the issuer, control and owner SGs | Accept, scoped to those three SGs only (security decision for Neo) |

## Stage 0: Aurora backup (approval: database owner)

- Manual cluster snapshot `meri-first-chat-pre-20261017` before any SQL. Cost: snapshot storage only for data changed after it, which is negligible.
- Rollback anchor for Stage 1. **No restore** is proposed in the plan; a restore would be a separate decision, because the cluster is shared with Core.

## Stage 1: database (approval: Neo plus database owner; SQL text reviewed in a PR first)

All of this runs in one Fargate one-shot migration task on the Build A image, with a dedicated migrator credential. Nothing runs at service startup.

| Object | Detail |
|---|---|
| Schemas | `meri_conversations`, `meri_product_budget`, `meri_service_identity` |
| Migrations, in order | Conversations `0001–0011, 0013, 0015, 0016, 0017` (0012 and 0014 stay held); budget `0001_product_budget`, `0002_tenant_budgets` plus seed row `budget id=1` with the D1 cap; issuer `apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql` (blob `607929b1…`) |
| Temporal stores | Logical databases `temporal` and `temporal_visibility`; Temporal 1.32.1 schemas primary 1.19 and visibility 1.14 with `CREATE EXTENSION btree_gin` (Aurora 16 supports it) |
| Roles | `meri_product_migrator` (owner of the `meri_*` schemas), `meri_control_runtime`, `meri_model_budget_owner`, `meri_temporal_issuer_service`, plus two Temporal runtime logins. Each login password is a new exact-version secret. No role gets `public`/Core grants, BYPASSRLS or superuser |
| Untouched | Every existing Core table, the Core receipt migration (never rerun), `public` grants |

Rollback: drop only the new `meri_*` schemas, the two Temporal databases and the new roles; a restore is never needed for these. The Core ledger is not modified.

## Stage 2: security and network prerequisites (approval: Neo; desired counts stay zero)

| Resource | New/reused | Notes |
|---|---|---|
| KMS RSA-2048 sign key + alias `alias/meri/temporal-issuer-preview` | new | Retain on delete. Key policy grants the issuer task role `GetPublicKey` and `Sign` only in Stage 3 |
| IAM roles | new | Issuer task/exec, control task/exec, worker exec, runner exec (no task role), proxy task/exec (Bedrock invoke on the one profile), owner task/exec, Temporal exec. Exact actions from `AWS-CHANGESET-20261017.md` and `CAPIRO-DEV-CHANGE-SET-20261016.md`; IAM simulation before attach |
| Security groups | new | control, worker, runner, issuer, proxy, owner, five Temporal role SGs. Exact peer rules: issuer:8445 from control/worker/Temporal; Temporal frontend:7233 from control/worker; runner→control:8082; runner→proxy:8443; proxy→owner:8444; Aurora:5432 from control, owner, issuer, Temporal and migrator only (added to `sg-059b4e4de0b1dcca5`) |
| Cloud Map | new | Private namespaces `meri.internal` (issuer, control-private, proxy, owner) and `temporal.meri.internal` (five roles) |
| Log groups | new | `/meri/product-preview/*`, 30-day retention |
| Secrets | new | Exact-version bundles: control, worker, issuer, proxy, owner and Temporal role TLS; DB logins; CA keys (D4) |
| S3 checkpoint prefix | reused bucket | `meri-greenfield-qual-checkpoint-…/product-preview/checkpoints`, 7-day Object Lock; bucket and KMS policy delta for the control role only |

Rollback: delete the new stack. The KMS key is retained (scheduled deletion only on Neo's word). Secrets are deleted with a recovery window, and SG rules on the shared Aurora SG are removed individually.

## Stage 3: services at desired count 0 (approval: Neo)

Register digest-pinned task definitions and create ECS services, all with **DesiredCount 0**:
- `meri-product-preview-control`
- `meri-product-preview-temporal-worker`
- `meri-product-preview-temporal-issuer`
- `meri-product-preview-proxy`
- `meri-product-preview-owner`
- five Temporal roles
- the runner, which is a task definition only, with no service

Each service has a material-init container with a `SUCCESS` gate, a read-only root, user 1000 (10001 for the proxy), and no public IP. Requires D1–D6 closed, Build B qualified and D3 built.

Rollback: delete the stack. Nothing ran.

## Stage 4: public route (approval: dot owns the listener and zone; Neo approves)

- Target group: IP, HTTP 8080 to control, health `/health/live`.
- Listener rule at **priority 4** (the only free slot below the host-agnostic `/api/*` at 10, requested on backend PR #48): host `meri-preview.capiro.ai` only, forwarding all paths. Meri control's public boundary returns 404 for everything except `/api/conversations*` and `/api/action-followthrough/session`.
- Route 53 alias `meri-preview.capiro.ai` → `capiro-prod-alb`.
- Core rules 1–3 and the guard are unchanged.
- Rollback: delete the rule, the record and the target group.

## Stage 5: bounded activation smoke (approval: Neo plus dot for Core)

| Order | Service | Count | Size (vCPU/GiB) | $/hour |
|---|---|---|---|---|
| 1 | Temporal frontend, history, matching, worker, internal-frontend | 5 × 1 | 0.5 / 1 each | 0.124 |
| 2 | Issuer | 1 | 0.25 / 0.5 | 0.012 |
| 3 | Owner, proxy | 2 × 1 | 0.5 / 1 each | 0.049 |
| 4 | Control (exactly one; process-local poststart nonces), worker | 2 × 1 | 0.5 / 1 each | 0.049 |
| 5 | Core (dot's documented desired-one) | 1 | 0.5 / 1 | 0.025 |
| — | Runner per conversation, short-lived | ≤ 2 concurrent | 1 / 2 | ≤ 0.099 while running |

Fargate x86 at $0.04048 per vCPU-hour and $0.004445 per GB-hour gives **about $0.26/hour (about $190/month)** if left up. Proposed smoke window: **2 hours, ceiling $5** including Bedrock, so with D1 caps a handful of real prompts costs well under $1. Fixed monthly additions: KMS key $1, about 12 secrets ≈ $5, two private hosted zones $1, Cloud Map instances ≈ $1, logs under $1. Aurora, NAT and the ALB already exist; NAT data processing is about $0.045/GB and small.

Gate sequence: private readiness for each tier, then a real native Core identity/context call with a real bearer (never logged), then a private first prompt, and only then the frontend flags. Health alone is never acceptance.

Rollback, at any failure or at the end of the window:
1. Fence new admissions and kickoffs.
2. Settle or stop runs.
3. Set every new service to 0; Core goes back to 0 via dot.
4. Reconcile journal, runs, allocations, Temporal and ECS until zero UNKNOWN.
5. Keep config A, and its saved conversations, for continuity.

## Hand-off to dot (step 3)

dot then:
- switches the frontend preview service to the qualified frontend image with `MERI_API_BASE_URL=https://meri-preview.capiro.ai` and the first-chat flags, per its own checklist;
- runs the authenticated prompt → stream → save → reload acceptance.

Fable returns the release packet: every source, image, config, secret **reference/version**, migration hash, task definition and receipt, plus the run and custody identifiers.

## Approvals requested from Neo, in order

1. D1 caps (numbers), D4 CA key generation, D5 and D6 network decisions.
2. One more qualification build for the Temporal server image (about $4), plus Build B once dot lifts its hold.
3. Stage 0 + 1 (snapshot, then the reviewed SQL).
4. Stage 2 (security/network), then Stage 3 (zero-count services).
5. Stage 4 with dot, then the Stage 5 smoke window ($5 ceiling, 2 hours).

Each approval is consumed by its stage; a failure never grants a retry.
