> Historical read-only review before receipt. Root subsequently received all three closure commits, ran 74 passing source checks (one conditional skip), verified all assets, and received PR187. The image/native qualification limits remain open. See the main integration report for current pins.

# Read-only document executor image closure review

Reviewed integration source `1fe6baaedbd410089907bed2e52b804ec28482ce`. Missing branch head `d2f054362521f622b9dd63c65ef5eaa3bdde8d5a`, tree `fa6f22476ada43b6360660310c2948c443a84d50`, above common base `21862a5e7c557f9089b245d0e2685b91420ef128`. No root/source edits, full checkout, binary materialization, tests, installs, container/image build, AWS, migrations or provider calls occurred. Git objects were read and hashed in place.

## Exact closure and candidate patch

The complete source increment is three commits, in order:

1. `31d8de37630d674b7f30a12323d216db68ec9298` — executor dependencies, locks, retained APK/wheel inputs and source tests.
2. `94b692648c47fd509e62a621cc5b612e0d356ed3` — retained failed Docker attempt and prepared in-image smoke.
3. `d2f054362521f622b9dd63c65ef5eaa3bdde8d5a` — reject installed APK architecture other than exactx86_64, including absent/duplicate architecture.

**60 changed paths:16 text +44 binary (40 new APKs +4 wheels).** New asset bytes:73,798,861. The target lock has44 additional APKs (75,892,230 bytes) plus unchanged 10,635,138-byte signed index; base package identities and signed index are unchanged. All 44 new Git binary blobs were streamed through SHA-256 and match lock digest/size exactly. This verifies retained bytes, not an installed image.

[Text-only candidate patch](executor-closure-text.patch):104,633bytes, SHA-256 `67e13e62f39e9a2f726121b352d7bd4d0b4f8550d9fb14bf05c9fb6e97be1b33`; `git apply --check` passes at the reviewed integration source. **It intentionally excludes all44 binary inputs.** [Full inventory](EXECUTOR-CLOSURE-INVENTORY.json) and [review JSON](EXECUTOR-CLOSURE-REVIEW.json) identify each Git blob/size/SHA-256 so a receiver can obtain exact cached assets after transfer. Do not apply the two-file [architecture-only patch](architecture-guard-only.patch) as if it supplied the executor closure.

## Exact text/config/runtime ownership

| File | Change |
|---|---|
| `.dockerignore` | M;2943bytes; blob`16d7bf0a0f5e844b0768658ecc22689ac039fd56` |
| `apps/artifacts/generation/licenses/pptxgenjs-LICENSE` | A;1081bytes; blob`0b21750ad94fcfc08e723c81d337fd66e5b35964` |
| `apps/artifacts/generation/package-lock.json` | A;6858bytes; blob`9f9cf5fc7b87bb0a167f41db11c7b8b47e1cffed` |
| `apps/artifacts/generation/package.json` | A;479bytes; blob`8d4c769a32d1c2d27e50a75c769f5e19b3d4173d` |
| `apps/runtime/Dockerfile` | M;10482bytes; blob`48005795530d312f6ee236ac58d41cc121210c45` |
| `apps/runtime/build/runtime-packages.mjs` | M;18029bytes; blob`7c93b3120d2ecdcec7373bb955a22aeafac61200` |
| `apps/runtime/build/runtime-packages.test.mjs` | M;22590bytes; blob`aad54e4319550792b03b568a94c0ee0cac01e8c7` |
| `infra/product-preview/image-build.test.mjs` | M;46674bytes; blob`cdb5fd0c00e4f9cc2a33cd263eb84529de37ebf8` |
| `infra/product-preview/runtime-packages.lock.json` | M;16159bytes; blob`a914d229530bd9f5711fb1e2cd968ecad2c22740` |
| `infra/product-preview/runtime-packages/.gitattributes` | M;30bytes; blob`b5899d5ac2a2e941a13bb2b1bfef8d6fae2c051a` |
| `infra/product-preview/runtime-packages/build-attempt-20261018.txt` | A;9664bytes; blob`068edb3fae7b5d87093085313159df4bde410f1e` |
| `infra/product-preview/runtime-packages/complete-pending-additions.mjs` | A;16610bytes; blob`50a42e078b983e602171128e2efcb70c7e48d15b` |
| `infra/product-preview/runtime-packages/complete-pending-additions.test.mjs` | A;9276bytes; blob`99a3a432a99bcc7ac79d80240397dcebe62e1322` |
| `infra/product-preview/runtime-packages/executor-generation-smoke.mjs` | A;2152bytes; blob`2bf478f3b29212b138d58c4977676a14bb782ea5` |
| `infra/product-preview/runtime-packages/retained-additions-receipt.json` | A;17706bytes; blob`131ee111959c31d0c41d8fe0da13e185b4d662b1` |
| `infra/product-preview/runtime-wheels.lock.json` | A;2221bytes; blob`9c2727acb080ef0d6516b67f02c1a831eb01ccb9` |

