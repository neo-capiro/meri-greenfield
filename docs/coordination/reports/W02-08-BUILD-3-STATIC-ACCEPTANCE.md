# Worker attempt3: owner static reconciliation

Codex integration owner, 10 October 2026 UTC. **ACCEPTED as a successful, statically reconciled qualification build only. NOT RUNTIME OR SECURITY ACCEPTED.** CodeBuild `meri-greenfield-qualification-build:f78dc8c3-a0d9-45b1-a893-9abb1f403287` completed SUCCEEDED at03:57:06.050Z. The owner verified the complete new result, inventory, source and publication bindings. Neither failed attempt2 image527e6d8 nor its diagnostic evidence is admitted or substituted. See [attempt3 preparation and dispatch](W02-08-BUILD-ATTEMPT-3.md).

| Immutable binding | Verified value |
| --- | --- |
| Source / consumed run | `0be04d0799c9c527e300b47c19176cddb0eaa231` / `88ac3e91-6a31-4df6-8b13-e5ee39940790` |
| Source archive SHA256 / S3 version | `1cc7457901e42c2ce6efadf2d1647139489d598fe4310f6314457d611a1345f8` / `11FDWLVOZMj6U2Y.iHnQEJsAc5UGlq4A` |
| Image digest | `sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c` |
| Referenced image config | `sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471` |
| Result S3 version | `18aD4wwhjBMOmnGQWp3zfJbnC3jKUnAG` |
| Complete result bytes / SHA256 | 7,566,681 / `685a4180f8b33f35268f95ad8eed0ebd7b0eed05a47e3aeb492e67ca759d22ee` |
| Original inventory bytes / SHA256 | 5,671,849 / `a9f2ffb41e5fe251319f3e6c328529af679d83ea5e67c57097a90e685a62976f` |

## Owner verification and preserved failures

The owner read the complete five-module data auditor, its two narrow repairs, retained synthetic tests and independent static inspections before execution. The auditor reads supplied local data; it performs no cloud, Git, helper, Docker, native or model operation. Its Windows identity reader preserves within-API continuity while accounting for the already observed path/FD ctime API difference; production Linux code remains unchanged.

The first new readback capture stopped at AWS CLI local parameter validation because GetObject still required explicit bucket/key flags alongside the JSON input. No GET body or final envelope was produced. A separate new capture with those explicit flags completed seven read-only AWS calls: fresh principal identity, exact source HEAD, terminal build, exact result HEAD/GET and ECR digest/manifest readbacks. Four other envelope payloads are retained actual dispatch-time request/response/project/upload copies; their later local copy-selection timestamps are not new mutation timestamps. All eleven payloads are hash-bound in envelope `f1034a2d1c03520e7d96246e204c7d458f333a16f0b6284777a1afd930c5ae14`.

Owner audit1 failed closed after one completed group because CodeBuild returns exact empty typed context placeholders for successful phases. It wrote no result directory. A narrowly scoped validator repair accepts only absent/empty contexts or at most100 exact `{statusCode:"",message:""}` placeholders; substantive, whitespace, malformed and excess contexts still reject. Unique explicitly SUCCEEDED BUILD and top-level SUCCEEDED remain mandatory. Independent static inspection confirmed only the intended validator changed and all prior tests remained intact; the repaired synthetic suite passed22/22. The failed invocation remains preserved.

Owner audit2 was a new single execution after that source correction, with exact five-module hash pins and a60-second outer bound. It exited0 in0.844seconds and completed nine groups: builder baseline/configuration and15/5-minute limits; raw commit/full tree and all287 archived blobs/25protected files; source and cleanup/spec pins; complete cleanup receipt and pinned absence-before-publication verifier; both inert never-started container observations/removal identity; raw ECR manifest digest/config reference; every inventory entry, root, alias, expected pin, privilege and candidate view; and explicit readback request/version/digest/timestamp provenance. Independent read-only evidence inspection subsequently reconciled all25 input hash records, all11 readbacks and the counts below.

Private owner audit: `.task-inputs/worker-result-v3-audit-template/runs/owner-audit-0be04d0-88ac3e91-2/audit.json`, SHA256 `e7d0a4d0593456cf8939f8f7334a1849fdb7952d7cca6953aece176942fefe54`. Invocation/output captures: `.task-inputs/W02-worker-v3-primary-result-audit-2/`. Readbacks: `.task-inputs/worker-v3-result-readbacks-owner-2/`. The embedded auditor limitation describing non-execution applies to its support author; the owner execution is separately evidenced here.

## Cleanup and inventory scope

Receipt `meri-worker-auth-cleanup/1` reports CLEANED, observed root and verified absence for `/tmp/meri-worker-auth.ZYhr7S9j`, bound identity `[37,396953252]`:14entries,7files,314bytes,maximum depth4. The pinned recipe checks the original bound identity and absolute absence before final publication; the successful build and complete receipt reconcile that producer behavior. The original AUTH_IDENTITY observation and independent lstat bytes are **not** separately exported or independently reobserved. The reviewed trusted build host/daemon/recipe and absence of any mounted child beneath the fresh0700 auth root remain prerequisites. This is not hostile-root or bind-mount containment proof.

All26,834 inventory entries were processed, including22,623 files,1,022 symlinks,four expected pins and two expected privilege entries. Errors, unexpected privileges and expectation failures are zero; no bounds were exceeded. Counts were recomputed from this image's complete original inventory, not copied from an older image. This is retained producer inventory, not a fresh independent filesystem walk. Raw registry config and layer bytes were not separately fetched/rehashed. Container removal absence is enforced by the pinned producer; the result records matching container IDs, rather than an independent daemon-absence export.

## Security disposition at this checkpoint

The COMPLETE scan03:57:34Z contains **49 findings:4CRITICAL,18HIGH,18MEDIUM,7LOW,2UNDEFINED**. All22 critical/high CVE/source/version tuples equal attempt2; none was repaired or removed by cleanup v3. The sole addition is MEDIUM `CVE-2026-107655`, cups `2.4.10-3+deb13u2`, which remains OPEN. Raw scan SHA256 `4eb6bd90a8bf2fdfd312b2d850ef40348da94f9f0339bed710a007263e84bc42`; complete local comparison `66c25ac9cd3791193ad8d3ff3388c27d474b89e3f3cc3d7d0f31bed714aab384`.

**No security waiver or runtime admission is issued here.** Retained primary-source triage has not established a coherent fixed Trixie replacement. Five older vendor-open findings omitted by the scan, three prior fixed-package candidates requiring installed-copy proof, disputed version ranges and bundled-library mapping uncertainties remain open. Scanner counts, fixed input and restricted egress do not repair native memory corruption. Fargate no-new-privileges is not claimed; the image retains two expected SUID Chromium helpers.

The owner will consider the reviewed SDK-only loopback synthetic fixture first, after accepted surviving enforcement, exact per-run immutable definitions and fresh complete IAM/network/DNS authority verification. It would have no real model/provider/source, credential, upload, public host or browser input. That later admission must explicitly retain applicable findings, bounded input/egress/authority, expiry and independently confirmed STOPPED cleanup. The Office fixture really exercises unresolved XML/ZIP/Expat/zlib/PDF parser surfaces; its separate residual-risk decision remains deferred, rather than automatically inheriting SDK eligibility. Browser-host, user documents, public/authenticated web, real providers, tenant data, product and release scopes remain unadmitted.

W02-14 is unaccepted and no next native task has launched. [G1 remaining work](../../qualification/G1-REMAINING-WORK.md) stays open; W03 remains queued. Current Meri and Capiro resources are unchanged; this checkpoint grants no cutover.
