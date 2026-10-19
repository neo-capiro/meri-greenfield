# Neo: private local re-render handoff for PR193

This document prepares a reviewable operator handoff. Both qualification jobs succeeded. Root verified the six authenticated receipt joins, all seven launch gates and canonical runtime-values assembly; independent result review also passed. It does not authorize a deployment or an external mutation. Neo retains private material on the existing secure operator host. Every private path below is a placeholder, not a discovered or guessed location.

## Fixed candidate and scope

| Item | Required value |
| --- | --- |
| Product source | `5b395d4ce9218b872b21c420dc00a3af31739824` |
| Node image | `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49` |
| Product build | `meri-greenfield-qualification-build:2d0c9e04-a170-46d2-9d0b-f4094e6a48e8` |
| Measurement build | `meri-greenfield-qualification-build:56cd3c64-a7cb-46ec-9cd6-86f92041bbed` |
| Reviewed public baseline | C packet at `5a42ec962677e70e76db5433330b52fd34db5bcd`, `docs/shipping/20261019/a16cc40d-public-render/` |
| Current public inputs | This evidence directory's `public-candidate/deployment-inputs.candidate.json`, `policy.json`, `allocation.json`, and root-verified `runtime-values.json` |
| Verified runtime file SHA256 | `46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d` |
| Policy | Three turns, one tool call; existing reviewed allocation unchanged |
| Optional activation selectors | Preserve absent `features`, capability profile and active-read selectors exactly; do not add empty lists or enable product families |
| Proxy main image, unchanged | `sha256:734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551`, source `34851020aa0d73fead4db59ba6e26a098e2d0313` |
| Temporal server image, unchanged | `sha256:f73ce01ef4739a77fad6ace3fbfbbe1f1aeaa553b5c263d705053a2f5063cf2d`, source `989a4227e6da6f176975d798826904d71c3a9f9c` |

The Node image covers control, the application `temporal-worker`, runner, owner, issuer and material-init. The proxy's material-init also uses the Node image while its main proxy container keeps the existing proxy image. The five Temporal **server** services, their image and private bundles remain unchanged. The application `temporal-worker` is distinct from Temporal's `internal-worker` server.

Use the newly assembled runtime file, including the actual native CLI measurement, complete installation inventory and source/image joins. Do not copy the historical C native CLI hash or reconstruct runtime values from the runner hash alone. Root records measured values separately from unchanged public C values. This scope does not qualify additional enabled features or establish live admission.

## Recorded fresh metadata

Root's authenticated [service readback](measurement-operator/live-services.json), observed `2026-10-19T19:58:57.9466300Z`, records all ten services listed below at desired/running `1/1`, pending `0`, with deployments `COMPLETED`. The [task image readback](measurement-operator/live-task-images.json) distinguishes the running images from this candidate:

| Observed component | Running image digest | Candidate relationship |
| --- | --- | --- |
| Node runtime containers and Node material-init containers | `sha256:9bff84ba24959130e63e64b2ac72783144053084168fcf14f4344f4dd8583717` | Candidate `sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49` is built and measured; it is **not deployed** |
| Proxy main container | `sha256:734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551` | Unchanged; its material-init currently uses the Node digest above and is included in the proposed Node task/material refresh |
| All five Temporal server services | `sha256:f73ce01ef4739a77fad6ace3fbfbbe1f1aeaa553b5c263d705053a2f5063cf2d` | Unchanged; no Temporal server image or bundle refresh is proposed |

Root's [latest revision readback](measurement-operator/live-latest-revisions.json), observed `2026-10-19T19:59:09.0349208Z`, and corresponding [canonical TSV input](measurement-operator/live-latest-revisions.tsv) contain both statuses. The [canonical next-revision result](measurement-operator/next-revisions.observed.json) derives these candidates from those observations:

| Task family | Current service revision | Latest ACTIVE | Latest INACTIVE | Derived next candidate |
| --- | ---: | ---: | ---: | ---: |
| `meri-product-preview-control` | 33 | 33 | 32 | 34 |
| `meri-product-preview-temporal-worker` | 32 | 32 | 31 | 33 |
| `meri-product-preview-temporal-issuer` | 32 | 32 | 31 | 33 |
| `meri-product-preview-owner` | 31 | 31 | 30 | 32 |
| `meri-product-preview-proxy` | 31 | 31 | 30 | 32 |
| `meri-product-preview-runner` | No ECS service | 18 | 17 | 19 |