PptxGenJS is separately pinned at`4.0.1` in a new private generation package and lock (19 npm dependency entries), installed by the existing builder with scripts disabled. Python runs `/usr/bin/python3.13 -I -B`; new libraries unpack into`/usr/lib/python3.13/site-packages`. The runtime base remains locked Wolfi linux/amd64, glibc2.44, Nodev24.21.0, and runtime UID/GID 1000:1000. The 128MiB retained archive bound replaces64MiB because index+APKs exceed64MiB; per-file16MiB bound remains.

## New retained APKs:40

| Package/version | Bytes | SHA-256 |
|---|---:|---|
| `freetype=2.14.3-r7` | 478404 | `81694e54dd1c00ae479310aed0b45e492b31b15d2ae81865ee5393604354cf92` |
| `gdbm=1.26-r7` | 280622 | `b353e1fb3f7702fe2faba2fd6800bbfd3db63a726e17d294a626aacbf239629b` |
| `lcms2=2.19.1-r3` | 237648 | `f2c5857cab8fd797f0a07e56042e41e93522bca988281e8765d275614ee23933` |
| `libbz2-1=1.0.8-r25` | 50263 | `52d98e5a8b0ea3e1f301d565bf8c8fed6b106f881d9d120dbde0d38fbd4f9fb8` |
| `libexpat1=2.9.0-r0` | 113449 | `49291dad97f2292a5796c2cdb766f6476b274332ae2bbd3c35447d7f305f81a8` |
| `libffi=3.8.0-r2` | 47462 | `93fe2f937802653775e8537c7a2840c6de8a1d83c396559be200c0d5d86375f6` |
| `libgfortran=16.2.0-r1` | 1312300 | `de6d40b1510125b2530c7b7e1d37c1c3f70c49a1c7dfc33826c3725e3d92f4e2` |
| `libjpeg-turbo=3.2.0-r5` | 638577 | `0a30d14964216ff18d89107d75bf7903d5ef7d7a1bddf33c7d5f93715a72511a` |
| `libopenblas-0=0.3.34-r1` | 11799709 | `1eab6e1b9049452dcad27dc3ef02dcbf1575648d6f01ee991966021b0794402a` |
| `libpng=1.6.59-r0` | 143584 | `658ba44b0ae145eac273d5822093e891be48967dd482067af79b189a00b8eb9b` |
| `libuuid=2.42.4-r0` | 33422 | `e1f5d85296afc0074e4d69fb3bdf7cb12b82233768ea5ad38330d53c76724785` |
| `libwebp=1.6.0-r7` | 339709 | `e1dcd7b76e2a53791462c84e4b8fa8f15892665e16f60a54c1751cb7a9804000` |
| `libxau=1.0.12-r9` | 16465 | `fa4cab03a805ef6996e7540d69096d3185903ca0a3101a3d57d9c6526df41793` |
| `libxcb=1.17.0-r17` | 399741 | `5b395537596061fb0bc6a55a1e5b89162b0f64d29ae0d3c882a3be3d338dbd3c` |
| `libxdmcp=1.1.5-r12` | 20709 | `7cc7cb88364210cd1d48016f7a1c4caf50525ea1c84516588f837020c0768d03` |
| `libxml2-16=2.15.4-r1` | 709117 | `461b0e802a5ffb3428f61e85eb56395361c1b2fd0cc0d4cc2666abb672c16471` |
| `libxslt=1.1.45-r5` | 292610 | `774aa16154ab1fe6ba8059ffabde298f2cc6ed3c3485de645e3db875108f46f6` |
| `libzstd1=1.5.7-r10` | 639525 | `6660523fbffeca75cd601b0c61f201f0054a568bac72204bb13be0dba36da176` |
| `mpdecimal=4.0.1-r4` | 131249 | `823156afdf095874d8e386ab453e69bf5677ab76dd249da7f6451929e6f9ccd4` |
| `openjpeg=2.5.4-r3` | 244855 | `eca7c6ea6d158a9d07cef353b9a7af8b2080e92c7a58dddae74f5a92f9fcd83d` |
| `py3-pip-wheel=26.2.1-r4` | 1814451 | `9e7ff37eeaa621df6d066b9904a91555848c5c13db95dab7efd2ad67c11fae7a` |
| `py3.13-contourpy=1.4.0-r1` | 462780 | `cb321f90a0d52f888d78d1b3a561dbd6c860dc0a764ea76551ca9affa949849e` |
| `py3.13-cycler=0.12.1-r8` | 27301 | `ca1b3cc9bed9249546f77bcbb211f5268df09ead37f236b9e6b19a124ba89328` |
| `py3.13-fonttools=4.67.0-r0` | 3354281 | `0161c9847bf6b62452c7fa29a831d3b08699f6af95677455a86d67ff832d2c50` |
| `py3.13-kiwisolver=1.5.1-r1` | 115891 | `31d9b285bc8d5535ae89906ff5705971e6e51f8e1a9344d785436b7ec09d655f` |
| `py3.13-lxml=6.1.3-r0` | 2581465 | `b77cf8d2a37b5a68351b9d8387a6fffc6da785bd44060a150b1eeebaa3afff5f` |
| `py3.13-matplotlib=3.11.2-r0` | 14295686 | `6f16b931d0208a6f296fb129529547430024eb997bdfe1a9e976e99ce4dacee4` |
| `py3.13-numpy-2.2=2.2.6-r5` | 12477950 | `82242789cf3bcbe8a3c64093d2782380a92de9ec3a4807d70ff975260203b219` |
| `py3.13-packaging=26.3-r0` | 343989 | `fc9f3c999a5963b1b6634b1c481af9942658920a93f444642166051f5defe3ec` |
| `py3.13-pillow=12.3.0-r1` | 1396143 | `30204e23855c47ed5ca62de88df3cbc8ff81ef4d1820d9b2323ef41aa46507d3` |
| `py3.13-pygments=2.21.0-r0` | 2899203 | `80b8019c2aeeeea4abeea2053eabc46997adc404ab20354e9c5ec8991f840416` |
| `py3.13-pyparsing=3.3.3-r0` | 362378 | `628ce308e90f234dfd34db2146f28bf4e25da682c8273c07f240b86f4f2b3ace` |
| `py3.13-python-dateutil=2.9.0-r13` | 389607 | `9f363a36fdcc074d0952d032dea5c3860eb6bfc6ea37f5dbea4f2a15b56a1521` |
| `py3.13-six=1.17.0-r7` | 41637 | `fcc24f3d528239978d16c215f379b103bf3115d9915d0a2dbb71a53e30cc3c47` |
| `py3.13-typing-extensions=4.16.0-r0` | 130024 | `1b2911197709c8700828f33a8da32159b490df009fdd36a4c634dd58b505fe96` |
| `python-3.13-base=3.13.16_git20261016-r0` | 12199161 | `081235dc7cc8a68e0896b80cd6b0ec27d9c0f38cdd6dcfd8df052e083735881d` |
| `readline=8.3-r3` | 349087 | `bc694bcbfcf3d3d48c890b2701714269c9c0851a85c44bb5bf38347e4999f80b` |
| `sqlite-libs=3.54.1-r0` | 989586 | `5ea68a7dad00791dbc5eff42aad9022b0984f82e271058811a4d72181e450144` |
| `tiff=4.7.2-r3` | 544160 | `2ff8e1ab80b34e531013dac8e42c546ac5fa0c097217f46a1ee74fc12d931587` |
| `xz=5.8.4-r0` | 397390 | `d015b40af8b300a0a33e710573e1e7d6cdc31ae5124bcac2fd299bea90a8506a` |

