---
name: reference-capiro-invpc-task-runner
description: "Recipe for running one-off SQL or authenticated internal-API calls against capiro-dev from in-VPC via a Fargate task, plus the four traps that cost time"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 71ec3256-a3b6-479b-8b09-223d58868a40
  modified: 2026-08-21T16:24:38.248Z
---

How to query the `capiro-dev` Aurora DB or hit an internal API route that needs
a production secret, without pulling the secret onto the local machine. Register
a one-off task definition using the `capiro/dev/api:latest` image with
`entryPoint: ["node","-e"]` and the script as `command[0]`, run it on cluster
`capiro-dev`, wait, then read CloudWatch. Model it on the existing
`capiro-dev-api-db-inspect` family.

Needed values (stable as of 2026-08-21):
- exec role `Capiro-dev-Compute-ApiTaskDefExecutionRoleE6ABB053-YlEDKuUPHjLg`,
  task role `Capiro-dev-Compute-ApiTaskRole12FAD4A7-szq3QeeZJSCQ`
- subnets `subnet-0e38bd390f8961fef,subnet-0920665f91c905f01,subnet-06db79cd21239de19`,
  SG `sg-01def4e5c0fe44d4a`, `assignPublicIp=DISABLED`
- DB secrets: host/port/dbname from `/capiro/dev/aurora/master-P4z1Vo`,
  user/password from `/capiro/dev/aurora/app-zNPtsU`
- internal API secret: `capiro/dev/internal-service-secret-6cEZG4`
- logs: group `/capiro/dev/api`, stream `<family>/<container>/<taskId>`

Four traps, each of which cost a wasted task run:

1. **`runtimePlatform` must be `ARM64`.** Omit it and Fargate defaults to X86_64,
   the image fails with `exec /usr/local/bin/node: exec format error`, exit 255.
2. **RLS**: `capiro_app` has no BYPASSRLS. `SELECT set_config('app.bypass_rls','on',true)`
   with `is_local=true` (the third arg) is scoped to the CURRENT transaction —
   with node-postgres's default autocommit (no explicit `BEGIN`), that
   transaction ends with the statement itself, so every later query in the same
   script silently loses the bypass and returns 0 rows (cost a full wasted task
   run 2026-08-21: `tenants`/cross-tenant queries came back empty, not erroring).
   Use `is_local=false` for a plain read-only script, or wrap real mutations in
   an explicit `BEGIN`/…/`COMMIT` and set `app.current_tenant`/`app.current_user`
   (matching `PrismaService.withTenantUser`) inside that same transaction — some
   tables (`memory_transition_audit` at least) have `FORCE ROW LEVEL SECURITY`
   with NO bypass_rls clause in their policy at all, so `app.bypass_rls` alone
   won't reveal or let you write those rows; you must set `app.current_tenant`
   to the real tenant.
3. **Port 4000 is NOT reachable task-to-task.** The api SG only admits the ALB SG
   and `sg-00192903751944847` (clio-runtime) on 4000, and `api-strategy` shares
   the api SG — so it reaches the bridge through the ALB, not directly. Call
   internal routes at `https://app.capiro.ai/api/<route>`; the `/api` prefix is
   stripped at the ALB and there is no Nest global prefix. A direct
   `http://10.40.x.x:4000/...` just times out after 10s.
4. **MSYS path mangling on Git Bash.** `aws logs --log-group-name /capiro/dev/api`
   gets rewritten to a Windows path; prefix `MSYS_NO_PATHCONV=1`. Same class of
   problem for `--cli-input-json file://...`, which needs `cygpath -w`.

Two more environment notes: the Bash tool's heredocs fail on large/complex
payloads, so write generator scripts with the Write tool instead; and `python`
here is Windows-native, so it cannot open `/c/...` paths — pass `cygpath -w`
output.

Related: [[reference-aws-credentials]], [[reference-capiro-deploy-traps]],
[[reference-capirov2-db-backed-testing]].
