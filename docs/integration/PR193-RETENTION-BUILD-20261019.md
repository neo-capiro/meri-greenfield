# PR193 retention successor: source and image qualification

## Ready packet

**Source/image qualification and the public receiving packet are complete.** Both authorized jobs succeeded; all six measurement receipts passed authenticated version-specific readback, SHA/size/source/image joins and independent review. All seven launch gates passed, and the frozen verifier completed `MEASUREMENT_VERIFIED_AND_ASSEMBLED` through the canonical runtime-values validator and assembly CLI. The two-job allocation is consumed. Actual billing was not audited.

- [Complete evidence index](pr193-retention-build-20261019/README.md)
- [Independent actual-result review, six immutable receipt references and coverage limits](pr193-retention-build-20261019/MEASUREMENT-RESULT-REVIEW.md)
- [Neo private local re-render/upload handoff](pr193-retention-build-20261019/NEO-PRIVATE-RERENDER-HANDOFF.md)
- [Canonical runtime values](pr193-retention-build-20261019/public-candidate/runtime-values.json): 28,933 bytes; SHA-256 `46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d`.

The Node image remains undeployed. Private re-render, approved private upload, final deployment review and authenticated live acceptance remain receiving gates. No private bundle was read or transmitted, and no deployment, model call, SQL or IAM/network change was performed in this qualification cycle.

## Exact source and authorization

Source: `5b395d4ce9218b872b21c420dc00a3af31739824`, tree `22860a8dc42fc63d9d2f0016432f7c1b7ff41858`. Remote `refs/pull/193/head` was verified at that exact commit before preparation. The previous `9acbfe7168eb4e9c1e2c3acb02e2a28d08bbd262` archive and proof remain preserved as superseded evidence and must not be uploaded or built.

The parent assigned this lane as sole next build operator, with Fable paused, and authorized one corrected Node build using the existing schema-v2 recipe/project after all preflights. Cycle allocation: at most two attempts/$5 additional, overall ceiling $610. A bounded qualification measurement route may use the remaining allocation after image-build success. No deployment, IAM/network change, private bundle or credential inspection is authorized. Automatic retries remain zero.

## Source review

Read `MERI-LOAD-RETENTION-RELEASE-20261019.md`, the exact two-production-file delta and committed regression evidence. The control composer injects its existing canonical retention gate. After the final task verification, the worker acquires that gate's release fence for the authenticated conversation, uses the scoped assertion, checks deadline/cancellation and serializes inside the lease. It awaits release before temporary-session cleanup. The source retains the original deadline and authority checks.

Recorded affected checks: 38 retention cases, 168 session/stream cases, 39 load cases: **245/245 pass**. The repaired regression records HTTP403, `promptPresent:false`, canonical projection `SUPPRESSED`, three task checks, four prior retention assertions, one release/scoped assertion, zero serializations and zero writes. This lane inspected those committed results and independently reviewed the boundary; it did not duplicate the product sweep.

The regenerated candidate `m` has SHA-256 `9350fb7a077d42369a5a2dc14f598dd228c67a21de76cd6791465581db6d381c` (35,352 bytes). Focused proof: **22/22 pass**, generator check and whitespace check pass. It preserves the historical45 plus seven supplemental source paths; 50 paths require Docker COPY. See `SOURCE348-PR193-RETENTION-PROOF-20261019.md` for the exact chain and evidence. Proof/document files remain outside runtime COPY and name the exact production source above.

## Official seal and independent audit

The canonical source sealer ran with Python3.12.14, lazy Git fetching disabled and network protocols disabled. The independent audit verified all 17,503 required Git objects, every blob identity and every archive member's SHA-256, byte count and Git mode. No missing objects or unexpected members remain. Member count20,254; raw member bytes410,012,145.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `product-source.zip` | 276,999,220 | `cee8da7ad937cc120b56ca653f56725466eb8376e38fafc5c41447d73bdfa11a` |
| `product-source-members.json` | 4,126,429 | `d408c32d5c2f056a5c1aec63c4bfdbe4b67fa5e4a1148eaa4d61d67da48f233e` |

