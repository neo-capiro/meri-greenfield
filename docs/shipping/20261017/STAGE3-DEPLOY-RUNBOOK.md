# Meri first-chat preview: Stage 3 deploy runbook

Prepared by Fable on 17 October 2026, branch `fable/meri-stage3-deploy-20261017`, on integration `ce2da186`. This is the mechanical sequence the coordinator runs **after Neo stores the Core bearer** in `meri/preview/core/identity-bearer`. Every AWS mutation below is an explicit command; `infra/product-preview/first-chat/stage3-deploy.mjs` only does local data plumbing (it reads and writes files, validates, and never prints a secret).

**Since the first rollout, all three stacks are live.** Steps 5 to 8 are the release procedure for every later image: render, stage under a new label, update model → issuer → app, then gate. `first-chat/ship-packet.mjs` turns one release into a reviewable packet. The create-time details below remain as the record of the first deployment.

Account `967807252336`, region `us-east-1`, cluster `capiro-dev`. Resource names come from `infra/product-preview/first-chat/foundation-outputs.json`, `deployment-inputs.json`, `temporal-binding.json` and `issuer-service-binding.json`.

## What gets deployed

| Stack | Source | Resources | Desired count at create |
|---|---|---|---|
| `meri-first-chat-issuer` (exists, updated) | `first-chat-issuer-service.mjs` | `meri-product-preview-temporal-issuer` task definition + service | 1 (already running) |
| `meri-first-chat-model` (new) | `model-proxy-template.mjs`, plan v2 | `meri-product-preview-proxy`, `meri-product-preview-owner` task definitions + services, 4 managed policies on the foundation roles | 0 |
| `meri-first-chat-app` (new) | `manifest.mjs` | `meri-product-preview-control`, `meri-product-preview-temporal-worker` task definitions + services, `meri-product-preview-runner` task definition | 0 |

Bindings come from `infra/product-preview/first-chat/stage3-bindings.mjs` (`buildStage3Bindings`), and `stage3-bindings.test.mjs` proves them on throwaway PKI. The key facts:

- **Execution roles and log groups are per task definition:**
  - control: `MeriPreview-control-execution`, `/meri/product-preview/control`
  - worker: `MeriPreview-worker-execution`, `/meri/product-preview/worker`
  - runner: `MeriPreview-runner-execution`, `/meri/product-preview/runner`

  The runner's role is the only role `MeriPreview-control-task` may `iam:PassRole`.
- **Control attaches to the private target group** `meri-preview-control-8082` and, since Stage 6, to the public `meri-preview-control-8080`.
- **Security groups for each ENI:**
  - control: `sg-05a350c100574b21f` (control), `sg-0c3da023e9e8fb292` (issuer-client) and `sg-0d5b5286baf28242e` (db-client)
  - worker: `sg-00111cd0e475badfa` and `sg-0c3da023e9e8fb292`
  - owner: `sg-05f76fcb9a014a73e` and `sg-0d5b5286baf28242e`
  - proxy: `sg-02c3cc26b435e2516`
  - runner: `sg-098fc4f2ac89aa943`, in subnet `subnet-0920665f91c905f01`
- **Images:**
  - Node runtime N6 `…@sha256:9b8c5a96…cf51a`, source `ba454fd0`. Control, worker, runner, owner, issuer and every material-init container use it.
  - Proxy B6 `…@sha256:a1266221…71666`, source `b7fc79ef`.
- The worker's `NODE_EXTRA_CA_CERTS=/run/meri/issuer-ca.pem` is emitted by the manifest because the token writers are configured. It is the same Meri server CA that runner poststart pins.

## Inputs the coordinator must hold before starting

| Input | Where it comes from |
|---|---|
| AWS profile with STS account `967807252336` | The coordinator's own authorized profile |
| `PKI`: the private PKI directory, with `db-logins.json` | The coordinator's private custody. Never in Git; this runbook never reads it except through `render-material.mjs --private` |
| `FRONTEND_ORIGIN` | dot: the browser origin of the frontend preview. `deployment-inputs.json` still says `PENDING_CORE`, and render refuses anything that starts with `PENDING_` |
| `image-scans.json` `{"proxy":"<64 hex>","nodeRuntime":"<64 hex>"}` | SHA-256 of the exact reviewed image-build receipt object (the producer `RECEIPT`, which carries `scanStatus` and `findingSeverityCounts`) for B6 `a1266221` and N6 `9b8c5a96`. Read each receipt by its S3 VersionId. Model-proxy plan v2 pins both values, and the repository does not record them (see Source gaps) |
| A checkout of this branch | `render-material.mjs` re-measures the runner at `nodeRuntimeSourceCommit` `ba454fd0` with `git cat-file` |

