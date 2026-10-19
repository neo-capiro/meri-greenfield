# a16cc40d preview deployment record (2026-10-19)

Public record of the live Meri product-preview rollout completed 18:13 UTC on 2026-10-19. Everything here is public: image digests, commit IDs, secret ARNs and version IDs, template hashes. Private render bundles, PKI, Core identity and database inputs stay only on the operator host and are referenced below as `<private …>` placeholders.

## What is deployed

| Item | Value |
| --- | --- |
| Node runtime image | `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:9bff84ba24959130e63e64b2ac72783144053084168fcf14f4344f4dd8583717` |
| Node image source commit | `a16cc40d2a7ca3695eb6cc5a8d45440d0c40d040` (branch `fable/source348-linux-case-set-20261019`) |
| Node image build | CodeBuild `meri-greenfield-qualification-build:f20d6e0d-abc7-41e5-92e8-036d6cbecb24`; receipt `node-product-image-receipt.json` here (sha256 `0146a886…41dc`), `scanStatus: COMPLETE`, zero findings |
| Proxy runtime image | `…/qualification-worker@sha256:734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551` (source `34851020aa0d73fead4db59ba6e26a098e2d0313`, unchanged) |
| Task definitions | control:33, temporal-worker:32, runner:18, temporal-issuer:32, owner:31, proxy:31 |
| Secret label | `FIRST_CHAT_20261019C` (AWSCURRENT untouched) |

Secret versions (pinned by version ID in the task definitions):

| Role | Secret | Version |
| --- | --- | --- |
| control | `meri/preview/control/material-OhIfMV` | `1ef98de4-6155-4d3d-9283-d5eaafc5846f` |
| temporal-worker | `meri/preview/worker/material-1tudsv` | `ade84123-8404-4f23-b30a-829da9fc348c` |
| temporal-issuer | `meri/preview/issuer/material-MYhacb` | `e0d0fe97-c5db-48eb-b397-e75d58d6ad2a` |
| model-owner | `meri/preview/owner/material-05kED4` | `eae1bf25-23d7-4e14-b272-ae394eed37a4` |
| model-proxy | `meri/preview/proxy/material-kpYYOE` | `699ed693-4f69-4feb-a63e-ab1687ca8fc9` |

Rendered config sha256: owner `d3acc10fca474d21c4a3cf8e97a1c0e22c70d9fd480033e755c234f0fc8d22ac`, proxy `8867d7a9876b4a230f2263ef4f583d317a4bddfdb5c13ef3b361fbc9d6cca148`, issuer `f568046d692296c1a2faa3f3d3fbba53199d4ae34f42402e973c6f537e0e728b`, control `132cffbc4bdf84cf36322494f82d8e3807006202ec86ebaea074b1790e15f4bb`, worker `b24ec25d9670fb8cd543344d390c65b25cd97c1c96ac5db3b3f11e3d9399aa3c`. Bundle validity notAfter 2026-10-26T17:46:23Z.

Executed change sets (templates built by `build-update-compatible-v2.mjs`):

| Stack | Template sha256 | Change set |
| --- | --- | --- |
| `meri-first-chat-model` | `b6a045fddab4ff2699501ecc7684ce6ba6b75d7b638800c5fe3387fdcf54c1e8` | `…changeSet/awscli-cloudformation-package-deploy-1792432078/7c390326-f583-46dd-b8a2-ec7d06272f13` |
| `meri-first-chat-issuer` | `5ff211c2737078ac96dcfa378a49a1e04995a7dd705db0e8a6ecee909bcbafeb` | `…changeSet/awscli-cloudformation-package-deploy-1792432089/f382b621-9468-4b0a-b09b-42727de43959` |
| `meri-first-chat-app` | `8d310aa255614f8a7b4e5bc22e3e04b804348938630639d209519f3fdcd16776` | `…changeSet/awscli-cloudformation-package-deploy-1792432095/4d60e139-51f5-4f53-8a6a-e28308355efb` |

## Files in this directory

