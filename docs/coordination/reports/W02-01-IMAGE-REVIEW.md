W02-01 STAGE-6 APT-PIN REPAIR INDEPENDENT REVIEW
================================================

Reviewed commit : 4f69d68f78052c6509f8441a02433fd15d87e8cc
Prior reviewed  : 3d85f4ae9fed85956a2cc1afd9cce4c13e8bcefd
Cumulative base : 07652e874d061a29e92843798e5445d7a6f1d71d
Branch / cwd    : hermes/w02-image-review @ C:\dev\main\meri-greenfield-worktrees\w02-image-review
Reviewer session: 20261009_155115_bada70 (read-only continuation; race view only)
Report path     : docs/coordination/reports/W02-01-IMAGE-REVIEW.md

VERDICT: READY FOR CODEX BUILD REVIEW. The narrow stage-6 repair is correct,
complete and coherent; the primary fixed-snapshot metadata was independently
confirmed from primary upstream (snapshot.debian.org). No unrelated change, no
sandbox/gate weakening, no security downgrade, protected files byte-identical.
This is NOT G1/image/runtime approval. No Docker/cloud build was run here.


1. SCOPE — exact four-file delta (3d85f4a..4f69d68)
---------------------------------------------------
git diff --name-status 3d85f4a..4f69d68 => exactly 4 files, all "M":
  apps/worker/qualification/Dockerfile          1/1 (one line: poppler-utils pin)
  apps/worker/qualification/component-pins.json 11/1
  apps/worker/qualification/probes/static.test.mjs 9/0 (new pin-drift test)
  docs/coordination/reports/W02-01-WORKER-IMAGE.md 39/9 (handoff)
Cumulative vs 07652e8 is still exactly the fifteen owned paths (all "A"); no new
path. git diff --name-only for protected paths (root package.json/package-lock,
tsconfig, packages/, docs/plans, infra, .github) is EMPTY => contracts, root
locks, launcher and infra are byte-identical to base. The Dockerfile delta is a
single insertion/deletion; base digest, CA bootstrap, Signed-By, HTTPS switch,
Check-Valid-Until and sandbox/ENTRYPOINT lines are all unchanged.
Report SHA-256 recomputed from committed blobs and MATCHES the updated table:
  Dockerfile d4508c8428eccb5294b669e14820e9dad7734f1ce52503f4ea66019357561867
  component-pins.json cb8b863b2fee1ae659408607394db6666acb81560ddcef63e27bf188ff6a7dbe
  probes/static.test.mjs 9e42026b722f42b24f6485fee3390d2ffbab5d828f8e421617863d295a0c983c


2. CANONICAL CHECKS (independently run on exact commit, clean tree)
------------------------------------------------------------------
Node v24.19.0 / npm 11.17.0.
  1) npm run check                                exit 0, tests 15 / pass 15 / fail 0
  2) npm --prefix apps/worker/qualification test  exit 0, tests 56 / pass 56 / fail 0
  3) git diff --check (vs 3d85f4a, vs 07652e8, worktree)  exit 0, no whitespace/
     conflict errors.
Counts match Codex's independent 15+56. Nested grew 55->56 with a non-vacuous
Dockerfile<->component-pins pin-drift test (static.test.mjs:474-483): it asserts
Dockerfile contains `${p}=${resolved[p]}` for ca-certificates, poppler-utils,
libnss3, libexpat1, libreoffice-core, python3, that resolved poppler-utils is
22.12.0-2+deb12u3, and that firstBuildFailure is recorded.


3. PRIMARY FIX VERIFIED FROM UPSTREAM SNAPSHOT METADATA
-------------------------------------------------------
Fetched the fixed snapshot indices (scratch under apps/worker/qualification/
.runtime; not committed, no OS Temp):
  https://snapshot.debian.org/archive/debian/20260901T000000Z/dists/bookworm/main/binary-amd64/Packages.xz
  https://snapshot.debian.org/archive/debian-security/20260901T000000Z/dists/bookworm-security/main/binary-amd64/Packages.xz

