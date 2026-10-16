# Private product model proxy: disabled change-set contract

Source pin: Meri product proxy modules and `model-proxy-plan.mjs` in this review
branch. The source plan is **disabled** (`enabled:false`, ECS desired count zero)
and creates nothing. It requires an exact ECR image digest containing the
reviewed LiteLLM 1.104.2 adapter, source commit and reviewed scan receipt. The
accepted upstream candidate is `ghcr.io/berriai/litellm` index
`sha256:3d88bd757134a00e8c00237b85a021ab1f6d54abb9c1df750f411dbe7256a500`;
that is not an assembled product image. No image, credential or service was
created here.

`model-proxy-template.mjs` also synthesizes a concrete CloudFormation review
shape: internal TCP NLB and listener, IP target group with client IP preservation,
private Bedrock Runtime interface endpoint, S3 gateway for ECR image layers,
task definition, zero-count ECS
service, log group, exact Bedrock and execution policies, and only the reviewed
SG edges. **Every resource has a condition comparing literal `false` to
`true`**, so the template cannot create even one resource as authored. It has
no output and does not create roles, security groups, DNS, certificates or
credentials. Its supplied role ARNs and SG IDs require fresh independent
verification and explicit owner approval before a later activation revision.

## Concrete placement and traffic

The observed candidate VPC is `vpc-0ac26cfac7ed972be` in account
`967807252336`, `us-east-1`; cluster `capiro-dev` has private subnet candidates
`subnet-0920665f91c905f01`, `subnet-0e38bd390f8961fef` and
`subnet-06db79cd21239de19`. This placement requires an explicit exception to
`AGENTS.md`'s independent-environment rule. The change set must use a distinct
proxy task role, execution role, proxy SG, NLB SG and Bedrock Runtime interface
endpoint SG. Reuse of the broad existing application SG is excluded.

| Source | Destination | Port | Rule |
| --- | --- | ---: | --- |
| Reviewed runner SGs | Internal NLB SG | TCP 443 | Only the two literal CLI Messages/CountTokens paths reach the task after direct TLS admission. |
| NLB SG | Proxy task SG | TCP 8443 | NLB is **TCP passthrough**, target type IP, client IP preservation on. It does not terminate TLS or provide identity. |
| Proxy task SG | Dedicated `bedrock-runtime` VPCE SG | TCP 443 | CountTokens and the single fixed Bedrock profile send. No model egress via NAT. |
| Proxy task SG | Authenticated canonical budget-owner SG | TCP 8444 | Fixed HTTPS origin, no public route; binds Python host observations to the JavaScript product owner. |
| Proxy task SG | Exact platform endpoint SGs | TCP 443 | ECR API, ECR DKR, CloudWatch Logs and Secrets Manager. Any later STS or KMS dependency needs a separate reviewed route. |
| Proxy task SG | Regional S3 gateway prefix list | TCP 443 | Private ECR image-layer download through the gateway route on every task subnet route table. |

Each row requires a source-SG outbound rule and destination-SG inbound rule.
In particular NLB health checks require NLB-SG outbound TCP 8443 to the proxy
target. The disabled template models both directions. All role-specific SG IDs
are distinct; broad pre-existing rules must be removed or disproved at the
reviewed activation pin because additive rules do not confine a reused SG.
The S3 gateway row is the exception: it uses a prefix-list egress rule and
reviewed private route-table association. The template's gateway policy permits
only `s3:GetObject` from the documented regional ECR layer bucket. The four
required existing interface endpoint SGs are bound in fixed order to ECR API,
ECR DKR, CloudWatch Logs and Secrets Manager; fresh endpoint, private-DNS and
subnet inventory must prove that mapping. [AWS ECR endpoint guidance](https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html)
requires the S3 gateway for Fargate 1.4+ image pulls and a Logs endpoint for
`awslogs` without internet. An existing gateway on any reviewed route table
must be reconciled before an activation template can add another one.

The private DNS name candidate is `model-proxy.meri-native.capiro.ai` pointing
to the internal NLB. The NLB health check on TCP 8443 proves only transport
liveness. The proxy task presents a reviewed TLS server certificate, which the
runner must validate against its pinned server trust. The pinned Claude Agent
SDK exposes `ANTHROPIC_AUTH_TOKEN` bearer transport, not a client-certificate
hook. Trusted ingress must hash and verify the opaque task-bound bearer against
the original grant, join the **direct TLS socket source IPv4** to a fresh,
current ECS task/ENI lease and original run/fence, and repeat currentness before
admission and the provider send. X-Forwarded-For, an ARN header, NLB source IP
alone and a codec frame are not authority. Validate actual client-IP
preservation and direct socket address exposure on Linux before any traffic.

