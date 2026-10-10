# W02-08 build-tooling review 4 — independent Hermes source review

Owner: separate actual Hermes session (this session) on `review/w02-build-tooling-4`.
Scope: source-only recommendation. No build execution, no AWS/cloud/runtime/security/G1 acceptance.
Distinction: owner repair versus independent review; reviewed source versus tested fixture; source
recommendation versus build/runtime/security acceptance. A process exit alone is never a pass.

Recommendation: **SOURCE ACCEPTED (reviewed representation/size-guard repair)** — recommend Codex
accept these exact candidate bytes as the independently reviewed source. This is NOT a build,
runtime, security, browser, Fargate, deployment or G1 acceptance, and it does not authorize
operational replacement or a new build admission (Codex owns those). No counterexample found to the
preserved transaction/security semantics or the new early size rejection.

## 1. Exact base / source identity

- Assigned base: `7a3d4802d91cd2cedb8b791c7fe0d5e8bfe788d2` — commit exists; `merge-base --is-ancestor` HEAD => YES.
- Review worktree: `C:/dev/main/meri-greenfield-worktrees/w02-build-tooling-review-4`; branch `review/w02-build-tooling-4` @ `7a3d4802…`; working tree clean at start.
- Integration root (read-only): `C:\dev\main\meri-greenfield-kickoff-20261009`.

### Candidate `docs/qualification/worker-build-v2` (verified exact)

| File | Bytes | SHA256 | worktree | integration root |
| --- | --- | --- | --- | --- |
| start-reviewed-worker-build.py | 31925 | `6b4b17a3531ea190d3abf1402a99c06e2a2d99009b90a0dc027c1d85d757905b` | MATCH | MATCH |
| test_start_reviewed_worker_build.py | 52740 | `4484d845620b9d02887bee742ed723309da35cc0ccb4cf52b4581f41c14924f2` | MATCH | MATCH |
| worker-buildspec.json | 25592 | `cdd6edb8282f3fbf931162451493ee13e11d74e59fff0523cdd1f084609edd9c` | MATCH | MATCH |

### Frozen v1 `docs/qualification/worker-build-v1` (must retain; verified)

| File | Bytes | SHA256 | worktree | operational `.task-inputs` |
| --- | --- | --- | --- | --- |
| start-reviewed-worker-build.py | 30974 | `c905283c7606daeb1cc3fb6369a935f3db5d3d32d9a86d9d406e180a890a2ca5` | MATCH | MATCH |
| test_start_reviewed_worker_build.py | 49835 | `35c2200137b390cd8852bf02e27bb45128fe3d154571371316fe0b6090be0830` | MATCH | MATCH |
| worker-buildspec.json | 25900 | `e055dff0860fa465087050fc2a9c7c6c318f94927fb4c16ac1115a89830cb356` | MATCH | MATCH |

Immutable operational copies `C:\dev\main\meri-greenfield-kickoff-20261009\.task-inputs\{start-reviewed-worker-build.py,test_start_reviewed_worker_build.py,worker-buildspec.json}` still equal frozen v1 byte-for-byte (hashes above). No mismatch; dependent execution not stopped.

Retained read-only fixtures (integration root, untouched; hashed for the record):
`docs/coordination/private-evidence/qualification-build-context/project.json` = `4a4279a20d8a9b4c3dff4088c560b2f1e340ce0fdbac66966e719d684b7788e6`
`docs/coordination/private-evidence/W02-build-8785118/start-build.json` = `ed50ce2c1c51c0e4c185c4a81a159bf9c0da9c7c61220307c54ad99867f87807`

## 2. Owner docs inspected

README.md, REPAIR-NOTES.md, REPRESENTATION-PROOF.json, compare-representations.py, helper.diff,
tests.diff and command-whitespace.diff read. Owner assertions were not accepted as independent
evidence: I reran the comparison source and reproduced the proof digest fields (below).

## 3. Check outcomes

