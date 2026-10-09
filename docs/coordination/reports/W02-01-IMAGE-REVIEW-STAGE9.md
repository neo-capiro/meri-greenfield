W02-01 STAGE 7-9 (SECURITY REFRESH + EVIDENCE + RUNTIME PROBES) INDEPENDENT REVIEW
=================================================================================

Reviewed commit : 496abbfcde212b96e02ad69a22488cc70bfeb83a
Prior reviewed  : 4f69d68f78052c6509f8441a02433fd15d87e8cc
Cumulative base : 07652e874d061a29e92843798e5445d7a6f1d71d
Branch / cwd    : hermes/w02-image-review @ C:\dev\main\meri-greenfield-worktrees\w02-image-review
Reviewer session: 20261009_155115_bada70 (read-only continuation)
Report path     : docs/coordination/reports/W02-01-IMAGE-REVIEW.md

VERDICT: CHANGES REQUESTED. The 3-commit refresh/evidence/runtime-probe delta is
substantively correct and independently reproducible (recipe pins, base digest,
snapshot metadata, SDK/CFT pins, build-evidence fail-closed, helper alias, stop
sequence, Office observed-value, direct-IP all verified). Two findings must be
repaired or explicitly reviewed before build admission: F1 (component-pins.json
internal contradiction about the CFT per-file hashes) and F2 (browser stepSequence
mislabels an absent tool as "ran"). Neither is a build-recipe defect. Not G1 /
application-security / cutover acceptance; the refreshed recipe is UNBUILT and all
live gates remain unrun.


1. SCOPE
--------
Delta 4f69d68..496abbf = exactly 9 files (Dockerfile, README.md, component-pins.json,
probes/{artifacts.mjs,artifacts.py,browser.mjs,runtime.mjs,static.test.mjs},
docs/.../W02-01-WORKER-IMAGE.md); three commits e68c796 (security refresh),
f01d6be (build evidence + CFT per-file pins), 496abbf (runtime probes).
Cumulative vs 07652e8 is still exactly the fifteen owned paths. git diff for
protected paths (root package.json/package-lock.json, tsconfig, packages/,
docs/plans, infra, .github, tasks) is EMPTY -> contracts, root locks, launcher,
tasks, infra byte-identical. All nine self-listed SHA-256 recomputed and MATCH
(Dockerfile 5e19c6aa, browser.mjs f3f3b885, runtime.mjs 586f400d, artifacts.mjs
557b9372, artifacts.py b75d7eac, static.test.mjs 55e8e2e7, component-pins a793b7ba,
README fd47fc3e; all nine match the WORKER report table).


2. CANONICAL CHECKS (independently run on exact commit, clean tree)
------------------------------------------------------------------
Node v24.19.0 / npm 11.17.0.
  1) npm run check                                exit 0, tests 15 / pass 15 / fail 0
  2) npm --prefix apps/worker/qualification test  exit 0, tests 69 / pass 69 / fail 0
  3) git diff --check (vs 4f69d68, vs 07652e8, worktree)  exit 0.
Counts match the owner's 15+69. Importing runtime.mjs/browser.mjs/artifacts.mjs
opens no sockets and spawns nothing (main() is invokedDirectly-gated; tests import
pure functions only), so the default suite is hermetic.


3. FINDINGS (concrete; do not fix here)
---------------------------------------
F1 (medium - documentation/evidence honesty). component-pins.json:256 (unresolvedPins)
states: "CFT per-file hash: only the archive sha256 (a24546e0...) was independently
inspected; no per-file chrome/chrome_sandbox hash is pinned, so the build-time
per-file comparison is UNAVAILABLE (recorded, not verified)". This is contradicted
by the same file and the code: component-pins.json:129-132 perFilePins pins exactly
`chrome-linux64/chrome` = adf078f8... and `chrome-linux64/chrome_sandbox` =
be9f5d4b...; Dockerfile:176-189 byte-verifies both with sha256sum and fails closed
(emitting cft-hashes.txt); static.test.mjs:466-482 asserts the pins and the Dockerfile
comparison; and WORKER report:143-145,163-172 states the per-file pins exist and are
verified. Repro: `grep -n perFilePins` vs `grep -n 'no per-file'`; the unresolvedPins
line is stale/incorrect. Concrete repair: replace that unresolvedPins entry with
accurate text (per-file chrome/chrome_sandbox hashes ARE pinned from the Codex-provided
independent archive inspection in perFilePins and ARE verified fail-closed at build;
residual honesty point is only that the authoring session did not itself re-derive
them), or delete the entry. No test asserts the stale text, so the suite cannot catch it.

F2 (low - evidence accuracy). probes/browser.mjs:424-434 pushes 'browser_get_config'
into `stepSequence.ran` unconditionally, before checking
`toolNames.includes('browser_get_config')`. The pinned MCP server does NOT expose
browser_get_config (baseline tools list has no such tool), so the emitted evidence
would report a step as "ran" that was never invoked. Concrete repair: only add the
step to `ran` when it is actually called; otherwise record it under `notRun`/absent.

(Everything else reviewed is correct; details below.)


