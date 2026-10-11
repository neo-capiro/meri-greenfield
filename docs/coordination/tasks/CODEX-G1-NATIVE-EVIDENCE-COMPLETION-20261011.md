# Native SDK evidence completion — bounded source work

Base: `a5dc95c5940e7403bc1d6a4dcf1d61ed06b2f91f`.
Branch: `task/codex-g1-native-evidence-20261011`.
The human authorized independent operation without `capiro-agent-ops` on
11 October 2026. Meri's own implementation standards and accepted deployment
plan remain controlling. AWS shipping requires a separate exact candidate
review. No AWS operation, paid provider request, image build, resource cleanup,
merge, source connection or gate acceptance is authorized by this task.

## Implementation outline

Reuse the accepted SDK phase driver, native session capture, four-operation
fixture channel, current-fence registry, bounded S3 reader and immutable
checkpoint publication. Do not add an agent loop or a parallel authorization
system. Keep `completeRecoveryCheckpoint:false` and
`sessionStoreQualified:false`.

1. The private qualification contract owns a strict, versioned grammar for
   init/interrupt/exit/drain observations. Reuse FixtureContext, runtime pins,
   namespace and capture definitions. Each record binds the exact producer,
   one process instance, observation sequence/time, observer identity and
   Ed25519 signature. Keys come from a separately trusted owner admission;
   a payload never supplies its own verification key. Signatures authenticate
   the admitted observer, not the truth of an unqualified runtime experiment.
2. A focused control inspector reads all four immutable references through
   `readEvidence`, verifies admitted observer signatures and lifecycle facts,
   and compares the final capture binding with the submitted bundle/sentinel.
   `checkpoint-store` passes those exact bytes into this existing seam before
   any object writes. Control construction remains free of external I/O.
3. The worker observation collector extends the existing phase/spawn seams.
   It must retain post-interrupt events, refuse stderr overflow/read failures,
   require observed exit and stream closure, and accept namespace/writer
   quiescence only from a separately trusted observer. It must not turn
   worker booleans or an unchanged file hash into native proof.
4. Evidence publication remains a trusted, create-only, exact-version adapter.
   The ordinary worker/store object adapter still refuses evidence writes.
   Task-bound currentness is checked before effects. A bounded one-shot
   evidence supplier resolves references after drain, preserving quarantine
   and the original D720/C900 clocks.

## Ownership

One bounded Codex writer per path, all on this dedicated source worktree.
Workers do not stage/commit, recursively delegate or perform external actions.
Codex integrates and independently reviews the exact completed candidate.

- Contract/inspector writer: new private native-evidence schema/validator;
  `packages/contracts/qualification-sdk/validate.mjs`; new contract tests;
  new `service/native-evidence.mjs` and inspector tests;
  `service/checkpoint-store.mjs` and its affected tests.
- Native observation writer: `probes/sdk-interruption.mjs`, its tests,
  `probes/sdk-capture.mjs`, its tests, and focused new observation modules/tests.
- Publication/channel writer: `service/s3-objects.mjs`, its tests, focused new
  publisher module/tests, `checkpoint/fixture-channel.mjs` and its tests.
- Namespace writer: focused `probes/native-namespace-observer.mjs` and its
  tests. A separately invoked, bounded Linux procfs scan captures the trusted
  supervisor's baseline namespace and requires no other surviving process
  after SDK exit. It never supplies signing keys or runtime admission. Procfs
  samples require an exclusively owned fixture namespace and workspace;
  they are not an atomic process freeze or proof against future host writers.
- Codex integration owner: task/report documents, package scripts, composition
  wiring, source context manifests, shared interfaces, dependency locks and
  all unallocated paths. Shared changes are proposed before editing.

## Verification and limits

Establish baseline checks from lockfiles. Test strict decoding, signatures,
foreign task/fence/session/image/policy, reordered/impossible timestamps,
nonempty interrupt queues, stream/exit errors, surviving writers, capture
mismatch, cancellation, no writes on refusal, immutable readback, stale-fence
denial, one-shot uncertainty and unchanged partial flags. Run the relevant
integrated source suites and architecture/diff checks on the final commit.

Synthetic keys, clients, process observers and namespace snapshots are test
fixtures only. They do not prove trusted ECS identity, live S3/IAM, native
two-task recovery, provider discovery, browser sandboxing or G1. Published
image security/license HOLD remains. No sentinel/namespace or lifecycle claim
may be marked real merely because a signature or source test passes.
