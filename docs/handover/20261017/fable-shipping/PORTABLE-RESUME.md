# Portable Fable checkpoint — 17 October 2026

## Final ownership and first milestone

Fable owns **all Meri runtime/services/tools/documents/memory/settings/routines and Meri-specific UI**, including the remaining accepted Meri backlog. The first milestone is a **deployed, connected preview with usable desktop chat**, returning full source/image/config pins and health evidence to dot. Mobile and previously deferred advanced capabilities remain in Fable's accepted backlog; they are not gates for that first milestone.

Dot retains **Core, backend cleanup, Portfolio, non-Meri Modules/Settings, shared frontend and deployment coordination**, followed by live authenticated E2E acceptance. Shared authentication, Core listeners, database migration IDs and shared files require explicit coordination. There must be one deployment owner for each resource; Fable must coordinate any Core or shared-resource activation with dot. This scope allocation does not enable a held service, waive qualification or authorize an unallocated build.

This is the operational entry point for the **02:17 UTC safe-stop**. Fable takes Meri on another machine. Dot retains Core/frontend coordination and the real authenticated prompt → streamed answer → saved conversation → reload acceptance. Fable must explicitly coordinate any Core activation with dot. Earlier 01:34 dot-shipping wording in dated receipts is historical. No new Meri image attempt, upload, activation, credential, or permission change was made for this handoff.

## What to select

The immutable commit containing this file retains the portable handoff above exact **source-only remediation candidate `31edd91a5762dd0a5909e541f815a25d7789fcc9`**, tree `7dd63badb808acd12716ea8269b70bf1bcaeb0ab`. Read its exact SHA from the immutable URL supplied by the outgoing owner; use that SHA, not remote main, for the candidate. The source candidate parent is published scan-fix `6fd48c9c3d49962a111e7f801f9f71ad06a7f1c9` (PR101). That fix bounds pending `ScanNotFoundException` polling; it has not been imaged. The candidate adds a separate digest-pinned Wolfi final base, signed package install and native/provenance checks. **Actual apk install, final-image native compatibility, final 24-case gate, clean scan and release acceptance are UNRUN.**

| Repository | Current source to inspect | Image qualification |
|---|---|---|
| neo-capiro/meri-greenfield | Candidate31edd91; parent6fd48c9; stack PR89→90→91→92→93→94→97→98→101 | Last consumed image is38f52df9, terminal FAILED, HIGH3; no accepted Meri image |
| neo-capiro/capiro-frontend | PR60 `8fd2c4c4556e5fed37da012293a4f1b4d2088d14`, tree `c52e8147` prefix |8fd2 is not sealed/built. Qualified source remains `e0b47a34d00b8c181420188ed39a1d849e25ec0a` |
| neo-capiro/capiro-backend | PR48 image source `6542f5b089656b6d255465edd464d06c2a0b408f` | Qualified image exists; held service0/0/0; no authenticated public acceptance |

Full ancestry/pins and separately excluded lanes are in [the lane inventory](FINAL-LANE-INVENTORY.json), [source inventory](meri-source-inventory.json), and [owner links](OWNER-HANDOFF-LINKS.json). Do not merge read/preferences/Planner/funding stacks into this candidate implicitly.

