# Successor Windows upload handoff

Neo reported `PR193_LOCAL_RENDER_COMPLETE`. Every pasted public pin matches the frozen packet/readbacks, and the five bundle counts/hashes are now pinned. The upload gate is READY for Neo to invoke once from the exact newly published helper commit. Existing local rendering output and cache must be reused. Local bindings run only after upload completion and metadata preservation checks.

**Neo alone runs private render, private upload and local bindings on the secure Windows host. Agents must not read private inputs, run these private operations, or transmit secret material.** Keep the existing PKI/Core inputs and credentials on that host. Return only the safe receipts and public templates specified below.

## Implementation outline

Reuse the reviewed PR193 Windows PowerShell 5.1 wrappers and their existing public interfaces. Preserve `Pr193Common.ps1` and `Pr193DependencyProbe.mjs` byte-for-byte. Keep canonical stage3/render/bindings and the preserved compatibility helper as the owners of generated materials and templates. Change only successor configuration pins, the staging label, cache default, and an early shared pending-pins guard. Retain existing `Pr193` names and constant event codes to minimize the implementation delta.

`Pr193PublicInputs.ps1` owns the source, packet, readback, runtime, image, deployment and approved-upload-manifest pins. `Assert-Pr193ReleasePinsReady` prevents all three entry points from proceeding before the corresponding reviewed pins are complete. Render requires the common release pins. Upload and local bindings additionally require the approved manifest derived from Neo's new render receipt; this second gate prevents the old private bundle hashes from authorizing a successor upload.

The public source is `2b4421f612f9fbb728d6da52927aac228d712d40`. The proposed new label is `FIRST_CHAT_20261020E`. Five existing secret ARNs and role-to-bundle paths are retained. Root reports both allocated jobs SUCCEEDED, canonical measurement and independent result review PASS, and the image scan COMPLETE with zero HIGH/CRITICAL findings. The runtime-value bytes equal the predecessor's bytes, but their acceptance comes from the fresh exact-image measurement. The new private summary and all five bundle sizes/hashes are recorded in `NEO-UPLOAD-MANIFEST.json`. These are Neo-reported metadata; the agent has not read the private bytes.

Root owns `public-candidate/`, build/measurement receipts, public manifest, `windows-readbacks/` and their frozen commits. This wrapper task owns only `windows/`. Only parser/help and bounded source-delta checks are allocated here; no real private rendering, upload, bindings, AWS, network, dependency installation or old broad test suite is run.

## Fixed public pins

| Input | Exact pin |
| --- | --- |
| Source commit | `2b4421f612f9fbb728d6da52927aac228d712d40` |
| Public packet commit | `86983726ebf532955631578c07b080da1fcf2500` |
| Public manifest SHA256 | `ebae569fdec329602ad068641f4c33599fb001f2eab9b1c1e613f88b801dfeec` |
| Readback commit | `334f68728f23669d121d309b69b45a5bfc77b24b` |
| Readback manifest SHA256 | `4eeb505b63f1f6ab2756d2f694bcb446f6748124cc70b159d277337ea77e8233` |
| Runtime values SHA256 | `46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d` |
| Deployment inputs SHA256 | `4c7f8adfafc6eb3ed7b9e65b8a0ee7d940a40269f903f7127b30111b68869a54` |
| Stage3 SHA256 | `4ed035291fe02954ad5b2abd6ac3d29fe1cf1c8e176a344c0efdef6506bd1419` |

Node runtime image: `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:f5a7abc9940ef8f5092bbfa9db9c3345874d448de2d7d7712645f8aad9db5ff7`.

Stage3 predicts control35, application worker34, issuer34, owner33, proxy33 and runner20. These are next-revision predictions, not reservations. Existing proxy/Temporal images, policy/allocation and absent optional activations remain as reviewed in the public packet.

## Exact input dependencies

The packet commit must export `docs/integration/runner-diagnostic-release-20261020` with a pinned `PUBLIC-FILE-MANIFEST.json`. Required files under its `public-candidate/` are:

- `runtime-values.json` â€” freshly assembled from the accepted exact-image measurement.
- `deployment-inputs.candidate.json` â€” reviewed successor input with the same five secret ARNs.
- `policy.json` and `allocation.json` â€” the existing reviewed settings, with absent optional activations preserved.
- `image-scans.candidate.json` â€” authenticated evidence for the exact successor image.
- `build-update-compatible-v2.mjs` â€” the reviewed preserved compatibility helper.

The readback commit exports `docs/integration/runner-diagnostic-release-20261020/windows-readbacks`, with pinned `FILE-MANIFEST.json` covering:

- `foundation-live.json`, `latest.tsv`, `stage3.observed.json`.
- `app.live.template.json` and `private-edge-outputs.json`.
- `secret-label-metadata.json` and `readback-summary.json`.

Readbacks must bind the exact source, account `967807252336`, region `us-east-1`, and absence of `FIRST_CHAT_20261020E` for all five secrets. Candidate revisions come from fresh readbacks and are not reserved by preparation. Stop for refreshed reviewed inputs if registrations or deployments change those maxima.