These candidates are **not reserved revisions**. Repeat the readbacks and canonical derivation before rendering for an approved rollout; another task registration or failed deployment can consume the next number. Existing service health describes the running image only and does not qualify this candidate in live service. The role/foundation drift checks below still apply.

## 1. Root: fresh read-only revision and service records

These commands read public AWS metadata only. Run them with the existing authorized profile in account `967807252336`, region `us-east-1`, cluster `capiro-dev`. Save their timestamps and outputs in the public evidence packet. Do not request environment variable values, task overrides, bundle contents or secret values.

```bash
aws --region us-east-1 --no-cli-pager sts get-caller-identity \
  --query '{account:Account,arn:Arn}' --output json

aws --region us-east-1 --no-cli-pager ecs describe-services --cluster capiro-dev \
  --services meri-product-preview-control meri-product-preview-temporal-worker \
    meri-product-preview-temporal-issuer meri-product-preview-owner meri-product-preview-proxy \
  --query '{failures:failures,services:services[].{name:serviceName,arn:serviceArn,status:status,desired:desiredCount,running:runningCount,pending:pendingCount,taskDefinition:taskDefinition,deployments:deployments[].{id:id,status:status,taskDefinition:taskDefinition,rolloutState:rolloutState,desired:desiredCount,running:runningCount,pending:pendingCount}}}' \
  --output json

aws --region us-east-1 --no-cli-pager ecs describe-services --cluster capiro-dev \
  --services meri-product-preview-temporal-frontend meri-product-preview-temporal-history \
    meri-product-preview-temporal-matching meri-product-preview-temporal-internal-worker \
    meri-product-preview-temporal-internal-frontend \
  --query '{failures:failures,services:services[].{name:serviceName,status:status,desired:desiredCount,running:runningCount,pending:pendingCount,taskDefinition:taskDefinition,deployments:deployments[].{status:status,taskDefinition:taskDefinition,rolloutState:rolloutState}}}' \
  --output json
```

For each **exact task-definition ARN returned by those service records**, capture its revision, image and secret-version metadata. This is a read of the named revision, not an assumption that a family name means the service's current revision:

```bash
aws --region us-east-1 --no-cli-pager ecs describe-task-definition \
  --task-definition '<EXACT_TASK_DEFINITION_ARN_FROM_FRESH_SERVICE_RECORD>' \
  --query 'taskDefinition.{arn:taskDefinitionArn,family:family,revision:revision,status:status,taskRoleArn:taskRoleArn,executionRoleArn:executionRoleArn,runtimePlatform:runtimePlatform,containers:containerDefinitions[].{name:name,image:image,user:user,readOnly:readonlyRootFilesystem,environmentNames:environment[].name,secrets:secrets[].{name:name,valueFrom:valueFrom}}}' \
  --output json
```

If root needs running image digests as well, use `ecs list-tasks --cluster capiro-dev --service-name <one exact service above> --desired-status RUNNING --query taskArns --output json`, then `ecs describe-tasks --cluster capiro-dev --tasks <exact returned ARNs> --query 'tasks[].{arn:taskArn,taskDefinition:taskDefinitionArn,lastStatus:lastStatus,healthStatus:healthStatus,containers:containers[].{name:name,image:image,imageDigest:imageDigest,lastStatus:lastStatus}}' --output json`. Record failures/empty results; do not infer readiness from a successful list call.

### Fresh next revisions for the six Node families

Canonical `parseLatestTsv` requires both ACTIVE and INACTIVE observations for every family. `nextRevisions` selects the maximum observed revision across both statuses and adds one. Do not reuse C's historical `33/32/18/32/31/31`, and do not increment only the running service revision.

The following produces the exact `family<TAB>ARN|None` input expected by `stage3-input`. `READBACK_DIR` is a new local directory for public metadata, supplied by root. A prefix collision is refused by the canonical parser.

