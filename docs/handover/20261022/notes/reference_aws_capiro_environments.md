---
name: reference-aws-capiro-environments
description: AWS account 967807252336 (capiro-dev CLI profile) contains multiple unrelated ECS clusters — capiro-dev is the one for capirov2 work; ignore capiro-prod-os-capiro
metadata: 
  node_type: memory
  type: reference
  originSessionId: 03464458-37d3-4fb3-8a15-b62268ac048a
  modified: 2026-08-07T09:46:19.117Z
---

The `capiro-dev` AWS CLI profile's account (967807252336, us-east-1) has at least two separate ECS clusters:

- **`capiro-dev`** — cluster for the `capirov2` repo (services `capiro-dev-api`, `capiro-dev-web`). This is the one relevant to [[project_capirov2_ci_blocked]] and any capirov2 deployment/migration work.
- **`capiro-prod-os-capiro`** — a **separate, unrelated product** ("os-capiro"), with its own services (`Capiro-prod-os-capiro-Compute-ApiService...`, `...-WebService...`, `capiro-prod-intel-api`). Explicitly confirmed by Neo (2026-08-07): ignore this entirely when working on capirov2 — do not investigate, query, or touch it as part of capirov2 tasks.

ECR repos follow `capiro/dev/<service>` and `capiro/prod-os-capiro/<service>` naming (not `capiro-dev-<service>` — that pattern only matches ECS cluster/service names, not ECR repo names).

**Why:** Neo flagged this mid-task after AWS recon surfaced the `prod-os-capiro` cluster/repos as a tangent while investigating whether `capiro-dev` itself is production for capirov2. The existence of a distinctly-named "prod" cluster does NOT by itself resolve whether `capiro-dev` is production for capirov2 — that question is separate and still open, see [[feedback_aws_no_permission_prompts]].

**How to apply:** When doing AWS recon or ops for capirov2, only look at the `capiro-dev` cluster and `capiro/dev/*` ECR repos. Don't waste turns exploring `prod-os-capiro` — it's a different app.
