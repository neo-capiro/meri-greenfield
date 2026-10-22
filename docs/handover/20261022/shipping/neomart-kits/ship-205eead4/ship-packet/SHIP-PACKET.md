# Meri first-chat ship packet (pre-deploy)

Packet sha256 `e3ed3f2ecdbc102bfd52524e915b221eae2994ab7784333dd6ee43bc09f5fe88`. Source `205eead4c18882e4fc0e6c016c10dc4e5dd8c45c` replaces `2b4421f612f9fbb728d6da52927aac228d712d40`. Label `FIRST_CHAT_20261022B`.

## Pins

```json
{
 "sourceCommit": "205eead4c18882e4fc0e6c016c10dc4e5dd8c45c",
 "previousSourceCommit": "2b4421f612f9fbb728d6da52927aac228d712d40",
 "images": {
  "nodeRuntime": "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:1f138115e69de0fb8df3c787ed077f50c7828a8e827bdbc5a0d8a6b55d7ab43c",
  "nodeRuntimeSourceCommit": "205eead4c18882e4fc0e6c016c10dc4e5dd8c45c",
  "proxy": "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:dd40ed4dbaaa7843a6d5ecd2655a73d0990613abe8ae93bcbf2e42cd83e16a73",
  "proxySourceCommit": "205eead4c18882e4fc0e6c016c10dc4e5dd8c45c",
  "temporalServer": "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:f73ce01ef4739a77fad6ace3fbfbbe1f1aeaa553b5c263d705053a2f5063cf2d",
  "temporalServerSourceCommit": "989a4227e6da6f176975d798826904d71c3a9f9c"
 },
 "runnerSha256": "174e66b2c24034fc6ccb3a406daa26874a8f3c56164ce80e9d60f419d567f542",
 "executableSha256": "4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358",
 "versions": {
  "sdk": "0.3.295",
  "cli": "2.1.295",
  "contracts": "0.1.0",
  "skillsDigest": "40e6270e9394ebcd86c60ee06f3689d5069ebc04dde0d7b60ece63fd63ce55fa",
  "checkpointFormat": "0.1.0"
 },
 "label": "FIRST_CHAT_20261022B",
 "taskDefinitions": {
  "control": "arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-control:48",
  "temporal-worker": "arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-worker:47",
  "temporal-issuer": "arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-temporal-issuer:47",
  "model-owner": "arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-owner:46",
  "model-proxy": "arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-proxy:46",
  "runner": "arn:aws:ecs:us-east-1:967807252336:task-definition/meri-product-preview-runner:33"
 },
 "inputs": {
  "deployment-inputs": "e9eb57c204c14ab228f888668b30b818bc453aaad5492736851c1ed72db4284a",
  "previous-deployment-inputs": "4c7f8adfafc6eb3ed7b9e65b8a0ee7d940a40269f903f7127b30111b68869a54",
  "runtime": "b227481d30a8e4327ca55f2e6a66c0d9671ddf62250866272485469cf8893bf2",
  "node-receipt": "c87fbcb156929d24d17f60e267a9205fdbf54c0e2fbcc26144610185f8b90ea7",
  "image-scans": "a4adf7329cc1b2fe4ec2bd1f0808369551cb36659e434ef6bf0a7f8ca9df5ec7",
  "stage3": "ffa0644152ffeef715f0fa56445007301369a2e71cf77dca95bad588ebf91668",
  "upload-plan": "e1c140924b45c9b40a3b212d037e2c3e462ae0cf470c8ba0a9e95f36155ac171"
 },
 "templates": {
  "model": {
   "sha256": "919edca2118a197a094b4a6b0170368842d0d6a16d94e4471e2b7a8953f585ae",
   "bytes": 16281
  },
  "issuer": {
   "sha256": "85aab335c05d10d76e85a14342cce1de85bfbcb2f9256f7dd467e0c576aa459f",
   "bytes": 5922
  },
  "app": {
   "sha256": "ff9ee7833bf1cedaf336bf86a44b233c5127e21140d281f39b0d2cb5b00e06d2",
   "bytes": 14505
  }
 }
}
```

## Evidence

```json
{
 "producerBuild": "meri-greenfield-qualification-build:f800e453-66b6-43bb-8313-1594803dd401",
 "scanStatus": "COMPLETE",
 "findingSeverityCounts": {
  "UNDEFINED": 2
 },
 "glibcVersion": "2.44",
 "nodeVersion": "v24.21.0",
 "archiveSha256": "275a24a2ab2500817116d23c49eeeb14acb83158539ef1553372dd5f3f57e2c3",
 "sourceManifestSha256": "c5c009587576be3a9b9b188cabf8026812db04aacacc9e5b51ab471db7f01e8c",
 "required": [
  "24/24 Linux cases B01-B06 R01-R06 W01-W12 in the producer",
  "launch measurement: 7/7 gates PASS and MEASUREMENT_VERIFIED_AND_ASSEMBLED",
  "independent review of the measurement result"
 ]
}
```

