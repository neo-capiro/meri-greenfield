W02-01 FINAL CANDIDATE (STAGE-10 INTEGRATION REPAIR) INDEPENDENT REVIEW
======================================================================

Reviewed commit : 577e8f07cf0f79029218d8d73fd0166244745cff
Prior candidate : 496abbfcde212b96e02ad69a22488cc70bfeb83a (stage 9; its review
                  preserved unchanged by the owner as
                  docs/coordination/reports/W02-01-IMAGE-REVIEW-STAGE9.md)
Cumulative base : 07652e874d061a29e92843798e5445d7a6f1d71d
Branch / cwd    : hermes/w02-image-review-final @ C:\dev\main\meri-greenfield-worktrees\w02-image-review
Reviewer session: 20261009_155115_bada70 (read-only continuation; 24-turn bound)
Report path     : docs/coordination/reports/W02-01-IMAGE-REVIEW.md

VERDICT: REPAIR REQUIRED (narrow, documentation integrity only). The composed
runtime/browser/Office code changes are correct and independently reproduced, and
both stage-9 findings are resolved, but the committed owned handoff
docs/coordination/reports/W02-01-WORKER-IMAGE.md contains a FALSE SHA-256 table
(5 of 15 files) and a stale nested test count (79 vs the actual 81). The image is
UNBUILT, open CVEs remain, and there is no G1 / security / runtime acceptance. The
recipe may proceed to a separately reviewed isolated build/probe once the report is
corrected; nothing here relaxes non-root / read-only-root / dropALL / --sandbox.


1. SCOPE
--------
Cumulative delta 4f69d68..577e8f0 = exactly the 9 previously-owned files;
cumulative vs 07652e8 = exactly the fifteen owned paths (all additions).
Protected paths (root package.json/package-lock.json, tsconfig, packages/,
docs/plans, infra, .github, tasks) are byte-identical to base. Per-commit:
e9008c8 (actual-flow gating + Office false-pass), 9225329 (fail-closed
inconclusive evidence), 9789cd0 (positive fixture authoritative child facts),
577e8f0 (reject errored generation + partial recalc facts). Dockerfile is
UNCHANGED across 496abbf..577e8f0 (its independent verification below stands).


2. CHECKS (independently run on exact commit, clean tree)
---------------------------------------------------------
  1) npm run check                                exit 0, tests 15 / pass 15 / fail 0
  2) npm --prefix apps/worker/qualification test  exit 0, tests 81 / pass 81 / fail 0
  3) git diff --check (vs 4f69d68, vs 07652e8, worktree)  exit 0.
Nested suite is 81 (NOT the 79 asserted in the WORKER report - see F2). Imports
open no sockets / spawn no children; default tests are hermetic.

Independent adversarial execution of the injectable offline functions (node
in-memory, no files written, no browser/Office/network), all PASSED:
- buildBrowserSteps+runBoundedSequence, fatal at sandbox-eval: stops, exactly 8
  MCP calls, sandbox-eval is the last ran, no later callback.
- absent browser_get_config: zero calls, recorded notRun.
- decideRecalc with GOOD observed [1,2,3]/=SUM(A1:A3)/numeric6: FAILS when the
  inspection child is missing, exit-1, signalled, spawn-errored, parseOk false or
  nestedOk false; PASSES only with all-authoritative inspect (status0, no
  signal/error, parseOk, nestedOk). Constant 6 without formula fails.
- decideNative fails for an errored/signalled child that still carries
  status0/parseOk/valid JSON.
- classifyNetworkResults: directIp timeout/ENETUNREACH/EHOSTUNREACH allowed;
  CONNECTED, undefined, 'weird' and error:ECONNREFUSED (and error:ECONNRESET)
  all fail closed; ECONNREFUSED removed from DIRECT_IP_DENIED.
- classifyUnshareDiagnostic never returns ok for timed-out / signal-killed /
  spawn-errored children even with an "unshare_ret=0" stdout.
- classifyHelperDiscovery rejects a non-root, wrong-bytes or non-4755 alias.


3. FINDINGS (concrete; repair required; not fixed here)
-------------------------------------------------------
F1 (HIGH - documentation integrity). docs/coordination/reports/W02-01-WORKER-IMAGE.md
lines ~268-272 (the "Changed files (the fifteen owned tracked paths)" SHA-256
table) lists WRONG hashes for 5 files vs their committed blobs at 577e8f0:
  - probes/browser.mjs:      report e77eddce…  actual c09bd204a86c0cbfcdfa397b9b1f6938b078f7b4b3c6989a59d3588db2c481e0
  - probes/artifacts.mjs:    report df06cabd…  actual 3155bd31447f37b27c512cc2522a46947241c0f3fd74d738bed54920486757d6
  - probes/runtime.mjs:      report 586f400d…  actual 56873762181926b276fc8283ceb9485d9fd55ef788bd4204b55feef241236716
  - probes/static.test.mjs:  report 00856594…  actual ef89b8e353aa63c214d2e9cdfa31d4319a069dd08344a01957b18e9d34682166
  - component-pins.json:     report a793b7ba…  actual a92a505b8580f1d1d343288fca480f962b2bf9dd67aaca6f81c9f12a6c54b17b
