# W02-18 — initial read-only TestState REQUEST planner (source only) — repair 1

Status: REPAIRED / OFFLINE PASS (owner replay + exact-commit review still required; this
report never establishes acceptance). Original session `20261010_034137_572412`; repair
continuation per `.task-inputs/W02-18-ADOPTED-REPAIR-1.md` (root assigns the repair
session id separately). The original candidate `0116181f…` is UNACCEPTED.

## Provenance

- Repair base (cleanBASE): `0116181f8ff3814e657d85c276b4568d3a8803eb` (verified `git rev-parse`, clean tree before edits); prior integration base `36c61071c5f6424c082c48ab7889a2af344792ac`.
- Branch / worktree: `task/w02-initial-teststate-planner` @ `C:/dev/main/meri-greenfield-worktrees/w02-initial-teststate-planner`
- Adopted repair brief sha256 `249bc5257e39b79850cee31e3b7012604c87eb1a8105faa1384e7d51cb7563d6` (verified); original brief sha256 `b9a42c8c01483af121153d76cc75647d57537e775c5f540e95c5d51de4f956d6`; final static audit sha256 `b3c3f2705515a39875b3b642602ff4420968c46929be41e75906268a83a8655f` (read as DATA).
- Owner input data (ignored): `static-pins.json` 10904B sha256 `fc9f1beb1fc0e0c065abb9339ad4cfccc9a5b12591386064e113d128686591cc`; `definition.json` 112210B sha256 `2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3` (both verified).
- Owner independently reproduced FOUR integrity failures on unchanged candidate `0116181`; counterexample result sha256 `49b284552b7e60567231f5bf35a5fd4a504db7e44b9df4144030193fd63c6d67`; closed-candidate 24-file preservation manifest sha256 `83ca03c0029ade3fbed004f04405ee2a1f7e233842528f90d26e857c9d0f95d4`. Read as DATA only.

## Owned paths (SAME seven) — repaired hashes

| path | bytes | sha256 |
| --- | ---: | --- |
| scripts/prepare-native-teststate.mjs | 3875 | 9a5f39a22805e2be5f6abf907e0353fd408936a8643ce4e7b982e060d0dfd252 |
| scripts/native-teststate/binding.mjs | 12978 | ac8aca950e4ddb0af2c404448f19f75271a1c2ec00886b8014df0aa3116ce32a |
| scripts/native-teststate/requests.mjs | 10538 | 20034956fa9445cb0dbd15992f1cfe500a235a97e4fe443912a536f5b5ca478d |
| scripts/native-teststate/files.mjs | 8272 | ed9bf836d80539b71b1fd1c68d4f906ede106ba09e171b7ea70fbf19aa70e3d4 |
| scripts/test-native-teststate.mjs | 28189 | 349aa6a853f3cbc4c316c665d43fb15ae25e5df2e1d1492f2f23def2845a5f4d |
| docs/qualification/NATIVE-TESTSTATE-REQUESTS.md | 11132 | d73f6f34053e0fa66c3f084f05440ab48d16b972aa58ba7ffcdcfcef6936ff67 |
| docs/coordination/reports/W02-18-TESTSTATE-PLANNER.md | this file | (see commit) |

## Required repairs (attribution)

- **F1 (raw input identity before import) — FIXED.** Both allocated raw inputs are snapshotted synchronously at composition entry and checked against exact raw byte length + SHA256 (`STATIC_PINS_RAW` 10904/`fc9f1beb…`, `GRAPH_RAW` 112210/`2c962d23…`) BEFORE the fixed dynamic import, then strictly parsed; the raw identity is retained in the binding (`inputProvenance`) and emitted in every plan (`plan.input.staticPins`/`plan.input.graph`). Whitespace/truncation/equal-length/malformed inputs refuse. Post-compile source re-check preserved.
- **F2 (immutable authority) — FIXED.** The branded binding exposes only immutable authority: primitive `graphText`, deep-frozen `graph`/member data, deep-frozen `pins`/`authorityReferences`/`sourceRecords`/`postCompileRecords`/`memberHashes`/`inputProvenance`; no exposed Buffer; outer array/records recursively frozen (including `FIXED_SOURCE_PINS`). Requests/hash/member/target/provenance derive from the same snapshot via `binding.graphText`, `binding.memberHashes` and `binding.inputProvenance`.
- **F2 source-reader bypass — FIXED.** Removed the caller `sourceReader` seam. Production composition reads the actual six fixed repository files internally before and after the fixed import; a caller reader cannot synthesize passing records. Pure validators retained for negative tests only.
- **F3 (bounded file refusal) — FIXED.** Every IO/close path yields a bounded, content-free refusal (constant codes; no message/stack/input excerpts); the handle is closed on every branch; a close failure can never become success or erase an earlier refusal, and is not reported closed when it threw (`handleClosed`/`closeFailed`). Consistent initial path / initial FD / final FD / final path comparison covers identity, type, hard-link policy, size, total bytes and available mtime/ctime (same-size-change detection). Chunk limits and ancestor checks retained.
- **F4 (test/doc honesty) — FIXED.** Overclaims removed; the noninert fixture (which overwrote its own flag) is replaced by a measured pure `isInertAdmission` predicate, distinct from brand rejection. Added raw static-pins whitespace/equal-length/truncation drift, graph drift, caller-buffer mutation across composition, deep-freeze/mutation and source-reader-bypass regressions, and IO throw / final-identity / link-policy / same-size-timestamp regressions. Subprocess fixtures are timeout-bounded; the reader-bypass, no-IO and no-write claims are labelled with their actual (limited) scope.

