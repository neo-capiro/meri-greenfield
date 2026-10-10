# W02-06 BROWSER-REVIEW-5 — independent real-Hermes review (report only)

Reviewer: separate real Hermes session (report-only; no acceptance/launch/gate authority).
Candidate under review: `d09740b8f1fa7855baf0308d2f0f813e0e6fbf87` ("fix: Codex owner
completion of bounded browser-host evidence"), review worktree
`C:/dev/main/meri-greenfield-worktrees/w02-browser-review-5` (branch `review/w02-browser-host-5`).
Base partial: `4fd85f73405d9cca2d66d8f01234c3aead557905` (owner loader bind) with prior
accepted observer correction `be1e7a7`. Frozen observer regression reference commit: `4863878`.

Verdict: **recommend owner decision — no acceptance, no launch, no gate change.** This review
reproduces the claimed offline behaviour and finds no false-pass in the bounded host path, but
native AL2023/kernel/userns/seccomp/browser/renderer, Bash/systemd/Docker semantics, ECR/CloudWatch
transport, metadata/network denial, EC2 termination and the actual image/version pins remain
**NOT RUN**. The worker image pin `7327…` is preparatory only and carries unresolved 2 CRITICAL /
13 HIGH findings.

## 1. Scope, method, constraints honoured

- Reviewed actual source (not test counts): `infra/browser-qualification/{README.md,app.mjs,
  bootstrap.sh,host-evidence.py,component-pins.json,security.test.mjs,seccomp.default.docker-25.0.16.json,
  seccomp.chromium-155-amd64.json}`, task brief `docs/coordination/tasks/W02-06-BROWSER-HOST.md`,
  owner report `docs/coordination/reports/W02-06-BROWSER-HOST.md`, `docs/coordination/DECISIONS.md`
  (D005/D006), `AGENTS.md`.
- D006 support-build pipeline reviewed READ ONLY at root `C:/dev/main/meri-greenfield-kickoff-20261009`:
  `infra/qualification/host-assets.Dockerfile`, `infra/qualification/host-assets.buildspec.json`,
  `.task-inputs/start-reviewed-host-assets-build.py`, `.task-inputs/test_start_reviewed_host_assets_build.py`,
  `.task-inputs/HOST-ASSETS-OWNER-REPAIR-AUDIT.md`, `docs/coordination/reports/W02-06-SUPPORT-BUILD-PREPARATION.md`.
- No edit to implementation, locks, app, shared files or other reports. No push/amend. No AWS/cloud/
  network/provider/native Docker/Linux/browser/SDK/Office/socket/credential/source call. `--execute`,
  `--prepare` and old `start-reviewed-build.py` were never invoked. Scratch confined to ignored
  `.task-inputs/` (confirmed ignored by `.gitignore`).
- The `w02-browser-host` worktree is at the same commit `d09740b` and its reviewed source bytes are
  byte-identical (hashes below), so its pinned deps were used READ ONLY to run the byte-identical
  host suite; generated `cdk.out/` and `.task-inputs/observer-audit/tmp/` were removed afterwards and
  the worktree left clean (`git status` empty).

## 2. Exact bytes / hashes (independently recomputed)

Candidate worktree `infra/browser-qualification/`:

| File | Bytes | SHA256 | Matches candidate claim |
| --- | ---: | --- | --- |
| bootstrap.sh | 12089 | `d6c10afb7d6205f633882d23ce6a112ccc136be4d64c5ffe4394d2c6ee5df0dd` | yes |
| host-evidence.py | 88864 | `3da79f3661b1f907ec7e20f1ba1426169c54b65aeebae0728161b9fc9c634fc4` | yes |
| seccomp.chromium-155-amd64.json | 17188 | `e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6` | yes |
| seccomp.default.docker-25.0.16.json | 12828 | `9c1025c88ccaa517b648da571961838744ea2137f176bfe6a48b21294cae9c76` | yes |
| app.mjs (frozen) | 29637 | `972eea022521bc96f17f1f429d1e025ab1631ecdbc9357b1ee15bcb58fe649ce` | yes |
| security.test.mjs | 33852 | `46bc851f3c294a7a679f1de14fbaa955eccbe8e6a635d604718aaf8b9793d80f` | (recorded) |
| component-pins.json | 8882 | `5d0b07a6430aa8a08304b2d9faadfcb8680c76af7ec665b7e4f9c98892b5fb15` | (recorded) |
| README.md | 6969 | `8baf5aaaef1554f9e34212cac8960a8cf05e73fc98cf4cb40d04ea161c6cbe5a` | (recorded) |

Frozen app is byte-identical to base: `git hash-object infra/browser-qualification/app.mjs` =
`114bf4ed601d8664e87196bbf99baf38b3b34d1a` = `4fd85f7:infra/browser-qualification/app.mjs`.

D006 root pipeline:

| Artefact | Identity | Matches claim |
| --- | --- | --- |
| host-assets.Dockerfile | commit `6d20bb4a2fbe5c9431fa0c8131639d290f5febc8` (blob `1e89ffe2…`) | yes |
| host-assets.buildspec.json | SHA256 `4bf811f3cf0ac401a42a508f3d05539aa595ae02568fb08249ba273eb80ef9b9` | yes |
| start-reviewed-host-assets-build.py | SHA256 `7fd8c036e634df0e7af2e907c13bce83c2c5ed7213467f87f174ed3c6e1f1c2a` | yes |
| test_start_reviewed_host_assets_build.py | SHA256 `5a73d9044796ff28c6227780962f8626823c1f1bf40473ca443c82737f97e0d7` | (recorded) |
| builderAuthority infra/qualification/app.mjs | pinned SHA256 `a866b68fda76cf3bf09636909d62d7dbee646ed396a7879052be63ee60a0442f` (asserted by helper) | consistent |

## 3. Original vs owner attribution

Independent AST comparison of `host-evidence.py` between `4fd85f7` and `d09740b`:

- Top-level function/class bodies: 46 at base, 39 remain **byte-identical** (all
  collector/classifier/poll/version/helper bodies: `classify`, `collect_observation`,
  `run_bounded_poll`, `_proc_record`, `_threads`, `_hash_exe`, `_runner`, `running_containers`,
  `preflight`, `normalize_version`, `_ancestry_ok`, `_parse_uid_map_strict`, `_ns_complete`, …).
  A broader comparison (including nested defs) found 42 identical.
- Changed (all in the deferred verification/export/CLI helper set the candidate declares):
  `verify_run_record` (rewritten), `classify_put_response` (hardened), `_load_json`, `_dump`, `main`.
- Removed: `build_export_plan`. Added: `build_export_protocol`, `validate_export`,
  `render_export_batches`, `assemble_run_record`, `assemble_export_records`, `capture_browser`,
  `_browser_payload_reasons`, `_inspect_reasons`, `_sandbox_rows_ok`, `timer_record`,
  `source_manifest`, `_context_ok`, `_strict_json`(+nested), `_finite_json`, `_exact_keys`,
  `_bounded_text`, `_evidence_identity`, `process_platform_linux`.
- `app.mjs` unchanged from base (frozen). Frozen seccomp default unchanged.

Attribution therefore matches the candidate's own claim: this is Codex owner completion of the
closed Hermes partial, touching only deferred helpers plus the allocated bootstrap/tests/docs;
the authoritative collector/classifier/polling bodies and the app are preserved.

## 4. Checks actually run (commands, counts, results)

All on Windows, Node `v24.19.0`, Python `3.14.7` (author host). No native execution.

1. `node --test infra/browser-qualification/security.test.mjs` (in `w02-browser-host`, byte-identical
   source): **13 pass / 0 fail / 0 skip**. Includes preserved 23-case observer checkpoint audit and
   33-case owner replay, strict run-record/export/bootstrap static checks, 11-resource synthetic CDK
   checks, and the 39-frozen-body identity test.
2. `python3 -B .task-inputs/codex-host-final/completion-audit.py` (independent completion replay):
   **23 pass / 0 fail**, `fakeOnly: true`, `sourceSha256` = `3da79f36…` (candidate observer).
3. `python3 -I .task-inputs/test_start_reviewed_host_assets_build.py` (root D006): **Ran 16 tests … OK**
   (28 project-drift variants, 8 returned-build drift cases, 6 PATH cases, 9 actual copied-file/
   never-started verifier cases, 7 archive-validator cases; import/default-CLI side-effect free).
4. `bash -n infra/browser-qualification/bootstrap.sh`: **OK**.
5. Python 3.9 grammar: observer + exactly 4 embedded bootstrap heredocs parse with
   `feature_version=(3,9)` (driven by the suite); no 3.10+ runtime API observed in source inspection.
6. Reviewer independent export/retrieval/Put/timer counterexamples
   (`.task-inputs/reviewer-export-counterexamples.py`, pure, recomputes bounds without calling the
   implementation): **48 pass / 0 fail**. Covers round-trip, independent chunk/batch recomputation,
   6144→1 / 6145→2 chunk boundary, 12 KiB event bound, 8192 base64 bound, ≤32 calls, 26-byte batch
   overhead, transport≠admission (a `status:137` run record exports cleanly but still fails
   `verify_run_record`), and rejection of duplicate/loss/hash/run/truncation/unknown-field/nonfinite/
   duplicate-JSON-key/missing-end/wrong-kind/two-end/reorder/negative-index/bool-bytes/context/count/
   duplicate-record-name/owner-context-mismatch/single-end, plus Put index0/any-rejection/unknown-
   index/unknown-field/entity/malformed/zero-token and timer 900-ok / 479-rejected / wrong-target /
   inactive / nonfinite-uptime, oversize aggregate, and missing context.
7. Reviewer independent `run_bounded_poll` lifecycle check
   (`.task-inputs/reviewer-poll-lifecycle.py`): **ok** — later complete unsafe observation ⇒
   `lifecycle="unsafe"`, `bestOk=False`, `unsafeClassification` set; stop-after-pass ⇒ `stopped`,
   `bestOk=True`, no unsafe; incomplete-after-pass ⇒ `passing` (best retained); never-complete ⇒
   `timeout`, `bestOk=False`.
8. Independent seccomp verification: derived file equals `json.dumps(load, indent=2) + "\n"` exactly
   (17188 bytes); first 31 default rules byte-identical; exactly 5 appended `SCMP_ACT_ALLOW` amd64
   rules (`clone` 268435473 / 1879048209 / 536870929, `unshare` 268435456, `chroot` no-arg);
   `clone3` → `SCMP_ACT_ERRNO 38` and `setns` denied preserved.
9. `classifyHostEvidence` is **not referenced** by `security.test.mjs` (grep: comment only) —
   the stale JS classifier is not an admission oracle.

## 5. Source-level findings against the required recheck list

- One Docker create / known ID / one attach-start: bootstrap has exactly one `docker create
  --pull never --cidfile` (verified count = 1) and `capture_browser` issues exactly one
  `docker start --attach <64-hex id>`; `docker run` never appears.
- Complete bounded stdout+stderr: `capture_browser` drains both pipes under a combined 2 MiB cap
  and an absolute deadline, reaps its owned client on all paths, and writes full
  `browser.stdout`/`browser.stderr`; admission requires `capture.ok/status0/timedOutfalse/
  overflowfalse/errornull/clientReaped` and `browserStdout` reconstructing exactly the browser record.
- Observer join preserves later unsafe observation: TERM then bounded Bash-builtin join (`wait`
  only after the child is observed gone); forced/uncertain/nonzero joins and any non-null
  `unsafeClassification` fail admission (independently reproduced, §4.7).
- Process + renderer sandbox evidence: classifier requires pinned chromium exe + hash, zero host
  capsets, NoNewPrivs=1/Seccomp=2, renderer user-namespace distinct from host/container/browser
  baselines with a valid uid map, and renderer thread seccomp filter count strictly above the
  container baseline; a Node process is never accepted as browser/renderer.
- Full original browser tool/nav/download/version payload: admission requires the actual ordered
  `stepSequence` (with the supported absent `browser_get_config` case), the loopback download facts
  (31 bytes / known sha), version evidence, `chrome://sandbox` rows (Layer 1 = Namespace|SUID and
  Seccomp-BPF = Yes), and full `rawResults`.
- Actual image ENV/config/namespaces/mounts/caps: `_inspect_reasons` binds the exact safe image ENV
  set, `User=10001:10001`, `Entrypoint=["node"]`, `Cmd=[/opt/meri-worker/probes/browser.mjs]`,
  `WorkingDir=/workspace/conversation`, `NetworkMode=none`, `CapDrop=ALL`, NNP+seccomp security opts,
  read-only root, private PID/IPC, fixed caps (pids512/mem4GiB/cpu2/shm1GiB), only the reviewed
  workspace bind + noexec tmpfs, and clean stopped exit0 inspect.
- Run/source/image/profile identity: `verify_run_record` binds canonical run UUID, self-measured
  source manifest, actual Docker config image ID, support digest (distinct from worker, same repo),
  and seccomp path/sha; the owner independently pins reviewed bytes via the external context file
  at `--validate-export`.
- 900 s original timer never rearmed: bootstrap only reads `is-active`/`Unit`/
  `NextElapseUSecMonotonic`; no `systemctl start/restart`, no `--on-active`, no `sleep 900`;
  `timer_record` requires active target == `meri-browser-assets-poweroff-<run>.service` and
  480 ≤ remaining ≤ 900.
- Bounds fit: bootstrap `BOOTSTRAP_DEADLINE=480`, `WORK_DEADLINE=420`, browser ≤ 120 s; loader
  `LOADER_DEADLINE=300` with `--kill-after=5s`; statically 305 + 480 = 785 s < 900 s timer.
- Version patch observed not synthetic: `BROWSER_VERSION=155.0.8059.12` is a pinned expectation
  enforced against the real probe payload (`userAgent` must contain `Chrome/<pin>`, `version-eval`
  detail must equal the pin); a mismatching real browser fails closed. See residual R6.
- Export/retrieval protocol: independently confirmed complete record, 6144-raw / 8192-base64 chunks,
  12 KiB events, 8 MiB raw aggregate, 1500 events, ≤32 Put calls, 100-event / 900 KiB (incl. 26-byte
  overhead) batches, strict indices/counts/hashes/context and exactly one final `end`; failed record
  cannot become passed by a valid export (§4.6).
- D006 support build: Dockerfile is `FROM scratch`, three exact `COPY`s, no CMD/ENTRYPOINT/RUN/ADD;
  helper is import-safe and defaults to local-only `prepare`; it binds the full previously reviewed
  live project configuration (sha-pinned), requires an exact separate scratch buildspec override,
  hashes/pins source archive + helper + builder authority, requires fresh STS immediately before
  each mutation, writes a one-shot reservation before any external action, validates project drift
  before upload and again before dispatch, and validates the returned build. The buildspec verifies
  seven exact source/authority files, asserts the assumed builder role, builds `--network none
  --pull=false` scratch, inspects image ENV/config/labels/ID, creates (never starts) the support
  container, asserts `created / Running false / Pid 0 / zero timestamps`, copies three files,
  byte-compares them to source, removes the container and reads back an empty list **before** push.
  Confirmed offline; native Bash/CodeBuild/Docker/ECR/S3 behaviour NOT RUN.

## 6. Residuals and limits (preserved honestly)

- R1 (low, cosmetic): `host-evidence.py:31` `MAX_EXPORT_BYTES, MAX_EXPORT_EVENTS, MAX_EXPORT_CALLS`
  are now dead — their only consumers were in the removed `build_export_plan`; superseded by the
  `EXPORT_*` constants. No functional impact.
- R2 (limitation): bootstrap `cleanup()` uses `BOOTSTRAP_DEADLINE-4` for its own bound; if work
  overran ~476 s, `remaining()` returns 124 and the bounded `docker stop`/`rm` are skipped and the
  guest powers off instead. This degrades gracefully (poweroff backstop) and cannot create a
  false-pass, but container stop/removal is then not proven.
- R3 (frozen, pre-existing): the legacy JS `classifyHostEvidence` in `app.mjs` is stale — its path
  pattern is `chrome-linux/chrome` while the authoritative Python uses `chrome-linux64/chrome`, and
  the `app.mjs` header comment claims a JS/Python parity assertion that the suite does not perform.
  Correctly **not** used as the admission oracle; frozen, so unchanged by this candidate.
- R4 (inherent): observer sampling only flips `best` on a *complete* later unsafe observation; a
  later incomplete observation does not. Documented and reproduced.
- R5 (NOT RUN): native AL2023 / kernel namespace / userns / seccomp, real browser + renderer
  sandbox, Bash/systemd/Docker attach+inspect semantics, ECR support packaging/pull, CloudWatch
  transport/reconstruction, metadata/network denial, and EC2 termination + root-volume deletion.
- R6 (NOT RUN): the pinned Chromium version `155.0.8059.12` and executable hash are asserted against
  the actual probe; their correctness vs the built image cannot be verified offline. Admission fails
  closed on mismatch, but the pin itself is unmeasured here.
- R7: the image ENV allowlist is hardcoded; any future image change requires re-review (the report
  states this).
- R8: `verify_run_record`'s source check is self-consistency (same host); binding to the reviewed
  bytes is a two-party check via the owner-supplied context at `--validate-export` (actual remote
  events not yet available).
- R9: worker image `7327…` remains preparatory only with unresolved 2 CRITICAL / 13 HIGH; no waiver
  or new admission is created. Eventual final worker pin needs fresh review.
- R10: D006 helper/spec/archive still need owner integration, a clean exact HEAD, and independent
  registry digest verification before any single build; live IAM policy contents and TOCTOU changes
  are not disproven by project comparison.

## 7. Verdict

**RECOMMEND OWNER DECISION — do not treat as accepted.** The candidate faithfully completes the
closed partial, preserves the frozen authoritative collector/classifier/polling bodies and the app
byte-for-byte, and the deferred verification/export/bootstrap/CLI helpers enforce complete,
fail-closed, bounded behaviour consistent with the task's false-pass classes. All offline checks
reproduce green and the reviewer's independent counterexamples find no false-pass. Acceptance,
launch, the worker-image pin, and every native/G1 gate remain open and are **NOT RUN** or **NOT
proven** here; the D006 support-build path is prepared only.

Review result: `REVIEWED — OWNER DECISION RECOMMENDED` (report-only; no acceptance authority exercised).