The later conditional frontend source-only checkpoint is draft PR64, head `4f820f588386e6b023f55714c0e6c11091ecef63`, tree `bf797704f972a7d00a46f1a33cddffe2894161e7`: [portable issuer/image HOLD](https://github.com/neo-capiro/capiro-frontend/blob/4f820f588386e6b023f55714c0e6c11091ecef63/docs/non-meri-continuation-20261016/PR60-ISSUER-AND-IMAGE-HOLD-20261017.md). It retains focused buildspec/archive-verifier tools and sanitized retrieval commands. It is not an image or activation; PR60 8fd2 remains the published read-binding baseline and e0 remains the qualified image. Dot owns reconciliation of this frontend successor.

## Fresh host setup

Use existing authorized GitHub and AWS sessions on Fable's machine. **Never copy `.aws`, credentials, tokens, private keys, browser sessions or jump-box configuration.** Do not create credentials or assume profiles named `default` or `capiro-dev` exist. Choose the receiving machine's existing profile explicitly.

Prerequisites: Git, Node24 for source checks, Python3.12+ standard library, AWS CLI v2; authorized Linux amd64 Docker/BuildKit for future image work. The image pins Node **v24.21.0**; outgoing source checks used24.19.0. No local Docker daemon/install or database is required just to inspect this checkpoint. Use unused checkout/output paths; preserve existing work and local-only commits.

```sh
mkdir capiro-fable-checkpoint
cd capiro-fable-checkpoint
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/meri-greenfield.git
git -C meri-greenfield fetch origin handoff/meri-portable-fable-20261017
# Replace HANDOFF_FULL_SHA with the immutable SHA delivered with this file.
git -C meri-greenfield switch --detach HANDOFF_FULL_SHA
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/capiro-frontend.git
git -C capiro-frontend fetch origin feat/meri-first-chat-bootstrap-preview-20261016
git -C capiro-frontend switch --detach 8fd2c4c4556e5fed37da012293a4f1b4d2088d14
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/capiro-backend.git
git -C capiro-backend fetch origin feat/core-preview-alpine-amd64-qualification-20261016
git -C capiro-backend switch --detach 6542f5b089656b6d255465edd464d06c2a0b408f
git -C meri-greenfield status --short
node --version
python3 --version
aws --version
```

For exact older objects, fetch the published PR refs listed in the inventories. A shallow clone may not contain every predecessor; absence locally is not lost source. No global Git trust or permission change is required.

## Source checks and retained public inputs

[SOURCE-CANDIDATE-CHECKS.md](SOURCE-CANDIDATE-CHECKS.md) contains portable POSIX/PowerShell commands and the scoped provenance loader. Results are36/36 image-build,11/11 Python diagnostics,23/23 helper/probe, and7/7 comparator-only provenance with its disclosed sparse dependency fixture. Full dependency-joined provenance remains unrun. [CONTRACT-REPRODUCTION.md](CONTRACT-REPRODUCTION.md) reconstructs the historical frontend0.1.8/Meri0.1.7 comparison from Git; all five expanded initial-input schemas agree. No frontend wire edit or package bump is established by this base remediation.

```sh
cd meri-greenfield
python3 -I -B -S docs/handover/20261017/fable-shipping/verify-runtime-package-inputs.py
node docs/handover/20261017/fable-shipping/scripts/verify-public-index-signature.mjs --verify
python3 -I -B -S docs/handover/20261017/fable-shipping/scripts/aws-readonly-checkpoint.py --help
git diff --check
```

The exact public signed index, four APKs and public signing key are retained in [runtime-package-inputs](runtime-package-inputs/README.md). They contain no credentials. The current candidate fetch helper still downloads the hash-pinned mutable upstream index; **if it rotates, Fable must add/review consumption of this retained snapshot before a paid build, or perform a separately reviewed re-pin.** Do not weaken hash/signature checks. The `.dockerignore` candidate now narrowly admits the new runtime lock; all other infra and the retained docs cache stay outside the Docker context.

The contract extractor intentionally disables lazy Git fetch. Before using it after a partial clone, hydrate its exact historical inputs with the receiving machine's existing authorized Git session. From the Meri checkout, use a new private directory outside Git (POSIX example):

```sh
mkdir -m 700 ../fable-private-hydration
git -C ../capiro-frontend fetch origin e0b47a34d00b8c181420188ed39a1d849e25ec0a 6d796834aab693e90a3a052548c4c51a03ebe3c3
git -C ../capiro-frontend archive --format=tar --output=../fable-private-hydration/frontend-vendor.tar e0b47a34d00b8c181420188ed39a1d849e25ec0a vendor/capiro-meri-contracts-0.1.8.tgz
git -C ../capiro-frontend archive --format=tar --output=../fable-private-hydration/frontend-plan.tar 6d796834aab693e90a3a052548c4c51a03ebe3c3 docs/non-meri-continuation-20261016/FIRST-CHAT-PREVIEW-BINDING-PLAN-20261017.md
git archive --format=tar --output=../fable-private-hydration/meri-contract-source.tar 38f52df94b1738649776792b2a28aac743801c19 packages/contracts apps/control/conversations
```

The archives are only a hydration aid; the extractor reads authenticated local Git objects. Do not print binary objects to a terminal or use text-transcoding shell redirection. Full object identities and expected hashes are in CONTRACT-REPRODUCTION; missing local objects must be provisioned before the offline extractor, never treated as absent product source.

The [base report](../../../../infra/product-preview/RUNTIME-BASE-REMEDIATION-20261017.md) and its evidence JSON preserve exact base/packages and CVE fix evidence. Three findings on the old image are CVE-2026-85091(zlib), CVE-2026-19499(glibc), CVE-2026-5435(glibc). Bundled Node zlib has a separate bounded source question; no final-ELF/exploitability disposition was made. Keep the zero HIGH/CRITICAL gate. No vulnerability waiver is granted.

## AWS access and read-only prerequisites

Neo confirms the receiving client already has AWS CLI access. Select its existing profile:

```sh
export FABLE_AWS_PROFILE='YOUR_EXISTING_AUTHORIZED_PROFILE'
export AWS_MAX_ATTEMPTS=1 AWS_PAGER=''
aws --profile "$FABLE_AWS_PROFILE" --region us-east-1 sts get-caller-identity
```

Require **account967807252336** and **regionus-east-1**. The receiving ARN may differ from the jump-box user. STS alone proves neither service permissions nor permission to ship. The portable read-only helper checks STS before other reads and retains selected metadata in a new private directory outside Git:

```sh
python3 -I -B -S docs/handover/20261017/fable-shipping/scripts/aws-readonly-checkpoint.py resources \
  --profile "$FABLE_AWS_PROFILE" --output-directory ../fable-private-resource-readback
python3 -I -B -S docs/handover/20261017/fable-shipping/scripts/aws-readonly-checkpoint.py evidence \
  --profile "$FABLE_AWS_PROFILE" --output-directory ../fable-private-consumed-evidence
```

These scripts were syntax/help checked at safe-stop; **their AWS calls were not executed on Fable's machine**. They are read-only scaffolding, not an activation or full policy verifier. Compare new reads against the committed [resource baseline](resource-baseline/README.md): same project/role trust/15-statement inline policy/no attached policies, immutable ECR/scanOnPush/KMS, build30min/queue5min, Linux standard7 SMALL privileged, no VPC/cache. Reconcile any active/newer build or policy drift. Do not broaden IAM or recreate missing resources. Required reads: STS; CodeBuild project/build history; IAM role/trust/inline/attached policies; ECR repository/image/all scan pages; KMS key metadata; S3 version/checksum/encryption; CloudWatch exact build logs; CloudTrail exact event if available. Failure is a permission/owner blocker, not a reason to configure credentials.

Future write permissions (conditional S3 input puts, KMS encryption/data key, exact one CodeBuild start and pass-role if required) need a fresh approved operation plan. No write is used as a permission probe. The committed baseline is historical, not a template to apply.

## Retrieve private evidence without the jump box

Consumed build: `meri-greenfield-qualification-build:5b67476a-5b30-43a7-9957-d83c72525aa2`, source38f, attempt`f238e6f45da84885bd2e3c0b6a0fa92f`, end01:44:10.906UTC, FAILED/ECR_SCAN, cleanupOK. All24 Linux cases were enforced before the producer reached ECR push; there is no separately retained per-case success report or success producer receipt. CloudTrail recorded `ScanNotFoundException`01:44:09; scan completed01:44:31 with HIGH3/MEDIUM9/LOW3. Image digest:

`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:e318ab002a9f1dfb86245c352d2f521f09c66086f31d9ffd92f08cbf39f0b236`

The `evidence` helper retrieves authenticated exact-build/image/scan readbacks and the versioned406-byte failure receipt with SHA/KMS verification. To retrieve source bytes independently, use the existing authorized profile and these **read-only** operations, from a new private output directory:

```sh
aws --profile "$FABLE_AWS_PROFILE" --region us-east-1 s3api get-object \
 --bucket meri-greenfield-qual-build-967807252336-us-east-1 \
 --key inputs/product-runtime/38f52df94b1738649776792b2a28aac743801c19/product-source.zip \
 --version-id ZoCyjIswQjO0iWjwM8Hm3E6uo6Fzrws1 --checksum-mode ENABLED product-source.zip
aws --profile "$FABLE_AWS_PROFILE" --region us-east-1 s3api get-object \
 --bucket meri-greenfield-qual-build-967807252336-us-east-1 \
 --key inputs/product-runtime/38f52df94b1738649776792b2a28aac743801c19/product-source-members.json \
 --version-id Jn0nOAeAbGkgnMMWGpERe5r7OLk15y8Q --checksum-mode ENABLED product-source-members.json
```

Verify archive138070049bytes/SHA`64e499360f5df74d2544922890c1cc1fe787d651f8acb30bfb2860b076cc1e69`; manifest3781316bytes/SHA`d0c5cea1b61c2e4053db1fa64e73f010d237d9b1dbc38162a3cc87ae7ba93939`;18395members. Use `head-object --version-id ... --checksum-mode ENABLED` to prove SSE-KMS and key`1cca74fc-d9ae-43a6-8bfd-b93107e90042` as well. Never reseal current source and label it with these old hashes.

The helper's `consumed-build.json` returns the exact log group/stream. Retrieve raw pages privately with `aws ... logs get-log-events --log-group-name EXACT_GROUP --log-stream-name EXACT_STREAM --start-from-head`; follow `nextForwardToken` until unchanged. CloudTrail lookup is `aws ... cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=DescribeImageScanFindings --start-time 2026-10-17T01:43:30Z --end-time 2026-10-17T01:44:40Z`; filter privately to the exact repository/digest/builder role/event time. Retention may expire; Git summaries and versioned failure receipt remain. Raw logs/scans/account identity readbacks stay private and are not committed. No required proof depends on a C: path.

## Reproducible future qualification — after explicit allocation

No next Meri attempt is allocated. Last observed central reservation was **$335/$400**, with the consumed$4 included; actual billed spend is unknown and later frontend reservations require reconciliation. Do not reuse its attempt, source keys or scripts. Fresh approval must name exact candidate commit, source delta, remaining source/native/Node question disposition, one$4-or-other agreed reservation, one start,30/5timeouts, autoRetry0, and exact resource guards. No paid action is implied by the safe-stop publication.

The canonical offline sealer, verifier, recipe, producer and Linux reporter are all committed under `infra/product-preview/`. Example after source review, in a **new output directory**:

```sh
SOURCE_COMMIT=REVIEWED_NEW_FULL_COMMIT
mkdir ../new-meri-image-inputs
python3 -I -B -S infra/product-preview/image-build-source.py seal --repository . \
 --commit "$SOURCE_COMMIT" --archive ../new-meri-image-inputs/product-source.zip \
 --output ../new-meri-image-inputs/product-source-members.json
```

This sealer reads full Git objects even from sparse checkout. Use the revision2 [request template](templates/image-request.template.json); fill every placeholder from the exact source member manifest, approved new identity and authenticated conditional-upload VersionIds. No generated attempt identity is supplied here. The old [RESUME-QUALIFICATION.md](RESUME-QUALIFICATION.md) retains exact conditional S3 put, source verification, recipe generation, one-start/uncertainty protocol and terminal readback commands; its old profile, ownership, request revision, source pins and consumed budget are superseded by this file. Run `node docs/handover/20261017/fable-shipping/scripts/check-product-buildspec.mjs EXACT_REQUEST.json` with final immutable keys/versions: limit25600bytes, prior measured25466, margin134. Do not silently increase the limit or strip a gate.

`templates/start-build.template.json` records the existing API shape, deliberately invalid until reviewed values are supplied. Before a future start, persist exclusive flushed upload/start intents, verify version/checksum/KMS, absence of new tag/conflicting build, exact recipe bytes, sourceVersion/role/timeouts/retry0, and independent source guard. On timeout/uncertain result, read back first; never create a second identity/start. Monitor the one exact build to terminal. Accept only final-image packages/native measurements,24/24 Linux, verified provenance/cleanup, immutable digest and complete scan HIGH0/CRITICAL0. Source tests are not that gate.

## Activation, integration and rollback remain held

The canonical source generators/config validators are already in Git: `infra/product-preview/{manifest,material-delivery,model-proxy-plan,model-proxy-template,temporal-binding,temporal-deployment,temporal-launch-render,temporal-product-join}.mjs`; launch details in `LAUNCH-INPUTS-20261016.md`, `CAPIRO-DEV-CHANGE-SET-20261016.md`, `EXISTING-DATABASE-GRANTS-20261016.md`, `temporal-deployment.md`, and `model-proxy-change-set.md`. Do not invent an enabled config to fill an unknown binding. [ACTIVATION-BINDINGS.md](ACTIVATION-BINDINGS.md) and [this worksheet](templates/activation-bindings.worksheet.json) enumerate the missing nonsecret owners; secret values are delivered only through the approved deployment owner, never Git.

Order: qualify source/image → settle exact Core/frontend Clerk application+issuer/template/member/client currentness → native identity/context/membership and selected-client read paths → product DB/grants/0017 backup/apply/role/restore → Temporal endpoint/store/namespace/queue/mTLS/issuer → native capability/model proxy/provider/model/budget/object custody → owner-only config delivery/control-worker-runner binding/task-private DNS/TLS/network → zero-count manifest/readiness → bounded explicitly approved activation → dot live acceptance. Core receipt migration already passed once (ledger646→647); **never rerun** it from a handoff example. Meri0017 has Windows isolatedPG16.15 9/9 source evidence; Unix/liveAurora16.11 remains unrun. Additional lock-column guards require central allocation and native qualification before grants.

Current issuer blocker: frontend preview proposal permits Test Clerk/preview ARN, held Core accepts `https://clerk.app.capiro.ai`/dev reference. Meri does not invent its own Clerk authority; it forwards the original native bearer to Core and joins fresh identity/context to configured tenant/actor/client. Matching-app nonsecret readback and reviewed frontend template/config fix are pending. The current selected-client reads use existing Core PR48 API, not the historical111f separate read-service plan. No five-schema/consumer-version finding requires a wire edit.

Listener priority3 is the retained Core guard, not free for Meri. Priority4 was vacant but unreserved at02:11; re-read before any plan. Keep services/runner admission closed until exact bindings and shipping approval. Core held service0/0/0 and empty targets are historical readbacks, not a current-state guarantee. Qualified frontend/Core images do not prove a mounted Meri path.

Rollback must name exact old task-definition/image/config/secret references, route owners, DB restore and step-by-step admission fencing. Preserve the old-pin controller/config and authenticated stop/reconcile path. Drain **every initial and successor run**, allocation, issuance, Temporal workflow and ECS task; require physical-stop proof/zeroUNKNOWN. Zero live tasks does not preserve conversation continuity: immutable configA conversations need A pin-routing/controller or explicit read-only/closure before B replaces it. No live drain inventory was done. Never delete old config or journal to make a new pin fit.

Dot's final acceptance uses the actual preview login, real Meri prompt, first streamed answer, saved conversation, reload/selection, interrupted-submit exact retry and stop/currentness checks. Fixtures, scans, Core startup and component source acceptance do not satisfy it. Record exact user/session application without exposing tokens, source/image/config pins, durable run/conversation receipt and reload evidence. Hand the resulting evidence back to dot/Neo.