```bash
READBACK_DIR='<NEW_LOCAL_PUBLIC_READBACK_DIRECTORY>'
for family in meri-product-preview-control meri-product-preview-temporal-worker \
  meri-product-preview-temporal-issuer meri-product-preview-owner \
  meri-product-preview-proxy meri-product-preview-runner; do
  for status in ACTIVE INACTIVE; do
    arn=$(aws --region us-east-1 --no-cli-pager ecs list-task-definitions \
      --family-prefix "$family" --status "$status" --sort DESC --max-items 1 \
      --query 'taskDefinitionArns[0]' --output text) || exit
    printf '%s\t%s\n' "$family" "$arn"
  done
done > "$READBACK_DIR/latest.tsv"
```

Capture the current outputs of `meri-first-chat-app`, `meri-first-chat-model`, `meri-first-chat-issuer` and `meri-first-chat-private-edge` with `aws --region us-east-1 --no-cli-pager cloudformation describe-stacks --stack-name <exact stack> --query 'Stacks[0].{name:StackName,status:StackStatus,outputs:Outputs}' --output json`. For the canonical bindings input, save the **Outputs array alone** for the foundation and private-edge stacks:

```bash
# Source runbook's read-only foundation discovery; require one exact match.
aws --region us-east-1 --no-cli-pager cloudformation describe-stacks \
  --query "Stacks[?Outputs[?OutputKey=='RunnerExecutionRoleArn']].StackName" --output json

aws --region us-east-1 --no-cli-pager cloudformation describe-stacks \
  --stack-name '<EXACT_EXISTING_FOUNDATION_STACK_FROM_UNIQUE_READBACK>' \
  --query 'Stacks[0].Outputs' --output json > "$READBACK_DIR/foundation-live.json"
aws --region us-east-1 --no-cli-pager cloudformation describe-stacks \
  --stack-name meri-first-chat-private-edge --query 'Stacks[0].Outputs' --output json \
  > "$READBACK_DIR/private-edge-outputs.json"
```

The canonical builder requires these foundation/private-edge outputs to equal the reviewed deployment input. Also compare the task/execution role ARNs in fresh task-definition readbacks with the applicable reviewed foundation role pins; an unexpected role is a review failure, not a replacement value to copy into the candidate. Any drift returns to upstream review. Re-read the six ACTIVE/INACTIVE pairs before an approved mutation that depends on predicted revisions; a concurrent registration or failed deployment can consume a revision and invalidate the rendered pins.

## 2. Neo: secure local inputs and canonical render

Use an exact-source checkout with the actual required locked dependencies available. The public evidence checkout may contain later documentation commits, so use root's clean `5b395d4...` source checkout for canonical rendering. Confirm the published runtime-values file has the verified SHA256 above before Neo starts. The public deployment's Core/frontend placeholders are superseded only by Neo's existing reviewed private core-values file.

Neo selects existing private files on the secure host. Their paths and contents must stay out of the chat, repository and public handoff. The renderer reads the PKI directory's existing certificate/key/database material and the identity credential path named by core-values. No private file was opened while preparing this document.

```bash
set -euo pipefail
umask 077
R='<CLEAN_SOURCE_CHECKOUT_AT_5b395d4ce9218b872b21c420dc00a3af31739824>'
PUBLIC='<PUBLIC_EVIDENCE_DIRECTORY>/public-candidate'
READBACK_DIR='<ROOT_FRESH_PUBLIC_READBACK_DIRECTORY>'
PKI='<EXISTING_PRIVATE_PKI_DIRECTORY>'
CORE='<EXISTING_REVIEWED_PRIVATE_CORE_VALUES_JSON>'
W='<NEW_PRIVATE_WORK_DIRECTORY_OUTSIDE_ALL_REPOSITORIES>'
mkdir -m 700 "$W"

node "$R/infra/product-preview/first-chat/stage3-deploy.mjs" stage3-input \
  --deployment-inputs "$PUBLIC/deployment-inputs.candidate.json" \
  --foundation-outputs "$READBACK_DIR/foundation-live.json" \
  --latest "$READBACK_DIR/latest.tsv" --out "$W/stage3.json"

node "$R/infra/product-preview/first-chat/render-material.mjs" \
  --deployment-inputs "$PUBLIC/deployment-inputs.candidate.json" \
  --private "$PKI" --core "$CORE" --runtime "$PUBLIC/runtime-values.json" \
  --stage3 "$W/stage3.json" --out "$W/rendered"
```

`stage3-input` is local data plumbing; it registers nothing. The render output must be new and outside the repository. The renderer creates directories with mode 0700 and files with mode 0600, validates each role/config/material inventory and emits only summary location and config hashes. On a Windows operator host, enforce equivalent owner-only ACLs; POSIX mode arguments alone do not establish those ACLs.

