# Verification, 2026-10-14

Base: exact PR85 258082eb5e1097812159045689c0131a8cbd6726. Frozen failure receipts
and earlier branches remain intact. New recipe/source provenance is explicitly
unsealed for a future packet, not qualified as the historical 0898fadd code.

Approved diagnostic build:
meri-greenfield-qualification-build:05e0177c-b3fb-4f92-ab34-64e421e8adfc.
It used the frozen PR85 2,401-file source plus a sealed diagnostic overlay. No ECR
push, deployment, DB write, app/model startup or admission occurred. Private receipts
remain outside Git in meri-linux-diagnostic/.

Baseline: Node24.21.0 Linux x64, glibc2.36; SWC1.16.18 optional package present,
ELF machine62. Exact cause ERR_SWC_NATIVE_CACHE: user cache EROFS on readonly root,
fallback /tmp noexec. Both causes are observed, rather than inferred from a generic trace.

Guarded materialization passed. Raw addon: 30,745,616 bytes, SHA256
13e460557d098ffed63df9eea082b6d5c6933899fdc883b8c8d54aba1c5a0bce.
Fresh cache-independent native transform passed. Original readonly/network-none,
noexec tmpfs, non-root, caps/PID/memory restrictions remained intact.

Actual Temporal1.24.0 bundle: 1,657,570 bytes, SHA256
817d2bd6faae40e1c2fc517811689ffa1bd8c620d41b4745425f09d13b79190f.
POSIX fixtures: five passed. Full native probe then failed at missing proof source
prepared-execution-claim-pg.test.mjs; the 45-file gate and aggregate admission failed.

Promoted helpers are byte-identical to those tested in Linux:
materializer cd34a83e28ebbd70ff6acdfaf636938d30d609d86a1f509d8c0d8a7abda897fe;
diagnostic de82332711daf9af8a3475eb0f97305ee2b127696c08f78b04e2b9f72a2ad329.
Narrow attributes preserve these bytes. There is one canonical diagnostic implementation.

All45 files exist with expected bytes in the frozen archive. The exact16 excluded
test sources now have allowlist exceptions, parent reopening and sibling denial.
Static audit verifies the complete original45 path set, all44 unchanged non-recipe
hashes, each candidate file hash, exception set and exact helper hashes. Actual Docker
COPY testing now verifies all45 source hashes and both helper copies.

Local source/diagnostic tests pass; four producer guard/receipt tests pass. Real
upstream Temporal also passed locally. Earlier Windows file-symlink creation returned
EPERM and stopped. Owned Windows materializer fixtures rejected an external fallback;
no ACL/cache configuration/security opt-out was used. Their private evidence remains
outside Git. The later Linux diagnostic proves only the observed guarded mechanism.

The integrated new recipe plus16-file packaging change is not yet natively qualified.
Actual Docker COPY verification awaits a working approved engine/fresh source build.
No further paid attempt is authorized here. New commit/archive/manifest/probe pins
must be sealed; stale/mismatched/unsealed provenance holds before upload.