(The other ten rows, incl. Dockerfile, package.json/lock, README, artifacts.py,
requirements, sdk-options, .gitignore/.dockerignore match.) Repro:
`git show 577e8f0:<path> | sha256sum` vs the table. The values match neither the
committed tree nor 9789cd0, i.e. they are stale/fabricated. Repair: regenerate the
15-row table from the committed blobs at the result SHA.
F2 (HIGH - same file). WORKER report lines ~286/289 state the nested suite is
"tests 79 / pass 79 / fail 0" and "grew 69 -> 79"; the committed tree runs 81
(independently observed, exit 0). 577e8f0 added the decideNative error/signal
fixtures after the text was written; the report was not refreshed. Repair: state
81/81/0 and update the growth line.

Secondary observation (non-blocking): planBrowserSteps/shouldStopAfter are now
exercised only by tests - the production path uses buildBrowserSteps +
runBoundedSequence - so they are effectively dead in main(); harmless but should
not be mistaken for the live gate (the live gate is the shared driver, which the
fake-client fixtures do exercise).


4. VERIFIED CORRECT (positive; do not read as acceptance)
---------------------------------------------------------
- Browser composed flow: one shared granular driver drives main() AND the offline
  fake-client fixtures; after the FIRST fatal substep no later MCP call runs and
  remaining substeps are notRun; nav/snapshot successes without a Result section
  are not fatal (only isError / an actual `### Error` section / a missing
  loopback marker), while browser_evaluate stays strict. Verified by execution.
- Office: decideRecalc requires an authoritative inspection child in addition to
  the observed value; `recalc.child` retains status/signal/error/parseOk/
  parseError/nestedOk plus bounded stdout/stderr; artifacts.py keeps the
  documented XlsxWriter blank cache (never seeds 6) with observed inputs/formula/
  cached value + A4 XML/calcPr facts; artifacts.mjs keeps per-format convert/
  PDF/page/PNG child facts and seeds `partial` so accumulated observations survive
  a later throw.
- Network: direct-IP 1.1.1.1:443 negative with fail-closed ambiguous handling (a
  peer RST/refusal is not counted as blocked egress); DNS negatives + private
  Logs 10.80.0.0/16 positive unchanged. Classification tests are pure.
- Prelaunch diagnostics retain the pinned chrome AND helper path/realpath/uid/gid/
  mode/sha256, helper/chrome/root mount flags, self Cap*/Seccomp/NoNewPrivs/
  TracerPid + uid/gid maps, read-only sysctls, and the raw unshare spawn facts
  alongside the simple classification (never a Chromium predicate claim).
- Helper: Dockerfile (unchanged) creates a root-owned 4755 `chrome-sandbox` alias
  byte-identical to the pinned `chrome_sandbox` and asserts it after all chowns;
  the probe's discovery gate rejects non-root / wrong-bytes / non-4755 aliases.
- Dockerfile security recipe unchanged since my prior independent verification:
  immutable base node:24.21.0-bookworm-slim@sha256:d6aa754f… (amd64 manifest
  51b1100c…), fixed snapshot 20261009T000000Z, source-scoped Check-Valid-Until:no
  with Signed-By, HTTP CA bootstrap then HTTPS, direct pins (ca-certificates
  20250419~deb12u1, poppler-utils 22.12.0-2+deb12u3, libnss3 2:3.87.1-1+deb12u4,
  libexpat1 2.5.0-1+deb12u4, libreoffice u14, python3 3.11.2-1+b1) coherent in
  main+security, no-removal dist-upgrade, full dpkg inventory / runtime versions /
  SDK linux-x64 SHA256 / CFT per-file SHA256 checks fail-closed.
- component-pins unresolvedPins: the earlier stale CFT "per-file hash not pinned"
  text is corrected to "pinned and asserted by the recipe; refreshed-image
  installed-byte assertions remain unexecuted until its build" - accurate.


5. NOT RUN / LIMITS (unchanged)
-------------------------------
Refreshed image build + immutable digest and rescan; live non-root sandboxed MCP
Chromium, real download, browser/renderer attribution and chrome://sandbox verdict;
LibreOffice export + visual review (no exported pixels/PDF bytes claimed); the new
direct-IP/DNS/private-Logs controls (code present, unmeasured); Fargate read-only
mounts and task separation; remote opaque-session + workspace snapshots;
interrupt/resume restoration; SDK mirror_error; Temporal. Open CVEs (GnuTLS
CVE-2026-95210, tiff CVE-2026-52490) remain; prior f669 image 12 CRITICAL / 64 HIGH
and the failed baseline-2 STOPPED run remain visible. Local offline results pass
none of the live gates; no security/G1/runtime acceptance.

Handoff: reviewer session 20261009_155115_bada70; reviewed candidate 577e8f0;
report committed to docs/coordination/reports/W02-01-IMAGE-REVIEW.md (one file).
F1/F2 keep build admission blocked until the owned report is corrected/reviewed.
Stop.
