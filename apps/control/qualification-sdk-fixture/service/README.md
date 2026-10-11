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

`createS3CheckpointStore` assembles the partial receipt using that I/O. Its
mandatory `evidenceInspector.verify` must independently read and qualify the
four native evidence references and quiescence; a worker's reference or boolean
is insufficient. It stores bundle, sentinel and receipt under generated IDs
within the trusted run namespace. Registry publication remains the only
current-fence authority. Orphaned objects after a failed publication grant no
recovery authority. The receipt is loaded by the registry's SHA-256 identity;
the bundle and sentinel are reread by their exact S3 VersionIds.

This adapter is still source only. Read-only AWS inventory on 2026-10-11 found
only the qualification **build** bucket, not the dedicated checkpoint bucket.
The dedicated versioned/locked bucket, KMS key, control role, endpoint policy,
native evidence inspector, ECS credential resolver, image, and live two-task
experiment must be reviewed and admitted. The build bucket must not be used for
checkpoint data. The S3 tests exercise command shapes and negative readbacks
with a fake client; they are not AWS durability evidence.