```bash
set -euo pipefail
export AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1
aws sts get-caller-identity --query Account --output text      # must print 967807252336
R=/path/to/meri-stage3-deploy                                    # this checkout
W="$HOME/meri-stage3-$(date -u +%Y%m%dT%H%M%SZ)"; mkdir -m 700 "$W"   # private work dir OUTSIDE the repo
PKI=/path/to/private-pki                                         # coordinator custody
FRONTEND_ORIGIN=https://<frontend preview host>                  # from dot
STAGE3=infra/product-preview/first-chat/stage3-deploy.mjs
```

On Windows Git Bash, give `file://` arguments a Windows path (`file://$(cygpath -m "$W")/…`).

---

## 1. Check that the bearer secret has an AWSCURRENT version (never print it)

```bash
aws secretsmanager describe-secret --secret-id meri/preview/core/identity-bearer \
  --query '{arn:ARN,versions:VersionIdsToStages}' --output json
```

Accept only when one VersionId maps to `AWSCURRENT`. Record that VersionId; it is safe to record. Then copy the value into the private work dir without echoing it:

```bash
umask 077
aws secretsmanager get-secret-value --secret-id meri/preview/core/identity-bearer --version-stage AWSCURRENT \
  --query SecretString --output text | tr -d '\r\n' > "$W/identity"
grep -Eq '^[A-Za-z0-9._~+/-]{1,8192}={0,2}$' "$W/identity" && echo BEARER_SHAPE_OK || echo BEARER_SHAPE_REFUSED
wc -c < "$W/identity"; sha256sum "$W/identity" | cut -d' ' -f1      # length and hash only
```

The regex is the same one as `credentialOk` in `apps/control/product-access/core-membership.mjs`. If the shape check refuses, stop: the secret is not a bare bearer.

## 2. Core activation (dot's service; Neo's approval)

```bash
aws ecs describe-services --cluster capiro-dev --services capiro-preview-first-chat-core \
  --query 'services[0].{desired:desiredCount,running:runningCount,pending:pendingCount,td:taskDefinition}'
CORE_TG=$(aws elbv2 describe-target-groups --names Capiro-CoreT-NHA4DBPHLZ2E --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-groups --target-group-arns "$CORE_TG" \
  --query 'TargetGroups[0].{path:HealthCheckPath,port:HealthCheckPort,protocol:HealthCheckProtocol}'   # expect /health, 4000

aws ecs update-service --cluster capiro-dev --service capiro-preview-first-chat-core --desired-count 1
aws ecs wait services-stable --cluster capiro-dev --services capiro-preview-first-chat-core
aws elbv2 describe-target-health --target-group-arn "$CORE_TG" \
  --query 'TargetHealthDescriptions[].{ip:Target.Id,port:Target.Port,state:TargetHealth.State,reason:TargetHealth.Reason}'
```

Accept only when exactly one target on port `4000` is `healthy` (`GET /health`).

**Rollback:** `aws ecs update-service --cluster capiro-dev --service capiro-preview-first-chat-core --desired-count 0`, then `aws ecs wait services-stable …`.

## 3. Membership query (the bearer goes in from a file, never into argv or output)

```bash
umask 077
printf 'authorization: Bearer %s\n' "$(cat "$W/identity")" > "$W/auth.header"     # printf/cat output stays in the file
DEADLINE=$(( $(date +%s) * 1000 + 10000 ))
curl -sS --proto =https --max-time 15 -o "$W/membership.json" -w '%{http_code}\n' \
  -X POST https://first-chat-preview.app-dev.capiro.ai/api/clio/application-authority/membership \
  -H @"$W/auth.header" -H 'content-type: application/json' -H 'accept: application/json' \
  -H 'accept-encoding: identity' -H "x-meri-deadline-at: $DEADLINE" --data '{}'
rm -f "$W/auth.header"
```

Expect `200`. These are the same headers `createCoreMembershipGate` sends. The response is the membership receipt that `apps/control/product-access/membership.mjs` admits, exactly:

`{tenantId, actorId, status, role, permissions[], clientIds[] (lowercase UUIDs), membershipRevision, checkedAtMs, expiresAtMs}`

