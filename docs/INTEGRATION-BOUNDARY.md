# Future Capiro integration boundary

Recorded 9 October 2026. The user approved private `neo-capiro/meri-greenfield` and account **967807252336 / us-east-1**, using fully separate Fargate resources while retaining the ability to connect to Capiro later. This document records read-only endpoint and identity metadata for that future connection. It does not enable sources, grant access, modify Capiro, qualify a network connection or authorize cutover.

## Boundary to preserve

The new application owns its VPC, ECS cluster/services/tasks, security groups, roles, database, storage, keys, secrets, logs, budgets and deployment pipeline. Capiro records, current membership and canonical memory remain authoritative external dependencies. Each active conversation has its own Fargate task. Workers communicate with the new trusted broker/gateway using expiring, task-bound capabilities; they receive no source database credentials, Clerk backend key, provider key or cloud administration access.

**Source connections remain disabled by default.** Qualification and isolated development use seeded identities/policy fixtures. Account co-location does not grant database access or create network reachability. Do not attach the new workers to Capiro's cluster, subnets or service security group, copy its application database login, reuse its Meri runtime, add unrestricted VPC peering, or create implicit shared security-group grants. Future source access needs an explicit restricted connector target, a narrow network path and independent authorization evidence before G3.

The gateway contract should retain external source endpoint/principal configuration behind a disabled source feature. No credentials or active source target are hardcoded by this document. Application-owned state and canonical source state stay distinct; a later connector can be enabled without moving the new runtime into current Meri infrastructure.

## Identity and AWS evidence

Read-only AWS discovery used profile `capiro-dev`, which returned `arn:aws:iam::967807252336:user/capirocli` through STS in `us-east-1`. This is the discovery/deployment caller identity, not a worker or source principal. No Secrets Manager value, SSM parameter value, database row or HTTP source endpoint was read. AWS calls were limited to selected CloudFormation outputs, RDS descriptors, ECS service/task configuration metadata, load-balancer routing, DNS records and security-group/VPC descriptors.

Source code and schemas remain pinned to Capiro commit **`fd8765ec01d292013758606204f2c9d886cd31c1`**. AWS descriptors are a point-in-time live configuration observation; they do not establish that the deployed images exactly match that source SHA. See `SOURCE-INVENTORY.md` for schema/capability discovery and `CAPABILITY-SCOPE.md` for provisional selection.

## Discovered database boundary

| Item | Observed metadata |
| --- | --- |
| Existing source VPC | `vpc-0ac26cfac7ed972be`, CIDR `10.40.0.0/16`. This remains external to the new VPC. |
| Capiro Data stack | `Capiro-dev-Data`, status `UPDATE_COMPLETE` at observation. |
| Source Aurora cluster | `capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv`, Aurora PostgreSQL 16.11, encrypted, IAM database authentication enabled. |
| Writer endpoint | `capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv.cluster-csryw28ai752.us-east-1.rds.amazonaws.com:5432`. Matches the Data stack `AuroraEndpoint` output. |
| Reader endpoint | `capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv.cluster-ro-csryw28ai752.us-east-1.rds.amazonaws.com:5432`. Matches `AuroraReaderEndpoint`; currently the API's explicit `ANALYTICS_DB_HOST`. |
| Public access | Both cluster members report `PubliclyAccessible: false`. No database connection was attempted. |
| Existing database security group | `sg-059b4e4de0b1dcca5`; observed TCP 5432 ingress only from three existing security groups, including the current service group. No new Meri group is granted. |
| Database name metadata | Current API task specifies `DB_NAME=capiro` and `ANALYTICS_DB_NAME=capiro`. |
| Current host configuration mechanism | API task `DB_HOST` and `DB_PORT` come from fields in the existing master-secret reference; application username comes from a separate existing app-secret reference. Values were not retrieved. Therefore the effective primary `DB_HOST` value is not independently proven by this task. |
| Other clusters | Incident/rehearsal/migration diagnostic clusters also exist. Their labels do not make them canonical sources; none is selected or connected. |

The writer/reader names above are **candidate source descriptors, not assigned connector endpoints**. A restricted principal must be proven non-owner and unable to bypass policy, issue DDL or mutate sources during read qualification. IAM authentication being enabled on the cluster does not show that a suitable database role exists or has grants. Replica lag and freshness must meet the revocation deadline if the reader is used; current authorization cannot rely on stale membership/grant data.

## Discovered HTTP service boundary

Existing services use cluster `capiro-dev`, Fargate, private task addresses (`assignPublicIp=DISABLED`) and service security group `sg-01def4e5c0fe44d4a`. Their current subnet IDs are `subnet-0e38bd390f8961fef`, `subnet-0920665f91c905f01`, and `subnet-06db79cd21239de19`. These are inventory references and must not become new worker placement defaults.

