WAVE5 MM12 — NATIVE UPLOAD SCAN/EXTRACTION HOST INTEGRATION (Hermes implementation worker)

Status: LIVING HANDOFF. Source-level integration implemented and locally tested. NO Release, host, image,
tool or corpus qualification is claimed. Update this file in place as facts change; do not create a second report.
Author: Hermes implementation worker (default profile). Date: 28 October 2026.

1. CHECKPOINT THIS WORK SITS ON
   checkout : C:/Users/Administrator/Documents/Codex/2026-10-27/wave5-orchestrator-20261027/work/wave5-upload-native-host-hermes-20261028
   branch   : codex/wave5-upload-native-host-hermes-20261028
   base HEAD: 5fb6edf38b994a13bc08bd4854121dffda3193f0
   base tree: 1099022cd6c34a4df5352edfe923e17948dcea2c
   "Compose typed prior-chat attachments through the canonical native reader"
   New work is confined to the untracked directory apps/runtime/uploads/ (4 modules + 4 tests).
   No registry/package/export/version/lock/migration/Dockerfile/renderer-source edit was made.

2. WHAT IS IMPLEMENTED (source, this checkout)
   apps/runtime/uploads/native-sandbox.mjs
     Fixed no-model child boundary: one bubblewrap plan spine shared by the probe and by every scan/extract child,
     so the boundary that is observed is the boundary that scans and extracts. Roles probe|scan|extract with fixed
     workspace-name prefixes; --unshare-all, --die-with-parent, --new-session, --uid/--gid 1000, --cap-drop ALL,
     --remount-ro /, private 0700 owned workspace bound at cwd, prlimit fsize/nofile/nproc caps. Definitions root and
     extractor program are read-only by construction (fixed --ro-bind entries), never by a caller flag. Argument plans
     are closed: the scanner gets only the fixed ClamAV flag set plus the single target name input.original, the
     extractor only the pinned program plus one allowlisted format token. Host modality refusal on non-Linux, non-1000
     uid, symlink/non-dir/not-0700/non-realpath-stable workspace. Reuses runArtifactProcess (apps/artifacts/process.mjs)
     for bounded lifetime/kill-group semantics and the reviewed renderer observation/requirement owners
     (apps/artifacts/renderer-probe.mjs, renderer-qualification.mjs, renderer.mjs) rather than duplicating the spec.
   apps/runtime/uploads/native-definitions.mjs
     Server-owned signed-definition owner tracing the official FreshClam CVD/CDIFF path. The freshclam config is
     generated from constants (fixed DatabaseMirror database.clamav.net, ScriptedUpdates yes, TestDatabases no, Checks 24,
     no NotifyClamd / no clamd / no global cache), written 0600 under the owned provisioning root. Every database file is
     verified with `sigtool --verify` before any snapshot is published; a failed refresh or unverifiable signature leaves
     the previous snapshot untouched and fails closed. The published snapshot binds an exact sha256 over the file set
     plus a publish date; the read-only store distinguishes missing/unparseable (UNAVAILABLE), stale (STALE),
     future-dated or non-verified (CORRUPT) and never rewrites it. No live download runs here.
   apps/runtime/uploads/native-inspection.mjs
     The two ports A5's upload owner consumes. Each port runs exactly one fixed child through the observed sandbox and
     binds the receipt to the exact original bytes/hash plus native tool name/version/binarySha256, the image digest and
     the signed definition snapshot. scan() returns status clean|infected|unavailable; ClamAV max-size/encryption alerts
     map to SCAN_LIMIT_REACHED (NON-clean, non-infected): content that was not fully examined is never called clean.
     extract() returns the fixed child's bounded result re-anchored to the same original, with status
     available|partial|unavailable|blocked and coded limitations. observeUploadTools reads the pinned tool paths and
     versions the scanner/python inside the same sandbox; an unreadable or unversionable tool is unavailable, never assumed.
   apps/runtime/uploads/composition.mjs
     The caller-join seam. It issues the ports only for an observed upload-sandbox admission and observed tool
     identities; otherwise it returns null ports plus an exact `missing` list, so the upload owner reports
     SCANNER_UNAVAILABLE / EXTRACTOR_UNAVAILABLE instead of a fabricated qualified flag. No cloud probe, no credential
     owner, no S3/IAM change, no new transport.

