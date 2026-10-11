# Browser exact-VolumeIds post-bootstrap intent — SOURCE only (H3)

Owner: Codex remote pickup `01a12b12-337d-7a01-9f8b-b790558c9d00`. Worker: one bounded Hermes H3 session. This is a **source-only** assignment; G1 remains open. The session exited after returning this commit and handoff; Codex owns process registration, deadline enforcement, teardown and physical-exit verification.

Exact task base: `354631c2548d5702bf51fd9f4667c57f90ee8761` on `task/remote-browser-source5-20261011`. Worktree HEAD at start of work: `99566d2` (allocation commit, descendant of the exact base). Shared policy commit: `b32b4803933760dc0a93fffdcd8fba30a89c3aac` in `neo-capiro/capiro-agent-ops` (ahead of `origin/main` `b2b0ce8c`; `origin/main` is an ancestor, no local changes discarded). Machine map: `machine-paths.local.yaml` app_repo_root `C:\dev\capirov2`, worktree_root `C:\dev`.

## What changed

The post-bootstrap read-only volume **request intent** in `preparePostBootstrapReadOnlyWireProof` no longer uses a filtered `DescribeVolumes` request. It now carries only the retained singleton exact-ID request:

- before: `case: 'DescribeRetainedVolumeByFilter'`, `arguments: { Filters: [{ Name: 'volume-id', Values: [volumeId] }], MaxResults: 5 }`
- after: `case: 'DescribeRetainedVolumeById'`, `arguments: { VolumeIds: [volumeId] }`

The rename is intentional: the previous case name asserted a filter shape the arguments no longer have. Nothing else in the intent changed — `readOnly: true`, `service: 'ec2'`, `operation: 'describeVolumes'` are unchanged, as is the sibling `DescribeInVpc` intent and the original MANAGED predecessor intent in `prepareManagedFixtureVolumeProbes`.

One limitation string was updated to describe the real remaining gap (`Exact-ID response body, native missing-ID error bytes, typed pagination and actual service wire remain unqualified; no response or absence decoder is inferred here`). No absence decoder, error-string mapping or request/response construction was added — this module still returns intent DATA only.

## Canonical owners and boundaries preserved

`infra/browser-enforcement/fixture-volume-probe-provenance.mjs` remains a pure, IO-free evidence-preparation module. It still delegates raw history/profile/clock/retained-identity reconstruction to the single canonical owner `decodeFixtureBootstrapVolumeHistory`; no second parser, registry, graph, role, client or lifecycle was introduced. The change is confined to one literal intent object plus one limitation string.

Preserved unchanged: exact `{capture, expected, originalClock, volumeId, proofClock}` input/context ownership, all external-pin and original-clock equality checks, retained volume identity binding, the separate bounded proof clock (`POST_BOOTSTRAP_READONLY_WIRE_V1`, ≤600,000 ms, distinct session, not before the recorded successful delete), `directInstance: null`, `plannerBoundary`, and the false flags `runtimeAdmitted`, `absenceWireQualified`, `physicalAbsenceProven`, `freshApiAbsenceObserved`, `originalDeadlineCleanupProven`, with `cleanup`/`historicalCleanup` `UNKNOWN`. The raw native missing-ID response remains unqualified; a positive absence decoder is explicitly not inferred from a CLI string or simulated service error.

## Verification actually run

Environment: Windows 11, git-bash. `node --version` = **v26.7.0** (system Node; no bundled Node 24 runtime was located in this worktree and none was needed — the module and tests are dependency-free ESM). `node_modules` is absent in this remote-style checkout.

Focused owned suite (final bytes):

```
node --test infra/browser-enforcement/fixture-volume-probe-provenance.test.mjs
```

Result: **exit 0, 22/22 pass, 0 fail** (baseline before the change was 20/20 pass; the change adds 2 net new cases). Raw stdout: `.task-inputs/remote-browser-source5-1/focused-test-output.txt`.

Directly affected check (canonical history owner this module consumes):

```
node --test infra/browser-enforcement/fixture-volume-history.test.mjs
```

Result: **exit 0, 42/42 pass, 0 fail**. Raw stdout: `.task-inputs/remote-browser-source5-1/history-test-output.txt`.

`git diff --check` clean. Full diff captured at `.task-inputs/remote-browser-source5-1/working.diff`.

New/changed test cases (all synthetic DATA, no live session or clock):