Keep the existing Core origin, frontend origin, tenant/actor/client binding and identity credential path. If upstream requires rebuilding the local core-values file from an already approved local membership receipt, the supported command is:

```bash
node "$R/infra/product-preview/first-chat/stage3-deploy.mjs" core-values \
  --membership '<EXISTING_APPROVED_LOCAL_MEMBERSHIP_JSON>' \
  --identity '<EXISTING_PRIVATE_IDENTITY_CREDENTIAL_FILE>' \
  --frontend-origin '<EXISTING_REVIEWED_FRONTEND_ORIGIN>' \
  --client-id '<EXISTING_REVIEWED_CLIENT_UUID>' --out "$W/core.json"
```

Then use that file as `--core`. Do not create new identities, fetch bearer values, rotate PKI or change database credentials as part of this handoff. Omit `--feature-secrets`; this candidate has no enabled reads feature configuration. Use a fresh render time and existing validity policy. Certificates, material expiry and predicted task revisions must all be valid; a render refusal is not permission to loosen their checks.

## 3. Approval boundary: private bundle upload

**Stop for explicit upstream approval before any external mutation, including PutSecretValue.** Provide a concrete review package first: root-verified image/runtime evidence, fresh service/revision observations, planned task ARNs, renderer summary/config/material hashes, exact five secret ARNs, proposed unique staging label, and persisted per-role client request tokens. Do not attach or transmit `bundle.json`, private configs, keys, database material, bearer files or real private paths to the assistant/public repository.

After that separate approval, **Neo alone** uploads from the existing secure host. This is a future operator command, not an action executed by this task. Use a new approved label and an idempotent token persisted for each exact role/bundle; never default to AWSCURRENT or reuse another candidate's label/token.

| Render role | Exact existing secret ARN |
| --- | --- |
| control | `arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/control/material-OhIfMV` |
| temporal-worker | `arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/worker/material-1tudsv` |
| temporal-issuer | `arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/issuer/material-MYhacb` |
| model-owner | `arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/owner/material-05kED4` |
| model-proxy | `arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/proxy/material-kpYYOE` |

For each exact ARN, first capture `describe-secret --query '{arn:ARN,kms:KmsKeyId,versions:VersionIdsToStages}'` and `list-secret-version-ids --include-deprecated --query '{arn:ARN,versions:Versions[].{id:VersionId,stages:VersionStages}}'`. Confirm the new label is absent and record the existing AWSCURRENT mapping. Neither command reads a secret value.

```bash
ROLE='<ONE_ROLE_FROM_TABLE>'
SECRET_ARN='<THAT_ROLES_EXACT_ARN_FROM_TABLE>'
LABEL='<NEW_UPSTREAM_APPROVED_UNIQUE_LABEL>'
TOKEN='<PERSISTED_UUID_FOR_THIS_EXACT_ROLE_AND_BUNDLE>'

aws --region us-east-1 --no-cli-pager secretsmanager put-secret-value \
  --secret-id "$SECRET_ARN" --client-request-token "$TOKEN" --version-stages "$LABEL" \
  --secret-string "file://$W/rendered/$ROLE/bundle.json" \
  --query '{arn:ARN,versionId:VersionId,stages:VersionStages}' --output json \
  > "$W/$ROLE.put-metadata.json"
```

Repeat only for the five approved mappings. Record `role<TAB>VersionId` from successful authenticated responses in `$W/secret-versions.tsv`. Re-read version metadata to confirm that exact version has the new label and AWSCURRENT is unchanged. On uncertain outcome, inspect metadata for the original client request token; do not issue a new token or upload different bytes. This candidate does not rotate or upload any Temporal server secret. A proxy material refresh does not change the proxy main image.

## 4. Local bindings and update-compatible template review

After approved uploads produce exact VersionIds, the supported local binding command is:

```bash
node "$R/infra/product-preview/first-chat/stage3-deploy.mjs" bindings \
  --deployment-inputs "$PUBLIC/deployment-inputs.candidate.json" \
  --foundation-outputs "$READBACK_DIR/foundation-live.json" \
  --private-edge-outputs "$READBACK_DIR/private-edge-outputs.json" \
  --rendered "$W/rendered" --secret-versions "$W/secret-versions.tsv" \
  --image-scans "$PUBLIC/image-scans.candidate.json" --out "$W/bindings"
```