## Migrations

1 new entries must be applied first:

- OWNER_READS_SCRIPT `b05b88f0657b8b10681ac612101b9fca505ae2d6fef65b53866d92e269afdf18`

## Cost limits

```json
{
 "cycleCeilingUsd": 5,
 "perRunMaxUsd": 2,
 "maxTurns": 3,
 "tenantMonthlyCapUsd": 25,
 "tenantMaxConcurrentRuns": 2,
 "rule": "no CodeBuild retry, no fresh chat or model request without its own authorization; an uncertain submission is observed, never resubmitted"
}
```

## Steps

### 1. Revisions unchanged since stage3.json (any registration in between forces a new render)

```bash
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-control --status ACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-control --status INACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-temporal-worker --status ACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-temporal-worker --status INACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-temporal-issuer --status ACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-temporal-issuer --status INACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-owner --status ACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-owner --status INACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-proxy --status ACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-proxy --status INACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-runner --status ACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
aws ecs list-task-definitions --region us-east-1 --family-prefix meri-product-preview-runner --status INACTIVE --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text
```

Gate: the highest ACTIVE/INACTIVE revision of every family is one below stage3.json taskDefinitions (an unchanged runner keeps its revision)

### 2. Apply 1 new migration(s) (stage meri) before any stack update

```bash
node infra/product-preview/first-chat-migrate.mjs plan   # offline: confirms the planned files and hashes
```

Gate: the d2-migrate one-shot task (docs/shipping/20261017/D2-DATABASE.md; its task definition is not in this repository) reports the ledger as the exact plan prefix

### 3. Stage the five rendered bundles under FIRST_CHAT_20261022B (AWSCURRENT does not move)

```bash
aws secretsmanager put-secret-value --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/control/material-OhIfMV --client-request-token 77814206-4259-46d7-8ba4-cc555b31ac9a --version-stages FIRST_CHAT_20261022B --secret-string 'file://C:\dev\fable\meri-stage3-20261022T121427Z\rendered\control\bundle.json' --query VersionId --output text   # append "control<TAB>VersionId" to C:\dev\fable\meri-stage3-20261022T121427Z\secret-versions.tsv; on an uncertain outcome resend this exact command
aws secretsmanager list-secret-version-ids --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/control/material-OhIfMV --include-deprecated --max-results 100
aws secretsmanager put-secret-value --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/worker/material-1tudsv --client-request-token dc659fbb-c7b9-45c2-8c2d-114a5a0c24b7 --version-stages FIRST_CHAT_20261022B --secret-string 'file://C:\dev\fable\meri-stage3-20261022T121427Z\rendered\temporal-worker\bundle.json' --query VersionId --output text   # append "temporal-worker<TAB>VersionId" to C:\dev\fable\meri-stage3-20261022T121427Z\secret-versions.tsv; on an uncertain outcome resend this exact command
aws secretsmanager list-secret-version-ids --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/worker/material-1tudsv --include-deprecated --max-results 100
aws secretsmanager put-secret-value --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/issuer/material-MYhacb --client-request-token 237dc8b9-d517-455e-a6c2-badd6c155a4b --version-stages FIRST_CHAT_20261022B --secret-string 'file://C:\dev\fable\meri-stage3-20261022T121427Z\rendered\temporal-issuer\bundle.json' --query VersionId --output text   # append "temporal-issuer<TAB>VersionId" to C:\dev\fable\meri-stage3-20261022T121427Z\secret-versions.tsv; on an uncertain outcome resend this exact command
aws secretsmanager list-secret-version-ids --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/issuer/material-MYhacb --include-deprecated --max-results 100
aws secretsmanager put-secret-value --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/owner/material-05kED4 --client-request-token 6ee2a06b-8ef3-405c-a792-4a7bbc24205b --version-stages FIRST_CHAT_20261022B --secret-string 'file://C:\dev\fable\meri-stage3-20261022T121427Z\rendered\model-owner\bundle.json' --query VersionId --output text   # append "model-owner<TAB>VersionId" to C:\dev\fable\meri-stage3-20261022T121427Z\secret-versions.tsv; on an uncertain outcome resend this exact command
aws secretsmanager list-secret-version-ids --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/owner/material-05kED4 --include-deprecated --max-results 100
aws secretsmanager put-secret-value --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/proxy/material-kpYYOE --client-request-token cc3ea069-b87e-4894-8196-7f3d455e618f --version-stages FIRST_CHAT_20261022B --secret-string 'file://C:\dev\fable\meri-stage3-20261022T121427Z\rendered\model-proxy\bundle.json' --query VersionId --output text   # append "model-proxy<TAB>VersionId" to C:\dev\fable\meri-stage3-20261022T121427Z\secret-versions.tsv; on an uncertain outcome resend this exact command
aws secretsmanager list-secret-version-ids --region us-east-1 --secret-id arn:aws:secretsmanager:us-east-1:967807252336:secret:meri/preview/proxy/material-kpYYOE --include-deprecated --max-results 100
```