Admission requires `status` `active` and `role` one of `standard_user`, `user_admin` or `capiro_admin`. The receipt holds no secret:

```bash
node -e 'const m=require(process.argv[1]);console.log({tenantId:m.tenantId,actorId:m.actorId,status:m.status,role:m.role,clientIds:m.clientIds})' "$W/membership.json"
node "$R/$STAGE3" core-values --membership "$W/membership.json" --identity "$W/identity" \
  --frontend-origin "$FRONTEND_ORIGIN" [--client-id <uuid, required when clientIds has more than one>] --out "$W/core.json"
```

`core.json` is `{coreOrigin: https://first-chat-preview.app-dev.capiro.ai, frontendOrigin, tenantId, actorId, clientId, identityCredentialPath}`. It goes through `render-material.mjs parseCoreValues`.

## 4. Tenant budget row (one-shot Stage 1 migrate task, as `meri_product_migrator`)

The SQL, run as the Aurora admin login that the Stage 1 task already injects (`PGUSER`/`PGPASSWORD`). The role step is the same as `first-chat-migrate.mjs` bootstrap and release. Columns come from `apps/gateway/budget/migrations/0002_tenant_budgets.sql`:

```sql
GRANT meri_product_migrator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
BEGIN;
SET LOCAL ROLE meri_product_migrator;
INSERT INTO meri_product_budget.tenant_budgets (tenant_id, monthly_cap_micro_usd, max_concurrent_runs)
VALUES ($1 /* membership tenantId */, 25000000, 2)
ON CONFLICT (tenant_id) DO NOTHING;
SELECT monthly_cap_micro_usd, max_concurrent_runs FROM meri_product_budget.tenant_budgets WHERE tenant_id = $1;  -- must be 25000000, 2 (else ROLLBACK)
COMMIT;
REVOKE meri_product_migrator FROM CURRENT_USER;   -- always, also on failure
```

`stage3-deploy.mjs tenant-budget` embeds exactly this as a `node -e` program (`TENANT_BUDGET_PROGRAM`). The program uses the image's own `pg` (`/opt/meri/apps/runtime`) and RDS bundle (`/opt/meri/certs/rds-global-bundle.pem`, `verify-full`). The tenant id travels as a plain environment override; it is not a secret.

```bash
aws ecs list-task-definition-families --family-prefix meri-product-preview --status ACTIVE   # find the Stage 1 D2 migrate family
MIG_TD=$(aws ecs list-task-definitions --family-prefix <d2 migrate family> --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text)
aws ecs describe-task-definition --task-definition "$MIG_TD" --query 'taskDefinition.containerDefinitions[0].{name:name,image:image,entryPoint:entryPoint,env:environment[].name,secrets:secrets[].name,logs:logConfiguration.options}'
```

Confirm all of the following before running:
- `entryPoint` is `["/bin/bash","-c"]`.
- The environment holds `PGHOST`, `PGPORT` and `PGDATABASE=capiro`.
- The secrets hold `PGUSER` and `PGPASSWORD`.
- The image is N3 or later.
- Note the container name and the log group.

```bash
node "$R/$STAGE3" tenant-budget --core "$W/core.json" --container <container name> --out "$W/tenant-budget-overrides.json"
TASK=$(aws ecs run-task --cluster capiro-dev --launch-type FARGATE --platform-version 1.4.0 --task-definition "$MIG_TD" \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-0920665f91c905f01],securityGroups=[sg-0c9f0505c552ce469,sg-0d5b5286baf28242e],assignPublicIp=DISABLED}' \
  --overrides "file://$W/tenant-budget-overrides.json" --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --cluster capiro-dev --tasks "$TASK"
aws ecs describe-tasks --cluster capiro-dev --tasks "$TASK" --query 'tasks[0].containers[].{name:name,exit:exitCode,reason:reason}'   # exit 0
aws logs filter-log-events --log-group-name <migrate log group> --filter-pattern '"tenant_budget"' --query 'events[].message'
```

The security groups are the migrator SG (endpoints and NAT 443) plus the db-client marker; the db-client marker is what gives Aurora 5432. Accept `{"event":"tenant_budget","inserted":1|0,"cap":"25000000","runs":2}`, where `inserted:0` means the row already existed with the same values. A different existing row raises `MERI_TENANT_BUDGET_CONFLICT`. Changing a cap is a separately reviewed `UPDATE`, never this step.

