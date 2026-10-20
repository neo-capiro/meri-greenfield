# Runner diagnostic successor measurement packet

Exact source: **`2b4421f612f9fbb728d6da52927aac228d712d40`**, clean checkout `../meri-runner-transport-diagnostic`. Status: **HELPERS READY; IMAGE AND AUTHENTICATED RECEIPTS PENDING**.

Root alone operates AWS. This packet performs offline prepare/finalize/verify; the Linux wrapper runs only inside root's separately submitted job two. Allocation: at most two sequential jobs, product30 minutes then measurement10 minutes, queue5 each, zero retries, new human-approved $5 ceiling. The measurement retains its existing10-minute bound within the approved30-minute maximum. No fresh model call. Uncertain submission/cleanup is a hold requiring resolution of that exact outcome; no replacement job or automatic retry.

## Minimal helper diff and verification

Copied nine helper/fixture files from `../pr193-retention-measurement-packet/`, preserving the old packet. Only these two lines changed:

| File | Change | Successor SHA-256 |
| --- | --- | --- |
| `receipt-joins.mjs:5` | `SOURCE_COMMIT` becomes exact2b4421f | `dafd107910a7739e6c8d3aba3a0ed712c568189b57e8a70e5ad6b87752128bdd` |
| `measurement-build-wrapper.py:19` | `SOURCE` becomes exact2b4421f | `15e28b2515dfd2c7667693647ca108447db83e88233e1d716201d6267813cda4` |

The other seven files are byte-identical. `source-packet-hashes.json` records old/new hashes and fourteen exact-source raw Git blob comparisons. All fourteen match5b395d4, including the canonical verifier, producer, recipe, Linux reporter/check helper, Docker COPY definition, launch measurement, runner, runtime-values/render material and package lock. Therefore the unchanged verifier pin `c373ff556873823e1fd7cb5a00945ed2f70f41acb74c96d2d9756d0f12bf461d` remains valid. Instructions also match the already reviewed source.

`offline-checks.json` records seven Node syntax checks, both Python AST parses, exact pin-only comparisons, 10/5/0 limits and canonical source/baseline hash checks. No imports/execution of the Python wrapper, no AWS/network/Docker, no build/upload, no product tests and no rerun of the old34/12 suites. The old suites remain historical evidence; no behavioral helper change was introduced.

## Unchanged public measurement baseline

The preparer still requires the exact public C deployment baseline: Git `5a42ec962677e70e76db5433330b52fd34db5bcd`, path `docs/shipping/20261019/a16cc40d-public-render/deployment-inputs.candidate.json`, raw SHA-256 `0232304892929be91435889b33d86032f0febf178eb2d407a62079f8d092bb88`. This blob exists locally and its hash was rechecked. Only `images.nodeRuntime` and `images.nodeRuntimeSourceCommit` may change, to the authenticated new digest and exact2b4421f source. Policy/allocation use the exact-source canonical files. Three turns/one tool and absent feature/capability/active-read selectors remain unchanged.

This public measurement baseline is not a current live/private deployment packet. Do not replace it with secret bundles or silently weaken baseline equality. A different baseline needs an independently reviewed exact successor pin.

## Ready offline commands

Run from `task-2`. The first three input paths below remain pending outputs of root's product build and public-input preparation; replace them with the actual accepted paths. Do not use the old product receipt/digest. No helper emits a new source pin implicitly.

