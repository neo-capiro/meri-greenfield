# Temporal issuer: bounded AWS activation proposal

Source and read-only planning only, 17 October 2026. The reviewed issuer source is
Meri draft PR #122, commit `66a251733c13fd659c0f9ff5f1f759b4f99d8192`.
That source is unmounted. This document authorizes no key, certificate, role,
resource, image, SQL, service start or deployment action. The Meri runtime
owner must review a composed successor and a physical change set before any
step below is executed.

## Exact observed boundary

Approved read-only `jump-cli` inventory in account `967807252336`,
`us-east-1`, observed the existing ECS cluster
`arn:aws:ecs:us-east-1:967807252336:cluster/capiro-dev`, VPC
`vpc-0ac26cfac7ed972be` (`10.40.0.0/16`) and private subnets
`subnet-0920665f91c905f01` (1a), `subnet-0e38bd390f8961fef` (1b),
`subnet-06db79cd21239de19` (1c). The existing shared
`sg-01def4e5c0fe44d4a` admits broad VPC TCP 443 and public-ALB port ranges;
it is **not** the issuer trust boundary. No issuer-named ECS service, Cloud Map
service, private `issuer.meri.internal` record, or internal ALB was observed.
The existing private zone `capiro.dev.local` (`Z08383661FRN28VAIMQFI`)
contains no Meri/Temporal issuer record. Existing KMS aliases `capiro-dev`,
`capiro-dev-master`, and `meri-greenfield/qualification-build` refer to
symmetric `ENCRYPT_DECRYPT` keys; an inventory of 23 keys found no
`SIGN_VERIFY` key. No issuer/revocation DynamoDB table or Meri/Temporal-named
Secrets Manager Secret was observed. The existing available KMS interface
endpoint is `vpce-0129a64c28f36072a` with private DNS; it and the existing
Secrets Manager/ECR/Logs endpoints use the broad shared SG. None of those
facts proves an IAM grant, network reachability, material custody or a
live certificate-to-task binding.
The three selected private subnet route tables currently use available NAT
`nat-016e7d15424ca9f8a` for `0.0.0.0/0`; there is **no ECS API interface
endpoint**. The issuer's ECS/EC2 Describe calls would use that existing NAT
until a separately approved endpoint or private route is supplied. The
existing internet-facing `capiro-prod-alb` is not an issuer entry.

Current `infra/product-preview/temporal-binding.mjs` selects the same
`capiro-dev` VPC and cluster. Its five-role Temporal template is disabled,
creates desired-zero services, and references `network.issuerSecurityGroupId`
for TCP 443 egress. The fixture issuer is exactly
`https://issuer.meri.internal/`, JWKS
`https://issuer.meri.internal/.well-known/jwks.json`, audience
`meri-temporal`, namespace `meri`, and the default Temporal claim mapper and
authorizer. These are source contracts, not observed deployed resources.
Older prose in the preview documents that describes a separate Temporal VPC
does not match the current closed binding source; reconcile it before sealing
the combined infrastructure change set.

## Proposed smallest issuer resource set

Use a new isolated CloudFormation stack proposal
`Meri-Preview-Temporal-Issuer` with logical resources
`IssuerTask`, `IssuerService`, `IssuerSecurityGroup`,
`IssuerPrivateDnsNamespace` and `IssuerDiscoveryService`. The physical
names below are proposed new names; there is no existing resource to adopt.
All inputs must be physically rebound and a change set inspected before
creation.