1. `post-bootstrap intents are exactly the VPC read and the retained singleton exact-ID volume read` — replaces the old filter assertion with a `deepEqual` against the exact VPC read plus `{ VolumeIds: [ID] }`.
2. `post-bootstrap volume read is a frozen single-element exact-ID intent with no filter, paging or width escape` — asserts exactly one own argument key (`VolumeIds`), absence of `Filters`/`MaxResults`/`NextToken`/`VolumeId`/`filters`, single element equal to the reconstructed retained ID, deep-frozen arguments, and that the MANAGED predecessor keeps the same shape as an independent literal (no shared argument arrays).
3. `post-bootstrap cannot accept caller filters, widened IDs, error strings or a simulated absence shortcut` — refuses caller `filters`/`volumeIds`/`maxResults` extras, native-error/error-string/simulated-absence shortcuts (`nativeError`, `errorString`, `missingVolumeError`, `absence`, `response`), foreign/malformed/array volume IDs, and proves the module exports only the two evidence-preparation functions (no exported absence/error decoder).
4. The detached-frozen test now asserts `Object.isFrozen(value.requestIntents[1].arguments.VolumeIds)` instead of the removed filter values.

Cases 1–4 do not restate implementation constants: they assert the observable public contract, the exact own-key set, refusal boundaries and export surface. No existing case was skipped, weakened or removed.

## Known failures / limitations

- Pre-existing, **unrelated setup failures** (not caused by this change): `infra/browser-enforcement/browser-enforcement.test.mjs`, `fixture-volume-activation.test.mjs` and `fixture-volume.test.mjs` each fail with `AssertionError: Explicit retained JSONata evaluator required` because this checkout has no `node_modules` with the JSONata evaluator installed. A programmatic import-graph check confirms `fixture-volume-probe-provenance.mjs` is **not reachable** from any of the three failing suites, so the failures cannot be attributed to this change. Per the remote-pickup runbook, dependencies are restored with `npm ci` at pickup; that install is out of this task's authorized scope.
- Node here is v26.7.0 while `package.json` engines state `>=24 <25`. No install, lockfile change or engine coercion was performed; the focused check ran on the ambient runtime, which is a deviation from the pinned runtime to be confirmed by Codex on the pinned Node 24 image.
- NOT RUN (out of authorized scope, correctly refused): AWS/EC2/TestState, network acquisition, provider/model calls other than this session, native/Docker execution, browser-host launch or deletion, source connection, credential read, paid job, merge or deployment. No child/background agents or schedulers were started.

## Evidence hashes

Final (post-change) SHA256:

- `infra/browser-enforcement/fixture-volume-probe-provenance.mjs` = `05e90295cab019f351beab265ff4249ffeca8c08cb40f815bdf1c2553f937933`
- `infra/browser-enforcement/fixture-volume-probe-provenance.test.mjs` = `1923f337eb317c01d08697560531c8bbe02c6a19e737608465266c850576f8da`
- Previous (HEAD) `fixture-volume-probe-provenance.mjs` = `ff099b851ca7ccbcf51698811c626527d8c7c30b62a40bc2fad74efaa4f2c9f5`

Evidence is under the ignored namespace `.task-inputs/remote-browser-source5-1/` (test raw output, `changed-file-sha256.txt`, `working.diff`). No private capture, secret or customer data was copied.

## Changed paths

- `infra/browser-enforcement/fixture-volume-probe-provenance.mjs` (modified)
- `infra/browser-enforcement/fixture-volume-probe-provenance.test.mjs` (modified)
- `docs/coordination/reports/CODEX-G1-BROWSER-EXACT-VOLUMEIDS-REMOTE.md` (new, this handoff)

## Next dependencies / handoff to Codex

1. Codex independently reviews and tests this exact commit on the pinned Node 24 runtime and records ACCEPT or HOLD. A worker summary is a claim until independently verified.
2. A later actual read-only TestState that captures the **native** missing-ID error bytes (not a CLI string or simulated error) needs separate root review, fresh action admission, an exact request-hash allocation and the real `Ec2.Ec2Exception`/service-error payload. This source task deliberately produces neither the response nor an absence decoder from it.
3. The historical SOURCE10 Python planner reference still names `DescribeRetainedVolumeByFilter` in its own frozen artifacts (e.g. `CODEX-G1-BROWSER-POST-BOOTSTRAP-READONLY-SOURCE.md`, `CODEX-G1-BROWSER-READONLY-CLOCKFREE-PREPARATION.md`). Those historical reports are read-only and were not modified; a future planner change that mirrors this intent must be separately allocated so the planner and this evidence module do not diverge silently.
4. G1 remains open. No host, runtime, security, scheduler or deployment acceptance is claimed or implied.
