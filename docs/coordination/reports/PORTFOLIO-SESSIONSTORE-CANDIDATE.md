# SessionStore recovery candidate

## Scope and ownership

Human direction in the Portfolio chat on 11 October 2026: use capiro-internal and
neo@capiro.ai for integration, create a test account if needed, proceed with
SessionStore now, and apply the supplied recovery recommendation. This does not
authorize shared deployment, migrations, routing, source activation or customer
messages/charges. Shared policy: b32b4803933760dc0a93fffdcd8fba30a89c3aac;
machine map last recorded 2026-09-30T00:21:48.2698715Z.

Isolated branch `codex/sessionstore-recovery-20261011`, worktree
`C:/dev/meri-greenfield-sessionstore-20261011`, base
`e9261783c910b3f4a35fa89e44844a8606e2ba21`. Only new
`checkpoint/bound-session-store.mjs`, `checkpoint/verify-session-store.mjs`,
their focused unit tests, deterministic Promptfoo provider/configuration and
this report are owned here. Canonical native-session
capture/restore, SDK options, contracts, lockfiles, driver, proxy, orchestration
and deployment files are read-only. The active G1 owner is not in the app's
current thread list; cleanup coordination confirmed it has no verified owner
thread ID. This is a separate review candidate, not a concurrent integration.

## Implementation outline

The worker adapter implements the pinned SDK's append/load/listSubkeys interface
for one exact project/session. It forwards the frozen canonical RunBinding to
an injected trusted transport on every operation. It preserves opaque JSON and
UUID-less entries, serializes calls, bounds work and refuses further dispatch
after an uncertain timeout. It neither issues credentials nor checks authority
with a worker-side predicate. The transport must authenticate the task and
enforce the current fence atomically at its authoritative commit boundary.

The read-back verifier reuses the existing SDK restore verifier and canonical
contract hashing. It checks the complete expected main/subagent key inventory
and ordered opaque contents against a trusted immutable/quiesced snapshot.
Settling observed promises is explicitly not an SDK flush or completeness
barrier. Mirror failures and late rejected writes remain visible. SessionStore
does not support native file checkpointing in this pinned SDK combination;
application-owned workspace snapshots remain separate.

The user's recommended recovery path remains primary: stop new work, interrupt,
prove all writers stopped, capture the existing native session bundle and the
workspace, verify immutable objects, commit one canonical checkpoint under the
current generation, and restore into a fresh task under renewed authority.
Preserve compaction, subagent and sidecar state. A hard kill recovers from the
last committed checkpoint and reconciles subsequent action receipts.

## Verification and remaining integration

Focused tests exercise ordering, opaque fields, UUID-less records, input/output
ownership, tenant/session/fence forwarding, timeout uncertainty, late writes,
subagent enumeration, omitted/reordered/corrupted records and unknown subkeys.
They use the actual pinned SDK's reference store; they do not establish remote
durability. Existing native file tests cover filesystem capture/restore.

Trusted authenticated transport/storage, durable receipts, quiescence/interrupt
driver, atomic stale-generation rejection, workspace snapshots and the two fresh
Fargate task experiment remain G1 owner integration work. No claim of G1 pass or
complete SessionStore recovery follows from this candidate. Full W05 product
integration is later work, not a prerequisite to the bounded G1 recovery spike.

No new dependency, schema, migration, cloud resource, model call, SDK native
query, host, account, backend deployment or source connection is introduced.

## Recorded checks

- PASS (exit 0): 121 checks comprising the existing 91 static worker tests,
  14 native-file cases and 16 new SessionStore cases. Evidence:
  `outputs/evidence/sessionstore-candidate/unit-final.log` in the Portfolio task.
- PASS (exit 0): seven deterministic Promptfoo 0.124.1 custom-assertion cases,
  using the pinned SDK 0.3.295 InMemorySessionStore. Evidence:
  `promptfoo-final-source-results.json` and `promptfoo-final-source.log` in the
  same evidence directory. Promptfoo was installed in task scratch only; no
  repository package or lockfile changed. The initial seven assertion syntax
  failures remain preserved; the IIFE correction changed no expected outcomes.
- FAILED (exit 1): a later broader run of all `probes/*.test.mjs` and
  `checkpoint/*.test.mjs` passed 295/297. Two unchanged native-file cases refused
  with `SOURCE_CHANGED` during capture: opaque roundtrip and invalid-inventory
  setup. A focused native-file rerun passed 14/14 (exit 0), preserved in
  `native-files-rerun.log`. This intermittent refusal is unresolved; do not
  describe the broader worker suite as green. No native guard/assertion was
  weakened or edited. Linux filesystem/runtime qualification remains required.
- NOT RUN: real SDK query/mirroring, Linux/Fargate task replacement, remote
  transport/storage, workspace checkpoint publication, recovery authorization,
  action-receipt reconciliation and independent integration review.

Reproduce source checks from `apps/worker/qualification` with Node 24:

```powershell
node --test probes/static.test.mjs checkpoint/native-session-files.test.mjs checkpoint/session-store.test.mjs
```

Run the existing Promptfoo CLI from task tooling against
`apps/worker/qualification/checkpoint/promptfooconfig.json`, with one concurrent
evaluation and its cache disabled. It makes no model/provider requests.

The adapter's factory keeps its queue, deadline, uncertainty and shutdown state
in one closure because they govern the same SessionStore lifecycle. Snapshot
verification is a separate module; it depends on the adapter's JSON/key boundary
and canonical public validators. Neither module imports control/proxy internals.
