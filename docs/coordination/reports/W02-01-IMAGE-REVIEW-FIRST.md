W02-01 INDEPENDENT IMAGE PREPARATION REVIEW
===========================================

Reviewed commit : bf72484d4c19461b58fa2287c9993926cf8bc100
Parent/base     : 07652e874d061a29e92843798e5445d7a6f1d71d
Branch / cwd    : hermes/w02-image-review @ C:\dev\main\meri-greenfield-worktrees\w02-image-review
Reviewer session: 20261009_155115_bada70 (single Hermes CLI session, read-only review)
Report path     : docs/coordination/reports/W02-01-IMAGE-REVIEW.md

VERDICT: READY FOR CODEX BUILD REVIEW, with one concrete isolated-probe blocker
(chrome-sandbox ownership, F1) and two build-time pin risks (F2, F3) that must be
confirmed during the isolated build; no offline/static defect found. No code was
repaired here. Codex owns acceptance, build and deployment. G1 remains incomplete;
this review does not qualify any live image, browser sandbox, provider/session
durability or source policy.


1. SCOPE VERIFICATION (exact changed-path list vs parent)
--------------------------------------------------------
git diff --name-status 07652e8..bf72484 => 15 paths, ALL status "A" (added),
0 modified, 0 deleted, 3916 insertions, 0 deletions.

  apps/worker/qualification/.dockerignore
  apps/worker/qualification/.gitignore
  apps/worker/qualification/Dockerfile
  apps/worker/qualification/README.md
  apps/worker/qualification/component-pins.json
  apps/worker/qualification/package-lock.json
  apps/worker/qualification/package.json
  apps/worker/qualification/probes/artifacts.mjs
  apps/worker/qualification/probes/artifacts.py
  apps/worker/qualification/probes/browser.mjs
  apps/worker/qualification/probes/runtime.mjs
  apps/worker/qualification/probes/static.test.mjs
  apps/worker/qualification/requirements.lock.txt
  apps/worker/qualification/sdk-options.mjs
  docs/coordination/reports/W02-01-WORKER-IMAGE.md

This equals the fifteen owned tracked paths in .task-inputs/W02-image.md exactly.
No protected file changed: root package.json / package-lock.json, contracts/v0.1.0
(7a44d575...), launcher, infrastructure, CI, migrations, other reports and existing
Meri/Capiro are untouched. Frozen contract boundary preserved.

Report SHA table independently recomputed (git blob SHA-256 of every committed
file) and MATCHES docs/coordination/reports/W02-01-WORKER-IMAGE.md line 18-31 for
all fourteen self-listed files (e.g. Dockerfile d9659eaf..., package-lock.json
ed0c7329..., runtime.mjs c956d571..., static.test.mjs fb826c6b..., sdk-options.mjs
174efdfc...). The report's own file hash is intentionally self-referential.

package-lock.json contains all eight platform optional entries for
@anthropic-ai/claude-agent-sdk 0.3.295, including @anthropic-ai/claude-agent-sdk-linux-x64,
so a Linux `npm ci --include=optional` resolves offline-consistent lock data.


2. PROCESS / SESSION EVIDENCE (private-evidence, distinct states preserved)
---------------------------------------------------------------------------
Stage 1 (W02-image): process.json status=exited-unreviewed, exitCode=0,
  processesRemainingAtCleanup=0, treeEmptyConfirmed=true, resultCommit=base
  (no commit), sessionIds=[20261009_152136_008131]; checkpoint.json
  status=partial-unaccepted with 12 interim files. => "exited 0, partial, no
  commit, no survivors" CONFIRMED.
Stage 2 (W02-image-stage2): process.json status=failed-unreviewed,
  exitCode=4294967295, processesRemainingAtCleanup=7, cleanupConfirmed=true,
  sessionIds=[] (no final session marker), resultCommit=base (no commit);
  interruption.json records the controlled interruption reason (reproduced
  malformed-JSON parser infinite loop). => "parent 4294967295, seven descendants
  terminated, cleanup confirmed, no commit, no final session marker" CONFIRMED.
Stage 3 (W02-image-stage3): process.json resume=20261009_152136_008131,
  status=exited-unreviewed, exitCode=0, processesRemainingAtCleanup=0,
  cleanupConfirmed=true, resultCommit=bf72484d4c19461b58fa2287c9993926cf8bc100.
  => "resumed the explicit session, exited 0, no remaining processes, cleanup
  confirmed" CONFIRMED.

Reviewer did not re-run any stage; these are read-only observations of scrubbed
process.json/interruption.json/stderr files. Stage-3 stdout.scrubbed.txt
corroborates the reported 15/15 and 38/38 check counts (grep lines ~860-1053).