```powershell
$rdNode = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$rdSource = '.\meri-runner-transport-diagnostic'
$rdPacket = '.\runner-diagnostic-measurement-packet'
$rdRequest = '<actual-new-product-request.json>'
$rdReceipt = '<authenticated-new-product-image-receipt.json>'
$rdDeployment = '<reviewed-public-C-deployment-with-new-image-and-source.json>'
$rdPrepared = '.\runner-diagnostic-measurement-prepared'
$rdOperator = '.\runner-diagnostic-measurement-operator'
$rdResults = '.\runner-diagnostic-measurement-results'
$rdAttempt = '<fresh-recorded-32-lowercase-hex>'
if ($rdAttempt -notmatch '^[a-f0-9]{32}$') { throw 'PENDING_MEASUREMENT_ATTEMPT' }
foreach ($rdInput in @($rdRequest, $rdReceipt, $rdDeployment)) {
  if (-not (Test-Path -LiteralPath $rdInput -PathType Leaf)) { throw 'PENDING_MEASUREMENT_INPUT' }
}

# Only after the product build is terminal SUCCEEDED and receipt/image/scan joins pass:
& $rdNode (Join-Path $rdPacket 'prepare-measurement.mjs') --source-root $rdSource --request $rdRequest --product-receipt $rdReceipt --deployment $rdDeployment --policy (Join-Path $rdSource 'infra/product-preview/first-chat/policy.json') --allocation (Join-Path $rdSource 'infra/product-preview/first-chat/allocation.json') --project-role-arn 'arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H' --attempt $rdAttempt --out $rdPrepared
if ($LASTEXITCODE -ne 0) { throw 'MEASUREMENT_PREPARATION_REFUSED' }

# Root uploads generated public payload and supplies authenticated immutable pin:
& $rdNode (Join-Path $rdPacket 'finalize-measurement.mjs') --packet $rdPrepared --payload-pin (Join-Path $rdOperator 'payload-pin.json')
if ($LASTEXITCODE -ne 0) { throw 'MEASUREMENT_FINALIZATION_REFUSED' }

# Root separately reviews/submits the generated measurement-start.request.json once.
# After terminal success and authenticated six-file selected-version downloads:
& $rdNode (Join-Path $rdPacket 'verify-measurement.mjs') --source-root $rdSource --packet $rdPrepared --results $rdResults --operator-dir $rdOperator --out '.\runner-diagnostic-runtime-values.measured.json'
if ($LASTEXITCODE -ne 0) { throw 'MEASUREMENT_VERIFICATION_REFUSED' }
```

Preparation is create-only. Do not rerun into an existing prepared directory or delete failed/partial evidence. Finalize reconstructs exact payload/plan/wrapper joins and emits the small inline bootstrap, avoiding the historical inline buildspec overflow. Final verification independently reconstructs the request/buildspec and calls canonical `runtime-values.mjs assemble`.

## Required evidence before acceptance

- Product source is exactly2b4421f, with both corrections in sealed archive/manifest and production Docker COPY closure. Source HEAD drift refuses. Product request schema2, archive/manifest immutable versions, raw hashes and producer/verifier pins must join to the actual successful job-one receipt; proof packet remains separately owned by the proof agent.
- Authenticate product and measurement distinct actual IDs, `buildComplete:true`, `SUCCEEDED`, expected project/role/source/version/buildspec hashes, no retries,30/5 and10/5 limits respectively. Preserve the actual StartBuild response as `measurement-start.json`.
- Exact digest ECR tag/OCI source labels and COMPLETE scan with HIGH=0/CRITICAL=0 must agree with the receipt. No latest-tag substitution.
- Public payload key is `inputs/launch-measurement/2b4421f612f9fbb728d6da52927aac228d712d40/<attempt>/measurement-payload.json` in existing `meri-greenfield-qual-build-967807252336-us-east-1`; KMS is unchanged. Pin actual VersionId, length, SHA-256, base64 checksum and KMS metadata from authenticated Put/HEAD/GET. A self-authored pin is insufficient.
- Download exactly six selected-version results: `launch-measurement.json`, `launch-readback.json`, `runtime-native.json`, `runtime-packages.json`, `measurement-provenance.json`, `measurement-diagnostic.json`. Operator directory also needs `product-build.json`, `measurement-start.json`, `measurement-build.json`, `ecr-image.json`, `ecr-scan.json`, `artifact-downloads.json`; preserve underlying authenticated HEAD/GET metadata.
- Four sequential probes use one exact linux/amd64 image digest, uid1000, no network, no host bind mounts, read-only root, dropped capabilities and bounded resources. Verify all seven launch gates, two invariant SDK probes, source/image/runner/native/package/skills/read inventory joins and COMPLETE physical cleanup. Launch capture interrupts the SDK spawn hook and makes no model request.

Only `MEASUREMENT_VERIFIED_AND_ASSEMBLED` plus independent evidence review accepts the new runtime measurement artifact. It does not prove transport repair, live model behavior, enabled capability completeness, browser acceptance or deployment. No live action or image acceptance occurred in this preparation.