The initial task sizing candidate is 1 vCPU, 2 GiB memory and 21 GiB ephemeral
storage, user `1000:1000`, read-only root, no public IP and desired count zero.
This is a reviewable ceiling candidate, not measured capacity. The runner task
role gets no Bedrock/database/provider permissions. The proxy task role gets
only selected profile inference:

- `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on
  `arn:aws:bedrock:us-east-1:967807252336:inference-profile/us.anthropic.claude-sonnet-4-6`
  with source region `us-east-1`, plus the three literal foundation-model ARNs
  in `us-east-1`, `us-east-2`, `us-west-2` constrained by
  `bedrock:InferenceProfileArn` equal to that profile.
- `bedrock:CountTokens` on the literal east-1 foundation-model ARN and
  `bedrock:GetInferenceProfile` on the selected profile only. No Marketplace,
  model discovery, general Converse route or admin permission. Before release,
  simulate these IAM statements and verify an explicit nonselected-profile and
  direct-foundation-model denial.
- The separately reviewed ECS task/ENI observer needs bounded read-only
  `ecs:DescribeTasks` and `ec2:DescribeNetworkInterfaces` rights with a fresh
  current-task/ENI join. Those exact resource/condition capabilities require
  policy simulation; no broad observer role is silently inherited. The
  disabled task-role policy contains **no** ECS/EC2 observer rights yet.

## Material and owner binding

`planPrivateModelProxy` requires two **distinct exact-version** Secrets
Manager references: server TLS cert/key and the proxy's private budget-owner
channel identity. Their contents are never accepted from the worker. A separate
issuer must mint a short-lived opaque bearer bound to run, attempt, writer fence
and task; the proxy resolves its hash from trusted grant custody, never from a
worker claim or log. The owner endpoint is
fixed HTTPS port 8444 with the single canonical `meri_product_budget` namespace
and original allocation/grant facts; no proxy Postgres budget or LiteLLM
reservation ledger is created. LiteLLM's own budget reservation must stay
disabled when this product path is mounted.

The Python host factory now composes direct ingress, final HTTPX observation,
the actual one-shot CountTokens client, canonical UNKNOWN reservation before
native send, and complete response settlement. Required unbound host ports are:

1. `trusted_resolver(scope) -> TrustedRequest` from the **direct** TLS socket
   source IPv4, opaque bearer hash, fresh ECS task/ENI lease and current-grant
   observation before admission and send.
2. `resolve_session(life) -> awaitable ProductSession` from persisted original
   run/allocation, configured client, pricing revision and Core conversation
   currentness. A worker body/header cannot supply these.
3. `ProductSession.make_owner_bridge(capture_authenticated_call) -> bridge`
   whose `reserve`, `bind_complete_capture`, `settle_complete`, `read_outcome`
   use an authenticated private operation-bound channel and invoke the existing
   JavaScript `createProductProxyReservationBridge` /
   `createProductProxySettlementBridge`. The owner must independently capture
   host request and complete-response bytes, validate original task/grant and
   use the one product budget. Only a canonical `BudgetCommitUncertain` may map
   to `SettlementCommitUncertain` for historical readOutcome.
4. `invoke_litellm(handler, scope, receive, send)` must use the **provided**
   per-request `AsyncHTTPHandler` for the pinned upstream LiteLLM Messages
   operation and await complete streaming before handler closure. A global
   default client would bypass the product hooks and is forbidden.

The reviewed image recipe, native client injection, TLS socket/ENI observer, private
Python-to-JavaScript bridge endpoint and material issuer are still missing.
The product host now moves its durable lookup and ECS/EC2 reads off the ASGI
loop and caps admission wait at five seconds before `RequestLifetime` starts.
An unfinished lookup permanently poisons readiness; it cannot authorize a
late send. Python cannot stop a hung lookup thread, so native shutdown and
process-supervisor behavior still require qualification. Mount stays **HOLD**
until that check and exact scoped observer IAM review/simulation complete.
The disabled template's additive SG rules do not prove that the supplied SGs
have no broad existing egress. The reviewed role ARNs likewise do not prove
trust policies, secret/KMS access, or the exact ECS/ENI observer privileges.
Check existing Bedrock private-DNS endpoint collisions, endpoint access and
the log encryption/retention policy before replacing the false condition.
Consequently the plan remains disabled and the private DNS is not a runner
configuration value. Fill and fresh-verify every source binding, image digest,
role, SG, secret version, route and cost bound before presenting an exact AWS
change set for human shipping approval. No AWS build, upload, service, SQL,
credential or paid model operation was performed for this source plan.
