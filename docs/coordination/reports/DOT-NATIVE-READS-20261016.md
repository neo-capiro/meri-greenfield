# Native general reads: implementation outline

Base: `f54dc958e83eb4a146cfc2066518108be16b84b7`, accepted integration source
`eaca77e1ea6f8b805a3a6942e179bcb8acd7d0e4`. This lane adds only the allocated
versioned READS contract, client, Fetch receiver, control owner and task verifier.
Startup owns registry, issuance, vocabulary, composition and runner changes.
Qualification owns accepted-slice integration. No accepted READS source is repicked.

The contract owns closed, inert configuration, requests and secret-free receipts.
The worker client owns fixed HTTPS transport, bounds, cancellation and initial
installation/catalog pinning. The Fetch receiver performs transport validation.
The control owner borrows the existing canonical general-read gateway; it checks
task admission and installed/discovered operations before execution and release.
The separate task verifier reuses existing grant parsing, capability comparison
and read-only `currentTaskRun`, plus a registry-owned current-entry closure. It
never obtains an identity credential or selected client, creates an entry, mints
authority, refunds settlement, caches results or retries uncertain execution.

Configuration is immutable and secret-free. Disabled configuration permits an
empty or retained reviewed operation list; absent configuration remains unavailable.
Enabled configuration requires a nonempty unique canonical read list. Availability is bounded to 3 seconds; execute has an
explicit configured maximum of 30 seconds. All receipts end no later than their
original task/grant/entry/operation cutoff. Business/context/source/budget checks
and durable delivery identity remain owned by the canonical gateway.

Verification will exercise the new request/response and task boundaries, HTTPS
client/receiver path with synthetic Fetch transport, bounded cancellation, changed
catalogs, admission revocation before and after settlement, output integrity and
durable duplicate behavior using existing canonical gateway owners with synthetic
SQL/native resources. These controls do not qualify PostgreSQL, Core trust, native
installation, providers or live availability. Heavy checks remain held. Historical
proof manifests and prior failed/uncertain outcomes remain unchanged.

Actual activation is blocked on registry/shared composition integration, real
ordinary no-skill allocation, qualified installation/discovery, retained context,
Core principal/delegation broker and separate security approval of actual trust.
