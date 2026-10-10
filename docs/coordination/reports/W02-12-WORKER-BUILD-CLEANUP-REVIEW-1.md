# W02-12 Worker build cleanup — independent actual-Hermes exact-commit source review 1

Reviewer: NEW independent actual Hermes session `20261009_231013_73a3b0` (installed default profile).
Session role: independent reviewer, NOT the implementer; the W02-12 Codex completion was authored by the
orchestration agent and is explicitly not claimed as independent Codex review.

- Pinned base: `6176ce11217213f1f3b30801349864106c85a21a`
- Pinned candidate (== HEAD of this worktree): `9e3200ded27053618f7d9462bdf5cb7aa428fbfb`
- Candidate parent verified `== 6176ce1`; worktree clean (`git status --porcelain` empty).
- Report-only branch: `review/w02-worker-build-cleanup-1`; sole new tracked owned path is this file.

## Verdict

**PASS — OFFLINE SOURCE review scope only (non-accepting).**

Independently reproduced: exact candidate bytes/SHAs, both canonical pure suites, the
v2↔v3 helper/spec AST relationships, the spec's cleanup-gate/trap/ordering behavior by reading the
exact committed bytes, attribute-name integrity, and the failure trigger from the retained log.

This PASS is scoped to source inspection + offline pure checks. It is **not** Codex source acceptance,
not Linux/real-deletion proof, not Bash/CodeBuild/Docker proof, not image/security/runtime acceptance,
and not G1. One non-blocking prospective hardening finding (F-1) is reported below.

## Method (all read-only; no source/test/spec edit; no AWS/Docker/Bash/network/provider call)

- Read all eight candidate files at the exact commit plus frozen v1/v2 helper/test/spec.
- Assigned Python `C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`
  confirmed `3.12.14`. Ran each canonical suite ONCE via subprocess arrays, `-B`, explicit cwd = this
  worktree root, 60 s outer timeout, stdout+stderr captured to NEW ignored files under `.task-inputs/`.
- Private pure in-memory AST/behavior fixtures under `.task-inputs/` (no OS mutation, no deletion,
  no subprocess mutation, no generator/AWS/Docker execution). Author generators and author PASS/AST
  claims were treated as data only and independently re-derived.

## Verified hashes (measured independently, `sha256sum` / `wc -c`)

| File | Bytes | SHA256 | Matches pin |
| --- | ---: | --- | --- |
| scripts/clear-qualification-docker-config.py | 13489 | fbf5e0c23ac13fe75342f1488d84fdc446cb3d7b36a098adaf8dc5c0aefb191f | yes |
| scripts/test_clear_qualification_docker_config.py | 18210 | 0865593071225eeda024fd7fd22aa44b0daa83e3d907ab7c58aa12b50e986399 | — |
| docs/qualification/worker-build-v3/start-reviewed-worker-build.py | 33809 | 3d778752724ade2f3406f2e6496b75ec8725dc40d605090eb3686c1d14fe5db2 | — |
| docs/qualification/worker-build-v3/test_start_reviewed_worker_build.py | 56399 | 4033c71412acf9551b07ab18c30a704eb08dad63fdca229d28080830dff7e0b7 | — |
| docs/qualification/worker-build-v3/worker-buildspec.json | 25538 | 0914c999976a2581795a62267960f8b1a361b38e6d5c05f926912accce66eeee | yes |
| docs/qualification/worker-build-v3/README.md | 4446 | efb0c8dd1a760a3af9fc87fe9c6b636c14087bfffd63c823e8168ce4abda5310 | — |
| docs/qualification/worker-build-v3/REPAIR-NOTES.md | 8965 | c70279d673109580678a40251f812dd279b2375a6013dba7b1cec8f49a2296b6 | — |
| docs/coordination/reports/W02-12-WORKER-BUILD-CLEANUP.md | 4990 | 2852801f079d26ad39cf770f7cc48abb582fa3d5000c441635a9dbdd305a5626 | — |

Cleanup source 13,489 B / fbf5e0c… and v3 spec 25,538 B / 0914c9… matched exactly. `git show
--name-status 9e3200d` = 8 additions, 0 modifications: the entire candidate scope is 8 new paths; no
existing Meri/Capiro file, spec, pin, test or shared file is touched. Corrected accepted inventory pin
`ACCEPTED_INVENTORY_BYTES=17953` / `ACCEPTED_INVENTORY_SHA256=f7f08d86…` is present in the helper and
replaces v2's blacklist `REJECTED_INVENTORY_SHA256=01b673c0…` with an exact-bytes whitelist.

## Independent canonical test results

Command shape: `python.exe -B <suite>` from this worktree root; both suites are pure (fake filesystem/
AWS/image data with extracted Python validator bodies).

- `scripts/test_clear_qualification_docker_config.py` → **Ran 33 tests, OK, 0 skipped** (rc 0).
- `docs/qualification/worker-build-v3/test_start_reviewed_worker_build.py` → **Ran 30 tests, OK, 0 skipped** (rc 0).

