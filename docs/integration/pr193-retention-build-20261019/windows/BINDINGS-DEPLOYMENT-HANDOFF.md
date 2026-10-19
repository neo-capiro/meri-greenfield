# Post-upload local bindings and held deployment handoff

## Accepted upload metadata

Neo alone completed the upload with `PR193_PRIVATE_UPLOAD_VERIFIED_BIND_READY`. Root independently read AWS metadata from **2026-10-19T21:36:12.7035271Z to 21:36:26.6331330Z**. All five versions below have only `FIRST_CHAT_20261019D`. Every prior version ID/stage is preserved, AWSCURRENT and KMS are unchanged, and each secret has exactly one approved addition. Counts are now 35/35/36/35/35 in table order. No secret values were read and no agent AWS mutation occurred. [Verification](../windows-upload-verification/verified/verification-summary.json).

| Role | Confirmed VersionId |
| --- | --- |
| control | `fa20782d-aa2e-4a9f-96d5-5a280c7f6006` |
| temporal-worker | `57ec3646-a266-4bf8-8d8b-0f612ec2f539` |
| temporal-issuer | `82665233-c946-4f4d-a3b7-c83c7530bf36` |
| model-owner | `290f3f19-1dcf-4046-b629-0a116b79fe1b` |
| model-proxy | `e8794017-6bd2-4932-89d1-2441ad8296d2` |

Neo reported render receipt SHA256 `99b01a2ea89e25162fc03a63fca6541d28e926a2e129026a0a2189ee7bd4b649`, upload state SHA256 `3918eb073034231b85c0576ba6e4455ada69466604feaffd41594618f16e2d1e`, approved manifest SHA256 `870bc3e9abd6a53f6da97d220261ccb83ff5f9947ec1be5c8d0623fe54c19c50`, and canonical TSV SHA256 `8cb6bac16a69bfb4b88a561e66273846b6bb1baf532ba7edfcf9e532ee93e257`. Private receipt/state bytes remain with Neo. These hashes are reported operator metadata; remote version/stage preservation was verified separately.

## One local-only Neo command is required

The exact uploaded render, summary and five expected-material records reside under Neo's existing `$out`. Root has not opened that private tree. Run the existing canonical composition there, through the newly reviewed wrapper. This makes no AWS call, upload, fetch, dependency install, task registration or deployment.

Export the exact operator commit given in the completion message to `$bindOps`, keeping its shared helper files together. Reuse `$out`, the same public cache and existing Node 24:

```powershell
& powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File (Join-Path $bindOps 'Invoke-Pr193LocalBindings.ps1') `
  -OutputDirectory $out `
  -PublicCacheRoot (Join-Path $env:LOCALAPPDATA 'Meri\pr193-public')
if ($LASTEXITCODE -ne 0) { throw 'LOCAL_BINDINGS_STOPPED_KEEP_EXISTING_OUTPUTS' }
Get-Content -LiteralPath (Join-Path $out 'local-bindings-receipt.json') -Raw
```

If `node.exe` on PATH is not the Node 24 used by the successful render, pass that existing executable with `-NodePath`. Do not install or replace Node as part of this step. Success is `PR193_LOCAL_BINDINGS_COMPLETE_NO_DEPLOYMENT`.

Return **`local-bindings-receipt.json`** first: it contains source/packet/readback, render/upload/state/TSV/approved-manifest hashes and exactly three template paths, byte counts and hashes. To review the exact template diff, the parent additionally needs only these three generated JSON files, through the existing approved file handoff:

- `update-compatible-v2/app.template.json`
- `update-compatible-v2/model.template.json`
- `update-compatible-v2/issuer.template.json`

Canonical binding/template source accepts public metadata: secret ARN/version references, expected hashes, service/task configuration and public CA material. It does not embed the private bundles or credential values. Do not send the entire `$out`, bundles, configs, key/credential files or upload state. Receipt hashes alone cannot establish the exact template diff. Retain `bindings/deploy-plan.json` and helper `changes.txt` locally for review if a discrepancy needs investigation.