### 3.1 Representation comparison (check 2) — PASS
Ran the sibling read-only `compare-representations.py` **once** under the frozen Python 3.11.15
runtime (`C:/Users/neoma/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe -B`), stdout only, no file-output redirection to
tracked source, exit 0, empty stderr. Output equals the preserved `REPRESENTATION-PROOF.json`
(modulo Windows text-mode CRLF in the capture; normalized-diff IDENTICAL). All digest fields matched,
including 5× `astSha256` and 5× `semanticTokenSha256`. Independently reproduced by my own probe
(no module import of the helper beyond pure validator calls):
- 5 embedded heredoc Python programs: identical AST (locations excluded) and identical semantic
  token sequence (only tokenizer `NL` omitted; NEWLINE/INDENT/DEDENT/operators/names/constants/strings retained).
- Whitespace-only: `''.join(x.split())==''.join(y.split())` for all five.
- 3 inline `python3 -I -c` STS identity programs byte-identical; outer Bash equal after heredoc
  replacement + lead-space normalization; exact delta = **40 leading spaces**; candidate has no leading spaces.
- Other (non-`phases.build.commands[0]`) buildspec properties equal (`old==new` after command swap).

### 3.2 Bash syntax (check 3) — PASS
Exact candidate `commands[0]` fed to `bash -n` once (parse only; never executed). Exit 0.
Command is 24081 chars, ASCII. Buildspec: canonical compact ASCII JSON (`raw == json.dumps(value,
ensure_ascii=True, separators=(',',':')) + '\n'`, bytes == decoded chars), **25592 bytes/characters,
final LF, ASCII-only, 8-byte margin below 25600**. One build command.

### 3.3 Guard ordering and boundaries (check 4) — PASS
Source read confirms:
- `expected_content` (helper:176) reads the override and calls `json.loads(checked_inline_buildspec(raw))` (193) before returning; `prepare` calls `expected_content` (292) before `archive_bytes` (293) and before evidence `mkdir`/`save` (297-300). Guard validates before preparation/archive/evidence.
- `execute` calls `expected_content` (315) before the exclusive `execution-reserved.json` save (325) and before any S3/ECR/STS mutation (identity 361, upload 380).
- `build_input_for` (252) validates the **actual inline text** via `checked_inline_buildspec(buildspec.encode('utf-8'))` (254); the final pre-dispatch equality replay (402-404) calls `build_input_for` again just before `start-build`.
- `checked_inline_buildspec` (63) requires 1..25600 bytes, ASCII, ≤25600 chars, and canonical compact ASCII JSON + final LF; it rejects rather than rewriting.
Independent pure probe (candidate validator, no external calls): accepts exactly **25600** and 25592;
rejects **25601**, **empty**, **non-ASCII**, **noncanonical (indent=2)**, trailing-space, missing-final-LF
and CRLF. Rejection path is pure (no evidence write, no external tool call); the retained negative
regression test patches `archive_bytes`/`save`/`subprocess.run` to `AssertionError` and asserts the
in-memory filesystem is unchanged.

### 3.4 Pure methods once (check 5) — PASS
Ran the integration-root v2 test once, read-only, from the assigned review cwd:
`"C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" -B "C:/dev/main/meri-greenfield-kickoff-20261009/docs/qualification/worker-build-v2/test_start_reviewed_worker_build.py" -v` (Python 3.12.14).
**Ran 28 tests — OK (0 failures, 0 errors, 0.919s, exit 0).** Loader uses adjacent v2 files
(`TOOL_DIR = …parent; HELPER = TOOL_DIR/'start-reviewed-worker-build.py'; SPEC_BYTES = TOOL_DIR/'worker-buildspec.json'`),
ROOT resolved to the integration root only for the retained fixtures; the old operational spec is not loaded.
Expected deliberate duplicate-ZIP negative fixture emitted its userWarning; not a defect. No `__pycache__` or other file created in the v2 dir (`-B`), no fixture modified.