## 5. Render the material

Next revisions are a read-only listing. ECS never reuses a revision number, so the listing covers both ACTIVE and INACTIVE:

```bash
for f in meri-product-preview-control meri-product-preview-temporal-worker meri-product-preview-temporal-issuer \
         meri-product-preview-owner meri-product-preview-proxy meri-product-preview-runner; do
  for s in ACTIVE INACTIVE; do
    printf '%s\t%s\n' "$f" "$(aws ecs list-task-definitions --family-prefix "$f" --status $s --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text)"
  done
done > "$W/latest.tsv"
node "$R/$STAGE3" stage3-input --deployment-inputs "$R/infra/product-preview/first-chat/deployment-inputs.json" \
  --foundation-outputs "$R/infra/product-preview/first-chat/foundation-outputs.json" --latest "$W/latest.tsv" --out "$W/stage3.json"
```

`stage3.json` names the following, all derived from the foundation outputs in one function (`stage3Network`) shared with the bindings:
- the family:revision each stack will register;
- the five service ARNs;
- each role's exact ENI set.

A listed ARN of a different family (a prefix collision) refuses.

```bash
cd "$R"
node infra/product-preview/first-chat/render-material.mjs \
  --deployment-inputs infra/product-preview/first-chat/deployment-inputs.json --private "$PKI" \
  --core "$W/core.json" --runtime infra/product-preview/first-chat/runtime-values.json --stage3 "$W/stage3.json" \
  --out "$W/rendered"
```

The output is `MERI_FIRST_CHAT_MATERIAL_RENDERED`. `$W/rendered/<role>/{config,bundle,expected}.json` and `summary.json` are written 0600, in a 0700 directory. `bundle.json` is **secret**.

Validity:
- The owner and proxy `serviceTasks` and the pricing expire **7 days** after render (`--validity-days`). After that, owner and proxy refuse to start, and steps 5 to 7 must be repeated.
- The static candidate's grants expire after `maxRuntimeSeconds` (900 s). That is expected: real chats use dynamic runs.

## 6. Stage each role bundle as a new exact secret version

The task definitions reference exact VersionIds, so AWSCURRENT never moves. Each release stages its five versions under a **new custom label** (`FIRST_CHAT_<YYYYMMDD><letter>`; earlier labels stay on their versions). `upload-plan` writes the exact commands with one fixed idempotency token per role and never reads a bundle:

```bash
node "$R/$STAGE3" upload-plan --deployment-inputs "$R/infra/product-preview/first-chat/deployment-inputs.json" \
  --rendered "$W/rendered" --label FIRST_CHAT_<YYYYMMDD><L> --out "$W/upload-plan.json"
```

Run each role's `command` once and append `role<TAB>VersionId` to `$W/secret-versions.tsv`, then check its `readback`: the new version carries only the label, and AWSCURRENT and earlier labels are unchanged. After an uncertain outcome, resend the **same** command (same token, same bytes); never generate a new token. Each secret holds at most 100 versions.

| Role | Secret ARN (`arn:aws:secretsmanager:us-east-1:967807252336:secret:…`) |
|---|---|
| control | `meri/preview/control/material-OhIfMV` |
| temporal-worker | `meri/preview/worker/material-1tudsv` |
| temporal-issuer | `meri/preview/issuer/material-MYhacb` |
| model-owner | `meri/preview/owner/material-05kED4` |
| model-proxy | `meri/preview/proxy/material-kpYYOE` |

Each execution role may read only its own secret.

## 7. Build the bindings and update the three stacks

All three stacks are live. `bindings` refuses if the live foundation differs from `deployment-inputs.json`, or the live private edge from its `privateEdge` block. It also needs the live app template, because control keeps the public 8080 target group its service is attached to.

```bash
aws cloudformation describe-stacks --stack-name meri-first-chat-foundation --query 'Stacks[0].Outputs' > "$W/foundation-live.json"
aws cloudformation describe-stacks --stack-name meri-first-chat-private-edge --query 'Stacks[0].Outputs' > "$W/private-edge-outputs.json"
aws cloudformation get-template --stack-name meri-first-chat-app --template-stage Original --query TemplateBody --output json > "$W/app.live.template.json"
node "$R/$STAGE3" bindings --deployment-inputs "$R/infra/product-preview/first-chat/deployment-inputs.json" \
  --foundation-outputs "$W/foundation-live.json" --private-edge-outputs "$W/private-edge-outputs.json" \
  --rendered "$W/rendered" --secret-versions "$W/secret-versions.tsv" --image-scans "$W/image-scans.json" \
  --live-app-template "$W/app.live.template.json" --out "$W/stage3"
```

