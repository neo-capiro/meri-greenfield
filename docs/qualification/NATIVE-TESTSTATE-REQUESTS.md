# Native TestState requests — exact local contract and future handoff limits

W02-18 (repair 1). OFFLINE REQUEST DATA ONLY. This document is the exact local contract
for the four-case initial read-only TestState **request** planner, its bound inputs and
the limits that must be re-checked by a separate future owner artifact. It allocates no
runtime, execution, decoding or deployment authority.

## Purpose

Given three explicit absolute input files, emit ONE JSON **request plan** to stdout.
The planner builds the exact AWS Step Functions `TestState` request DATA for a single
reviewed read-only state of the accepted W14 graph. It never calls TestState, never
decodes a reply and never follows `nextState`.

## Owned paths (exactly seven)

- `scripts/prepare-native-teststate.mjs` — small offline CLI (stdout plan; no writes).
- `scripts/native-teststate/binding.mjs` — fixed source/input/graph integrity, strict
  JSON, inert compiler composition, deep-frozen authority, internal brand.
- `scripts/native-teststate/requests.mjs` — pure four-case seed validation + request/manifest.
- `scripts/native-teststate/files.mjs` — bounded regular-file reads (no import-time IO).
- `scripts/test-native-teststate.mjs` — focused pure/CLI fixtures.
- `docs/qualification/NATIVE-TESTSTATE-REQUESTS.md` — this contract.
- `docs/coordination/reports/W02-18-TESTSTATE-PLANNER.md` — provenance/checks/gates.

No existing source, shared contract, lockfile, migration, decision, infra, controller or
test is edited. W11 is unaccepted and its runtime dispatch is neither imported nor reused.
W14/SDK decoder files are READ ONLY. Only `scanJsonKeys` is reused from the accepted SDK
decoder; no SDK protocol/semantics, parser fork or framework is adopted.

## Fixed trusted inputs (raw byte identity checked BEFORE any dynamic import)

The two allocated raw inputs are the ORIGINAL raw bytes, not normalized JSON identity.
Composition snapshots the caller buffers synchronously, then checks exact raw byte length
and SHA256 before the fixed import:

- `static-pins.json` — 10904 bytes, SHA256 `fc9f1beb1fc0e0c065abb9339ad4cfccc9a5b12591386064e113d128686591cc`
- `definition.json` — 112210 bytes, SHA256 `2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3`
- expected `staticBindingId` `0599b1c8ed11af66130c08a54db950cac3cc79ba6e4941fa00ba2493fe907548`; expected `runtimeEnabled` false

Whitespace, truncation, equal-length changes and malformed inputs refuse. A caller
mutation of the input buffers across the import await cannot substitute bytes (the
snapshot is taken synchronously and the raw hashes are retained in the binding and plan).

Accepted fixed W19 source pins (exact raw `Git9f` bytes of `9f51fd3e45f1ddf33c7bb83d5c76720d12cea83c`, the closed eight-file compiler
closure); byte length AND sha256 are checked before and after the fixed import, by internal fixed reads only. The first six positions preserve
the original W14/W18 record order and the two appended members complete the closure:

| path | bytes | sha256 |
| --- | ---: | --- |
| infra/native-enforcement/app.mjs | 618 | e03076acb2ccda59bd38c2e2763f94af0d057f6c6c1bd3e699e25c72314ab1ed |
| infra/native-enforcement/lib/binding.mjs | 16458 | 8df3f2f02e23a4f3587a342dcb882404c7c0f70be6e57b84b9d1b0af0eaea35a |
| infra/native-enforcement/lib/expressions.mjs | 13776 | 933dcca53027688be2e6373bed818890882f239bc5da5af1af827277213b87aa |
| infra/native-enforcement/lib/workflow.mjs | 25002 | 09171cbc66ce0efbd643969d92c92c742f89d0b41804eefd65064f2175aa39ca |
| infra/native-enforcement/lib/infrastructure.mjs | 4780 | c0ddb78cbfb28ed0fd3360b0dec86d12371240fb7d87c0452dec0408454a53af |
| infra/native-enforcement/lib/task-definition.mjs | 8996 | 3d45d054150c5e7706253694a725761afb96abe5a39d1a3ecc0bfb1adb686436 |
| infra/native-enforcement/lib/probe-profiles.mjs | 4920 | 67dff6ffb4025e1767226a5bb330998ad78bd9d76083319adb910a22e3397660 |
| infra/native-enforcement/canary-task-definition.mjs | 2612 | 524135d00aec413a6393e69a7d22974160109b01cc4ced71d35f26440d3e4df5 |