| File | sha256 | Purpose |
| --- | --- | --- |
| `deployment-inputs.candidate.json` | `0232304892929be91435889b33d86032f0febf178eb2d407a62079f8d092bb88` | `source348-public-render/deployment-inputs.candidate.json` with only `images.nodeRuntime` and `images.nodeRuntimeSourceCommit` changed |
| `image-scans.candidate.json` | `f8a4362cbc71fdb012b58d2c031d73a62b8632771239564f37ce016d230bbc2f` | `nodeRuntime` → sha256 of the build receipt; `proxy` unchanged |
| `runtime-values.candidate.json` | `2ce1ec5dc36a1beeacaf0ec09ff534bfef5febaeeaa6b7a71c474318540ff06c` | only `preparationIntent.runnerSha256` → `166742d9…96f5` (git blob of `apps/runtime/conversation-runner.mjs` at `a16cc40d`, equal to the receipt's runner measurement). `executableSha256` stays `4503bfe1…`: re-measured in the image and SDK lockfiles are identical `34851020..a16cc40d` |
| `node-product-image-receipt.json` | `0146a886bd8b47f66e83bc6a2406b71c59f01297c6eb781ca88bc2122f3741dc` | producer receipt from S3 `results/product-image/a16cc40d…/fa027e7a…/` |
| `build-update-compatible-v2.mjs` | `20ce161617d4450c04d55f67d94d298a3018eb0241a89a4af1a3c4640e48b695` | post-processes the frozen synthesizer output: public 8080 TG binding, DesiredCount 1, control max100/min0 + `AvailabilityZoneRebalancing: DISABLED`, `DependsOn: [runnerTask]` |

## Command sequence used (private paths as placeholders)

Source and render checkout: `meri-greenfield` at `26e8d7b216b0e0ea0c01c101beef9314d5db80a9` (render tooling under `infra/product-preview/first-chat/` and `manifest.mjs` is byte-identical to `a16cc40d`).

1. **Seal and upload the image source:** `python3 -I -B -S infra/product-preview/image-build-source.py seal --repository <checkout at commit> --commit <commit> --archive <packet>/product-source.zip --output <packet>/product-source-members.json`. Then the create-only upload from `docs/handover/20261017/fable-shipping/scripts/qualify-start.sh` (`put-object --if-none-match '*'`, SHA-256 checksum, KMS) to `s3://meri-greenfield-qual-build-967807252336-us-east-1/inputs/product-runtime/<commit>/`.
2. **Build:** the schema-v2 request, `verify`, `createProductImageBuildRecipe()` and a single `start-build` exactly as in `docs/integration/scripts/qualify-restart.sh`, with the repo path set to a clean checkout at the commit.
3. **Render** (operator host only): `stage3-deploy.mjs core-values` → `stage3-input` (the expected pins must match) → `render-material.mjs --deployment-inputs <this dir>/deployment-inputs.candidate.json --runtime <this dir>/runtime-values.candidate.json --private <private PKI> --core <private core.json> --stage3 <work>/stage3.json --out <work>/rendered`, then `verify-rendered.mjs` with both image digests.
4. **Upload secrets** (Neo only): `put-secret-value` per role with a new label, AWSCURRENT preflight, idempotent client request tokens.
5. **Bindings:** `stage3-deploy.mjs bindings --deployment-inputs <this dir>/deployment-inputs.candidate.json --foundation-outputs infra/product-preview/first-chat/foundation-outputs.json --private-edge-outputs <describe-stacks meri-first-chat-private-edge Outputs> --rendered <work>/rendered --secret-versions <work>/secret-versions.tsv --image-scans <this dir>/image-scans.candidate.json --out <work>/bindings`.
6. **Templates:** `node build-update-compatible-v2.mjs <dir with app.live.template.json from the original app stack> <work>/bindings <work>/update-compatible-v2 <checkout>`.
7. **Change sets:** `aws cloudformation deploy --stack-name meri-first-chat-{model,issuer,app} --template-file <work>/update-compatible-v2/<stack>.template.json [--capabilities CAPABILITY_IAM for model] --no-execute-changeset --no-fail-on-empty-changeset`. Execute MODEL → ISSUER → APP, gating each on 1/1/0, a single COMPLETED deployment, init `ready:true`, `runtime.listening`, no `RUNTIME_UNAVAILABLE`/`PRODUCT_OWNER_*`, and survival past 200 s.