My own counts (33 + 30) match the author's reported counts. My cleanup stderr output is **byte-identical**
(4113 B, sha256 `1b952dc8a09f23d0aae2aea7402bcc0cfc328fd665c1f77a3ca9532c3a618855`) to the author's final
`codex-cleanup-tests-3.txt`, an independent corroboration. Frozen outputs retained under `.task-inputs/`.

## Independent AST comparison vs frozen v2

Helper (`ast.dump` with locations stripped): exactly **five** module-level function ASTs differ —
`archive_bytes`, `build_input_for`, `check_review`, `expected_content`, `request_for`. Every other
function (`execute`, `prepare`, `cleanup`/`main`, `validate_dispatched_build`, `source_record`,
`literal_constants`, `checked_inline_buildspec`, `inventory_contract`, …) is AST-equal to v2. Matches the
author's declared change set.

Spec embedded Python blocks (`<<'PY' … PY`), applying the exact long→short local renames declared in
REPAIR-NOTES.md (reversed) then comparing ASTs:

- block[1] (bounded single-member tar-copy reader): **equal to v2 after declared reversal**.
- block[2] (full image/container/inventory verifier): **equal to v2 after declared reversal**.
- block[0] (source/archive verifier), block[3] (result-binding), block[4] (upload receipt): intentionally
  change (new cleanup bindings/constants and relocated logout). Inspected substantively via the private
  unified diff.

Both independently reproduce the author's `codex-v2-v3-proof.json` claims (tar reader + inventory
verifier equal v2 after reversal).

## Spec behavior inspection (exact committed bytes, rendered to `.task-inputs/v3-script.sh`)

- Success-path cleanup really runs: `(set -C; bound 30 python3 -I scripts/clear-qualification-docker-config.py
  --nonce "${auth_dir##*.}" --identity "$auth_identity" > worker-auth-cleanup.json)`.
- Verifier checks receipt `schema==meri-worker-auth-cleanup/1`, `status==CLEANED`, `verifiedAbsent is True`,
  `root==parent+"/"+directoryName`, `policy==fd-relative-nofollow-root-owned-bounded/1`,
  `boundIdentity==[AUTH_IDENTITY dev, ino]`, then performs an **independent absolute `os.lstat(DOCKER_CONFIG)`**
  that must raise `FileNotFoundError` (`else: raise AssertionError("auth root remains")`).
- Ordering: `docker push` (line 277) precedes `docker logout` (line 280); cleanup (281) and its verifier
  precede the result manifest build and the final `aws s3api put-object` result publication (357).
- Fail trap preserves failure: the `EXIT` trap calls the helper and on failure prints the nonsensitive
  `AUTH_CLEANUP_UNCONFIRMED` marker and sets `status=1` (v2's `rmdir … || true` swallowed the error — the
  core defect this candidate fixes). Already-absent/empty auth dir replays idempotently (`rootObserved=False`).
- Worker is never started: no `docker start|run|exec`; `docker create` uses `--network none`,
  `--entrypoint /meri-never-execute-worker`, read-only, cap-drop ALL, no-new-privileges, non-root
  `10001:10001`. Build package fetch is **not** restricted (`docker build --pull --platform linux/amd64`,
  no `--network none`).
- `bound`/deadline: 900 s remote `worker_deadline`, 1200 s helper `DISPATCH_DEADLINE_SECONDS`, 15 min
  build + 5 min queue overrides, per-call caps; inline guard `≤25600` canonical compact ASCII + final LF
  before archive/evidence/reservation/S3/dispatch.