Gate: five new versions carry only FIRST_CHAT_20261022B; each secret's other labels equal its labelsBefore in the upload plan (AWSCURRENT unmoved)

### 4. Live readbacks, then bindings and the update templates

```bash
aws cloudformation get-template --region us-east-1 --stack-name meri-first-chat-app --template-stage Original --query TemplateBody --output json > 'C:\dev\fable\meri-stage3-20261022T121427Z\app.live.template.json'
aws cloudformation describe-stacks --region us-east-1 --stack-name '<foundation stack>' --query 'Stacks[0].Outputs' > 'C:\dev\fable\meri-stage3-20261022T121427Z\foundation-live.json'
aws cloudformation describe-stacks --region us-east-1 --stack-name '<private-edge stack>' --query 'Stacks[0].Outputs' > 'C:\dev\fable\meri-stage3-20261022T121427Z\private-edge-outputs.json'
node infra/product-preview/first-chat/stage3-deploy.mjs bindings --deployment-inputs <deployment-inputs.json> --foundation-outputs 'C:\dev\fable\meri-stage3-20261022T121427Z\foundation-live.json' --private-edge-outputs 'C:\dev\fable\meri-stage3-20261022T121427Z\private-edge-outputs.json' --rendered 'C:\dev\fable\meri-stage3-20261022T121427Z\rendered' --secret-versions 'C:\dev\fable\meri-stage3-20261022T121427Z\secret-versions.tsv' --image-scans <image-scans.json> --live-app-template 'C:\dev\fable\meri-stage3-20261022T121427Z\app.live.template.json' --out 'C:\dev\fable\meri-stage3-20261022T121427Z\bindings'
```

Gate: STAGE3_BINDINGS_WRITTEN; rerun this packet with --bindings to pin the template hashes

### 5. meri-first-chat-model: change set, review, execute, wait

```bash
aws cloudformation deploy --region us-east-1 --stack-name meri-first-chat-model --template-file 'C:\dev\fable\ship-205eead4\bindings\model.template.json' --capabilities CAPABILITY_IAM --no-execute-changeset --no-fail-on-empty-changeset
aws cloudformation describe-change-set --region us-east-1 --change-set-name '<change set ARN printed above>'
aws cloudformation execute-change-set --region us-east-1 --change-set-name '<change set ARN printed above>'
aws cloudformation wait stack-update-complete --region us-east-1 --stack-name meri-first-chat-model
aws ecs wait services-stable --region us-east-1 --cluster capiro-dev --services meri-product-preview-owner meri-product-preview-proxy
aws servicediscovery list-instances --region us-east-1 --service-id srv-fqjjiu4dmuqsg5mo
aws servicediscovery list-instances --region us-east-1 --service-id srv-dv43rzktx7mvrh6m
aws logs filter-log-events --region us-east-1 --log-group-name /meri/product-preview/owner --start-time '<deploy start ms>' --filter-pattern '"PRODUCT_OWNER_UNAVAILABLE"' --query 'events[].message' --output text   # set MSYS_NO_PATHCONV=1 in Git Bash
aws logs filter-log-events --region us-east-1 --log-group-name /meri/product-preview/proxy --start-time '<deploy start ms>' --filter-pattern '"REFUSED"' --query 'events[].message' --output text   # set MSYS_NO_PATHCONV=1 in Git Bash
```

Gate: owner and proxy 1/1/0 on the new revisions, RUNNING past 120 s, one Cloud Map instance each; one owner restart (PRODUCT_OWNER_UNAVAILABLE ~184 s) is expected while the old proxy overlaps, its replacement must pass

### 6. meri-first-chat-issuer: change set, review, execute, wait

```bash
aws cloudformation deploy --region us-east-1 --stack-name meri-first-chat-issuer --template-file 'C:\dev\fable\ship-205eead4\bindings\issuer.template.json' --no-execute-changeset --no-fail-on-empty-changeset
aws cloudformation describe-change-set --region us-east-1 --change-set-name '<change set ARN printed above>'
aws cloudformation execute-change-set --region us-east-1 --change-set-name '<change set ARN printed above>'
aws cloudformation wait stack-update-complete --region us-east-1 --stack-name meri-first-chat-issuer
aws ecs wait services-stable --region us-east-1 --cluster capiro-dev --services meri-product-preview-temporal-issuer
aws logs filter-log-events --region us-east-1 --log-group-name /meri/product-preview/issuer --start-time '<deploy start ms>' --filter-pattern '"runtime.listening"' --query 'events[].message' --output text   # set MSYS_NO_PATHCONV=1 in Git Bash
```