The observed public load balancer is **`capiro-prod-alb`**, DNS `capiro-prod-alb-57164953.us-east-1.elb.amazonaws.com`, internet-facing in the existing VPC. HTTP 80 redirects; HTTPS 443 forwards by route. Public DNS `app.capiro.ai` and `app-dev.capiro.ai` both alias to this load balancer; `os.capiro.ai` also aliases to it. A development-looking host is therefore not evidence of an isolated backend.

| Existing service | Observed task definition | Container port | Public HTTPS route family |
| --- | --- | --- | --- |
| capiro-dev-api | `capiro-dev-api:650` | 4000 | `/api/*`, after more-specific engagement routes. |
| capiro-dev-engagement-api | `capiro-dev-engagement-api:155` | 4500 | `/api/engagement/*`; specific Microsoft/Google callback routes and Recall webhooks also exist. |
| capiro-dev-api-strategy | `capiro-dev-api-strategy:57` | 4400 | `/strategy-api/*`. |
| capiro-dev-workspace | `capiro-dev-workspace:48` | 4200 | `/workspace-api/*`. |
| capiro-dev-intel-api | `capiro-dev-intel-api:72` | 4300 | `/intel-api/*`. |
| capiro-dev-onboard-api | `capiro-dev-onboard-api:5` | 4400 | `/onboard-api/*`, plus `onboarding.capiro.ai` host routing. |
| capiro-dev-meriv2-orchestrator | `capiro-dev-meriv2-orchestrator:175` | 4300 | `/meri-api/*`; existing agent runtime is not reused by the new build. |

These route families establish routing metadata only. No route was invoked, and no route is qualified as a read-only, service-authenticated source API. In particular, identity middleware can provision a genuinely missing membership from verified claims; an apparent read route may have authentication side effects. Existing Meri tool/retrieval endpoints cannot substitute for the independently built connector.

**CloudFormation drift matters.** `Capiro-dev-Compute` reports `UPDATE_ROLLBACK_COMPLETE`; its `AlbDnsName` output is `Capiro-Alb16-PWSBu59pPfLj-1606523634.us-east-1.elb.amazonaws.com`, which differs from the sole observed live load balancer above. Current ECS target groups and DNS resolve to the prod-named load balancer. Do not use that stale output as the new source target or repair existing stacks as part of this build.

The private hosted zone `capiro.dev.local` exists. Its observed A-record names were only `clio-sandbox.capiro.dev.local`; no general private source API service-discovery endpoint was established. Existing ECS source services reported no service registries. This task did not inspect private record addresses or invoke the sandbox.

## Clerk configuration mechanism

Current API task `capiro-dev-api:650` and strategy task `capiro-dev-api-strategy:57` explicitly set **`CLERK_JWT_ISSUER=https://clerk.app.capiro.ai`**. Public DNS has `clerk.app.capiro.ai CNAME frontend-api.clerk.services`. Their `CLERK_SECRET_KEY` is injected through an ECS Secrets Manager reference under `/capiro/dev/clerk/secret-key`; its value was not retrieved. Current API metadata gives sign-in URL `https://app.capiro.ai/sign-in` and a Capiro origin allowlist; no new greenfield origin is currently established by this discovery.

The new trusted identity layer uses the qualified official Clerk backend SDK and this authoritative identity instance if retained by the integration decision. It needs its own explicitly provisioned credential/access mechanism and validated issuer, authorized-party/origin/audience configuration. Existing secret references are evidence of configuration, not permission to retrieve or mount those credentials into new services or workers. The new origin, redirect behavior and current identity reconciliation need their own fixtures before enabling real users.