`image-scans` contains SHA256 of the reviewed **receipt files**, not image digest strings: the fresh Node producer receipt and unchanged proxy receipt. `bindings` writes app/model/issuer binding JSON, templates and a deployment plan; it makes no AWS calls. Inspect the emitted expected task ARNs against fresh maximum revisions again. All five material roles must come from one coherent render.

The existing C rollout applied an update-compatibility helper after canonical synthesis. Its public record identifies `build-update-compatible-v2.mjs` at commit `5a42ec962677e70e76db5433330b52fd34db5bcd`, path `docs/shipping/20261019/a16cc40d-public-render/build-update-compatible-v2.mjs`, Git blob `8a689fb04e9d410da3543c01157775c5b00f6e9e`, SHA256 `20ce161617d4450c04d55f67d94d298a3018eb0241a89a4af1a3c4640e48b695`. Root recovered that exact public blob; its bytes were inspected and copied unchanged to `public-candidate/build-update-compatible-v2.mjs`, with the same SHA256. The C README's supported command, using this preserved copy, is:

```bash
aws --region us-east-1 --no-cli-pager cloudformation get-template \
  --stack-name meri-first-chat-app --template-stage Original --output json \
  > "$READBACK_DIR/app.live.get-template.json"
node --input-type=module -e 'import fs from "node:fs"; const [input,out]=process.argv.slice(1); const value=JSON.parse(fs.readFileSync(input,"utf8")).TemplateBody; const body=typeof value==="string"?JSON.parse(value):value; if(!body?.Resources?.controlService)throw Error("unexpected live app template"); fs.writeFileSync(out,JSON.stringify(body));' \
  "$READBACK_DIR/app.live.get-template.json" "$READBACK_DIR/app.live.template.json"
node "$PUBLIC/build-update-compatible-v2.mjs" \
  "$READBACK_DIR" "$W/bindings" \
  "$W/update-compatible-v2" "$R"
```

Before using the helper, review its applicability against the freshly retrieved public `app.live.template.json` and the current service readbacks. The inspected helper performs only local file operations: it imports `synthesizeProductPreview` from the supplied exact-source checkout, reads the live control service's public port 8080 target group, and binds that target group into the app synthesis. It explicitly sets control, application Temporal worker, model-owner and model-proxy desired counts to 1; sets control deployment maximum 100 / minimum healthy 0 and availability-zone rebalancing `DISABLED`; sets control's dependency to `runnerTask`; and copies the canonical issuer template. Its output directory must not exist. Those desired counts and rollout settings require explicit review against the fresh live state before any future deployment; running a local helper provides no scale-up or deployment authorization.

No change set, task registration, service update, scale-up, RunTask, model request, database change or deployment is authorized here. Upstream must separately approve the concrete candidate and external mutation plan. If a later approved rollout consumes different revisions, re-render rather than accepting stale task ARN pins. Canonical `stage3-deploy.mjs verify-outputs --bindings <bindings> --app <fresh app Outputs array> --model <fresh model Outputs array> --issuer <fresh issuer Outputs array>` then checks exact rendered-versus-deployed task ARNs; it is a future readback gate, not a deployment command.

## Evidence returned to root

Return only public metadata: selected source/image/runtime file hashes, readback timestamps, observed/current and proposed task ARNs, unchanged proxy/Temporal image comparisons, renderer config/material hashes, secret ARN/VersionId/label metadata, template hashes and unresolved gate outcomes. Retain all private render outputs locally. Root owns final receipt verification, public packet publication and upstream coordination.

Source references: exact-source `render-material.mjs` (CLI, private inputs, role validation, `writeRendered`), `runtime-values.mjs` (`runtimeValues`, `assemble`), `stage3-deploy.mjs` (`parseLatestTsv`, `stage3-input`, `bindings`, `verify-outputs`), `stage3-bindings.mjs` (`nextRevisions`, family/service constants), `manifest.mjs`, `model-proxy-template.mjs`, `first-chat-issuer-service.mjs`, `temporal-binding.mjs`; public C README at the commit above. This author ran no AWS command, read no private file and performed no render, upload or deployment.
