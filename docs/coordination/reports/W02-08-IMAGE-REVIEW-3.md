# W02-08 image refresh — separate real Hermes review (candidate 3)

Reviewer: separate real Hermes review session `20261009_204534_bf7c51` (CLI, `review/w02-image-refresh-3`).
Candidate under review (exact): `7d2426315188d1e93508cb5835c4c36425fc1c9d`.
Worktree: `C:/dev/main/meri-greenfield-worktrees/w02-image-review-3` (HEAD == candidate, clean at start).
Owned output: this report ONLY. No implementation edits. Bound: 40 turns / 1800 s. No delegation,
background schedulers, self-resume, retry, global settings, approval bypass or push. Scratch kept only
in this worktree's `.task-inputs/`.

**Scope and authority.** This is a read-only source/contract review of an UNBUILT candidate. It grants
nothing. No image, probe, security, runtime, Fargate or G1 admission is transferred or implied. Codex
owns acceptance, contracts, task dependencies and deployments; the owner decision below is a
recommendation only.

## 1. Attribution (as instructed, verified against Git)

- Real Hermes implementation closed at `8e0379d` (session `20261009_192711_4b3d1a`) — five-file recipe
  candidate.
- `16bc2e5` (inventory traversal identity) and `7d24263` (four-file recipe/metadata correction) are
  **Codex owner** commits, not Hermes authorship. `git show --stat` confirms the file sets:
  `7d24263` touched Dockerfile, component-pins.json, probes/static.test.mjs, this ticket's report.
  `16bc2e5` touched exactly the two inventory files.
- The prior built image `7327` and its 2 CRITICAL / 13 HIGH scan remain a separate, unresolved
  bookworm build; nothing here inherits or waives it.

## 2. Exact reviewed bytes (SHA-256, independently recomputed)