There is NO caller-supplied reader, import path or import function: production composition
reads the actual eight fixed repository files internally, before and after compilation. Pure
record validators (`validateSourceRecord` / `verifySourceRecords`) remain exported as the
negative-test seam; a caller cannot synthesize passing records while different code is
imported. The compiler is imported only from the fixed repository path and compiled once as
`buildNativeEnforcementAdmission({staticPins, executeAdmitted:false})`. The graph is rebuilt
only via `buildNativeEnforcementStateMachine(binding)`; its `JSON.stringify` bytes must
equal the supplied graph bytes, the pinned hash and the pinned length, and `GuardInput`
must be an inert `{% false and … %}` choice. The pre/post source re-read is an offline
trusted-checkout integrity check — not an atomic hostile-filesystem execution boundary.

### Complete eight-file closure and exact edges (W02-22 source-pin advancement)

The accepted W19 source `9f51fd3e45f1ddf33c7bb83d5c76720d12cea83c` closes the compiler to
eight exact raw files. The planner's plan manifest `source.records` therefore advances from
six to eight records, in the fixed order above — the ONLY intentional value delta of this
task — while the graph identity (112210 bytes / `2c962d23…`), the static-pins input (10904
bytes / `fc9f1beb…`), the `staticBindingId` `0599b1c8ed11af66130c08a54db950cac3cc79ba6e4941fa00ba2493fe907548`
and the selected-member hashes are unchanged. Literal inventory: 16 repository import edges
plus one `node:crypto` builtin edge (`lib/binding.mjs`); the eight-file graph is reachable and
acyclic; there is no dynamic `import`/`require` in these exact compiler bytes. This is a
finite DATA/literal inventory, not a general JavaScript grammar parser or an import-time-IO
proof; import-time effects are assessed separately by source inspection.

## Immutable authority

The branded binding exposes only immutable authority: a primitive `graphText` string (the
authoritative definition), the deep-frozen checked `graph`/member data, deep-frozen `pins`,
`authorityReferences`, `sourceRecords`, `memberHashes` and `inputProvenance`. There is no
exposed authoritative Buffer. The request, its full `definition`, the `selectedMemberHash`,
`target` and provenance all derive from this same accepted snapshot; a spread/JSON copy is
still brand-rejected. `runtimeEnabled` is false.

## Frozen local seed contract

`schemaVersion` literal `meri-native-teststate-initial-seed/1`. EXACT six keys
`{schemaVersion,case,wireCaptureId,runUuid,t0Ms,planningTimeMs}` — no other key is
accepted (no `stateName`, role, definition/import path, ctx/variables, mock/context,
inspection, acceptance, origin or runtime field).

Exactly four `case` values and their fixed mapping:

| case | stateName | Resource | expectedArguments | variables ctx |
| --- | --- | --- | --- | --- |
| identity | DispatchIdentity | `arn:aws:states:::aws-sdk:sts:getCallerIdentity` | `{}` | `{D}` |
| list-started-by | ListFirst | `arn:aws:states:::aws-sdk:ecs:listTasks` | `{Cluster,MaxResults:10,StartedBy:runUuid}` | `{C,mode:0,run:{uuid:runUuid}}` |
| list-running | ListFirst | `arn:aws:states:::aws-sdk:ecs:listTasks` | `{Cluster,MaxResults:10,DesiredStatus:'RUNNING'}` | `{C,mode:1}` |
| list-stopped | ListFirst | `arn:aws:states:::aws-sdk:ecs:listTasks` | `{Cluster,MaxResults:10,DesiredStatus:'STOPPED'}` | `{C,mode:2}` |

Both UUIDs are canonical lowercase v4; `wireCaptureId` must differ from `runUuid`, and
`runUuid` must equal the fixed synthetic binding runUuid
`87890e41-3f88-4b4d-b1d3-aaa9b85aaa9b`. Times are positive safe integer milliseconds,
`t0Ms <= planningTimeMs` and `t0Ms + 900000` safe. Derive `D=t0+720000`, `C=t0+900000`;
no caller deadline expression and no `Date.now()` repair/stamp. The remaining selected
deadline (`D` for identity, else `C`) must be `>= 1000 ms`, and
`expectedTimeoutSeconds = min(30, floor((selectedDeadline - planningTimeMs)/1000))`.