Attribute/method integrity (the author's first failed token-shortening renamed `.digest()`→`.dg()`): the
final committed spec contains **3 intact `.digest()`** calls and **0** `.dg(` occurrences, and
`Bounded.__init__(self,rb): self.raw=rb` preserves the external `self.raw` attribute. No attribute was
silently shortened.

R/K/B literal factoring/escaping: role/KMS/bucket literals are factored to exports
`R`/`K`/`B` and the inline STS validators use `re.escape(os.environ["R"])+r"/[A-Za-z0-9_+=,.@-]{2,64}"`
(R = `arn:aws:sts::967807252336:assumed-role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H`).
No helper/cleanup/spec path override exists; helper `main()` exposes only `--nonce/--identity/--max-seconds`
and the spec asserts absence of `--receipt`/`--expect-uid`.

Protected scope: worker Docker context = exactly **22** committed files (`git ls-tree -r HEAD --
apps/worker/qualification`), so protected records = 22 + builder authority + cleanup + tracked spec = **25**,
matching README/REPAIR-NOTES.

Frozen integrity: `git diff 6176ce1 HEAD -- docs/qualification/worker-build-v1 docs/qualification/worker-build-v2`
is empty; root operational kickoff copies hash to `6b4b17a3…` (helper) and `cdd6edb8…` (spec), equal to the
frozen v2 hashes.

Failure trigger (read-only, bounded to indices 2713–2715 of the retained `00.json`): event 2713
`…: digest: sha256:527e6d80d0e0cb9b3369f7f75d22475b96615bee171fb6fb6d57f31ce925d74e size: 5971`;
events 2714/2715 `rmdir: failed to remove '/tmp/meri-worker-auth.LtOjGEbZ': Directory not empty`. This
independently confirms the exact pushed digest and the non-empty-rmdir failure. Residual contents remain
UNOBSERVED; Buildx state remains a hypothesis.

Author evidence inspection: `codex-v2-v3-helper.diff` (5 functions + constants/docstring), `codex-v2-v3-spec.diff`
(cleanup gate move, false-swallowing removal, auth_identity binding, authCleanup in result, R/K/B),
`codex-v2-v3-proof.json`, `codex-owner-representation-proof.json`, `W02-12-codex-owner-completion.json`.
My independent checks agree with each testable claim; the completion JSON explicitly attributes the code to
"Codex owner completion after CLOSED actual Hermes partial" and marks the candidate UNACCEPTED.

## F-1 (prospective, non-blocking): child `st_dev`/mount boundary is not compared to the admitted root device

Exact code, `scripts/clear-qualification-docker-config.py` `_clear()` (lines ~183–197): a nested directory
is validated with `st = fsapi.lstat(name, dir_fd=dir_fd)`, opened, then only
`require(_identity(fsapi.fstat(child)) == _identity(st), 'directory substitution race')` where
`_identity(st) = (st.st_dev, st.st_ino)` (line 127–128). Each child is thus compared only to **its own**
lstat; the child device is never required to equal the admitted root device (`config.identity` /
`parent_stat`). `st_dev` is referenced nowhere else (grep confirmed lines 127/128/190/195/235/251/255/264
only, all self-relative).

In-memory reproduction (`.task-inputs/mount_boundary_fixture.py`, no real fs/deletion): with root/target
`st_dev=1` and a nested child `buildx` on `st_dev=2`, `run_cleanup` returned `status=CLEANED`,
`filesRemoved=4`, `rmdir` order `['buildx','meri-worker-auth.ABCD1234']` — i.e. the foreign-device child
(and a file inside it) **was traversed and deleted**.

Analysis and bound: the top-level target's `(dev,ino)` is bound to `config.identity`, so a *swapped
target/substituted root* is caught; only nested entries are unguarded. Planting a mount/bind mount under
the auth directory requires host root / `CAP_SYS_ADMIN`. The worker container runs as uid 10001 with no
host filesystem or mount capability, and the auth directory is freshly created `0700` by `mktemp` with a
random 8-char nonce, so a non-root actor cannot pre-place a mount at that path. The documented prerequisite
is a trusted root build host with no extraneous mounts, under which this is unreachable. On real Linux a
mount-point child would additionally make `rmdir` fail `EBUSY`, so the helper would still fail closed
(after attempting deletion), not silently succeed — the fake cannot model `EBUSY`.

Determination: a real, precisely-located hardening gap relative to a strict "containment against host
root" reading, but **bounded by the stated trusted-host/no-extraneous-mounts prerequisite and therefore
NOT an offline source blocker.** The helper's own docstring scopes the guarantee precisely to symlink/
rename ("a symlink or rename can never follow a symlink outside the admitted root", line 15); only a
broader "never outside admitted root" phrasing would overstate nofollow protection against mount-based
traversal (nofollow never claimed to stop mounts). Recommended (owner/Codex decision, not performed here):
either (a) state the "no bind/foreign mounts under the auth root" prerequisite explicitly as a residual
assumption, or (b) add a child `st_dev == admitted root dev` guard. No candidate patch, waiver, mount
experiment or feature work is claimed or performed by this review.

## Limits / explicit non-claims

- Windows host; real confined deletion is unsupported and was refused. Fake fixtures are NOT Linux/POSIX
  proof; `EBUSY`, descriptor-across-rename, Bash `timeout`/redirection, Docker logout races and CodeBuild
  tool availability are unproven. No native/Bash/Docker/AWS/network/provider call was made here.
- AST equality is source-level evidence only, not runtime/Bash equivalence.
- Receipt "stdout only / no arbitrary path authority" is established by source + fake fixtures, not by a
  live run. Directory-count limits are checked after enumeration (not preallocation).
- Trigger log read is bounded to indices 2713–2715; residual directory contents and Buildx state remain
  UNOBSERVED. No image admission, no retry, no reservation reuse.

## Remaining blockers (outside this source review)

Codex integration-owner acceptance of the exact commit; actual Bash/POSIX/CodeBuild compatibility and
bounded live cleanup evidence; fresh source/archive/review + one-build admission; registry
digest/inventory/security review; Linux real-deletion behavior; separate runtime/application qualification.
**Image NOT ADMITTED; G1 OPEN; current Meri unchanged.**

## Evidence (ignored, under this worktree's `.task-inputs/`)

`review-1-cleanup-stderr.txt` (1b952dc8…), `review-1-v3-stderr.txt` (acb65250…), `ast-compare-output.txt`
(aa887cb8…), `spec-ast-compare-output.txt` (72ba52af…), `mount-boundary-output.txt` (e8520d47…),
`trigger-events-2713-2715.txt` (aa157f89…), plus the fixture/runner scripts and rendered scripts.
This report's own commit SHA is returned after the report-only commit; no self-hash is embedded.