3. CANONICAL CHECKS (independently run on the exact commit, clean tree)
-----------------------------------------------------------------------
Node v24.19.0, npm 11.17.0. Working tree clean at bf72484.

  1) npm run check                                   exit 0
     tests 15 / pass 15 / fail 0 / skipped 0 (duration_ms ~902)
     (packages/contracts/test/*.test.mjs + evals/qualification/hermes-session.test.mjs)
  2) npm --prefix apps/worker/qualification test     exit 0
     tests 38 / pass 38 / fail 0 / skipped 0 (duration_ms ~2122)
  3) git diff --check                                exit 0 (also vs parent: exit 0)
     no whitespace or conflict-marker errors

Both suites are distinct and non-vacuous; counts match the implementation report.
The root check is the accepted 15-test contract/H00 suite and was not edited.


4. REVIEWED-AREA FINDINGS
-------------------------
PARSER + CHILD ERROR PROPAGATION -- PASS (no finding)
  runtime.mjs:64-81 parseStructuredOutput now requires the complete trimmed stdout
  to be exactly one JSON object; no backward scan; prefix/suffix noise, non-object
  and malformed JSON fail closed. classifyChildResult (runtime.mjs:87-99) keeps
  nonzero status / signal / timeout / ok!==true authoritative and never infers a
  pass from stdout. Regression tests { broken, { broken }, prefix/suffix noise,
  [1,2,3], 42, pretty multi-line JSON and nested ok:true-in-outer-false all pass
  (static.test.mjs:274-302). Stage-3 defect is genuinely repaired; '{ broken'
  returns instantly (whole suite ~2.1s offline).

SDK INERT OPTIONS + OPAQUE RESTORE -- PASS (no finding)
  sdk-options.mjs:39-91 builds explicit options (cwd pinned, settingSources [],
  settings.autoMemoryEnabled:false, skills []), rejects any override outside
  {sessionStore, sessionStoreFlush, persistSession, enableFileCheckpointing}, and
  fail-closes on sessionStore+persistSession:false and
  sessionStore+enableFileCheckpointing:true. verifyRestore (sdk-options.mjs:112-129)
  uses full ordered canonical deep-equality. Tests exercise opaque/unknown fields,
  UUID-less entries, subkeys, project/session separation, absent-state failure and
  the OBSERVED non-dedup behavior of the real upstream InMemorySessionStore
  (static.test.mjs:155-226). No custom storage SDK/broker introduced.

OFFICIAL PLAYWRIGHT MCP TRANSPORT / TOOL SCHEMAS -- PASS (no finding)
  browser.mjs:23-24 uses @modelcontextprotocol/sdk 1.32.1 Client +
  StdioClientTransport. CLI resolved via package.json bin
  (browser.mjs:140-142): installed @playwright/mcp 0.0.83 exports ./package.json
  and bin {"playwright-mcp":"cli.js"} (verified in node_modules), so
  require.resolve + bin lookup are correct. Flags passed
  (browser.mjs:146: --headless --browser chromium --sandbox --user-data-dir
  --output-dir) are all real MCP CLI options (verified in the installed
  playwright-core coreBundle option table; --sandbox is defined). No `--port 0`.
  isError is checked on every tool result; browser_evaluate uses the `function`
  argument; browser_get_config is availability-guarded (browser.mjs:159-164).
  browser_get_config / browser_evaluate / browser_navigate / browser_snapshot all
  exist in the installed server.

SANDBOX EVIDENCE GATE -- PASS + see F1
  browser.mjs:45-63 requires an affirmative namespace/SUID layer AND affirmative
  Seccomp-BPF, rejects any negative marker, requires effectiveFlagsSource==='proc'
  with a non-empty flag list, and rejects --no-sandbox /
  --disable-seccomp-filter-sandbox. Tests reject all-No, only-'sandbox', only-'yes',
  only-'namespace', config-only, absent and disabling flags, and accept a
  representative chrome://sandbox table (static.test.mjs:241-268). Gate is sound.

NATIVE OFFICE + RECALC -- PASS (static), live gate NOT RUN
  artifacts.py generates native DOCX heading+table, XLSX =SUM(A1:A3) with inputs,
  reopens with the same libraries, inspects ZIP/OOXML structure, inspects PPTX
  (2 slides + notes) and PDFs; every nested failure propagates to top-level ok
  (artifacts.py:162 all(r["ok"])). artifacts.mjs exports three separate PDFs,
  renders PNGs, inspects pages, recalculates a COPY with LibreOffice in a unique
  profile and asserts A4=6 via reopen (artifacts.mjs:72-80,134). Nested failures
  are surfaced (artifacts.mjs:42-48,146). Live execution remains a NOT RUN gate.

IMAGE RECIPE (non-root / volumes / scoped context) -- PASS (static)
  Dockerfile: base pinned by digest (23), non-root UID/GID 10001 (108-110,130),
  chown of /workspace + /tmp (116-119), VOLUME ["/workspace","/tmp"] (133),
  readOnlyRootFilesystem expectation documented (14-19,115). Build context is the
  qualification package dir with an allowlist .dockerignore (scoped, no whole-repo
  COPY). Runtime probe proves effective UID, real IO in both mounts
  (runtime.mjs:102-143) and read-only root via /proc/self/mountinfo + EROFS
  (runtime.mjs:150-194).


5. CONCRETE BUILD / ISOLATED-PROBE BLOCKERS (separate from unrun G1 gates)
-------------------------------------------------------------------------
F1 (isolated-probe blocker, medium) -- SUID sandbox helper is neutralised.
  Dockerfile:103-105 sets chrome-sandbox mode 4755, but Dockerfile:119 later runs
  `chown -R 10001:10001 /opt/meri-browsers`. The SUID helper therefore ends up
  owned by 10001 (setuid-to-10001 == a no-op) instead of root:root 4755, which is
  what Playwright/Chromium require for the SUID sandbox path. With `--sandbox`,
  the live browser gate then depends entirely on unprivileged user namespaces
  being enabled on the target kernel/container. If userns is restricted (common on
  hardened runtimes), the sandboxed Chromium launch can fail even though the recipe
  looks correct, or Chromium may treat the mis-owned helper as fatal. Recommend
  Codex either keep chrome-sandbox root:root with mode 4755 (chown only the rest of
  /opt/meri-browsers) or explicitly document/verify the unprivileged-userns path.
  This can only be confirmed live; it is not an offline defect and no repair was
  attempted here.

F2 (build-time pin risk, medium) -- snapshot timestamp exactness.
  Dockerfile:34,40 pin snapshot.debian.org URLs at exactly 20260901T000000Z. The
  snapshot archive serves an exact requested timestamp, so that timestamp must
  exist and every pinned version string (Dockerfile:55-67) must be present in that
  snapshot index. Any single mismatch makes `apt-get install -o` fail and the build
  fail hard (good fail-closed, but a build blocker if unverified). Cannot be
  confirmed offline; confirm during the isolated build and record the resolved
  versions already emitted to /opt/meri-worker/os-package-versions.txt.

F3 (build-time pin risk, low/medium) -- base digest unverifiable offline.
  Dockerfile:23 / component-pins.json baseImage.indexDigest
  sha256:3e69116c... cannot be verified without registry access (not authorised in
  this review). If the tag/digest pair drifted, the build fails; expected and
  surfaced by the real build.

(Authored as risks to verify, not asserted defects. Offline review cannot reach
the network by task boundary.)

Additional low-severity observations (no repair requested):
  O1 Dockerfile:95 `COPY probes/ ./probes/` also ships probes/static.test.mjs into
     the image via .dockerignore:9-10; harmless but unnecessary.
  O2 runtime.mjs:197-230 network denial marks `example.com`/`api.anthropic.com`
     resolution as a failure and 1.1.1.1:443 CONNECTED as a failure -- intended
     fail-closed for the isolated environment; correct by design.
  O3 browser.mjs:176-184 navigates to chrome://sandbox and evaluates innerText;
     if Chromium restricts chrome:// evaluation the probe fails closed (correct),
     though it may then not positively demonstrate the sandbox layers -- acceptable
     conservative behavior, to be watched live.


6. WHAT THIS REVIEW DOES NOT ESTABLISH (still NOT RUN / G1 incomplete)
---------------------------------------------------------------------
Image build and immutable assembled digest; target Linux SDK executable and
query/stream; non-root sandbox-enabled MCP Chromium plus real download; LibreOffice
/fonts/native export and visual render review; uploaded-configuration inertness;
curated original skill pack; model proxy and denied direct provider/source/internet
paths; real isolated Fargate IAM / read-only mounts / task separation / capabilities;
verified remote opaque-session plus workspace snapshots; interrupt/resume/replacement
restoration and stale-fence rejection; SDK mirror_error handling; Temporal production
topology/backups/restore; measured startup, peak memory/disk, timings and cost.
Static offline tests do NOT qualify a live image, browser sandbox, provider/session
durability or source policy. G1 stays incomplete and W03 stays blocked.


7. SUMMARY
----------
Scope: exact 15 owned paths, all additions; no protected/contract/root file touched.
Checks: root 15/15 exit 0, nested 38/38 exit 0, git diff --check exit 0 (independently
reproduced). Process states for stages 1/2/3 match the constrained description.
Reviewed areas (parser/child propagation, SDK inert options/restore, official MCP
transport/tool schemas, sandbox evidence gate, native Office/recalc, recipe
non-root/volumes/context) show no offline defect. One concrete isolated-probe
blocker (F1 chrome-sandbox ownership) plus two build-time pin risks (F2 snapshot
timestamp, F3 base digest) are recorded for Codex. Verdict: READY FOR CODEX BUILD
REVIEW (Codex owns acceptance, build and deployment); F1 should be repaired or
explicitly justified before the live browser gate.

Handoff complete. Reviewer session 20261009_155115_bada70; report
docs/coordination/reports/W02-01-IMAGE-REVIEW.md. No code changed; stopping after handoff.
