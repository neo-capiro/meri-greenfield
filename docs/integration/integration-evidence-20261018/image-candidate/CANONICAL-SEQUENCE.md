# Canonical sequence for the sole shipping owner

Status: one exact reviewed source for a future image is pinned at 34851020aa0d73fead4db59ba6e26a098e2d0313, tree d5d1b5599c812d49428bb113badd89092f9d05f3. No image or executable request exists. None of the commands below was executed by this lane. Build, object upload/ECR publication, AWS readback, rollout and chat remain unauthorized here. Use the existing approved shipping channel; do not create a replacement operator, project, repository, credential or diagnostic Dockerfile.

## Final source and local seal

Use the exact reviewed committed Git tree, with the canonical scripts' bytes checked against that commit. Set task-specific variables from the agreed final-source receipt. No placeholder below is a real build source or output.

```sh
: "${MERI_FINAL_SOURCE_ROOT:?absolute exact source checkout required}"
: "${MERI_FINAL_SOURCE_COMMIT:?full reviewed final Git commit required}"
: "${MERI_SOURCE_ARCHIVE:?absolute absent output zip required}"
: "${MERI_SOURCE_MEMBERS:?absolute absent output JSON required}"
python3 -I -B -S "$MERI_FINAL_SOURCE_ROOT/infra/product-preview/image-build-source.py" seal \
  --repository "$MERI_FINAL_SOURCE_ROOT" \
  --commit "$MERI_FINAL_SOURCE_COMMIT" \
  --archive "$MERI_SOURCE_ARCHIVE" \
  --output "$MERI_SOURCE_MEMBERS"
```

Expected local result is `SEALED_SOURCE_ONLY` with exact source commit, archive SHA256, member-manifest SHA256 and file count. It is not build/runtime acceptance. Preserve any failed seal outputs/diagnostics; do not overwrite them or silently substitute working-tree bytes. The sealer joins every member to its authoritative Git blob, portable mode and sorted manifest; rejects symlinks/submodules/private credential paths; and bounds complete source to 1GiB, each Git member 128MiB and member manifest 32MiB. Sealing has no Docker/AWS/network dependency.

The 16-field schema-v2 request must then bind the final source-derived Dockerfile/runtime lock/runner/verifier/producer hashes, approved immutable official Node/Wolfi bases, user 1000:1000, real approved project/repository, one tag `product-<full final commit>-<32 lowercase hex attempt ID>`, and source archive/member objects with exact bucket/key/**nonnull immutable VersionId**/SHA256. No archive/manifest upload or VersionId acquisition is authorized in this planning task. Do not invent temporary object versions to call a request complete.

Once the existing owner supplies a complete actual request through its approved channel:

```sh
: "${MERI_IMAGE_REQUEST:?absolute complete owner-reviewed request JSON required}"
python3 -I -B -S "$MERI_FINAL_SOURCE_ROOT/infra/product-preview/image-build-source.py" verify \
  --request "$MERI_IMAGE_REQUEST" \
  --archive "$MERI_SOURCE_ARCHIVE" \
  --manifest "$MERI_SOURCE_MEMBERS"
```

Expected `VERIFIED_SOURCE_ONLY` joins archive SHA, manifest SHA, full member vector and source pin, including the RDS public CA lock/bundle and the five critical source hashes. This is still no image proof.

## Inert recipe authoring versus operator execution

The canonical JavaScript owner is `infra/product-preview/image-build-recipe.mjs`, export `createProductImageBuildRecipe(request)`. Given the complete actual request, it returns `OFFLINE_RECIPE_ONLY`, exact `buildspecJson`, `buildspecSha256` and `requestSha256`; it performs no Docker/AWS call. Preserve/review exact bytes and hashes. The fixed buildspec override bound is 25600 bytes.

Do not run `image-build-producer.py` for planning. Its existing CodeBuild bootstrap/producer verifies real build identity/source VersionId, immutable scanning-enabled repository policy, downloads the exact source objects, constructs the exact Dockerfile, inspects image/runner/native/package/CA state, executes 24 Linux B/R/W fixtures, then obtains ECR auth, pushes, reads the digest, waits for scanning and physically cleans up. It therefore crosses AWS/publication boundaries even though it does not itself issue StartBuild or update a service. Running it requires separate explicit authorization and the sole shipping owner. The request must name that owner's actual approved project; the `meri-product-preview-build` fixture is not authority to replace historical `meri-greenfield-qualification-build`.