## Retained wheels:4

| Library/version | Import | Bytes | SHA-256 |
|---|---|---:|---|
| `et_xmlfile==2.0.0` | `et_xmlfile` | 18059 | `7a91720bc756843502c3b7504c77b8fe44217c85c537d85037f0f536151b2caa` |
| `openpyxl==3.1.5` | `openpyxl` | 250910 | `5282c12b107bffeef825f4617dc029afaf41d0ea60823bbb665ef3079dc79de2` |
| `python-docx==1.2.0` | `docx` | 252987 | `3fd478f3250fbbbfd3b94fe1e985955737c145627498896a8a6bf81f4baf66c7` |
| `XlsxWriter==3.2.9` | `xlsxwriter` | 175315 | `9a5db42bc5dff014806c58a20b9eae7322a134abb6fce3c92c181bfb275ec5b3` |

## Stale measurement and launch consumers

| Consumer | Retained value | Final-source requirement |
|---|---|---|
| Launch receipt SDK model | `us.anthropic.claude-sonnet-4-6` | `meri-sonnet-qualification` |
| SDK launch argument | `--model=us.anthropic.claude-sonnet-4-6` | `--model=meri-sonnet-qualification` |
| SDK options receipt/runtime-values | `af7f07b8f784884eae32e14e0b697d434d1668b0d68f55d203bf873c7af5431b` | Recompute canonical template and verify fresh in-image receipt |
| Runner raw bytes | `7402dabf8e6cf75bdfff2344cdc266aaead75c387f3796259a13cbb01f1d3618` | Current raw source `177a982b7b710eb1c13cdd372f44c8ba4043fbc429d0646e299b22dea0e992c2`; remeasure final image |
| Measurement module raw bytes | `ed88dfcbf84b52951bcc24f184db2c07d135ac56fc9d1f2a8449ac4b0aeb9b9e` | Current source `0cc9d6c62b51b308e3a97ad60754587017369c002fb8d73b4c6903f16fc62d2b` |
| Skills |14 retained / 15 current asset rows | Canonical `skillsDigest` revalidates all assets |
| Policy revision | Receipt`91063196140bb55ee8c9ccec8f5aba3c85e0ef0c3f2231b38afa3adeda221af5` / runtime`79936353b071ddfcc9e02477163f191f7dcdb1a1419f4769b860c9e709dfbf2f` | Reviewed policy and source allocation must agree through assembler |