`image-scans.json` is `{"proxy":"<sha256 of the proxy build receipt file>","nodeRuntime":"<sha256 of the producer receipt file>"}`. These are hashes of the receipt files, not image digests.

The templates are ready to update live stacks (`applyLiveServiceProfile` in `stage3-bindings.mjs`):

- Owner, proxy, control and worker stay at one task. The renderers' create-time `DesiredCount 0` would scale them to zero on update.
- Control runs one task at a time: max 100 / min 0, with AZ rebalancing DISABLED, which ECS requires for max 100.
- Control starts only after the runner task definition exists.

This profile **supersedes** `build-update-compatible-v2.mjs`. That helper exists only on the historical `handoff/runner-diagnostic-release-20261020` branch, and releases C–E used it. Deploy the `bindings` templates directly. Applying the old helper on top is redundant, and it is no longer a supported step.

`deploy-plan.json` lists the stacks in release order **model → issuer → app**, each with its `aws cloudformation deploy … --no-execute-changeset` command and its `wait stack-update-complete`. For each stack:

1. Create the change set.
2. Review it: task definitions and services Modify, nothing else.
3. Execute the ARN it printed, and wait.
4. Pass the stage gate in step 8 before starting the next stack.

The issuer admits only the control/worker revisions it pins, so control and the worker are refused from the issuer update until the app update lands. Run the app stack immediately after the issuer gate.

```bash
for s in app model issuer; do aws cloudformation describe-stacks --stack-name meri-first-chat-$s --query 'Stacks[0].Outputs' > "$W/$s.outputs.json"; done
node "$R/$STAGE3" verify-outputs --bindings "$W/stage3" --app "$W/app.outputs.json" --model "$W/model.outputs.json" --issuer "$W/issuer.outputs.json"
```

**On a `verify-outputs` mismatch or a failed update:** the rendered material pins exact task-definition revisions, and a rolled-back update burns them. Do not patch. Read the revisions again and repeat steps 5 to 7 with a fresh render under a new label.

**Rollback** is a forward redeploy of the previous release: its images and runtime values, a new render, a new label, then model → issuer → app. `UpdateService` to an older revision cannot work, because the material refuses unpinned revisions.

`infra/product-preview/first-chat/ship-packet.mjs` assembles steps 5 to 8 for one release into a reviewable, hash-pinned packet: pins, evidence, migration delta, cost limits, ordered commands and gates, smoke checks, rollback, cleanup and risks.

## 8. Stage gates

| After | Gate |
|---|---|
| model | `aws ecs wait services-stable --cluster capiro-dev --services meri-product-preview-owner meri-product-preview-proxy`. Both 1/1/0 on the new revisions, with main containers RUNNING past 120 s. One Cloud Map instance each: `aws servicediscovery list-instances --service-id srv-fqjjiu4dmuqsg5mo` (owner) and `srv-dv43rzktx7mvrh6m` (proxy). One owner restart is expected while the old proxy overlaps (`PRODUCT_OWNER_UNAVAILABLE` after about 184 s); its replacement must pass. Neither service emits a positive listening line, so this proves liveness only |
| issuer | `aws ecs wait services-stable … --services meri-product-preview-temporal-issuer`. `/meri/product-preview/issuer` shows `{"ready":true,…}` and `runtime.listening` on the new task definition |
| app | Exactly one control task; worker 1/1/0; `runtime.listening` for `"role":"control"` and `"role":"temporal-worker"`. `aws elbv2 describe-target-health` is healthy for `meri-preview-control-8082/1732509ee5fbf759` and `meri-preview-control-8080/03297203fa59801c`. A first worker task may be refused while the old one overlaps |

Any of these on a replacement task stops the sequence: `RUNTIME_UNAVAILABLE`, `RUNTIME_CONFIGURATION`, `STATIC_INIT_*`, `*_REFUSED`, or an init exit ≠ 0. In Git Bash, set `MSYS_NO_PATHCONV=1` for the `/meri/…` log groups.

## 9. Private probe (no public route)