The manifest matches independently computed raw-Git bytes exactly. ZIP metadata, order, commit comment and modes pass. The unchanged producer/verifier/recipe/Dockerfile and fixed24 Linux identities retain their prior hashes. The separate startup-budget regression remains outside Docker COPY. Exact source pin inputs and raw audit are retained in the task's `pr193-retention-source-audit` directory; the official packet is in `pr193-retention-build-packet`.

## Operator preflight and environment

The existing `default` AWS profile through the approved escalated execution route resolves account `967807252336`, principal `arn:aws:iam::967807252336:user/jump-cli`, region `us-east-1`. The sandbox has no configured profile; no credentials were read or copied. The existing project is `meri-greenfield-qualification-build`, Linux standard7.0/SMALL, privileged Docker, concurrency1, timeout30/queue5. The source bucket has versioning enabled and existing SSE-KMS key `1cca74fc-d9ae-43a6-8bfd-b93107e90042`.

The six latest project builds were terminal; no successor image tag was found. Both exact successor input keys returned404 before upload. The fresh attempt is `ef2439c9e0afe141d11e27836503975f`; its exact ECR tag returned `ImageNotFound`. These reads do not replace the final duplicate check before start.

Local Docker's server OS is Windows, so this lane cannot claim a local Linux launch measurement. The supported next route is a separately reviewed, bounded measurement-only job on the existing Linux qualification project after successful image production, counted within this cycle's allocation. It must pull the exact produced digest and preserve all canonical launch gates and source/image joins. The parent explicitly selected the public C packet at `5a42ec962677e70e76db5433330b52fd34db5bcd`: preserve three turns, one tool, no capability profile and no active-read/features expansion. Absent optional lists retain renderer semantics; no list is invented. Only image/source/receipt and image-derived measured values may change. This cycle does not qualify broader capabilities.

## Product build and exact receipts

Source/proof/seal complete. Both nonsecret files were conditionally uploaded with full-object SHA-256 and the existing SSE-KMS key; version-specific HEAD readbacks match exact sizes/checksums. Source ZIP VersionId: `wzj36s_GpR.73i.Gs6_AwP5BiWHAvXtw`; manifest VersionId: `JSV4IDhthFSNgfIaqNXWEcYsumTN45iP`.

The official verifier returned `VERIFIED_SOURCE_ONLY`. The canonical buildspec is25,495bytes, SHA-256 `fd1c57c774d5afa29c77f674e2745c345c9a4c3055d9efa7c6328edfaf21b26e`; canonical request SHA-256 `456df153a53d9b52c0038447e93926e43f1d8e6acf6c994d1e3e4fa6163999cd`. StartBuild request file SHA-256 `80a3865b346c57c21c6280d28da2cd3288e44907648e577cee667686248e873d`. At19:23:31UTC the final check found10recent builds terminal and the exact attempt tag absent.

Build **`meri-greenfield-qualification-build:2d0c9e04-a170-46d2-9d0b-f4094e6a48e8`** started at **2026-10-19T19:23:50.451Z** and **SUCCEEDED at19:29:48.443Z**, using the verified source version, timeout30/queue5 and automatic retry limit0. BUILD took340seconds; artifact upload succeeded. This is the first authorized image-build attempt of this cycle.

The resulting image is `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49`, tag `product-5b395d4ce9218b872b21c420dc00a3af31739824-ef2439c9e0afe141d11e27836503975f`, pushed19:28:58.218Z. Independent ECR readback reports COMPLETE with an empty finding-count map. The canonical producer receipt reports Nodev24.21.0, glibc2.44, uid/gid1000:1000 and verified native dependencies. The diagnostic reports SUCCEEDED, phase RECEIPT, cleanup OK and no primary or cleanup failure.

Both producer outputs were downloaded by the VersionId selected from authenticated HEAD, checked against GET VersionId/length, then hashed locally:

| Output | S3 VersionId | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `product-image-receipt.json` | `QB..1ACwXHizqlDslq_QFvZPpFUpueag` | 2,479 | `0ce6958ec9c9268ee32fa5ae22ba07e3e13de336419448f8ea635997d45607d5` |
| `product-image-diagnostic.json` | `R9cPtPv9LOKLFqJ6NCYXy5Dai.vAAgBn` | 192 | `49cb04ff0b16011c5559b0e1a30adc06fd363904272614ddbf470572d5f1852a` |