`runtime-values.mjs` rechecks exact alias/limits/profile/active refs, two-probe run-invariant SDK options, source skills and P2 active/full measurements. `render-material.mjs` additionally compares runner bytes at the pinned runtime source commit and derives the candidate/launch/material/configuration digests. Native preparation and runner-query enforce those persisted pins. Retained N21 receipts must stay historical; do not edit their hashes into a synthetic fresh receipt.

## Canonical sequence after final source and transfer

The following are reviewable commands/plans, not actions performed here. Source checks can run after receipt; image/private/operator steps remain with the sole shipping operator.

**C1 — source check after receipt**

```sh
node --test apps/runtime/build/runtime-packages.test.mjs infra/product-preview/runtime-packages/complete-pending-additions.test.mjs infra/product-preview/image-build.test.mjs
```

Offline source tests only. Not run by this review. The pending-record case is conditional and skips when no pending record exists.

**C2 — retained source check after receipt**

```sh
node infra/product-preview/runtime-packages/complete-pending-additions.mjs check
```

Offline, but exit0 permits missing wheels. Require apks=44,wheelsRetained=4,wheelsLocked=4,pending=false and compare all locked hashes; do not call run.

**C3 — seal final combined source**

```sh
python3 -I -B -S infra/product-preview/image-build-source.py seal --repository <repository> --commit <final-reviewed-commit> --archive <absent-archive.zip> --output <absent-member-manifest.json>
```

Canonical offline Git source seal after all source repairs are consolidated. It does not build or deploy.

**C4 — verify source request**

```sh
python3 -I -B -S infra/product-preview/image-build-source.py verify --request <reviewed-request.json> --archive <sealed-archive.zip> --manifest <member-manifest.json>
```

Request must bind final source/archive/manifest/Dockerfile/runtimePackages/runner/verifier/producer and approved immutable Node/Wolfi image inputs. No invented digests or stale N21 pins.

**C5 — shipping owner exact image build**

Existing reviewed createProductImageBuildRecipe / image-build-producer flow in the supported linux-amd64 shipping environment

Not executed or authorized by this review. Sole shipping operator supplies supported build context and any AWS steps. Image lock requires Nodev24.21.0, glibc2.44, linux/x64 and UID1000:1000.

**C6 — in-image verification**

```sh
node apps/runtime/build/runtime-packages.mjs verify --lock infra/product-preview/runtime-packages.lock.json
```

Inside exact final image. Canonical producer also verifies runtime-base-probe, runner and24required Linux fixture cases before registry publication.

**C7 — document generator smoke**

Run sealed SHA-verified infra/product-preview/runtime-packages/executor-generation-smoke.mjs bytes inside exact final image through the existing fixed local executor

Helper is not baked by Dockerfile. Bind its sealed source read-only or use equivalently verified script bytes. Actual sandbox must be UID1000, networknone, read-onlyroot, droppedcaps/no-new-privileges, bounded resources, private /tmp. Require four formats, SHA agreement, exitCode0 and groupAbsenttrue. Printed readOnlyRootChecked literal is not proof.

