W02-01 CORRECTED IMAGE PREPARATION INDEPENDENT REREVIEW
=======================================================

Reviewed commit : 3d85f4ae9fed85956a2cc1afd9cce4c13e8bcefd
Parent          : a5d6f0e1142fe0dac33a6db9b9b732a8e6c7f914
Cumulative base : 07652e874d061a29e92843798e5445d7a6f1d71d
Branch / cwd    : hermes/w02-image-review @ C:\dev\main\meri-greenfield-worktrees\w02-image-review
Reviewer session: 20261009_155115_bada70 (read-only rereview continuation)
Report path     : docs/coordination/reports/W02-01-IMAGE-REVIEW.md

VERDICT: READY FOR CODEX BUILD REVIEW. All seven Codex first-review findings are
addressed in the corrected code (evidence below); no unresolved finding and no
concrete preparation/build defect found. Remaining items are build-time pin
verifications and intentionally-unrun live G1 gates. Codex alone accepts, builds
and deploys. This review does not pass G1 and does not qualify any live image,
browser sandbox, provider/session durability or source policy.


1. SCOPE (cumulative vs 07652e8 and per-repair diffs)
----------------------------------------------------
git diff --name-status 07652e8..3d85f4a => exactly the fifteen owned paths, all
"A" (added), 0 modified/deleted outside scope. Repair diffs are scoped:
  a5d6f0e (bf72484..a5d6f0e): Dockerfile, README.md, component-pins.json,
    probes/artifacts.mjs, probes/browser.mjs, probes/static.test.mjs, report.
  3d85f4a (a5d6f0e..3d85f4a): Dockerfile, README.md, component-pins.json,
    probes/browser.mjs, probes/runtime.mjs, probes/static.test.mjs, report.
git diff --name-only for protected paths (root package.json/package-lock.json,
tsconfig, packages/, docs/plans, infra, .github) is EMPTY => contracts, root
dependency files, infra, launcher and migrations are byte-identical to base.
All fourteen self-listed SHA-256 in W02-01-WORKER-IMAGE.md independently
recomputed from committed blobs and MATCH (e.g. Dockerfile 680c0d68, browser.mjs
c4e6f59d, runtime.mjs d52d3812, static.test.mjs ebada473, component-pins 5da824e1,
README cfee3e9e). Report's own file hash is intentionally self-referential.


2. CANONICAL CHECKS (independently run on exact commit, clean tree)
------------------------------------------------------------------
Node v24.19.0 / npm 11.17.0.
  1) npm run check                                exit 0, tests 15 / pass 15 / fail 0
  2) npm --prefix apps/worker/qualification test  exit 0, tests 55 / pass 55 / fail 0
  3) git diff --check (vs a5d6f0e, vs 07652e8, worktree)  exit 0, no whitespace/
     conflict errors.
Nested suite is non-vacuous (55) and grew from 38 (stage3) with genuine negative
tests, not count-only. Matches the implementation report's table.


3. PROCESS EVIDENCE (distinct states preserved)
-----------------------------------------------
stage3 process.json: exited-unreviewed, exit0, 0 remaining, cleanupConfirmed,
  resultCommit bf72484.
stage4 process.json: base bf72484, exit0, 0 remaining, cleanupConfirmed,
  resultCommit a5d6f0e.
stage5 process.json: base a5d6f0e, resume 20261009_152136_008131, exit0, 0
  remaining, cleanupConfirmed, resultCommit 3d85f4a. stderr.scrubbed shows the
  explicit resume marker; stage5 stdout documents the sandbox_internals.ts /
  CFT-archive inspection.
My first review session (W02-image-review/process.json): session
20261009_155115_bada70, exit0, no commit. All consistent with the brief.


4. VERIFICATION OF THE SEVEN CODEX FINDINGS (corrected code, path:line)
-----------------------------------------------------------------------
F1 apt expiry + CA bootstrap — ADDRESSED. Dockerfile:47,54,69,76 add
   source-scoped `Check-Valid-Until: no` to BOTH fixed snapshot sources only;
   Signed-By keyring retained (46,53,68,75); no trusted=yes/allow-unauthenticated
   (static.test.mjs:417-424 asserts this). CA bootstrap is deterministic: first
   RUN uses http:// snapshot and installs pinned ca-certificates=20230311+deb12u1
   (57), then sources switch to https:// (62-77) with normal CA verification.
F2 sandbox helper ownership/name — ADDRESSED. Browser tree is never chowned
   (only /workspace /tmp /opt/meri-worker at Dockerfile:154); find matches
   chrome_sandbox OR chrome-sandbox (137); a separate final RUN asserts helper
   owner=root, mode=4755, setuid, and tree owner=root AFTER all ownership ops
   (158-164). static.test.mjs:432-437 asserts no chown of /opt/meri-browsers.
F3 real process identity — ADDRESSED. identifyAssociatedChromium uses
   /proc/<pid>/exe under browsersRoot (not argv), rejecting the MCP Node launcher
   whose args say `--browser chromium`; requires this run's exact profileDir and
   associates the renderer via real PPid ancestry (browser.mjs:144-164). Offline
   tests reject node-only, unrelated-profile chrome and missing renderer
   (static.test.mjs:252-264, PROC_TREE with node/browser/renderer/other-profile).
F4 MCP framing decode — ADDRESSED and SOURCE-FAITHFUL. extractResultSection
   (browser.mjs:40-61) parses the exact `### Result` Markdown section; fails on
   missing/duplicate/empty/Error/malformed; decodeToolResult prefers
   structuredContent (64-72). I confirmed against the pinned
   playwright-core/lib/coreBundle.js: Response.serialize emits `### ${title}`
   with the Result content = JSON.stringify(evaluate result, null, 2) and no code
   fence (addResult->addTextResult, addSection("Result",...)). Tests use real
   framing incl `### Ran Playwright code` and escaped newlines
   (static.test.mjs:315-351).