Confirmed the failure cause and the coherence of the fix:
- bookworm/main:      poppler-utils 22.12.0-2+deb12u2  Depends libpoppler126 (= 22.12.0-2+deb12u2)
- bookworm-security:  poppler-utils 22.12.0-2+deb12u3  Depends libpoppler126 (= 22.12.0-2+deb12u3)
- bookworm-security:  libpoppler126 22.12.0-2+deb12u3
So the old pin (u2) required libpoppler126=u2 while apt selects the higher
security u3 for the unpinned libpoppler126 -> the exact build error
"libpoppler126 (= 22.12.0-2+deb12u2) but 22.12.0-2+deb12u3 is to be installed".
Pin now u3 (Dockerfile:89) -> poppler-utils=u3 and libpoppler126=u3 agree. This is
an UPGRADE (u2->u3), not a downgrade; the security library is not lowered.

Coherence of the other exact (=) pins re-checked against bookworm/main (the
suite that carries the point-release versions at this snapshot):
- python3 3.11.2-1+b1            Depends libpython3-stdlib (= 3.11.2-1+b1)  -> present
- python3-venv 3.11.2-1+b1       Depends python3 (= 3.11.2-1+b1)            -> matches pin
- libreoffice-core/writer/calc/impress = 4:7.4.7-1+deb12u14 (main);
  impress Depends libreoffice-core (= u14) and libreoffice-draw (= u14);
  writer/calc Depends libreoffice-base-core (= u14); all present at u14 in main.
- ca-certificates 20230311+deb12u1, libnss3 2:3.87.1-1+deb12u2,
  libexpat1 2.5.0-1+deb12u2 -> present in main at the pinned versions (untouched).
No other exact-dependency conflict found; no unrelated pin change.


4. NO WEAKENING / HONEST STATE
------------------------------
- Sandbox, browser, network, SDK and Office probes are untouched by this delta
  (only poppler-utils line + pins + test + report changed). No --no-sandbox, no
  extra capabilities, no repo/base/CA/Check-Valid-Until change, no retry loop,
  no host switch, no gate relaxation.
- component-pins.json records firstBuildFailure honestly (build
  meri-greenfield-qualification-build:7464da9b-...; apt dependency-resolution
  stage BEFORE any npm/browser/runtime execution; signed HTTP CA bootstrap and
  verified HTTPS apt update succeeded; exact error; cause; fix) and keeps
  assembledImageDigest = null. status remains preparation-only.
- Image is NOT built; no image published (first CodeBuild failed pre-build).


5. REMAINING / KNOWN GAPS (outside this narrow repair)
------------------------------------------------------
- Known missing direct-IP network negative probe (per Codex) remains an explicit
  G1 gap; not addressed or claimed fixed here.
- All live gates remain NOT RUN: image build + immutable digest, target-Linux SDK
  query/stream, non-root sandboxed MCP Chromium + real download, /proc browser+
  renderer and chrome://sandbox verdict, LibreOffice render/recalc/visual review,
  Fargate read-only mounts/network controls, session durability, Temporal. Local
  offline results pass none of these.
- Build-verify risks unchanged from the prior review: the snapshot timestamp and
  every exact pin must exist in it (now additionally confirmed for poppler u3,
  python3, python3-venv, libreoffice set, ca-certificates, libnss3, libexpat1);
  base digest still only verifiable at build; Debian keyring presence assumed.


6. SUMMARY
----------
Four-file delta exactly as scoped; protected files and root locks byte-identical;
independent checks 15/15 and 56/56 green and git diff --check clean; the poppler
u2->u3 pin fix and every other exact pin independently confirmed coherent against
the fixed snapshot's main + security metadata; no downgrade/sandbox/gate
weakening; honest preparation-only state. Verdict: READY FOR CODEX BUILD REVIEW
(Codex owns acceptance/build/deploy). Changes not required; none made.

Handoff complete. Reviewer session 20261009_155115_bada70; report
docs/coordination/reports/W02-01-IMAGE-REVIEW.md (overwrites prior report; Codex
preserved the previous copy). Stopping.