**C8 — canonical measurement override**

```sh
node infra/product-preview/first-chat/runtime-values.mjs measurement-override --shipped --policy <reviewed-policy.json> --deployment-inputs <reviewed-deployment.json>
```

Generates exact measurement args from approved limits/profile/active operations and PRODUCT_PROXY_MODEL_ALIAS. Shipping executes generated command inside final image with empty credential environment; measurement capture stops at SDK spawn hook and makes no provider call.

**C9 — assemble fresh runtime values**

```sh
node infra/product-preview/first-chat/runtime-values.mjs assemble --receipt <fresh-in-image-launch-receipt.json> --allocation <reviewed-allocation.json> --policy <reviewed-policy.json> --deployment-inputs <reviewed-deployment.json> --out <absent-runtime-values.json>
```

Canonical function rechecks Linux UID, SDK/CLI versions, measured gates, alias, executable/template shape, run-invariant SDK options, current source skills and P2 active/full installation. Renderer separately compares runner bytes at the pinned image source; image producer pins Node version. Never hand-edit SDK/options/runner/source/skills hashes.

**C10 — shipping private material render**

```sh
node infra/product-preview/first-chat/render-material.mjs --deployment-inputs <reviewed-deployment.json> --private <existing-authorized-PKI-directory> --core <reviewed-core-values.json> --runtime <fresh-runtime-values.json> --stage3 <reviewed-stage3.json> --out <absent-private-directory-outside-repo>
```

Existing shipping owner only, using approved current private inputs. Bind final source/image/configuration/material version receipts; no new credentials, migration, resource mutation, deployment or chat by this review.

## Review findings and qualification boundaries

| ID | Status | Finding |
|---|---|---|
| IMG1 | integration dependency | Last d2 commit modifies only runtime-packages.mjs and its test. Complete executor dependency closure requires all60 changedpaths across31d8de37,94b69264,d2f05436, including44 binaryassets. Text patch alone is incomplete. |
| IMG2 | qualified source gap | Final executor Dockerfile has not been built. Retained94b69264attempt ended at builder6/27 when Docker daemon disconnected. No APK install, wheel unpack/imports, installed lock verification or exact-image generation smoke is evidenced. |
| IMG3 | measurement blocker | Checked-in launch receipt/runtime values still use provider profile in SDK --model instead of authorized alias, and retained runner/module/skills/policy inputs are stale. Regenerate through canonical final-image measurement and assembler after final source; a source-only rehash cannot prove CLI/executable/image identity. |
| IMG4 | checker limitation | The retained checker intentionally allows absent wheels. Exit0 is insufficient for release: verify all44APKs and4 wheels with exact hashes and no pending record. |
| IMG5 | helper limitation | Generation helper is not copied into image. Its readOnlyRootChecked:true is a literal; environment guarantees must come from actual sandbox flags/readback. It does not substitute for renderer/native-office qualification. |
| IMG6 | scope limit | Closure supplies structural TXT/DOCX/XLSX/PPTX generation, including charts/formulas/PPTX notes. It does not supply pandas for run_analysis or qualified LibreOffice rendering/PDF/preview. Existing owner gates remain fail-closed. |
| IMG7 | ownership hold | Shipping51f4a38eunpublished source and safe-stop/transfer receipt are pending with parent. Do not apply overlapping source or recreate shipping changes while that receipt is unresolved. |

The new image-build source assertions bind exact APK pins, all 4 wheel hashes and extraction paths, interpreter/library versions, PptxGenJS version/path and required filesystem paths to the renderer executor configuration. Runtime package tests preserve strict bounds and add wrong/missing/duplicate architecture refusal. The retained-input helper tests re-identify APK control/data hashes against the unchanged signed index; its pending-record test intentionally skips after all additions are retained. None of those source tests were run in this review.

The prepared generator smoke exercises TXT, DOCX with paragraph/table/chart, XLSX with formula/chart, and PPTX bullets/table/chart/notes through the fixed executor. It does not provide native Office rendering, recalculation or PDF proof. Its script is outside Docker COPY scope; use sealed/hash-verified bytes in the final sandbox and attest sandbox settings independently.

## Migrations: no change or execution

No SQL file is present in this 60-path delta. It requires no new migration for dependency installation. The existing default first-chat conversation plan still ends at 0017. Integration-only artifact 0001/0002/0003 and held conversation 0018/0019/0020 belong to separate reviewed installer/owner gates; do not apply them as part of image receipt, and do not run the copied D2 migration entrypoint. This review applied none.