The initial measurement packet preserved C's three turns/one tool and absent feature selectors; 34/34 focused synthetic checks and independent packet review passed for those recorded bytes. Local preparation initially refused missing locked runtime/conversation dependencies; those were installed with scripts disabled, and preparation completed under bundled Node24. The inline packet then exceeded CodeBuild's25,600-byte limit; the raw UTF8 and concatenated encodings were also refused locally at26,725 and26,418bytes. Those refusals occurred before submission and consumed no AWS job.

The parent authorized continuing through the remaining single measurement job and preferred an established pinned external artifact pattern. The author/reviewer prepared and independently approved one public payload under the existing bucket's `inputs/launch-measurement/` prefix, using the canonical producer's exact VersionId, length and SHA-256 download checks through its bounded command adapter. No IAM or source archive/image change was required. These local dependency and packaging steps were not additional AWS attempts.

The `product-result/` directory retains the full public producer receipt, diagnostic, terminal build record, selected-version download records and independent image/scan readbacks. `public-candidate/` preserves the reviewed C policy/allocation unchanged and updates its Node deployment image/source, receipt and image-derived measurements. The completed public candidate retains the existing placeholder external origins; these must be supplied from Neo's existing authorized private inputs at local render time. No deployment or live acceptance is claimed.

## Exact-image measurement attempt

The public payload contains the exact canonical plan and unchanged reviewed measurement wrapper. It is76,918bytes, SHA-256 `3587ebafba8f379e944845d80f43c2c2046496c85d67b37f576bd7257a0628c7`. Its plan is42,088bytes, SHA-256 `66b5956d6ca139a2e4159b827a096bb8b739d72712671ac8a149b35440e36298`; wrapper SHA-256 `8afb2093090a80c92f50f6988e21d182cf8a98fce61d5923674bb60db2d5d93c`.

After independent payload review, root conditionally uploaded only that public payload to `inputs/launch-measurement/5b395d4ce9218b872b21c420dc00a3af31739824/113ba3cc0d3f4baf978e157a347c9654/measurement-payload.json` in the existing qualification bucket with its existing KMS key. PUT, exact-version HEAD and GET agree on VersionId `s2LyKxvj0w39XEMmWWKZ1oKI1HEKbPFS`, full-object checksum, length and encryption. Downloaded bytes match the reviewed payload. The small inline bootstrap verifies the canonical source adapter before using its bounded commands to download this exact version, verify length/hash and reconstruct the exact plan/wrapper. It emits constant-only failure markers. Twelve focused payload/roundtrip/refusal checks passed, including generated Python bootstrap execution with AWS/wrapper execution replaced; these are offline checks, not image qualification.

The final buildspec is3,867bytes, SHA-256 `38340a4f678d8000fa5fae237cea8f6d67a6bbf34e78b19a098f79501db56c54`. The4,771-byte StartBuild request SHA-256 is `dd581fab794c42ed9aeeed683bbd4ac0c02943caf6ba9b4ddfc14ff964ddaed4`. Independent final request review passed. Fresh prestart reads at19:49:19UTC found all10latest builds terminal, unchanged existing project/role, the new result prefix empty, and the exact image scan COMPLETE with no findings.

Measurement-only build **`meri-greenfield-qualification-build:56cd3c64-a7cb-46ec-9cd6-86f92041bbed`** started at **2026-10-19T19:51:14.033Z** and **SUCCEEDED at19:52:48.735Z**; BUILD took79seconds and artifact upload succeeded. It used the same source archive version and exact successful image digest, timeout10minutes/queue5minutes/retry0, and attempt `113ba3cc0d3f4baf978e157a347c9654`. This consumed the second and final authorized AWS job in the cycle. It performed no image build/push, model call or deployment. The diagnostic reports SUCCEEDED / COMPLETE / cleanup COMPLETE with `commandFailure:null`.

## Accepted measurements and reused inputs

The six exact-version receipts, their authenticated HEAD/GET pairs, terminal records and frozen verification output are preserved under `measurement-results/` and `measurement-operator/`. The [independent review](pr193-retention-build-20261019/MEASUREMENT-RESULT-REVIEW.md) records every S3 VersionId, size and SHA-256 and found no unresolved result-review finding.