### 3.5 Transaction constraints preserved (check 6) — PASS (inspected; not runtime-measured)
Read the full helper and the candidate command. Preserved: review/source/archive hashes + exact
source-context checks; full project drift checks (`validate_builder`, `project_configuration`);
exact account/principal and assumed builder role; new bucket/ECR/project/KMS identity checks
(IMMUTABLE repo + KMS, ARN prefixes); mandatory complete override with legacy configured buildspec
explicitly FORBIDDEN; 15-min build / 5-min queue (`timeoutInMinutesOverride`/`queuedTimeoutInMinutesOverride`),
900-second remote deadline (`worker_deadline=$((SECONDS+900))`) and 1200-second dispatch deadline;
AWS one attempt / no automatic retry (`AWS_MAX_ATTEMPTS=1`, no retry loop, deadline `require`);
consumed one-shot reservation + uncertain-stop handling (`execution-reserved.json`, `STOPPED_OR_OUTCOME_UNCERTAIN`);
version/checksum/KMS source receipts (`VersionId`, `ChecksumSHA256`, SSE-KMS, HEAD re-verify);
`CODEBUILD_BUILD_SUCCEEDING` guard; `docker create`/`docker cp`/`docker rm` (never-started container,
bounded single inventory copy); checked removal (`removal`, `rm -f`) before ECR push/result;
fresh STS `get-caller-identity` before upload and before `start-build` (3 identity calls);
guarded `docker logout` + auth-dir cleanup in `cleanup()`.

### 3.6 Change confinement / new tests (check 7) — PASS
Compare-script assertions (independently reproduced): new top-level nodes exactly
`{INLINE_BUILDSPEC_MAX_BYTES, checked_inline_buildspec}`; no removed nodes; changed existing helper
functions exactly `expected_content` and `build_input_for`; removing the added `checked_inline_buildspec`
wrapper restores the old `expected_content`/`build_input_for` AST exactly; remaining helper AST equal.
Diffs confirm the same. Test delta is the adjacent-loader change plus 3 new tests that exercise the
actual preparation boundary (oversized spec stops prepare before archive/evidence/external call), the
actual dispatch-input boundary, and the 25600/25601 accept/reject boundary. Positive fake transactions
use the adjacent candidate v2 helper/spec (e.g. `test_full_transaction_and_separate_legacy_override`, passed).

## 4. Actual counterexamples

None found. No preserved transaction/security semantic was altered; no path bypasses
`checked_inline_buildspec`; the 8-byte margin is enforced locally and is not used to relax any command,
literal, identity/authority check, bound, cleanup or publication ordering.

## 5. Checks NOT RUN

- Real AWS build acceptance and any CodeBuild/ECR/S3/KMS behavior — NOT RUN (prohibited).
- Native Docker tar/config/Linux image inventory, assembled-image scan/security disposition — NOT RUN.
- Runtime/browser/model/source isolation, deployment, G1, cutover — NOT RUN.
- Owner generator (`generate.py`) and old exclusive-output `verify.py` — NOT RUN (prohibited).
- Comparison run under the second runtime / cross-version digest equality — NOT RUN; only the single
  3.11.15 proof-reproducing run was performed, as specified.
- Helper `--prepare`/`--execute`, candidate or old transactions, AWS CLI/API, network, credentials — NOT RUN.

## 6. Known unchanged limitations (retained)

First API failure with consumed reservation/idempotency identity (must never be edited/replayed); real
AWS acceptance still unmeasured; native Docker tar/config/Linux inventory unmeasured; existing Windows
inventory nondeterminism; full assembled-image scan and security decision still required; live
authority/administrative TOCTOU; local stdout is a post-capture acceptance cap, not a streaming memory
bound; hard-termination cleanup; uncertain publication requires read-only reconciliation. No
source/provider/runtime/G1/deployment/cutover pass is claimed. The helper remains deliberately
non-portable (literal integration ROOT; operational ignored override) and must never be invoked with
`--prepare`/`--execute` as a tracked reference.

## 7. Report-only commit

Owned path only: `docs/coordination/reports/W02-08-BUILD-TOOLING-REVIEW-4.md`. Report-only commit
identity and post-commit file SHA256 are recorded in the handoff below (single commit on
`review/w02-build-tooling-4`; no push, no other commit).

## 8. Handoff

Codex independently verifies this report and owns integration, operational replacement, and any new
one-build admission. Candidate recommended as reviewed source; build/runtime/security acceptance still
unmeasured.
