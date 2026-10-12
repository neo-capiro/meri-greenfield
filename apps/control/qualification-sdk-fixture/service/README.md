# Trusted SDK fixture operation composition

`createFixtureServiceHandlers({ registry, checkpointStore, now, decisionId })`
returns exactly the four handlers expected by the private mTLS ingress. Importing
or constructing it starts no server, database connection or object operation.
Trusted control composition must supply the existing `FixtureRegistry`, a real
immutable object-store capability and the ingress credential resolver. No
worker receives PostgreSQL or object-store credentials.

The ingress authenticates the TLS client certificate and binds its resolved
peer and canonical contexts to each request. The service passes a presented
context only as a claim to the registry. The registry uses PostgreSQL time and
current row locks for grant/fence/expiry decisions. A historical A credential
can receive a typed stale denial only when the registry recognizes the exact
revoked A grant and peer; the full B context in that denial must match the
locked current row. A stale A commit is refused before storage preparation and
again by the registry's atomic publication check after preparation.

For the qualification fixture, use the registry's read-only
`resolveCertificate` method as ingress `resolveCredential`. Its lookup key is
the SHA-256 fingerprint of the verified socket certificate, stored as the
grant's `credentialId` by the trusted issuer. It returns only the matching
grant's audience, and the existing operation transaction rechecks currentness.
The real PostgreSQL plus two-certificate loopback test uses this resolver;
certificate creation and ECS task admission are still synthetic/unrun.

The trusted `checkpointStore` port has two methods:

- `prepareCommit({ producer, bundle, fixtureFile, evidence, signal })` returns
  `{ receipt, readback }`. It must verify native quiescence and evidence,
  create immutable bundle/workspace/sentinel object versions, independently
  reread their bytes, and construct the canonical partial receipt. Its
  `readback` must be the result of that actual reread, never a worker claim.
- `load({ publication, producer, current, signal })` returns
  `{ receipt, readback, bundle, fixtureFile }` by rereading the exact immutable
  versions selected by the registry's publication identity. It must check
  tenant/policy scope and object integrity. The service compares receipt and
  bytes with the registry record and canonical private contract. For load, it
  rechecks the current grant after object I/O and before returning bytes.

Neither method accepts a worker-selected key, URL, bucket or storage privilege.
The `AbortSignal` requests cancellation; the owning object-store integration
must supervise any operation that continues after cancellation. A lost
PostgreSQL COMMIT acknowledgement is reconciled with `readPublication` once;
an absent or foreign receipt refuses and is never republished.

The current tests use a synthetic storage port plus a real isolated PostgreSQL
database and two real loopback mTLS client certificates. They prove service
binding and transaction behavior, not S3 durability, ECS identity, physical
revocation, native SDK recovery or G1 acceptance. A deployed storage resource,
native evidence verifier, trusted credential issuance/resolution and the bounded two-task experiment
remain required before this service is operational.

`createS3FixtureObjects` is the concrete versioned S3 I/O adapter for the
dedicated qualification checkpoint bucket. It writes only create-if-absent
objects with a precomputed SHA-256 checksum and the configured KMS key, then
rereads the returned exact version. Reads bound actual streamed bytes, size,
checksum, encryption key and version before they can become a receipt readback.
The default AWS client has one attempt. The injected client is for isolated
tests; production composition must use task-role credentials and narrow IAM.

The adapter also has a read-only `readEvidence({ producer, kind, reference,
signal })` operation for `init`, `interrupt`, `exit` and `drain`. It requires
the producer's tenant/policy scope, exact object version, hash and size, and
reads only the corresponding fixed run prefix with a 64 KiB ceiling. It does
not expose evidence upload. Reading these bytes does not validate their native
meaning or prove quiescence. The private signed-record grammar, admitted-owner
inspector and observer collector now have source implementations. A trusted
runtime owner must still bind their real provenance before commit admission.

`createS3CheckpointStore` assembles the partial receipt using that I/O. Its
mandatory `evidenceInspector.verify` must independently read and qualify the
four native evidence references and quiescence; a worker's reference or boolean
is insufficient. It stores bundle, sentinel and receipt under generated IDs
within the trusted run namespace. Registry publication remains the only
current-fence authority. Orphaned objects after a failed publication grant no
recovery authority. The receipt is loaded by the registry's SHA-256 identity;
the bundle and sentinel are reread by their exact S3 VersionIds.

The approved checkpoint stack reached `CREATE_COMPLETE` on 2026-10-11. Its
dedicated versioned/locked bucket, KMS key and unused control role were read
back; see
`docs/coordination/reports/CODEX-G1-SDK-CHECKPOINT-INFRA-20261011.md` for the
exact stack and limits. The build bucket must not hold checkpoints. No
checkpoint object or runtime task was created by that stack deployment. The
S3 tests exercise command shapes and negative readbacks with a fake client;
they are not AWS durability evidence.