F5 sandbox rows + verdict — ADDRESSED. parseSandboxRows (browser.mjs:88-103)
   parses the exact two-cell Chromium155 rows (KNOWN_ROWS: Layer 1 Sandbox,
   PID/Network namespaces, Seccomp-BPF sandbox, ...TSYNC); unknown labels ignored,
   duplicates/unexpected values ambiguous. Verdict requires Layer1 Namespace|SUID
   AND Seccomp-BPF=Yes AND an identified browser AND renderer (111-127); a
   disabled unused SUID alternative is allowed (no global negative regex).
   scanDisablingFlags rejects --no-sandbox/--disable-namespace-sandbox/
   --disable-seccomp-filter-sandbox anywhere (130-136). Fixtures are source-
   faithful two-cell (static.test.mjs:233-304); component-pins.json:108 cites the
   exact sandbox_internals.ts/.html source.
F6 Office nested verdicts — ADDRESSED. convert returns authoritative
   status/signal/error via classifySubprocess (artifacts.mjs:37-43,109-115);
   recalc uses DISTINCT recalc-in/recalc-out dirs and requires successful
   conversion + a NEW file + reopened A4=6 (163-178, decideRecalc 54-61); render
   requires per-format conversion+PNG+PDF-inspection+pages and recalc (decideRender
   64-80); MERI_ARTIFACTS_RENDER=off yields a visible NOT-PASSED fail (65).
   Offline negative tests at static.test.mjs:508-549.
F7 failure evidence — ADDRESSED. stderr listener is attached right after
   transport construction and BEFORE connect (browser.mjs:272-274); every
   navigation/evaluate error and client-close uncertainty pushes a reason ->
   final ok:false (356-364); full bounded raw responses are preserved in
   evidence.rawResults and written to evidence.json in the success and failure
   paths (368). Process/proc evidence is emitted to structured stdout for both
   browser and renderer (341-351).

Additional spot-checks: pinned playwright-core confirms Debian12 chromium maps to
cftUrl("linux64/chrome-linux64.zip") and the CFT helper name is chrome_sandbox;
browsers.json chromium = revision 1247 / 155.0.8059.12 / "Chrome for Testing".
component-pins.json:99-108 records the CFT download URL, archive bytes
198,335,306 and archiveSha256 a24546e0e6c763bf864861ce50498f38783663e24cd2af2a16798c25dc3a9489
(matching Codex's independent recomputation), extractedExecutable and helper path.
Runtime probe: parseStructuredOutput unchanged and sound; classifyChildResult
keeps status/signal/timeout authoritative; read-only-root uses
/proc/self/mountinfo + EROFS; network-denial now requires expected denial classes
(ENOTFOUND/EAI_NONAME/ENODATA) AND a positive control
(logs.us-east-1.amazonaws.com in 10.80.0.0/16 + 443 connect) with offline
classification tests (runtime.mjs:196-274; static.test.mjs:478-502).


5. REMAINING BUILD-VERIFY RISKS (not defects; confirm during isolated build)
---------------------------------------------------------------------------
R1 (medium) snapshot.debian.org serves exact timestamps: 20260901T000000Z and
   every pinned version (incl. ca-certificates=20230311+deb12u1 and all
   Dockerfile:83-96 pins) must exist in that snapshot's indices; any miss fails
   the build hard. Cannot be confirmed offline (no network authorised).
R2 (low/medium) base image digest sha256:3e69116c... unverifiable offline.
R3 (low) the slim base is assumed to still carry
   /usr/share/keyrings/debian-archive-keyring.gpg for Signed-By; if purged, the
   first apt update fails. Verify at build.


6. LIVE GATES STILL NOT RUN (G1 incomplete; static tests cannot pass these)
---------------------------------------------------------------------------
Image build / immutable assembled digest; target Linux SDK query/stream; non-root
sandbox-enabled MCP Chromium + real download; the /proc browser+renderer
identification, chrome://sandbox rows and effective-flags verdict; LibreOffice/
fonts export + visual review + XLSX recalc; Fargate read-only mounts/volumes,
network positive control and DNS denial; remote opaque-session + workspace
snapshots; interrupt/resume/replacement restoration and stale-fence rejection;
SDK mirror_error handling; Temporal topology/restore; measured startup/memory/
disk/timing/cost. Live-risk notes for the browser gate: unprivileged user
namespaces / setuid-helper efficacy and /dev/shm sizing on the target Fargate
kernel are only provable there. Local offline results prove none of these.


7. SUMMARY
----------
Scope clean (15 owned paths, protected files byte-identical). Checks 15/15 and
55/55 green, git diff --check clean (independently reproduced). Every Codex
first-review finding (apt expiry/CA, helper ownership/name, /proc process
identity, MCP Result framing, sandbox rows/verdict, Office nested verdicts,
failure evidence) is concretely repaired and neg-atively tested. Verdict: READY
FOR CODEX BUILD REVIEW; residual items are build-time pin verifications (R1-R3)
and intentionally-unrun live G1 gates. No repair required and none attempted.

Handoff complete. Reviewer session 20261009_155115_bada70; report
docs/coordination/reports/W02-01-IMAGE-REVIEW.md (overwrites prior report; Codex
preserved the unchanged first copy as W02-01-IMAGE-REVIEW-FIRST.md). Stopping.