Fixed account `967807252336`, region `us-east-1`, cluster
`arn:aws:ecs:us-east-1:967807252336:cluster/meri-greenfield-qualification`. The
`roleArn` is a CODE CONSTANT `arn:aws:iam::967807252336:role/MeriGreenfield-TestStateReadOnly-20261010`
— never a seed/CLI option. This future role is NOT known to exist, be trusted or be
authorized; planning grants no IAM action, no PassRole and no caller/trust review.

## Emitted request (exactly seven keys)

`{definition,stateName,roleArn,input,variables,inspectionLevel,revealSecrets}`:
`definition` = the COMPLETE exact inert graph string; `stateName` case-derived (only the
two names above); `roleArn` the code constant; `input` = the literal string `"{}"`;
`variables` = the JSON string of the derived minimal ctx only; `inspectionLevel` `DEBUG`;
`revealSecrets` false. No context/mock/stateConfiguration/TRACE/secret/unused ctx or
successor option. The selected full member (`Type/Resource/Arguments/TimeoutSeconds/
Assign/Catch/Output/Next`) is validated against the bound graph and its immutably
precomputed hash is preserved in the plan manifest.

Plan envelope: `schemaVersion` literal `meri-native-teststate-initial-plan/1`,
`status` `REQUEST_PLAN_ONLY`. It carries the exact request plus `requestBytes` and
`requestSha256`, graph/source hashes, the RAW `input` provenance
(`staticPins`+`graph` byte/hash), `staticBindingId`, case/role/target, seed hash and
original times, derived `D`/`C`, timeout expectation, `expectedArguments`,
`selectedMemberHash`, and explicit synthetic/inert/not-executed provenance. It contains
no `OWNER_REVIEWED_ACTUAL_READ_ONLY_INTEGRATION`, no `executeAdmitted`/`runtimeEnabled`
true, no actual service timestamp/network/identity verdict, no wire evidence and no
decoder output. An input hash establishes identity within the allocation, not
authentication or live authority.

## CLI

`node scripts/prepare-native-teststate.mjs --static-pins <abs> --graph <abs> --seed <abs>`

Exactly three flags, each absolute and supplied once; no other flag, mode, positional or
default/latest discovery. It reads only these files (bounds: staticPins 65536 B, graph
1048576 B, seed 4096 B), writes one JSON plan to stdout and never writes/temp/overwrites
or mutates output on import. Diagnostics are bounded and avoid input excerpts; unexpected
errors are mapped to a constant `internal error`. The CLI never spawns AWS/shell/provider/
network.

## Files module

`files.mjs` bounds size BEFORE allocating; rejects non-regular / symlink / multi-hard-link
inputs; compares initial path, initial descriptor, final descriptor and final path
observations consistently (identity, regular/non-link type, hard-link policy, bounded
size, total bytes and available mtime/ctime timestamps, catching same-size writes); checks
visible ancestor symlink/junction paths; uses `O_NOFOLLOW` where available; reads in capped
chunks; closes every opened handle on every branch; and maps every IO/close throw to a
bounded, content-free refusal. A close failure can never become success or erase an earlier
refusal, and the handle is not reported closed when close threw.

Honest limits: on Windows `O_NOFOLLOW` is undefined so it is omitted, junction / reparse
ancestors are only detectable when `lstat` reports them as symbolic links, timestamp
comparison catches same-size writes only where the filesystem exposes sub-millisecond
mtime/ctime resolution, and a same-user actor can still race the checkout (TOCTOU). This is
an offline trusted-checkout bound, not an atomic hostile-filesystem boundary.

## Explicitly NOT in this task (future, separately admitted gates)

- No result decoder, no pagination / `list-next`, no task / ENI read preparation, no
  owner seed reference parser, no live AWS adapter, no execute mode, no full-graph
  execution, no `nextState` follow, no reply of any kind.
- The role/caller/trust/TestState/PassRole review, actual retained records, live response
  decoding and any native/canary run are separate future artifacts.
- 49 scan findings / 22 severe OPEN; Office DEFERRED; native/security/G1 OPEN; paid
  Bedrock $0/$10; current Meri/Capiro untouched; app/control Fargate and Temporal
  unchanged; source connections disabled. The `TestStateReadOnly` role is not created,
  trusted or authorized by this work.

All source metadata is SYNTHETIC (`SYNTHETIC_TEST_ONLY`); the complete graph CONTAINS
mutators (`RunTask`/`StopOwned`), and only the fixed selected state request is read-only.
Never claim the full graph mutator-free.