| Resource | Exact proposed shape; action-time binding still required |
| --- | --- |
| ECS | One new Fargate task family and service named `meri-product-preview-temporal-issuer` in `capiro-dev`, `awsvpc`, private IP only, `enableExecuteCommand:false`, digest-pinned reviewed image, desired count **0** at creation. Limit a later qualification to exactly one issuer task, one hour, 0.25 vCPU/0.5 GiB unless measured startup requires a reviewed increase. No existing Core, legacy Meri v2 or qualification service is replaced. |
| Task identity | New `MeriTemporalIssuerPreviewTaskRole`, distinct new issuer execution role or an independently verified narrow existing execution role. Bind the exact task definition revision, image digest, source commit, role ARN and expected ECS service ARN in `parseTemporalIssuerTaskAuthorityConfiguration`; reject drift. A product task role must never inherit the old Meri v2, Core, or qualification grants. |
| Private transport | A new dedicated SG named `meri-preview-temporal-issuer-sg` in `vpc-0ac26cfac7ed972be`. Prefer an ECS Cloud Map private DNS A-record service `issuer` in a new `meri.internal` private namespace, yielding exactly `issuer.meri.internal`, pointing directly to the single task's TCP 443 Node TLS socket. Ingress TCP 443 only from the reviewed **control, temporal-worker, and five Temporal role SGs**; no public ALB route or public IP. Add control/worker and Temporal egress 443 to that SG. The five Temporal server roles need JWKS at startup. The token POST still requires a valid per-task client certificate. |
| Transport fallback | If direct service-discovery DNS/routing cannot be qualified, a separately reviewed **internal NLB TCP 443** with IP target group TCP 443 may preserve the Node TLS peer certificate **only if actual client source IPv4 preservation is enabled and independently proven end to end**. The issuer also compares the socket source IPv4 to the registered task ENI; an NLB source address fails this guard. Do not substitute ALB TLS or NLB TLS termination. The fallback adds an NLB, target group, listener, SG, source-IP-preservation qualification and cost to the approval packet. |
| Signing | One **new**, separately owned KMS asymmetric `RSA_2048`, `SIGN_VERIFY` key (proposed alias `alias/meri/temporal-issuer-preview`). Pin its resulting physical key ARN and exact public JWK/KID/SHA-256 into reviewed issuer and client configuration. The issuer task role may call only `kms:GetPublicKey` and `kms:Sign` on that key; constrain Sign with `kms:SigningAlgorithm=RSASSA_PKCS1_V1_5_SHA_256` and `kms:MessageType=DIGEST`. Key creation, policy, rotation and deletion are separate security actions. No existing symmetric key can sign this JWT. |
| Durable currentness | Reuse existing selected Aurora PostgreSQL cluster `arn:aws:rds:us-east-1:967807252336:cluster:capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv` as the **one canonical** Temporal workload certificate/task/revision/revocation authority. Central allocation [c16d6d5](https://github.com/neo-capiro/meri-greenfield/blob/c16d6d5cc8c2d1b73c5116f791cb22c20bb9bf60/docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md) exclusively reserves source-only `apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql`, schema `meri_service_identity`, table `service_task_registrations`. No second DynamoDB revocation table or process-local allowlist. The dedicated issuer PG adapter requires fresh primary-writer reads and CAS/revoke custody; its borrowed Pool must have only the separately reviewed dedicated issuer role. Add issuer SG to Aurora `sg-059b4e4de0b1dcca5` TCP 5432 only after exact grants, restore and live qualification are accepted. The source migration is not applied by this proposal. |
| Static material | A reviewed exact-version issuer server TLS bundle, independently approved client-auth CA certificate and signer key, public JWK manifest, and dedicated Aurora issuer-role credential reference. The issuer's registration adapter needs narrowly granted primary-writer SELECT/INSERT/UPDATE, not a read-only application Pool. ECS execution-role `secretsmanager:GetSecretValue` and conditional `kms:Decrypt` only for those selected version/key references; task-local owner-only material files, no secret bytes in environment/logs. Existing control/worker static bundles require reviewed public JWK, server/client CA certificates and issuer-delivery config; their **task-specific** client keys/certificates are dynamic and cannot be presealed. |
| AWS reads and network | Issuer task role needs `ecs:DescribeServices`, `ecs:ListTasks`, `ecs:DescribeTasks`, `ecs:DescribeTaskDefinition` for the pinned cluster/service/task-definition scope wherever ECS IAM supports it, plus `ec2:DescribeNetworkInterfaces` (resource `*` where the API requires it), and no ECS mutation/`iam:PassRole`. Its reader performs these fresh checks twice per token. Existing KMS VPCE may carry KMS calls only after endpoint policy, DNS, shared-SG exposure and exact IAM simulation pass. ECS/EC2 API routing through current private subnet/NAT or dedicated endpoints must be read back; this document creates no endpoint or NAT. |
| Logs | A dedicated retained log stream/group proposal `/meri/temporal-issuer-preview`, no JWT, cert, private JWK, DB credential, request body or fingerprint in logs. Pin encryption, retention and execution-role permissions before launch. |

The proposed direct Cloud Map route needs a new private `meri.internal` DNS
namespace/hosted zone because the existing source's
`temporal.meri.internal` namespace does not itself produce
`issuer.meri.internal`. Verify zone collision, association to the exact VPC,
resolver behavior and end-to-end TLS name/CA before choosing it. ECS service
discovery can register Fargate task A records without a load balancer
([AWS ECS service discovery](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-discovery.html)).
An ALB mutual-TLS listener authenticates at the ALB and forwards certificate
headers, which does not satisfy this Node socket-auth source
([AWS ALB mTLS](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/mutual-authentication.html));
an NLB TCP listener passes the encrypted stream
([AWS NLB listeners](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-listeners.html)).

## Required post-placement certificate registration

The server-side `task-authority.mjs` requires the client leaf's **one URI SAN**
to be the pinned role URI base plus the URL-encoded **actual ECS task ARN**. It
also requires the durable row for its SHA-256 certificate fingerprint to bind
that same task ARN, role, peer SAN, deployment revision and expiry, with
current revocation state. The ECS task ARN exists only after task placement;
a static role certificate in a task-definition Secret cannot satisfy this
contract. Token issuance also requires the direct TLS socket source IPv4 to
equal that registered task's current private ENI IPv4; a copied certificate
from another network peer is refused. Allocate one authenticated, task-local
post-placement CSR/certificate registration flow through the *same* durable
authority. Task metadata supplies only a claimed ARN; observed source IPv4,
fresh ECS service/task and EC2 ENI facts must independently prove the task.
The client private key must be generated and retained in its own task-local
owner-only volume; sign the leaf under an approved client-auth CA and register
it atomically with revision/expiry. The source owner's default leaf is five
minutes, so the private material owner must rotate by CAS before expiry and
restart the mTLS delivery client against the new private pair. A stopped/replaced task, revoked row, changed
revision, expired certificate or different service must refuse renewal. The
existing original-run runner poststart certificate owner is run-scoped and is
not implicitly this service-certificate authority. The Meri runtime/schema
owner found no existing canonical service certificate table. The separate
central allocation at c16d6d5 now reserves the exact migration path named
above. Source authoring does not authorize applying SQL, creating a DB role,
or admitting a live certificate.

## Decision, qualification and rollback sequence

1. **Source gate:** accept one composed issuer entrypoint with the external
   KMS signer, canonical Aurora binding adapter, task-local certificate
   registration, default-off runtime mount, exact Node 24 package closure,
   and independent source/security review. Pin full commit/tree, image source
   and immutable dependencies. PR #122 alone is insufficient.
2. **Metadata gate:** fresh readback of target cluster/VPC/subnets/route tables,
   exact new/old SGs, endpoint policy and DNS namespace; exact Aurora writer,
   schema owner/grants and restore; physical KMS key type/public key and alias;
   exact cert chain/purpose/SAN/private-key custody; task role/execution role
   trust and simulated action-by-action permissions. Review a CloudFormation
   change set at desired count **0**; do not use old resource names as adoption
   authority. This proposal is not that change set.
3. **Bounded qualification:** an issuer-only one-task/one-hour infrastructure
   smoke may probe startup, private DNS, TLS server name/CA, JWKS and signer
   identity under its own paid approval. This does **not** qualify workload
   admission. A later separately budgeted all-participants run must prove
   actual control/worker mTLS client chains, dynamic task SAN/registration,
   fresh Aurora revocation and ECS/ENI reads, real KMS signature against the
   pinned JWK, fixed JWT claims and expiry, JWKS from all five Temporal roles,
   and Temporal 1.32.1 acceptance/refusal. Test wrong, standalone, stopped,
   expired and revoked tasks, and revocation during signing. Control, worker
   and Temporal desired counts remain zero unless that separate activation
   packet authorizes exact minimal task counts and duration.
4. **Release decision:** `permissions:['meri:write']` grants **namespace-wide
   non-admin write** in `meri`, including termination, deletion and schedule
   mutation; it is not task-queue or tenant scoped. An already accepted token
   may work for up to **60 seconds after revocation**, until its `exp`; the
   stock Temporal default authorizer/JWKS provider does not make revocation
   instantaneous. A deployment approver must explicitly accept this breadth
   and residual lifetime. Issuer/client enforce exact `iss`, `aud`, `sub`,
   `jti`, key/KID and no additional permissions; live tests must prove the
   stock server's audience/JWKS/default-mapper behavior.
5. **Rollback:** first set issuer desired count to zero and remove/disable
   control and worker issuance paths, then revoke each canonical cert/task row;
   stop associated control/worker tasks and wait at least 60 seconds after
   their final issued JWT expiry before treating Temporal access as removed.
   Restore prior task definitions/config and keep old preview service/guard
   pins; do not delete a KMS key, certificate CA, database record, or private
   zone during an incident. After receipt capture, delete only resources
   created by this exact new issuer stack/change set and verify DNS/SG/task
   cleanup. An issued JWT cannot be recalled from stock Temporal earlier than
   its expiry solely by stopping ECS.

## Cost envelope and excluded decisions

For a one-hour *issuer-only infrastructure smoke*, assume one Linux/x86
Fargate task at 0.25 vCPU/0.5 GiB, at most 240 test signatures/hour,
one new RSA-2048 KMS key, one private DNS zone/resource, up to three new
Secrets Manager references, at most 10 MiB/day logs, reuse of existing
network endpoints and **pre-existing approved certificate material with no
new certificate issuance**, and **no** NLB. Public us-east-1 prices yield about
`$0.01234` Fargate compute/hour, `$0.00072` KMS Sign/hour, a `$1/month`
hourly-prorated KMS key, up to `$0.50` charged on creation for a retained
private hosted zone and about `$0.10` for one Cloud Map registered resource
over a month. A **$2 maximum proposed reservation for the one-hour issuer
smoke** leaves margin for up to three new Secrets Manager references
(`$0.40/secret-month`, prorated, plus `$0.05/10,000` API calls), logs and
small data transfer. It is neither an AWS spend cap nor authorization, and
excludes existing Aurora/Temporal/control tasks, source image build/scan,
new endpoints/NAT and any certificate issuance. The actual joined mTLS and
Temporal acceptance run needs its **own** task-count/duration/budget packet.
A new internal NLB adds about `$0.0225/hour` plus
`$0.006/NLCU-hour`; it requires a revised ceiling and reviewed source join.

Pre-existing approved certificate material is a prerequisite for that `$2`
candidate. Even use of an existing AWS Private CA has per-certificate cost
(`$0.75` general-purpose or `$0.058` short-lived at the first tier), so a
dynamic two-client certificate test must price its exact count. A new AWS
Private CA has material recurring cost:
`$400/CA-month` general purpose or `$50/CA-month` short-lived, plus
per-certificate issuance; no free-trial eligibility is assumed. If a new CA
is necessary, identify the exact CA, certificate count, owner and teardown
time in a new budget request before provisioning. No paid operation was
started for this proposal. Rate sources:
[Fargate](https://aws.amazon.com/fargate/pricing/),
[KMS](https://aws.amazon.com/kms/pricing/),
[Route 53](https://aws.amazon.com/route53/pricing/),
[Cloud Map](https://aws.amazon.com/cloud-map/pricing/),
[Elastic Load Balancing](https://aws.amazon.com/elasticloadbalancing/pricing/),
[CloudWatch Logs](https://aws.amazon.com/cloudwatch/pricing/),
[Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/), and
[Private CA](https://aws.amazon.com/private-ca/pricing/).
The RSA-2048 request rate `$0.03/10,000` was additionally checked via
AWS Price List SKU `D2442XTM4G9ABTHW`; the more conservative other-asymmetric
rate is `$0.15/10,000` (SKU `MS4387UGYYR785BJQ`).

Current decision is **HOLD**. The service-certificate migration and
post-placement registration now have a source allocation, but SQL application,
the reviewed physical KMS key and IAM, mTLS materials, route/endpoint readback,
image and Temporal runtime tests remain unapproved or unqualified. A source
proposal or cost estimate cannot lift those gates.
