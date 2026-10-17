# Runtime-base source candidate checks

These commands check the revision-2 image source candidate offline. Run them from the `meri-greenfield` repository root with an explicit Node.js 24 executable and Python 3 executable. The local receipts below used Node.js `v24.19.0` and Python `3.12.14` on the Windows jump box. The final image request pins Node.js `v24.21.0`; the local checks do not measure that Linux image.

## Focused commands

On a POSIX shell, set `MERI_NODE24` and `MERI_PYTHON3` to the executables installed on that host:

```sh
set -eu
: "${MERI_NODE24:?set an absolute Node.js 24 executable path}"
: "${MERI_PYTHON3:?set an absolute Python 3 executable path}"
case "$("$MERI_NODE24" --version)" in v24.*) ;; *) echo 'Node.js 24 is required' >&2; exit 2 ;; esac
"$MERI_PYTHON3" --version
MERI_IMAGE_BUILD_TEST_PYTHON="$MERI_PYTHON3" "$MERI_NODE24" --test --test-reporter=tap infra/product-preview/image-build.test.mjs
"$MERI_PYTHON3" -I -B -S infra/product-preview/test_image_build_diagnostics.py
"$MERI_NODE24" --no-warnings --experimental-loader ./docs/handover/20261017/fable-shipping/scripts/provenance-static-runner-loader.mjs --test --test-reporter=tap infra/product-preview/image-provenance.test.mjs
"$MERI_NODE24" --test --test-reporter=tap apps/runtime/build/runtime-packages.test.mjs apps/runtime/build/runtime-base-probe.test.mjs
```

On PowerShell, set the same two environment variables to existing executable paths. Check that each reported version and process exit is the expected one:

```powershell
$Node24 = $env:MERI_NODE24
$Python3 = $env:MERI_PYTHON3
if (-not $Node24 -or -not $Python3 -or -not (Test-Path -LiteralPath $Node24) -or -not (Test-Path -LiteralPath $Python3)) { throw 'Set MERI_NODE24 and MERI_PYTHON3 to existing executables' }
$NodeVersion = & $Node24 --version
if ($LASTEXITCODE -ne 0 -or $NodeVersion -notmatch '^v24\.') { throw 'Node.js 24 is required' }
& $Python3 --version
$env:MERI_IMAGE_BUILD_TEST_PYTHON = $Python3
& $Node24 --test --test-reporter=tap infra/product-preview/image-build.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Image source checks failed' }
& $Python3 -I -B -S infra/product-preview/test_image_build_diagnostics.py
if ($LASTEXITCODE -ne 0) { throw 'Producer diagnostic checks failed' }
& $Node24 --no-warnings --experimental-loader ./docs/handover/20261017/fable-shipping/scripts/provenance-static-runner-loader.mjs --test --test-reporter=tap infra/product-preview/image-provenance.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Provenance comparator checks failed' }
& $Node24 --test --test-reporter=tap apps/runtime/build/runtime-packages.test.mjs apps/runtime/build/runtime-base-probe.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Package and native probe source checks failed' }
```

At this source candidate, the focused results were image-build **36/36**, producer diagnostics **11/11**, provenance comparator **7/7**, and package helper plus native probe **23/23**. The 23 helper/probe cases include local refusal and mocked transport controls. They do not prove installation or native loading in the final Linux image.

The tracked provenance loader replaces only the exact `image-provenance.mjs` import of `ecs-prepared-task-proof.mjs` with its fixed, nonsecret `productRunnerMeasurement` constant. The sparse checkout lacks that module's AWS SDK and storage dependency. The 7/7 result checks comparator logic with this fixture; it does not prove the real ECS module, independently measured runner bytes, AWS access, an image digest, or deployment admission. Remove the loader from any full dependency or final-image qualification run.

## Exact revision-2 request and buildspec

The request has every prior product-image field plus exactly `schemaVersion: 2`, `runtimeBaseImageUri`, and `runtimePackagesSha256`. `runtimeBaseImageUri` must be a `cgr.dev/chainguard/wolfi-base@sha256:<64 lowercase hex>` digest URI and match the `runtimeImageUri` in `infra/product-preview/runtime-packages.lock.json`. `runtimePackagesSha256` is SHA-256 of that lockfile's **raw bytes**, including its newline. The source verifier joins that digest to the archived member before extraction. The Node base URI remains a separate digest-pinned field.

Use `createProductImageBuildRecipe(pin)` from `infra/product-preview/image-build-recipe.mjs` to generate the exact `buildspecJson`, `buildspecSha256`, and `requestSha256`; do not hand-edit the returned CodeBuild command. After the final source ZIP and member manifest have immutable S3 version IDs, put their exact bucket, key, version, and SHA-256 values in the reviewed request and run this tracked read-only size/hash check:

```sh
"$MERI_NODE24" docs/handover/20261017/fable-shipping/scripts/check-product-buildspec.mjs /path/to/final-request.json
```

```powershell
$FinalRequest = $env:MERI_IMAGE_REQUEST
if (-not $FinalRequest -or -not (Test-Path -LiteralPath $FinalRequest)) { throw 'Set MERI_IMAGE_REQUEST to the reviewed final request JSON file' }
& $Node24 docs/handover/20261017/fable-shipping/scripts/check-product-buildspec.mjs $FinalRequest
if ($LASTEXITCODE -ne 0) { throw 'Exact buildspec check failed' }
```

The checker reports only the generated byte count and hashes and refuses a request that exceeds the 25,600-byte buildspec limit. It does not authenticate S3 objects, build, upload, or authorize `StartBuild`. Using the previous real request's key and version lengths with the revision-2 fields and current lock yielded **25,466 bytes**, a **134-byte margin**. Recalculate with the new exact source, hashes, keys and version IDs; the prior request and its hashes are not reusable authority.

Source-only checks and this size check do not clear the Linux package set, Node/glibc/SWC/Temporal native probes, 24 Linux cases, image scan, cleanup, receipt, or live deployment gates. The existing image scan had three HIGH findings; this candidate has not had a paid image qualification run.