Gate: issuer runtime.listening on the new revision; from here the running control and worker are refused until the app update lands: continue immediately

### 7. meri-first-chat-app: change set, review, execute, wait

```bash
aws cloudformation deploy --region us-east-1 --stack-name meri-first-chat-app --template-file 'C:\dev\fable\ship-205eead4\bindings\app.template.json' --no-execute-changeset --no-fail-on-empty-changeset
aws cloudformation describe-change-set --region us-east-1 --change-set-name '<change set ARN printed above>'
aws cloudformation execute-change-set --region us-east-1 --change-set-name '<change set ARN printed above>'
aws cloudformation wait stack-update-complete --region us-east-1 --stack-name meri-first-chat-app
aws ecs wait services-stable --region us-east-1 --cluster capiro-dev --services meri-product-preview-control meri-product-preview-temporal-worker
aws logs filter-log-events --region us-east-1 --log-group-name /meri/product-preview/control --start-time '<deploy start ms>' --filter-pattern '"runtime.listening"' --query 'events[].message' --output text   # set MSYS_NO_PATHCONV=1 in Git Bash
aws logs filter-log-events --region us-east-1 --log-group-name /meri/product-preview/worker --start-time '<deploy start ms>' --filter-pattern '"runtime.listening"' --query 'events[].message' --output text   # set MSYS_NO_PATHCONV=1 in Git Bash
aws elbv2 describe-target-health --region us-east-1 --target-group-arn arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8082/1732509ee5fbf759
aws elbv2 describe-target-health --region us-east-1 --target-group-arn arn:aws:elasticloadbalancing:us-east-1:967807252336:targetgroup/meri-preview-control-8080/03297203fa59801c
```

Gate: exactly one control task, worker 1/1/0, both runtime.listening, both target groups healthy; no RUNTIME_UNAVAILABLE, RUNTIME_CONFIGURATION, STATIC_INIT_* or *_REFUSED; tasks alive after 200 s

### 8. Every deployed task definition is the rendered revision

```bash
aws cloudformation describe-stacks --region us-east-1 --stack-name meri-first-chat-model --query 'Stacks[0].Outputs' > 'C:\dev\fable\meri-stage3-20261022T121427Z\model.outputs.json'
aws cloudformation describe-stacks --region us-east-1 --stack-name meri-first-chat-issuer --query 'Stacks[0].Outputs' > 'C:\dev\fable\meri-stage3-20261022T121427Z\issuer.outputs.json'
aws cloudformation describe-stacks --region us-east-1 --stack-name meri-first-chat-app --query 'Stacks[0].Outputs' > 'C:\dev\fable\meri-stage3-20261022T121427Z\app.outputs.json'
node infra/product-preview/first-chat/stage3-deploy.mjs verify-outputs --bindings 'C:\dev\fable\meri-stage3-20261022T121427Z\bindings' --app 'C:\dev\fable\meri-stage3-20261022T121427Z\app.outputs.json' --model 'C:\dev\fable\meri-stage3-20261022T121427Z\model.outputs.json' --issuer 'C:\dev\fable\meri-stage3-20261022T121427Z\issuer.outputs.json'
```

Gate: STAGE3_TASK_DEFINITIONS_MATCH_RENDER for all six task definitions; a mismatch means re-render, never patch

## Smoke

```bash
curl --fail --max-time 10 https://meri-preview.capiro.ai/health/live
# a chat is a separate, explicitly authorized acceptance (plan D3: two turns, reconnect, stop, isolation); this packet authorizes none
```

## Rollback

forward redeploy: the rendered material pins exact task-definition revisions and a failed or rolled-back update burns them, so UpdateService to an old revision cannot roll back

- readback revisions
- render all five roles with the previous images and runtime values
- upload under a NEW label
- bindings
- model, issuer, app with the gates above
- verify-outputs

## Cleanup

- deregister any probe task definition used for diagnosis
- keep the private working directory, tokens and upload receipts for audit
- keep earlier secret versions; each secret holds at most 100 versions
- CloudFormation deregisters the replaced task-definition revisions

## Risks

- the static candidate grant and deadline expire 15 minutes after render (real chats use dynamic runs)
- material validity is 7 days after render: owner and proxy refuse to start after that, so re-render before then
- every render re-mints grants: conversations admitted under the previous render refuse (SESSION_REFUSED)
- between the issuer and app updates control and the worker are refused (RUNTIME_UNAVAILABLE): run the app update immediately
- worker AZ rebalancing stays ENABLED (only control changes); a first worker task can be refused while the old one overlaps
- owner, proxy and Core authority have no positive readiness signal: only a real chat proves Core authority