All seven gates passed: `compileNativePreparationIntent`, `matchPreparedDescriptor`, `commandIsRealpath`, `executable`, `runnerCaTrust`, `secureStorage`, `runnerSdkOptions`. Both synthetic-binding probes produced SDK-options SHA-256 `fbc8e95d618b9c3d0063af4f72be9588c96980822e8031971e641119bf28f78c`, with `sdkOptions.runInvariant:true`. The freshly measured native CLI is256,113,848bytes, SHA-256 `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`, compiled CLI version2.1.295; SDK/platform package0.3.295. Independent readback agrees on the module, runner, CLI and Node hashes. Separate native/package probes verified glibc2.44, SWC and Temporal native loading and exact package pins.

| Values | Current evidence | Relationship to C |
| --- | --- | --- |
| Node image/source and producer receipt | New successful product job and exact ECR/S3 records | Updated to5b395d4c / ea0e9ad4 |
| Descriptor, CLI, runner, SDK options, 15 skills | Fresh exact-image measurements and independent readback | Semantically equal; independently measured again |
| Complete read-installation inventory | Fresh source/image measurement, 76 rows | Same refs/order; one handler-source hash changed |
| Policy, allocation, limits, layout | Reviewed C inputs, validated by canonical assembly | Reused; three turns / one tool |
| Features, capability profile, active-read selectors | Absent in approved configuration | Remain absent |
| Proxy main image/source; five Temporal server images/source | C inputs plus current image metadata | Reused unchanged |

Only `memory.list_own_proposals@0.2.0` changes its handler-source hash within runtime values, to `4206e85834d584b6f0bb73e6460e21514f3f3ccb285842a178533675533fe5dd`. The complete inventory digest is now `cb70bb9306bd7dbd498dd8ced1cbd370e4e262217fffc172ab6311942d5e1526`. Installing or measuring76rows does not establish that76capabilities are enabled or complete.

## Fixture and live coverage limits

The successful pinned producer enforces its fixed24 Linux identities (B6/R6/W12) before push/receipt, refusing failures, skips, unknown/duplicate identities and count mismatches. Its success diagnostic does not retain a per-case `linuxTests` receipt or TAP transcript. The honest outcome is successful enforcement by the pinned producer; there is no separately retained per-case receipt. The245source checks,22proof checks,34packet checks and12payload checks remain distinct scopes. Excluded startup-budget/load/retention tests were not added to the fixed24 gate.

The launch module intercepts SDK process spawning with two synthetic bindings. It verifies intended launch options and native CLI bytes; it does not execute that CLI, make a model call or prove an authenticated conversation. The separate native probe loads SWC/Temporal native components. Broader capability behavior, historical graph-fixture gaps, private material, production retention race behavior and desktop/browser/Core live acceptance remain outside this measurement. Disabled source is not counted as completed product behavior.

## Fresh live metadata and receiving gates

Read-only metadata at19:58:57–20:00:33UTC records all ten services at desired/running1/1, pending0 and rollout COMPLETED. Current/latest ACTIVE revisions are control33, application temporal-worker32, issuer32, owner31, proxy31; latest runner18. The canonical derivation over both ACTIVE and INACTIVE observations gives candidate next revisions control34, worker33, issuer33, owner32, proxy32, runner19. These numbers are **not reserved**; Neo must repeat the read immediately before private render and compare again before any separately approved apply.

The observed Node digest is `9bff84ba24959130e63e64b2ac72783144053084168fcf14f4344f4dd8583717`, so the new `ea0e9ad4` image is not deployed. Proxy main image remains `734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551`; its material-init uses the Node image and must be included in a coordinated receiving render. Five Temporal server images remain `f73ce01ef4739a77fad6ace3fbfbbe1f1aeaa553b5c263d705053a2f5063cf2d`. Public metadata does not validate private material contents.

The [Neo handoff](pr193-retention-build-20261019/NEO-PRIVATE-RERENDER-HANDOFF.md) supplies canonical local commands, exact C compatibility helper, existing private-path placeholders, fresh revision/foundation/role drift checks and the five existing secret mappings. Secret upload and deployment remain held for the parent's separate approval after the private render and review. No current source/image measurement blocker remains; pending gates are private render and public digest review, approved upload/version binding, deployment approval, then authorized live functional/desktop/security acceptance. The larger labelled corpus remains a later gate under the agreed launch split.