Seven in-scope files (six recipe + the candidate's own report), all byte-verified in this worktree:

| file | sha256 |
| --- | --- |
| apps/worker/qualification/Dockerfile | `b9fd32fe633d34462fd438456368955399dfca247f728694ef1be3749ad42cf7` |
| apps/worker/qualification/component-pins.json | `d952ad340697b69c95eb1a9c89b02625085843567afbb6227c03792418a0cccb` |
| apps/worker/qualification/requirements.lock.txt | `47bb048b9750b074c7d33faba9f9c3873b7b461eaa4360bf57cb08d4f55c9765` |
| apps/worker/qualification/probes/static.test.mjs | `1645168ed0ef33b772bc2ca415b1fe5eaa5f80076c5893fe7c9c3bf0ea75b5eb` |
| apps/worker/qualification/probes/image-inventory.py | `f7f08d86a91f9cf6589deabb1304679b11bb8a2d80005a9bd1e5a49c7ea511e3` |
| apps/worker/qualification/probes/image-inventory.test.mjs | `84614714771a5b14b19dde81da3628f001340586fc9011adb90270f4413d547d` |
| docs/coordination/reports/W02-08-IMAGE-SECURITY-REFRESH.md | `e5499eb27d3a46aaed8e3a75a0e6d2a14d1bed867bc5e50a4b5f40e3c0a781ec` |

The two inventory hashes match the ticket-supplied values exactly (`f7f08d86…`, `84614714…`). The ticket
did not supply candidate recipe hashes; the four above are my independent computation.

ROOT (read-only) worker-build draft bytes — all match the ticket-supplied values:

| file | sha256 | ticket |
| --- | --- | --- |
| `.task-inputs/start-reviewed-worker-build.py` | `c905283c7606daeb1cc3fb6369a935f3db5d3d32d9a86d9d406e180a890a2ca5` | match |
| `.task-inputs/test_start_reviewed_worker_build.py` | `35c2200137b390cd8852bf02e27bb45128fe3d154571371316fe0b6090be0830` | match |
| `.task-inputs/worker-buildspec.json` | `e055dff0860fa465087050fc2a9c7c6c318f94927fb4c16ac1115a89830cb356` | match |
| `.task-inputs/WORKER-BUILD-PREPARATION.md` | `8392e5da94d34bd227ceb2184f4bd8e9b368535837d5b9384d64962f6e3a869c` | match |
| `.task-inputs/WORKER-BUILD-INDEPENDENT-AUDIT.md` (historical) | `044bbfa4a9a9e2d65c2569d7614fe2db42f94ee6811ba375e05c53c1ed8a8a38` | historical |
| `.task-inputs/worker-build-independent-repro.py` (historical) | `41062d510fee443929d1dd5da0fe4998d5c036f9b2176492ae62a98bd66f4b1d` | matches audit note |
| `docs/coordination/private-evidence/qualification-build-context/project.json` | `4a4279a20d8a9b4c3dff4088c560b2f1e340ce0fdbac66966e719d684b7788e6` | match |
| `infra/qualification/app.mjs` | `a866b68fda76cf3bf09636909d62d7dbee646ed396a7879052be63ee60a0442f` | match |

The ROOT tree may carry unrelated UI/plan/docs commits (a `STATUS-unexpected-plan-insertion-*.txt` is
present); the selected bytes above are closed by hash, which is what the ticket requires.

## 3. Checks actually run (real output)

Environment: node v24.19.0; explicit `PYTHON = C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe` (Python 3.12.14).
Sibling tree `w02-image-refresh` verified at the same HEAD (`7d24263`) with the six recipe files
byte-identical, used read-only only because this fresh worktree lacks `node_modules`.

1. **Owner inventory suite** (`node --test probes/image-inventory.test.mjs`, `PYTHON` exported), run 11×:
   results were **25/25 (6 runs)** and **24/25 (5 runs)**. The single intermittent failure is
   `enumerates fabricated roots deterministically and retains candidate byte hashes`
   (`OSError:file identity changed before hash`). See Finding F1 — this is a host artifact, and it makes
   the suite **non-deterministic on this Windows host**, so the documented "25/25" is not reproducibly
   deterministic here.
2. **Worker static suite** (`node --test probes/static.test.mjs`, sibling tree): **86 tests, 86 pass,
   0 fail, 0 skipped** — reproduced.
3. **Worker-build pure suite** (`python -B test_start_reviewed_worker_build.py`): **Ran 25 tests … OK**
   (fully fake AWS; `test_import_and_default_cli_make_no_external_call` asserts no real subprocess).
4. Syntax/JSON: `node --check probes/static.test.mjs` OK; `node --check sdk-options.mjs` OK;
   `python3 -c json.load(component-pins.json)` parses; bundled-Python `py_compile image-inventory.py` OK;
   `git diff --check` clean.

Independently recomputed and confirmed by reading the source (not merely trusting the report):
- Dockerfile inventory invocation now uses `--deadline-ms 120000 --max-entries 300000
  --max-events 2000000 --max-manifest-bytes 33554432 --max-hash-bytes 536870912`, matching the probe
  defaults (`image-inventory.py` `parse_args`) and the helper/buildspec contract
  (`maxEntries=300000`, `maxBytes=33554432`, buildspec asserts `0<=elapsedMs<120000`). `git diff 8e0379d..7d24263`
  confirms the previous `300000 / 500000 / 4000000 / 67108864` was tightened.
- Probe refuses non-linux; requires the exact 12 declared absolute normalized roots; requires
  `--out == /opt/meri-worker/image-inventory.json`; rejects weakening exclusions; contains no
  `--platform-override`/`--expect-file` escape hatch (and the Dockerfile static test asserts their
  absence).
- component-pins.json `vendorFixedPackageCandidates` = {LibreOffice CVE-2026-63277, TIFF CVE-2026-12912,
  util-linux CVE-2026-53615}; `remainingOpen` explicitly lists **TIFF CVE-2026-52490 CRITICAL** (plus
  GnuTLS 95210 CRITICAL, GCC, krb5, zlib, Cyrus, other util-linux). The static assertion now checks 52490
  is in `remainingOpen` and NOT in `vendorFixedPackageCandidates`. This matches the ticket and the
  independent vendor report; **no claim that 52490 is fixed**.
- Worker-build draft (read-only): `clean_head` requires exact `HEAD`, clean worktree incl. untracked,
  descent from accepted D006 (`6d20bb4`); `expected_content` rejects the known-rejected c769 inventory SHA
  (`01b673c0…`) and re-derives the compiled `SCHEMA/OUTPUT_PATH/REQUIRED_ROOTS/ROOT_ALIASES/PINNED_FILES`
  from the committed probe **as literal data only** (`literal_constants`, never executed);
  `execute` writes an exclusive one-shot `execution-reserved.json` BEFORE any external action, does a
  fresh STS principal check before S3 put / before StartBuild, marks mutation-attempt uncertainty before
  dispatch, and has no retry (STOPPED_OR_OUTCOME_UNCERTAIN). The buildspec pins 900 s absolute /
  15 min / 5 min queue, a never-started inert container (`--network none --user 10001:10001 --read-only
  --cap-drop ALL --security-opt no-new-privileges=true`, before/after `created`/`Pid0`), a bounded
  `docker cp` tar reader (one regular member, 33554432 payload cap, 33554432+65536 stream cap, zero
  padding, no generic extraction), and fresh equal builder identity before ECR push and before result
  upload. No reference to the old `start-reviewed-build.py` or to any sandbox/privileged/socket escape.

## 4. Findings

**F1 (LIMIT / host nondeterminism) — resolved-in-ticket uncertainty is broader than disclosed.**
With the explicit Python 3.12.14 the "25/25" result is not deterministic on this host: 6/11 runs passed,
5/11 failed, always the same real-traversal test. I proved the mechanism in `.task-inputs/repro_identity.py`:
on this NTFS host a freshly written file's `os.lstat` vs `os.fstat` disagree in `st_ctime_ns` in
**399/400** trials, and the probe's `_identity()` includes `st_ctime_ns`. The candidate report's own
"Tests run" section attributes the single failure to exactly this Windows `lstat`/`fstat` `ctime_ns`
artifact, but the ticket/profile elsewhere calls it a one-time "initial … positive failure" and asserts
"later 25/25, zero skipped". Net: **the fixture pass is a Windows-host artifact of a Linux-only probe and
must not be equated with native-Linux determinism.** The intended platform (Linux) is expected to have
`lstat`==`fstat`, but no native-Linux run was performed and I do not claim it here. The injected
POSIX-fixture tests (the 5 regression tests for the four rejected cases) are deterministic and pass.

**F2 (PASS) — the four independently rejected c769 cases now have dedicated regression tests.**
Comparing `W02-08-INVENTORY-INDEPENDENT-AUDIT.md` (cases: `/bin` alias replaced during target validation;
child dir `0755→2755` before descent; above-root ancestor becomes a link; normalized `/opt//…` output
accepted with no emitted file) to the corrected test file: each has an explicit test exercising the
changed-identity/alias/output-literal branch and asserting failure (`code==1`, incomplete coverage,
`errors` non-empty) — tests "reviewed root alias identity…", "recorded child directory mode…", "full
ancestors above the declared root…", and "Linux main admits only the literal output…". Zero skips.
One Windows-only accommodation is disclosed and fixture-local (junction `readlink` normalization via
`patch.object(m.os,'readlink',…)` inside the test driver only — the note states "never production CLI");
it does not relax the probe.

**F3 (PASS) — the independent audit's build-blocking bound mismatch is resolved.**
`W02-08-INVENTORY-INDEPENDENT-AUDIT.md` finding 1 flagged that historical `8e0379d` (300000/500000/
4000000/67108864) was incompatible with the helper/buildspec contract (300000 entries / 33554432 bytes /
elapsedMs<120000). The candidate now matches that contract exactly; the image and helper now share one
bound. Consistent with the ticket's "tighter than old 8e0379d".

**F4 (LIMIT / documentation nit) — stale hashes inside the candidate report.**
`W02-08-IMAGE-SECURITY-REFRESH.md` lines ~15-17 still cite the superseded c769 inventory hashes
(`01b673c0…`, `a03811cd…`) as the "Codex owner-closed" files, without an inline "see correction below"
pointer; the correction (current `f7f08d86…` / `84614714…`) appears later at ~line 158. The report also
describes the historical single failure once as the `enumerates fabricated roots…` test and once as an
"ancestor-change positive failure". These are documentation inconsistencies only; the actual files match
the corrected hashes and the real current failure (F1) is the `enumerates…` test. Not a recipe defect.

**F5 (ACCEPTED LIMITATION) — vendor findings remain open; not waived by version churn or permission bits.**
Three vendor fixed-package candidates exist (TIFF12912, util-linux53615, LibreOffice63277 securityu8);
twelve remain vendor-vulnerable including both CRITICAL (TIFF52490, GnuTLS95210). The privilege-bit step
(`chmod u-s,g-s` on unintended static regular files, preserving exactly the two root:root 4755 Chrome
helpers) is visibly separate from CVE disposition and correctly claims no fix and no globally atomic
snapshot (`find … -type f -perm /6000` only regular files; final inventory fails closed on any unreviewed
SUID/SGID entry, including directories). A version change or permission-bit removal does not waive any
finding.

## 5. Worker-build draft review (ROOT, READ ONLY)

The exact four new ignored files plus the frozen `project.json` and `infra/qualification/app.mjs` were
hash-verified and the pure suite was re-run (25/25). Against the ticket's audit checklist, I confirmed by
reading the source: default local-only prepare; import safety (no external call); exact clean accepted
HEAD with D006 descent; source archive/helper/buildspec/review full-target binding; full-project drift and
secret checks; mandatory separate owner buildspec override (legacy configured buildspec forbidden from
execution); one-UUID one-shot reservation **before** any mutation; fresh STS owner identity before upload
and StartBuild (plus, in the buildspec, fresh equal identity before ECR push and before result upload);
uncertain → stop, no retry; 900 s absolute / 15 min / 5 min queue; never-started inert container
(10001/readOnly/dropALL/NNP/network none, image IID, `created`/PID0 before+after); bounded one-file tar
copy (32 MiB payload, 32 MiB+64 KiB stream, no arbitrary extract/links/sparse/extras); inventory
source/schema/coverage/hash/mode/root contract; container removal **before** push (empty readback);
actual IID / registry digest / result-receipt binding; the 4 MiB stdout check is a post-capture
acceptance cap, documented as not a streaming memory bound.

Consistent with F3, the helper/buildspec contract (300000 / 33554432 / `elapsedMs<120000`) now agrees with
the candidate Dockerfile. **Year-out-of-scope (NOT RUN, by design of this ticket): live IAM policy
contents / administrative TOCTOU, actual Docker tar-format compatibility, the real ECR build+scan, and
native runtime compatibility.** The historical `W02-08-INVENTORY-INDEPENDENT-AUDIT.md` (helper
`8e54b587…`, tests `1290b957…`) remains evidence for its own older hashes only; the current helper
`c905283c…` is the owner repair (adds the two publication-boundary identity reads and documents the
capture-bound limit) and is attributable to Codex, not to this review.

## 6. Explicit NOT RUN / not established

Native/Linux image build; apt dependency resolution; ECR rescan; local Release/InRelease signature
verification; `--require-hashes` pip install; live Fargate/runtime/browser/Office execution; installed
filesystem inventory facts; Office `.deb` download; any AWS/Docker/network/provider/credential call. No
`--prepare`/`--execute` was invoked; no old `start-reviewed-build.py` was read as the reviewed artifact.
I did not read any other private/source/credential directory. No security, image, probe, durability,
Fargate or G1 acceptance is claimed; no waiver or gate is lowered.

## 7. Recommendation to the owner (decision only — no authority granted)

- The seven in-scope files are coherent, byte-pinned, and internally consistent with the independent
  audit and vendor evidence; the four previously false-passing inventory cases now fail closed with
  dedicated regression tests. **Recommend: ACCEPT the exact bytes as the reviewed preparation candidate**
  for the next owner step, with F1 and F4 recorded as documented limits.
- **Do not** treat any Windows fixture pass as native-Linux, image, security or G1 evidence, and **do not**
  admit the candidate or any image on this review. A real Linux/amd64 build and a fresh COMPLETE ECR scan
  remain mandatory, and the 2 CRITICAL / 13 HIGH findings (and the still-open trixie findings, including
  TIFF52490 and GnuTLS95210) remain unresolved.
- Suggested next owner actions: (i) optionally harden the fixture test so the `image-inventory` suite is
  deterministic off-Linux (or explicitly mark that one test Linux-only) before citing "25/25"; (ii) fix
  F4's stale inline hashes; (iii) proceed to the accepted immutable source + one-shot build only after
  principal/immutable-source acceptance, then a separate deployment/probe gate.

## 8. Reproducibility (this session)

- Candidate=7d2426315188d1e93508cb5835c4c36425fc1c9d ; branch `review/w02-image-refresh-3`.
- Inventory tests: `cd apps/worker/qualification && PYTHON=<bundled python.exe> node --test probes/image-inventory.test.mjs` → 25/25 (6×) and 24/25 (5×).
- Static tests: sibling `w02-image-refresh` → 86/86.
- Worker-build tests: `cd <ROOT>/.task-inputs && <bundled python.exe> -B test_start_reviewed_worker_build.py` → Ran 25 tests … OK.
- Scratch (not committed except this report): `.task-inputs/repro_identity.py`.

Status summary: recipe/pins/report **PASS (reviewed, unbuilt)**; inventory suite **ACCEPTED LIMITATION
(host-nondeterministic off-Linux)**; worker-build draft **PASS (pure/offline)**; native/Linux/image/scan/
security/G1 **NOT RUN**. Deliverable of this session: this report commit only.
