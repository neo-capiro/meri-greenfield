# D005 production host: inert source proposal

## Implementation outline

- `binding.mjs` validates exact, owner-supplied DATA for one tenant/conversation host generation and immutable source/image/network pins. It grants no authority.
- `network.mjs` describes the required separate proxy and browser/Bash network compartments, proxy-only tool traffic, public address denial and host firewall controls. Security groups are one layer, never the enforcement proof.
- `instance.mjs` describes non-root host/container, image and metadata constraints. `watchdog.mjs` records the existing managed-teardown source gap and the independent cleanup evidence required.
- `render.mjs` combines those DATA definitions into a **non-deployable** proposal with `runtimeEnabled:false`. It emits no CloudFormation resources, executable command or admission switch. The deployment owner must later review and implement an exact change set, obtain separate authorization, and qualify it on the real host.
- `template.mjs` compiles a reviewable CloudFormation **source specimen** with pinned AMI, private subnet, no public address or ingress, only the pinned private control security group on port 443, IMDSv2, encrypted delete-on-termination root, and an exact ECR repository pull role. Every resource is behind an unconditional literal-false condition. It has no parameter to enable launch, no host bootstrap, public web route, managed watchdog or deployment command. It cannot produce a live host as written; removing the guard requires a separately reviewed source and deployment change. The inert watchdog and missing positive root-volume-absence wire still block admission.
- Focused tests verify closed binding, exact run isolation, fixed topology and permanent refusal of deployment/activation claims. No AWS client, CDK, network, filesystem or process operation is imported or performed by these modules.

This proposal reuses `apps/worker/conversation/browser/{resolution,egress-control}.mjs`, `apps/worker/conversation/egress/proxy-server.mjs`, SDK sandbox readiness, and `infra/browser-{qualification,enforcement}` as source references. Their local fixtures do not qualify production. See `docs/coordination/handoffs/M8-BROWSER-BASH-SOURCE-DEPLOYMENT-20261018.md` for the owner handoff and activation sequence.