3. INTERFACE / CALLER JOIN (traced, read-only)
   Existing consumer: S/work/wave5-m5-upload-custody-20261027/apps/control/uploads/
     extraction.mjs  createUploadInspection({scanner=null,extractor=null,now=Date.now}) captures the two server ports
                     (storageMethod(scanner,'scan'), storageMethod(extractor,'extract')) and calls
                     port.scan({file,bytes,limits,deadlineMs,signal}) / port.extract({file,bytes,limits,deadlineMs,signal}).
                     Its scanReceipt/extractionReceipt validators fix the exact receipt key sets and the
                     clean/infected/unavailable and available/partial/unavailable/blocked invariants.
     custody.mjs     createUploadCustody({...,inspection,...}) consumes {inspect} and gates promotion on
                     r.inspection.scan.status==='clean'; it revalidates retained observations with
                     validateUploadInspection(raw,declaration,{fromMs,toMs}).
     policy.mjs      inspectUploadOriginal(declaration,input) is the hash+magic/structure/active-content preflight; the
                     file it returns is the `file` object my ports are handed.
   My port receipts were checked against those invariants (test: "receipts satisfy the invariants of A5
   createUploadInspection scanReceipt/extractionReceipt"), including checkedAtMs sane, tool present whenever status is
   not unavailable, reason non-null whenever status is not clean, limitations non-empty and unique whenever status is
   not available, and available+limitations coerced to partial.
   REMAINING WIRING (A5-owned; one call site, recorded in upload-native-host-claim.txt for coordination):
     const {scanner, extractor} = await composeUploadNativeHost({configuration});
     const inspection = createUploadInspection({scanner, extractor, now});
   A5 retains apps/control/uploads/* and the CONTROL upload host composition; this worker did not edit them.

4. THE ACTUAL PLATFORM PREREQUISITE (resolved as far as the evidence allows)
   Adopted host/transport for native isolated work in this repo is a configured AgentCore runtime invocation, not a
   locally spawned runner. Concrete existing owner: apps/runtime/artifacts/renderer-client.mjs
   createAgentCoreRenderer({region,agentRuntimeArn,qualifier,imageDigest}) invokes the configured runtime endpoint with
   a STRING qualifier and an EXACT expected imageDigest, and refuses any result unless the returned
   admission.imageDigest and qualification.imageDigest both equal the expected digest and qualification.state is
   'available'. The app-runtime config owner apps/runtime/agentcore-configuration.mjs fixes qualifier to 'preview' with a
   numeric runtimeVersion. So the supported placement shape is: configured endpoint + configured (non-numeric) qualifier
   + exact expected/observed image-digest binding + a returned qualification receipt. My composition uses exactly that
   shape (fixed imageDigest declaration, observation-based admission) and never a numeric-version assumption.
   The OTHER candidate — running the bwrap policy inside the existing CONTROL container on Fargate — has an UNRESOLVED,
   UNOBSERVED prerequisite: CONTROL is non-root UID 1000 on Fargate and must be able to unshare(NEWUSER|NEWNS|NEWNET)
   with NoNewPrivs=1. The frozen packet S/outputs/WAVE5-UPLOAD-HOST-PREREQUISITE-PACKET.txt and
   work/upload-host-prerequisite-20261027/probe.py describe the minimal probe for exactly that syscall; Release inspected
   the retained CONTROL image and found ECS Exec disabled with no execution agent and no authorized diagnostic channel,
   so NO syscall result exists. That is a negative/absent observation, not a pass. I did not enable ECS Exec/IAM,
   register or run a task, or probe the cloud, and I do not guess the syscall result.
   Consequence: `runUploadSandbox` (the local bwrap runner) is admissible only where a probe actually attests all eight
   requirements; `qualifyNativeUploadSandbox` refuses otherwise and `composeUploadNativeHost` then yields null ports. On
   this Windows author host the real runner refuses to spawn (test: "the real runner refuses to spawn on this non-Linux
   host") — honest, not a qualification.

5. IMPLEMENTED vs STILL REQUIRED EVIDENCE
   Implemented and locally verified (process/protocol source evidence only):
     closed argument/role/workspace allow/deny; real non-Linux modality refusal; observation evaluation and admission;
     definition provision/refresh/verify/snapshot read-only semantics; scan classification incl. limit/encryption alerts;
     receipt provenance and A5-invariant conformance; cancellation propagation and expired-deadline handling; fail-closed
     composition `missing` reporting.
   Still REQUIRED (Release qualification; not startable from this session):
     a real Linux/aarch64 host that attests the eight sandbox requirements through the identical probe; the real signed
     CVD/CDIFF provisioning with verified publisher signatures and a live hash/date snapshot; real ClamAV/Poppler/
     Tesseract/Python versions and image digest; a representative corpus run; and the adopted transport owner for uploads
     (the AgentCore-side upload runner or the CONTROL-Fargate child runner once its prerequisite is observed). Until then
     every receipt is `unavailable`/non-clean by construction and full MM12 is NOT done.

6. COMMANDS AND RESULTS (this checkout)
   Node: "C:/Program Files/nodejs/node.exe" v24.22.1 (satisfies the >=24 <25 gate).
   Module load check: native-sandbox OK 15 exports, native-definitions OK 11, native-inspection OK 10, composition OK 2.
   node --test apps/runtime/uploads/test/{native-sandbox,native-definitions,native-inspection,composition}.test.mjs
     tests 22 | pass 22 | fail 0 | skipped 0 (the two real-host cases are guarded by process.platform, not mocked).
   Source sha256:
     24603c9794ed57412ec8ae07b2909f7f41704027b77483613123a7180fa08c51  native-sandbox.mjs
     5db443de5dae431a9f657d0a2c93ddf818f53165f130f23ea771a3c63dea101d  native-definitions.mjs
     c98ab3b89a0cd7d7544c11ee94d690b2028c071d273db3d5c6043c3899ece814  native-inspection.mjs
     8f51d0978b728f811e8e833654a8e00addb94e0c74ff3145f2c3fef06d60f4a3  composition.mjs
     a50f373189ece277ed25d9b446e6f3bd10aff820266c6eeef7de1c95c13f069a  test/composition.test.mjs
     96910c7cbf62d1cdcc85079d1cf1926a80e99cfde6e1417534cc3ebe9831c65f  test/native-definitions.test.mjs
     7e1b69460b1d99d9719cbf09cd27a70845d493a4ef3de428f0231a1fdc1dad60  test/native-inspection.test.mjs
     be502723a3576a1476a505238a3f391af6371980c87cfcd61cd8f2ba48a447c1  test/native-sandbox.test.mjs
   A5 read-only reference hashes (unchanged by me):
     8a0d7708609a80c3a7bc29676b21445614a0afd1b2747f14c735b65274ad2082  apps/control/uploads/policy.mjs
     6daaac36f576b59d011154e859ac2802c20b77e83bc891fd00845910d7b5ffd5  apps/control/uploads/extraction.mjs
     c74b646e69062dbc49fd38422f6f3bab96b48bef273a248f2f49062474f1a76b  apps/control/uploads/custody.mjs
     514de3de248af1a4685e767254e2c81af8bf25d5fcdbcbd2f8e271184306ed63  apps/control/uploads/application.mjs
     57ae03c292a2012a1ddc9d5388c5b84433e8ba7fc9db1381cebd543bfe0108ab  apps/control/uploads/native/extract.py
   Failures hit and fixed: three test expectations that mis-modelled the implementation (Windows path join in the
   freshclam DatabaseDirectory assertion; unparseable snapshot is UNAVAILABLE not CORRUPT; a blocked extraction keeps
   the extractor tool identity). No implementation defect was found. Real-host cases were not weakened to pass.

7. DO NOT DO (explicit non-goals of this slice)
   Do not edit any existing renderer/qualification/probe/process/AgentCore/renderer-sandbox/image owner, any common
   registry/package/export/version/lock/migration/Dockerfile, or any apps/control/uploads file. Do not enable ECS
   Exec/IAM, register or run a task, or probe the cloud. Do not add a credential owner or an S3 grant. Do not accept an
   uploaded executable, environment value, plugin, configuration or child command. Do not add an injection-only hook and
   call MM12 complete. Do not treat a local mocked admission or a green unit suite as a physical sandbox/tool/corpus
   qualification. Do not duplicate the already-implemented MM11 generated library/history.