4. INDEPENDENTLY VERIFIED (positive)
------------------------------------
Base image: registry-1.docker.io manifest for node:24.21.0-bookworm-slim returns
docker-content-digest sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
and linux/amd64 manifest sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd
- both MATCH component-pins/Dockerfile.
Snapshot: bookworm-security Packages.xz at 20261009T000000Z fetched; sha256
d97872da3ff1a60952a9bf64d2c908b1275b32f67a73beb20ae455dc5bcd8137 / 349348 bytes
exactly MATCHES the component-pins snapshotEvidence claim.
Direct pins all RESOLVE in 20261009 (main+security) and cohere: ca-certificates
20250419~deb12u1 (security), python3 / python3-venv 3.11.2-1+b1 (main; venv->python3
= 3.11.2-1+b1), libreoffice-core/writer/calc/impress 4:7.4.7-1+deb12u14 (main; impress
-> core/draw = u14, writer/calc -> base-core = u14, all present), poppler-utils
22.12.0-2+deb12u3 (security; Depends libpoppler126 (= 22.12.0-2+deb12u3) present),
libnss3 2:3.87.1-1+deb12u4 (security), libexpat1 2.5.0-1+deb12u4 (security). No
unrelated pin moved; libglib2.0-0 stays u9 (highest of main/security).
Build evidence fail-closed: Dockerfile:109-126 writes the full dpkg inventory then
emits it (dpkg-query no longer piped into sort), captures node/python versions with
checked commands and requires a nonempty `LibreOffice <n>` (no placeholder success);
Dockerfile:135-140 byte-verifies the SDK linux-x64 binary (manifest.json
platforms['linux-x64'] = {binary:'claude', checksum:4503bfe1..., size:256113848} ->
matches the pin and the Dockerfile path/checksum).
CA/bootstrap unchanged and safe: HTTP signed snapshot -> install ca-certificates ->
switch to HTTPS; Signed-By keyring retained; Check-Valid-Until: no scoped to the two
fixed sources only; no trusted=yes/allow-unauthenticated (test-asserted).
Helper alias: Dockerfile:161-170 cp -a of the pinned chrome_sandbox to an adjacent
root-owned chrome-sandbox, chmod 4755, sha256-equal to the pinned helper; Dockerfile
:176-189 re-verifies both; Dockerfile:209-218 asserts root/4755/setuid for original
AND alias and root ownership of /opt/meri-browsers AFTER all chown (browsers tree is
never chowned). UID10001/read_only_root/dropALL/--sandbox/no host switch preserved.
Browser control flow: the browser-dependent sequence is really gated by `stoppedAfter`
(browser.mjs:424-503) - after the first fatal launch/navigation result the remaining
steps are recorded notRun, while runtime.mjs:339-346 still runs Office as an
independent child. Prelaunch diagnostics read the actual pin/alias path/realpath/uid/
gid/mode/sha256, /proc/self Cap*/NoNewPrivs/Seccomp + uid/gid maps, helper/root mount
flags, sysctls, and a bounded non-root libc.unshare(CLONE_NEWUSER) child labelled
explicitly NOT Chromium's full predicate; it runs only after the uid!=0 check.
Office: artifacts.py:102 uses the documented XlsxWriter blank cache (never seeds 6);
xlsx_recalc requires the retained `=SUM(A1:A3)` and a NUMERIC cached 6 (constant 6
with no formula fails). artifacts.mjs uses DISTINCT recalc-in/recalc-out dirs + a new
file, keeps each child's status/signal/error/parse-status and bounded stdout/stderr,
emits per-format convert/PDF/page/PNG facts and the recalc observed value even on
failure, and treats disabled rendering as a visible NOT-PASSED. Tests exercise
wrong-0/null/missing-inspection/python-failure/constant-without-formula negatives.
Network: checkNetworkDenial adds a bounded direct TCP 1.1.1.1:443 negative
(socket timeout+destroy cleanup) plus DNS negatives and the private
logs.us-east-1.amazonaws.com 10.80.0.0/16 positive control; CONNECTED on the direct
IP fails and ambiguous/other results fail closed (DIRECT_IP_DENIED). Classification
tests are pure (no sockets in npm test).
Docs honesty: README and WORKER report record the prior candidate's 12 CRITICAL / 64
HIGH ECR scan, the failed f669 Fargate probe (browser FATAL "No usable sandbox",
Office recalc null), the unbUILT refreshed recipe, NOT RUN gates, and an INCOMPLETE
license audit; prior digest is explicitly not applied to the refresh.


5. NOT RUN / REMAINING (G1 open)
--------------------------------
Refreshed image build + immutable digest and rescan; live non-root sandboxed MCP
Chromium + real download + browser/renderer /proc attribution and chrome://sandbox
semantic verdict; LibreOffice export + visual render review; the new direct-IP and
DNS/private-Logs controls (code present, unrun); Fargate read-only mounts and task
separation; remote opaque-session + workspace snapshots; interrupt/resume restoration;
SDK mirror_error; Temporal. The previous direct-IP G1 gap is now implemented in code
but still unmeasured. Local offline results pass none of these.

Handoff: reviewer session 20261009_155115_bada70; report
docs/coordination/reports/W02-01-IMAGE-REVIEW.md (committed; Codex owns acceptance;
F1/F2 keep build admission blocked until repaired/reviewed). Stop.