## Commands / exits / counts

- Canonical focused suite `node --test scripts/test-native-teststate.mjs` (new capture `.task-inputs/scratch-w02-18/repair1-test.out` sha256 `6ea877bc77af2ca198a3036006a7b9bc80ece6b9e0272dff34de0078657f2ca4`, stderr `repair1-test.err` sha256 `e3b0c442…`(empty)): EXIT 0, tests 37 / pass 37 / fail 0 / skipped 0 / todo 0, duration 662.4 ms (< 120 s).
- `node --check` on the five `.mjs` owned files: all ok (once). `git diff --check`: EXIT 0.
- Preserved author evidence (read as DATA only): original `test.out` sha256 `d2d2a0ac9f6f69622ceebfa4523c24311c379467febb1206361e8a99beddaf79` (27 PASS / 2 FAIL @ 597.5 ms), then `test2.out` sha256 `e1c8d50d1e455e6dc102db54c88dba3b050f9d4b32967a3a8f4144b16126f743` (29 PASS / 0 FAIL @ 604.7 ms).

## Failures visible

- Original author run: 2 FAIL (fake ancestor-stub fixtures), then 29/0.
- This repair: 0 FAIL on the canonical run. The earlier composite capture command was rejected by the environment's inline-parser limit; re-run as separate steps (no impact on results).

## Coverage (repaired additions)

Raw static-pins whitespace/equal-length/truncation drift; raw graph drift; caller input-buffer mutation across composition (snapshot isolation); caller `sourceReader` bypass refused; deep-freeze + nested mutation of graph/member/pins/authority-references/source-records/pins-array; pure `isInertAdmission` vs brand rejection; bounded-read IO/close throws (ancestor lstat/read/fstat/close) with bounded diagnostics and closure semantics; final identity (dev/ino), link policy and same-size timestamp changes; plus the retained four exact request/variable shapes, parser/seed/CLI checks.

## Limitations / unmeasured (ACCEPTED / OPEN)

- Not measured by tests: production dynamic-import ORDERING is not instrumentable, so pre-import source verification is established by source inspection only (labelled in the suite).
- ACCEPTED LIMITATION: pre/post source re-read is an offline trusted-checkout check, not an atomic hostile-filesystem boundary; Windows lacks `O_NOFOLLOW` and junction/reparse ancestors are only detected when `lstat` reports symlinks; timestamp catch depends on filesystem resolution; same-user TOCTOU remains.
- ACCEPTED LIMITATION: integration fixtures are owner-supplied ignored inputs under `.task-inputs/W02-18-owner-inputs/`; the suite fails one explicit "owner input data present" test if absent.
- ACCEPTED LIMITATION: the CLI "no-write" check observes input-directory names + original graph bytes only — not a comprehensive no-IO/no-write proof.
- NOT RUN: no live AWS/TestState call, reply decode, service timestamp/identity verdict, native/security/G1/browser/Fargate/Bedrock/build/cloud/network action, role/PassRole work or cutover. `definition.json`/graph mutator-free is NOT claimed (graph contains `RunTask`/`StopOwned`). Out of scope: decoder, pagination, task/ENI read preparation, owner seed parsers, live adapter, execute mode.

## Gates (unchanged, OPEN)

49 scan findings / 22 severe OPEN; Office DEFERRED; native/security/G1 OPEN; paid Bedrock $0/$10; W11 unaccepted; current Meri/Capiro untouched; app/control Fargate and Temporal unchanged; source connections disabled. The future `MeriGreenfield-TestStateReadOnly-20261010` role is NOT created, trusted or authorized.

## Closeout

One ordinary scoped commit of the seven owned paths on `task/w02-initial-teststate-planner`; no push/amend/install/background/recursion. Root separately preserves, fully reads, launches the actual exact-commit review and independently verifies.