The approved manifest SHA-256 is `573c7d09b1fcf8adade3f09e80037fa9585339e320ec4844cfa447347b874c9a`. `Pr193UploadPinStatus` is READY and the exact hash is pinned. `UPLOAD-MANIFEST-REVIEW.json` records the semantic comparison with all frozen public fields and five exact role tuples. Original receipt file bytes were not supplied: no original-file hash is inferred from pasted JSON. The unchanged wrapper hashes the actual local receipt, stage3, summary and bundles before any upload, and binds the actual receipt-file hash into saved retry state. `REVIEW.json` is the earlier render-release review retained from commit9230534d.

## Completed local render — reference

Neo has completed this step; do not rerender for the approved upload. The retained command is local render only. It uses the same existing PKI directory and reviewed Core values file on Neo's secure Windows host; choose a new private output directory outside all repositories and the public cache. Do not send those paths or files to an agent.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docs\integration\runner-diagnostic-release-20261020\windows\Invoke-Pr193LocalRender.ps1 `
  -PrivatePkiDirectory '<SAME_EXISTING_PRIVATE_PKI_DIRECTORY>' `
  -CoreValuesPath '<SAME_REVIEWED_PRIVATE_CORE_VALUES_JSON>' `
  -OutputDirectory '<NEW_PRIVATE_OUTPUT_DIRECTORY>' `
  -PublicCacheRoot '<PUBLIC_CACHE_DIRECTORY>' `
  -ReadbackCommit '334f68728f23669d121d309b69b45a5bfc77b24b'
```

Run this command from the exact wrapper checkout supplied by root, replacing the private placeholders only on Neo's host. Node24, Git, existing authorized GitHub access and Windows PowerShell5.1 are prerequisites. The optional `-NodePath '<EXISTING_NODE24_EXE>'` selects an existing executable. Output's parent directory must exist and output itself must be new. Use a short public cache path; it may contain earlier source/packet/readback directories because each successor directory is named by its exact commit.

The wrapper verifies the three fixed public commits and raw file hashes, prepares only required existing locked dependencies with scripts disabled, creates an owner-only private output directory, then runs canonical stage3 and render. Child output/errors remain suppressed. Success prints `PR193_LOCAL_RENDER_COMPLETE` and exits0; refusal prints a constant `PR193_*` code and exits2. A refusal is not a successful render; retain any private partial output for diagnosis and do not upload it.

Neo returned the public render metadata, which passed root and independent review. The separate Neo-only upload requires `-NeoApprovedPrivateUpload`, existing AWS executable/profile, and the same protected local output/cache. It persists the five exact idempotency tokens only when Neo runs it, explicitly stages E without moving AWSCURRENT, captures complete initial version metadata, rejects capacity at100 existing versions, preserves original version IDs/stages, and allows only each saved-token addition. An uncertain result retains the same state, token and bytes; it is never resolved by generating a new token. These are checked observations, not an atomic exclusion of concurrent external writers.

After upload's final metadata receipt and root's read-only preservation checks pass, Neo invokes `Invoke-Pr193LocalBindings.ps1` separately with the same output/cache. It validates the final upload receipt/state/TSV and private bundle hashes, then runs canonical bindings and the preserved compatibility helper. Return only `local-bindings-receipt.json`, the three generated `update-compatible-v2/{model,issuer,app}.template.json` public templates, and reviewed version metadata. Keep bundles, credentials, PKI/Core files, rendered configs, real private paths and raw command output local.

No wrapper deploys, registers a task definition, creates or executes a changeset, sends a chat/model request, changes credentials, or modifies shared listeners. Deployment remains a separately reviewed root operation.

## Current status

READY for Neo-only upload of the five approved bundles under `FIRST_CHAT_20261020E`. Use the supplied command that validates the existing `$repo`, `$out`, `$publicCache`, `$uploadAws` and `$uploadProfile`, updates the clean public checkout to the exact upload-helper commit, checks all executable/pin hashes and invokes the upload once. The wrapper verifies the live AWS account before mutation. Return only `$out\upload-receipt.json` after `PR193_PRIVATE_UPLOAD_VERIFIED_BIND_READY`. Preserve the same output, state, bytes and tokens on any refusal or uncertain outcome. No upload has been performed by the agent.

Preparation checks passed on Windows PowerShell 5.1: all five `.ps1` files parsed, and all three entry points returned help with exit0. The unchanged dependency probe passed Node syntax checking. A bounded comparison to the committed predecessor `e4b894c09177b03c0d28439f8e20a6d893236799` confirmed Common and dependency-probe bytes are identical; the three entry-point changes are confined to successor pins/default cache, label, help and pending guards. The initial render-release manifest preserved all five role/ARN/path tuples with null private metadata; this upload revision fills only Neo's exact new metadata and changes the two upload pin fields. The uploader, common functions and render/bind entry implementations remain byte-identical to9230534d. No entry point was invoked beyond help and no public/private operational inputs were consumed.

The implementation resides in the dedicated `handoff/runner-diagnostic-release-20261020` worktree based on `2b4421f612f9fbb728d6da52927aac228d712d40`. The upload successor changes only `windows/` and preserves the frozen packet/readback commits. The parent's relayed request authorizes preparing and publishing this user-operated upload; no agent secret transmission is performed.