Pinned source evidence: [Clerk verification and claim normalization](https://github.com/neo-capiro/capirov2/blob/fd8765ec01d292013758606204f2c9d886cd31c1/apps/api/src/auth/clerk.service.ts), [shared canonical tenant guard](https://github.com/neo-capiro/capirov2/blob/fd8765ec01d292013758606204f2c9d886cd31c1/packages/auth/src/tenant.guard.ts), and [main membership/impersonation middleware](https://github.com/neo-capiro/capirov2/blob/fd8765ec01d292013758606204f2c9d886cd31c1/apps/api/src/tenant/tenant-context.middleware.ts).

## Required source authority at the new gateway

- Verify the Clerk subject and canonical tenant, resolve the local actor UUID, and require current active `tenant_memberships`. Cross-check organization/custom tenant claims; never trust model-supplied actor/tenant arguments. Removed or suspended membership must not be revived by a new connector.
- Preserve effective role and any authorized impersonation attribution; do not treat `capiro_admin` as a universal source bypass. The new application session and capability bind actor, tenant, conversation, run, permitted actions, expiry and policy revision.
- Apply client walls independently from team membership. `client_memory_access` is a hard-delete wall-membership grant; it has no status or expiry columns. Unknown users/clients and absent wall grants deny access, including admins.
- Apply governed memory owner/class/scope/lifecycle, legal-hold and role/grant rules. `memory_access_grant` is a separate reasoned active/expiring permission grant. A memory proposal is not publication or review authority.
- Apply mailbox connection ownership, meeting ownership/sharing, encrypted body permissions and record lifecycle separately from tenant/client filtering. Recheck object previews, files, cached context, citations and download access using contributing source scopes.
- Keep source mutations disabled through read qualification. Initial memory proposals, tasks and exact artifact filing require accepted command contracts, immutable approval where required, current authority, source transaction/audit invariants, idempotency and outcome receipts after G3-G5.
- Implement revocation invalidation across live runs and stored transcripts/files/artifacts, not only at the next retrieval. Agree and measure a numeric maximum propagation deadline before G3.

The pinned [Prisma service](https://github.com/neo-capiro/capirov2/blob/fd8765ec01d292013758606204f2c9d886cd31c1/apps/api/src/prisma/prisma.service.ts) explicitly documents that existing `capiro_app` is a member of the table-owner role and bypasses PostgreSQL RLS. Its query hooks enforce material tenant isolation. No old Prisma package, query hook, retrieval adapter or application credential is imported. New policy must be tested against approved schemas/views under the actual new restricted principal; transaction-local tenant/actor context alone does not make an owner role safe.

Additional pinned policy evidence: [client walls](https://github.com/neo-capiro/capirov2/blob/fd8765ec01d292013758606204f2c9d886cd31c1/apps/api/src/memory/memory-wall.helpers.ts), [governed-memory authorization](https://github.com/neo-capiro/capirov2/blob/fd8765ec01d292013758606204f2c9d886cd31c1/apps/api/src/memory/memory-authorization.service.ts), [engagement ownership/body access](https://github.com/neo-capiro/capirov2/blob/fd8765ec01d292013758606204f2c9d886cd31c1/apps/api/src/engagement/engagement-access.helpers.ts), and [authoritative relational schemas](https://github.com/neo-capiro/capirov2/blob/fd8765ec01d292013758606204f2c9d886cd31c1/apps/api/prisma/schema.prisma).

## Safe connection sequence and exact missing inputs

Continue independent runtime/foundation work with sources disabled. Before enabling one client and memory, resolve these concrete inputs and record the evidence in a new bounded integration task:

1. **Effective source target and schema contract:** establish the actual canonical host/database versus the observed candidates, approved read tables/views per domain, schema revision and supported count/pagination/history/freshness semantics. Source object stores, encrypted fields, embeddings/graph stores and separate service databases still need precise endpoints and resource inventories.
2. **Restricted source principal:** identify/provision a dedicated non-owner read role or qualified narrow service identity, with no inherited bypass, DDL, cross-tenant operator privileges or source mutations. Define actor/tenant context and field restrictions; separately define later command permissions. No suitable role or credential is presently proven.
3. **Narrow private network transport:** select the exact source-side endpoint and new trusted gateway network interface, explicit routes/security groups/DNS/TLS and fail-closed egress policy. No VPC link, peering, source ingress change or endpoint service is configured by this task. Workers remain unable to reach source databases directly. Connectivity remains untested.
4. **Identity credential and app configuration:** provision the new trusted service's Clerk access mechanism, accepted new origin/redirect/authorized-party settings, current membership lookup path and local actor mapping. Do not call provisioning-capable middleware as a supposedly passive source read. No current identity policy, membership or Clerk dashboard setting was changed.
5. **Policy fixtures and real scope:** obtain an authorized two-tenant fixture set plus within-tenant membership/client wall/private memory/expired grant/mailbox/body-access/lifecycle cases. Actual tenant flags/entitlements, private rows and source secrets remain unqueried.
6. **Revocation and data lifecycle:** agree the numeric deadline, how authoritative permission changes reach the new gateway, current-authority lookup freshness, transcript/artifact invalidation and backup/restore retention handling.

Once these inputs and accepted contracts exist, Codex can review a concrete narrowly scoped connection plan and qualify it independently. Connection capability is preserved architecturally; live reachability and authority are not claimed. No deployment gate advances because metadata exists, and existing Capiro/Meri behavior remains unchanged.
