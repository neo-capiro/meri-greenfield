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
revocation, native SDK recovery or G1 acceptance. A real storage adapter,
trusted credential issuance/resolution and the bounded two-task experiment
remain required before this service is operational.
