# PR193 retention successor: source and image qualification

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

## Current state

Source/proof/seal complete. Both nonsecret files were conditionally uploaded with full-object SHA-256 and the existing SSE-KMS key; version-specific HEAD readbacks match exact sizes/checksums. Source ZIP VersionId: `wzj36s_GpR.73i.Gs6_AwP5BiWHAvXtw`; manifest VersionId: `JSV4IDhthFSNgfIaqNXWEcYsumTN45iP`.

The official verifier returned `VERIFIED_SOURCE_ONLY`. The canonical buildspec is25,495bytes, SHA-256 `fd1c57c774d5afa29c77f674e2745c345c9a4c3055d9efa7c6328edfaf21b26e`; canonical request SHA-256 `456df153a53d9b52c0038447e93926e43f1d8e6acf6c994d1e3e4fa6163999cd`. StartBuild request file SHA-256 `80a3865b346c57c21c6280d28da2cd3288e44907648e577cee667686248e873d`. At19:23:31UTC the final check found10recent builds terminal and the exact attempt tag absent.

Build **`meri-greenfield-qualification-build:2d0c9e04-a170-46d2-9d0b-f4094e6a48e8`** started at **2026-10-19T19:23:50.451Z** and **SUCCEEDED at19:29:48.443Z**, using the verified source version, timeout30/queue5 and automatic retry limit0. BUILD took340seconds; artifact upload succeeded. This is the first authorized image-build attempt of this cycle.

The resulting image is `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:ea0e9ad4cfcec1052c33b39ae2f41c1df6e591b7ab2e74c762a1f68f54990b49`, tag `product-5b395d4ce9218b872b21c420dc00a3af31739824-ef2439c9e0afe141d11e27836503975f`, pushed19:28:58.218Z. Independent ECR readback reports COMPLETE with an empty finding-count map. The canonical producer receipt reports Nodev24.21.0, glibc2.44, uid/gid1000:1000 and verified native dependencies. The diagnostic reports SUCCEEDED, phase RECEIPT, cleanup OK and no primary or cleanup failure.

Both producer outputs were downloaded by the VersionId selected from authenticated HEAD, checked against GET VersionId/length, then hashed locally:

| Output | S3 VersionId | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `product-image-receipt.json` | `QB..1ACwXHizqlDslq_QFvZPpFUpueag` | 2,479 | `0ce6958ec9c9268ee32fa5ae22ba07e3e13de336419448f8ea635997d45607d5` |
| `product-image-diagnostic.json` | `R9cPtPv9LOKLFqJ6NCYXy5Dai.vAAgBn` | 192 | `49cb04ff0b16011c5559b0e1a30adc06fd363904272614ddbf470572d5f1852a` |

Exact-image launch measurement remains pending. Its initial reviewed packet preserves C's three turns/one tool and absent feature selectors; 34/34 focused synthetic checks and independent packet review passed for those recorded bytes. Local preparation initially refused missing locked runtime/conversation dependencies; those were installed with scripts disabled, and preparation continues under bundled Node24. The inline packet then exceeded CodeBuild's25,600-byte limit; the raw UTF8 and concatenated encodings were also refused locally at26,725 and26,418bytes. No second AWS job was submitted.

The parent authorized continuing through the remaining single measurement job and preferred an established pinned external artifact pattern. The author/reviewer are preparing one public payload under the existing bucket's `inputs/launch-measurement/` prefix, using the canonical producer's exact VersionId, length and SHA-256 download checks through its bounded command adapter. No IAM change or source archive/image change is required. This packaging successor requires its own independent preflight before upload/start. These local dependency and packaging steps are not additional AWS attempts.

The `product-result/` directory retains the full public producer receipt, diagnostic, terminal build record, selected-version download records and independent image/scan readbacks. `public-candidate/` preserves the reviewed C policy/allocation unchanged and updates only its deployment image/source fields. It remains a public measurement candidate with the existing placeholder external origins. Fresh runtime-values and launch receipts are still pending; no deployment or live acceptance is claimed.
