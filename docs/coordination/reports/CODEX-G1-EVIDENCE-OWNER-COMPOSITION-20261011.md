# Trusted native evidence owner — source composition

11 October 2026. **Ready for independent source review; runtime HOLD; G1 OPEN.**
Base is `7f1d20d2c28db25948ecc02d26545645e87a3e3c` in the dedicated
`task/codex-g1-trusted-composition-20261011` worktree. This report describes
source continuation, not deployment or admission of a live signer.

## Responsibility and boundary

`scripts/qualification/sdk-native-evidence-owner.mjs` supplies the missing
owner composition between the existing signed observation collector and
one-shot publication capability. It returns exactly `nativeObserver` and
`evidenceProvider`; it does not return a private key, storage writer or an
old-task transport. Its scripts placement is outside the fixed worker image
context. The existing observer, canonical encoder, record verifier,
publisher, S3 adapters, checkpoint store and four-operation channel retain
their owners. No schema, package version, credential issuer, wire operation,
model loop, worker image recipe or build authority changed.

Independent review found that an invalid verification key initially survived
construction until later record verification. Root exposed the existing
service admission validator as `assertNativeEvidenceAdmission`, preserving
its original body and callers. The owner now calls that canonical validator
before publisher/observer construction or port exposure; no admission rules
were copied into this module. This service source remains outside the fixed
worker context, so the unchanged worker source-pin set is not repinned here.

The owner accepts an explicitly admitted interrupt producer, the original
phase cutoff, observer admission/private KeyObject, namespace-inspection port,
current-authorization port and borrowed evidence writer. Construction performs
no external I/O and immediately refuses malformed/foreign verification keys.
Dependencies are injected; no environment/default credential
lookup, key generation, SDK import, process spawn, listener or migration is
introduced. All capabilities remain borrowed and are never disposed here.

The existing channel provider arguments are unchanged:
`{producer, context, bundle, fixtureFile, deadlineMs, signal}`. Own data
properties are required at this mixed capability boundary. Canonical private
validators own the JSON context/payload boundary. Both supplied contexts must
equal the snapshotted admitted interrupt context. The deadline must equal
`min(phaseDeadlineMs, original deadlineMs, producer expiresAtMs)`; the phase
cutoff cannot exceed the existing sixty-second phase limit or renew D720.

Before bulk copying, the owner uses the existing canonical record verifier
to bind its four immutable observations, admitted key and exact bundle/sentinel.
It then encodes those records with the existing canonical encoder and invokes
the existing publisher, which independently verifies the exact supplied bytes.
The publisher's reservation/currentness/version/readback rules are unchanged.
The composition adds an owner-level reservation before asynchronous work, so
concurrent calls, uncertain effects, cancellation and failed replies cannot
produce another owner publication. It forwards a bounded owned AbortSignal and
rechecks the original deadline/cancellation around pending authorization.
The timer and borrowed-signal listener are always removed; the borrowed writer
is not closed. Aborting an unsettled storage request is a logical refusal,
not proof that a remote operation physically stopped.

## Verification actually performed

Pinned local Node 24.19.0 ran
`node --test scripts/qualification/sdk-native-evidence-owner.test.mjs`.
The final focused run passed **12/12**, zero failures/skips, exit 0.
`git diff --check` passed. The source freeze is:

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/qualification/sdk-native-evidence-owner.mjs` | 7,065 | `e3dc2b73e5b5bee2f2464a57da6a4397b5f44083c6585dd27dc32730244c597f` |
| `scripts/qualification/sdk-native-evidence-owner.test.mjs` | 18,349 | `4915dbfd39a90cf8081645e333d55e8064049678893e181af56a318d18b0fb75` |

The positive closure exercises the actual canonical channel/provider argument
shape, observer, encoder, publisher, independent inspector and checkpoint
store. A scripted byte transport and fake S3 command client retain exactly
four evidence versions and three checkpoint objects; the independently
inspected capture, returned receipt identity and synthetic sentinel payload digest
agree. Receipt completeness and SessionStore qualification remain false.
This is not a PostgreSQL current-fence publication or mTLS/ECS proof.

Negative groups cover incomplete lifecycle, wrong admission/phase/cutoff,
accessors/Proxies, foreign producer/current/capture, copying before refusal,
caller mutation of admitted inputs, foreign verification keys, revocation,
pre-abort and cancellation during pending authorization/write, expired and
backward clocks, concurrent publication and an uncertain first write.
The deadline test aborts an unsettled borrowed write and prevents retry;
the test explicitly releases its fake pending operation afterward.

Focused evidence is retained under ignored
`.task-inputs/trusted-owner-author-20261011/`. The first attempt failed at
test module loading because the author incorrectly imported a nonexistent
`encodeFixtureResponse` export. The test now uses the existing canonical
fixture `wire()` encoder; original failing streams are preserved. Run 2
passed ten groups. Additional capture-before-copy and cancellation/key
coverage then produced twelve-group run 3. Independent review then held
the source because malformed/foreign public keys were refused only after
observation. The strengthened constructor test reproduced that defect in
run 4: eleven groups passed and the immediate-refusal group failed with
`Missing expected exception`. After the canonical admission call, run 5
passed all twelve groups, including five malformed/foreign verification
key variants, zero namespace inspections and zero authorization/storage
effects. All earlier failed/passing streams remain; earlier passing bytes
are not represented as the final source freeze.

Root owns broader integration, package test registration, exact commit
freezing and independent acceptance. None of those is claimed by this author
report. No owned process remains running after the focused Node test exit.

## Remaining live prerequisites

This module does not establish a trusted supervisor. Current `realSpawner`
inherits its parent's UID; the procfs observer requires an exclusively owned
namespace/workspace. The task, UID/PID restrictions, key delivery and
observation provenance need an independently reviewed runtime composition
and genuine measurements before these ports can support live evidence.
The source must not be used as a worker-controlled signer or authority flag.

Actual task-bound certificate issuance, owner-port delivery to replacement B,
PostgreSQL/S3 wiring and physical two-task recovery/cleanup remain unqualified.
The old published image still has recorded five critical and seventeen high
findings. No new image build, SDK/native/provider execution, AWS command,
customer data, resource creation, remote publication, merge or deployment
occurred. Full SessionStore/workspace/subagent/compaction recovery remains a
separate obligation. Notify the user before shipping a concrete reviewed AWS
candidate; this source continuation provides no cloud admission.