`createFixtureControl` now assembles the PostgreSQL registry, fixed handlers,
versioned S3 store and private mTLS ingress. It resolves certificate fingerprints
from durable grants and exposes the registry only to the trusted owner for A/B
admission. Construction does not connect or listen. Its `start()` owns the
listener; `close()` shuts the socket path, waits for tracked operations, then
releases the owned S3 client. If an operation remains unsettled after the
bounded wait, closure reports uncertainty and leaves the client available for
owner reconciliation. A disconnected commit is refused before database
publication if its abort is visible after object preparation; an already
dispatched database commit still requires authoritative readback. The
native evidence inspector remains a mandatory trusted dependency. Its source
implementation verifies separately admitted Ed25519 observer signatures and
binds all four observations to the exact submitted capture; passing a test
inspector is not native quiescence.
The integrated source test uses two synthetic certificates, isolated local
PostgreSQL and fake S3 responses. Real S3 object I/O, task-role credentials,
private endpoint, native evidence, runtime image and two-task recovery remain
unrun and unadmitted.

The private grammar and canonical encoder live in
`packages/contracts/qualification-sdk/native-evidence.mjs`. The service's
`native-evidence.mjs` owns admission and cross-record lifecycle verification.
`native-evidence-publisher.mjs` owns one-shot publication through the separate
`createS3NativeEvidenceObjects` capability. The ordinary adapter still cannot
upload evidence. Both the publisher and the storage capability require current
authorization; each PUT and exact-version readback rechecks it. Lost replies
remain uncertain and cannot be retried as another publication.

Supply the inspector with `{producer, observerId, keyId, publicKey}` from the
trusted owner, never from a record. The observer receives its private KeyObject
through a separate trusted composition. No default key, credential issuance,
new network endpoint or second authorization system is introduced. Signing
authenticates an admitted observer; qualification must still prove its namespace,
task identity, isolation and observation provenance. Workers receive neither the
publisher/S3 client nor signing authority through model tools or environment.

Run `npm run check:sdk-evidence` at the repository root after restoring the root,
contracts, worker and service locked dependencies. These are injected source
tests. The two integrated PostgreSQL tests need the separately documented local
database and synthetic certificates; an explicit skip does not qualify them.

Handlers now refuse a pre-aborted request before any port, and recheck the
signal and current request-context lifetime before and after awaited registry
and object-store operations. Final response validation uses a fresh service
clock after the last port. The historical producer remains lineage; an expired
A capability does not block an otherwise valid current B load or verification.
The canonical request/response validators remain unchanged, including stale
authorization denial requirements.

Cancellation does not undo a dispatched write or prove a parked port stopped.
If publication reports an unknown COMMIT acknowledgement after cancellation or
expiry, the same uncertainty is propagated without starting reconciliation.
While active, the existing one-shot exact-identity reconciliation remains. An
owner must supervise unfinished work and reconcile any issued transaction; no
response success is released after observed cancellation or expiry. These
source checks do not establish native process teardown or physical revocation.
A failure, cancellation or expiry during the reconciliation read preserves the
original `CommitUncertain`. Invalid/foreign readback preserves typed uncertainty
with the existing `FIXTURE_SERVICE_REFUSED` code. Neither outcome is evidence
that a dispatched publication rolled back or can be safely retried.

## Explicit trusted owner stop

The actual control composition exposes `stopRun({context, peer})` and
`runStatus({context, peer})`. Both accept closed, inert canonical owner input,
never worker-selected cancellation authority. `stopRun` closes a process-local
gate for that exact full context/peer binding and aborts its tracked handler
signals synchronously, before asking the existing registry to persist revocation.
A stale A or wrong peer/pin/actor binding cannot cancel current B work. Requests
already resolving credentials encounter the same gate before entering handlers.
The original registry remains available unchanged; it alone decides durable
currentness and revocation.

The same stop promise is retained across repeat and reentrant calls. It returns
the canonical revocation receipt only after matching handlers settle with no
unresolved publication uncertainty. Waiting is bounded by the original cleanup
cutoff and60 seconds; it never extends that cutoff. An elapsed cleanup cutoff
refuses new revocation dispatch but leaves the local gate closed. The raw registry
still permits its separately documented exact expired-context revocation. An
already-issued late revocation stays tracked after the owner wait expires; no
retry, rollback or physical task-stop claim follows from timeout.

`runStatus` returns a frozen, content-free snapshot with exactly four fields:
`stopRequested`, `revocation`, `activeOperations`, `publicationUncertain`.
Revocation is NOT_REQUESTED, PENDING, REVOKED, ALREADY_REVOKED, FAILED or UNCERTAIN.
Handler publication and revocation `CommitUncertain` remain visible after the
promise settles. This is process-local owner bookkeeping, not a durable ledger
or restart recovery. Canonical owner readback remains through the raw registry;
no automatic reconciliation, uncertainty-clearing or retry is added here.

`close()` synchronously closes local admission and cancels tracked handlers,
then closes ingress and waits for tracked work. It refuses clean object-client
release while work or unknown-commit liability remains. It does not enumerate
or revoke all database runs: the owner must explicitly stop every admitted run.
The source contains no deployed broker/Temporal caller, credential issuance,
native task-stop adapter or crash-recovery completion path. These remain G1
requirements; local stop/status does not qualify them.