The wrapper refuses existing `bindings/`, `update-compatible-v2/` or final receipt outputs. On any failure keep them for diagnosis; do not delete or rerun blindly. It checks the exact approved manifest on both upload records, all five completed versions, receipt/state/TSV/bundle joins, canonical public/source pins, and all consumed inputs again before final success. Both canonical commands remain unchanged. [Review and focused test evidence](LOCAL-BINDINGS-REVIEW.md).

## Deployment is held for the exact template diff

The reviewed source is `5b395d4ce9218b872b21c420dc00a3af31739824`, public packet `b79d4b0c4b1027757e1d3ad5ca2ed0cbdf05e527`, original render readback `05b73a61cb4f2bbfa52eae38ea23e44598c33e9f`. Candidate Node image is `sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49`. Proxy main remains `sha256:734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551`; all five Temporal server services remain `sha256:f73ce01ef4739a77fad6ace3fbfbbe1f1aeaa553b5c263d705053a2f5063cf2d`.

The last revision readback at 21:16 UTC proposed control34, application worker33, issuer33, owner32, proxy32 and runner19. These are not reservations. The 21:36 secret metadata verification did not recheck ECS revisions or service health. Before any released deployment, refresh both ACTIVE/INACTIVE maxima, stack status, existing service health, foundation/private-edge and role pins, target-group attachments and material validity. Drift is a stop for review, not a replacement value to patch into this render.

Review the actual generated templates against the live original templates. Require five desired counts of 1, the existing public 8080 and private 8082 control target groups, control max100/min0, AZ rebalancing disabled and `DependsOn: runnerTask`. Preserve shared listeners/rules, DNS, network, IAM policies and existing Temporal servers. No SQL, credential changes, new build or added capability activation belongs to this update. Existing model managed-policy resources must be unchanged; `CAPABILITY_IAM` acknowledges their presence and does not authorize changing them.

**Do not execute `bindings/deploy-plan.json` command arguments unchanged.** That canonical plan points to raw `bindings/*.template.json`, which retain count-zero defaults and lack the C helper's public target-group binding. The unchanged C helper writes separate corrected files under `update-compatible-v2/`; only those exact reviewed files are deployment candidates. Its SHA256 remains `20ce161617d4450c04d55f67d94d298a3018eb0241a89a4af1a3c4640e48b695`.

## Future released update sequence

The successful C deployment record at `5a42ec962677e70e76db5433330b52fd34db5bcd`, `docs/shipping/20261019/a16cc40d-public-render/README.md`, establishes **MODEL → ISSUER → APP** for these existing stacks. This supersedes the older initial-create ordering. The helper does not enforce an owner-before-proxy order inside the model stack.

After the parent reviews the exact diff and separately authorizes AWS changes, prepare change sets for `meri-first-chat-model`, `meri-first-chat-issuer` and `meri-first-chat-app` using the corresponding reviewed helper template, `cloudformation deploy --no-execute-changeset --no-fail-on-empty-changeset`, and `CAPABILITY_IAM` only where required by the unchanged model resources. Any template staging/S3 write is also held until that release. Review the actual change-set ARN and resource changes before execution. Do not manually register task definitions.

Execute the released changes in MODEL → ISSUER → APP order, gating each before proceeding: update completion, desired/running/pending 1/1/0, one COMPLETED deployment, exact task/image/material pins, successful material init, applicable runtime readiness, no refusal/configuration/unavailable errors, and survival beyond 200 seconds. Owner/proxy evidence is liveness and Cloud Map registration; do not invent a positive `runtime.listening` signal for them. Use `stack-update-complete` for existing stacks. Do not apply the old create-stack waits, count-zero scale-up steps or delete-stack rollback instructions.

Finally retrieve fresh app/model/issuer Outputs arrays and run the local canonical `stage3-deploy.mjs verify-outputs --bindings <work>/bindings --app <app Outputs> --model <model Outputs> --issuer <issuer Outputs>`. Require `STAGE3_TASK_DEFINITIONS_MATCH_RENDER` for all six task ARNs. A consumed or unexpected revision stops progression. Parent retains deployment coordination and later authenticated desktop acceptance; this handoff executes neither.