Control's product routes (`/api/conversations/**`) are served **only** on 8080 (`apps/runtime/control-route-boundary.mjs`). The only ingress to control:8080 is the public ALB SG `sg-0dc7236a6d67e4340`, and that path is Stage 6. The private 8082 listener serves `/v1/**`, `/internal/conversations/**` and `/health/ready`. So what can be exercised privately now is readiness and the pinned private path, from the runner's network position:

```bash
node "$R/$STAGE3" probe-task --deployment-inputs "$R/infra/product-preview/first-chat/deployment-inputs.json" \
  --foundation-outputs "$W/foundation-live.json" --rendered "$W/rendered" --out "$W/probe-task-definition.json"
PROBE_TD=$(aws ecs register-task-definition --cli-input-json "file://$W/probe-task-definition.json" --query 'taskDefinition.taskDefinitionArn' --output text)
PT=$(aws ecs run-task --cluster capiro-dev --launch-type FARGATE --platform-version 1.4.0 --task-definition "$PROBE_TD" \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-0920665f91c905f01],securityGroups=[sg-098fc4f2ac89aa943],assignPublicIp=DISABLED}' \
  --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --cluster capiro-dev --tasks "$PT"
aws logs filter-log-events --log-group-name /meri/product-preview/runner --log-stream-name-prefix stage3-probe --query 'events[].message' --output text
aws ecs deregister-task-definition --task-definition "$PROBE_TD" >/dev/null
```

The probe task (`meri-product-preview-stage3-probe`) runs on the N6 image. It uses the runner execution role and log group, has no task role and no secret, and carries only the public Meri server CA. Expect three lines:
- `control-private-ready`: `200`, `status:"ready"`, through `https://control.meri-preview.internal` (internal ALB → 8082 `/health/ready`, product readiness detail).
- `proxy-pinned-tls`: an HTTP status and no TLS error at `https://proxy.meri.internal:8443`. The certificate validates against the pinned CA. The status itself is not judged, because the proxy admits nothing without a task-bound bearer.
- `owner-unreachable-from-runner-sg`: `timeout`, because the runner SG has no egress to 8444.

**An authenticated first chat** (allocate, admit, submit, stream, reload) needs a route to control:8080. That is Neo's call between:
- **(A) A temporary, fully private path:** a reviewed SG pair (egress from a probe SG to `sg-05a350c100574b21f:8080`, plus ingress on it), a probe task definition whose execution role may read the bearer secret, and a client that speaks the `packages/contracts/conversation-initial-input` protocol. The frontend's `packages/meri-client` conversation client does this, but it is not in this repository (see Source gaps).
- **(B) Stage 6 option (a), dot's anchor rule:** a never-matching host (`meri-preview-anchor.invalid`) forwards to `meri-preview-control-8080`. The app stack is updated with `controlTargetGroupArn`, and dot's real browser session runs the acceptance with an explicit `Host`.

Both are outside Stage 3.

## 10. Next stages

- **Stage 4 (dot executes; Neo approves):** install the Meri host deny at priority 6 under capiro-backend PR78 `bcdd689956e1aff3fa316103e75ec60ebe024fda`. The operator procedure is `docs/core-meri-shared-listener-reconciliation-20261017.md` at that commit. It relocates rules 9→16, 8→9, 7→8 and 6→7, then creates a fixed JSON 404 for exactly `meri-preview.capiro.ai`.
- **Stage 6** is complete: control is attached to `meri-preview-control-8080`. Every update keeps that attachment, because step 7 binds it from the live app template.

## Source gaps found while building this

1. **Image scan receipt hashes** are the sha256 of each build receipt file. `first-chat/image-scans.json` records the reviewed pair; a new image needs its own.
2. **`frontendOrigin`** is still `PENDING_CORE` in `deployment-inputs.json`. It must come from dot, because control's public listener checks `Origin` against it.
3. **No positive readiness signal for the owner or proxy.** Neither emits a listening line, and neither task definition has a container health check (the issuer has the same gap, but logs `runtime.listening`). Step 8 can prove only liveness and Cloud Map registration for them.
4. **No private authenticated first-chat path or client.** See step 9.
5. **Stage 1 migrate task family/container** are not recorded in the repository. `D2-DATABASE.md` proposes `meri-product-preview-d2-migrate` / `d2-migrate` with log group `/meri/product-preview/migrate`, while the foundation created `/meri/product-preview/migrator`. Step 4 discovers and confirms them before use.
6. **Revision prediction is circular by design** (configs pin task-definition ARNs). A failed stack create consumes revisions, so `verify-outputs` is mandatory before any scale-up.