Canonical producer build inputs are `apps/runtime/Dockerfile`, `--platform linux/amd64`, `NODE_IMAGE=<official digest>` and `RUNTIME_IMAGE=<Wolfi digest>`; it adds source/base/node/runtime-lock OCI labels. Keep this recipe; do not author an alternate image line. Retain full failure/success logs, source/member/archive pins, exact image digest, scanner findings,24 fixture case outcomes, installed package-set SHA, runtime base/native probes and cleanup status. Unknown cleanup is a hold, not a successful receipt.

## Executor and final-image launch measurement

After a separately authorized exact build, run the sealed `infra/product-preview/runtime-packages/executor-generation-smoke.mjs` under the established supported sandbox: UID/GID 1000, no network, read-only root, dropped capabilities, no-new-privileges, bounded PID/memory/output/time, task-like writable workspace/tmp and verified cleanup. This source helper is not copied by the current Dockerfile; mount only its sealed verified source or use the already reviewed equivalent owner. Do not claim its hard-coded `readOnlyRootChecked:true` proves the sandbox. Check TXT/DOCX/XLSX/PPTX outputs and process-group cleanup. Do not infer PDF/Portfolio/Modules/pandas qualification.

Canonical in-image measurement producer is `apps/runtime/build/first-chat-launch-measurement.mjs`; its override comes from:

```sh
node infra/product-preview/first-chat/runtime-values.mjs measurement-override --shipped \
  --policy "$MERI_REVIEWED_POLICY" \
  --deployment-inputs "$MERI_REVIEWED_DEPLOYMENT_INPUTS"
```

Generating an override is local authoring. Executing it in a task/image uses the existing owner and separately authorized channel. The final-image capture must be provider-call-free and bind the exact model alias, pinned SDK/CLI executable, source runner, CA trust, options template/two-probe run invariance, skills, policy, selected capability profile and enabled general-read installation. Do not fabricate runtime receipts by rehashing a historical JSON. Plain default actual-SDK transport and selected-schema production custody are distinct gates. The final root-reported actual-SDK owner-channel matrix passes 17/17 at egress 90f82dc6 with executable bytes matching the pinned candidate; final owner/admission/harness checks pass 30/30. These are offline synthetic-boundary receipts, not final-image/native/live acceptance. Selected stand-in transport uses injected trusted fixture BodyLimits; it cannot replace the accepted-owner→authenticated per-session schema→count/native chain and tamper/cross-run/concurrency/expiry tests in SELECTED-SCHEMA-CUSTODY-GATE.md. Unknown/cache/retry liability remains qualified separately.

Only after a valid fresh final-image receipt exists:

```sh
node infra/product-preview/first-chat/runtime-values.mjs assemble \
  --receipt "$MERI_FINAL_IMAGE_LAUNCH_RECEIPT" \
  --allocation "$MERI_REVIEWED_ALLOCATION" \
  --policy "$MERI_REVIEWED_POLICY" \
  --deployment-inputs "$MERI_REVIEWED_DEPLOYMENT_INPUTS" \
  --out "$MERI_ABSENT_RUNTIME_VALUES_OUTPUT"
```

The assembler rechecks policy/allocation/source skills/model/options/gates. Then the existing operator may render material with canonical `infra/product-preview/first-chat/render-material.mjs` and its **existing approved** private/Core/runtime/Stage3 inputs, after the exact scope is authorized. No private input is copied into this planning packet. Record source/image/config/material VersionIds together and preserve native UID1000 init→fresh Control/global-fetch hostname/database trust and first/multi-run readiness evidence.

## Deployment and acceptance stay separate

No migration is added by the current receiving increment relative to 7252f483, according to PR188's source receipt; none was applied here. Actual deployed schema and already-reviewed migration ledger remain unrefreshed and are the operator's later report, not permission to execute SQL. The current source pin is exact; the sole owner must still compare its existing migration ledger to actual deployed state before any later authorization. No SQL is permitted by this packet.

An exact image or source-green suite does not clear deployment/chat HOLD. The existing owner must first supply refreshed current state and rollback target after authorized access is restored, and blockers must pass review. Only explicit later clearance can admit a shipment and real authenticated prompt→reply→reload history→second turn→Stop cleanup acceptance. No healthy-endpoint shortcut, unresolved usage liability or failed acknowledgement is a pass.
