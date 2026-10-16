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

## Delivered source and receiving seam

The additive contract is `packages/contracts/runtime-0.2/reads.mjs`, schema version
`meri-native-general-reads/1`. Existing frozen contracts are unchanged. It exports
`nativeReadOperations`, `assertNativeReadConfiguration`,
`nativeReadConfigurationSha256`, `assertNativeReadRequest`,
`assertNativeReadResponse`, `assertNativeReadTaskAssertion`, and
`assertNativeReadSnapshot`. Config hashing is canonical SHA256 of the complete
validated configuration, including the order-preserved operation array.

`createReadTaskVerifier` receives the existing `allocationJson`, `grantFactsJsons`,
`grantId`, `currentOwner` (the same supervisor admission owner), registry-owned
`readCurrentEntry`, `taskArn`, `issuanceFactsSha256`, `runRequestSha256`, `scopes`,
`approvedReads`, `expiresAtMs`, optional disabled-by-default `enabled`, `now`,
`maxRequestMs` (at most 3000) and `signal`. Its sole method is
`verify({capability,binding,operation,inputSha256,signal?,deadlineMs?})`.

The internal registry closure is called with `{binding,signal,deadlineMs}` and
returns exactly `{binding,runRequestSha256,grantId,taskArn,issuanceFactsSha256,
allocationSha256,scopes,policyRevision,readConfigurationSha256,checkedAtMs,
expiresAtMs}`. It must read an already-issued, currently accepted exact entry;
stop-only, missing, unallocated and revoked entries refuse. Its clocks are fresh,
its expiry cannot extend the original task/grant/entry cutoff, and taskArn equals
the admitted grant qualification workerArn. This callback is not runtime input.

The resulting assertion is the parent's closed secret-free tuple:
`{schemaVersion,binding,operation,inputSha256,runRequestSha256,grantId,taskArn,
issuanceFactsSha256,allocationSha256,scopes,policyRevision,authorizationDecisionId,
checkedAtMs,expiresAtMs}`. Existing `assertWorkerAuthorization` remains untouched.

`createNativeReadsOwner({binding,approvedReads?,taskVerifier?,gateway?,
allocationSha256?,policyRevision?,scopes?,now?})` borrows a control-side canonical
gateway port and exposes `handle(operationSuffix,request,taskCapability,signal?,
operationDeadlineMs?)`. Missing dependencies are unavailable. The optional fifth
argument narrows the receiver's body-inclusive deadline. No SQL/native credential
is accepted from the worker or emitted in an assertion.

`createNativeReadsApplication({owner,approvedReads?,now?})` exposes Fetch `handle`;
only POST `/v1/runner/reads/availability` and `/v1/runner/reads/execute` exist.
`createNativeReadsClient({origin,credential,binding,approvedReads?,fetchImpl,now?})`
returns the existing `{readAvailability,execute}` worker interface. The credential
is the existing per-binding task capability. Exact HTTPS origin, omitted cookies,
redirect refusal, strict UTF8/media/length, streaming caps, cancellation and owned
deadline cleanup are enforced. The first accepted installation/catalog/policy/
allocation is pinned; changes require remount. No automatic retry or replay exists.

The owner rechecks task admission around snapshots, before execution and before
release. Installed/discovered/approved operations are intersected with canonical
read-only descriptors, family client requirements and explicit deferred originals.
Execution invokes the existing durable gateway, preserving settlement and delivery
identity. Later revocation withholds bytes without refunding or erasing a completed
receipt. An uncertain duplicate remains `BUDGET_UNCERTAIN`.

## Focused validation and custody

All runs used one Node process, 128 MiB V8 heap, no test isolation, concurrency 1,
120 second hard supervisor wall, fresh host memory check and 256 MiB total reserve.
No compiler, install, browser, real database/provider, SDK child or listener ran.
The tests use actual admission/verifier/gateway/Fetch owners with synthetic
SQL/native/HTTPS resources. Sampled working set is measured, not a memory guarantee.

Exact argv: `node --max-old-space-size=128 --test --test-isolation=none
--test-concurrency=1 --test-reporter=tap
apps/runtime/native-authority/test/reads.test.mjs`.

| Source commit | Cases | Primary / cleanup | Supervisor duration | Sampled peak bytes | Commit headroom bytes |
| --- | --- | --- | --- | --- | --- |
| ce4dfa8de82b6d467cb3a48521473437240aa601 | 44/44 | 0 / 0 | 1596.5211 ms | 160530432 | 2968227840 |
| 721541fe8910f953142b757fd734766c4aeea158 | 48/48 | 0 / 0 | 1601.2051 ms | 160690176 | 3132403712 |
| 1c05b99d49511742e31127e5e18b2a760e3dc4fa | 49/49 | 0 / 0 | 1660.6413 ms | 164626432 | 2649694208 |

Final tested source tree: `660ad9667ed119f32a9ea3d4b678126e3fd03024`.
Final stdout SHA256:
`6e8f26b6250e88d269201fe07d1402bfeebfc38e86c883293e3fa0892e56d5ff`;
stderr is empty. PIDs 41820, 39348 and 5596 ended; each terminal receipt records
zero remaining matching owned/child processes. The successive runs covered new
cutoff/approved-list and genuinely omitted-config corrections, not unchanged broad
suites. No native READS failure was hidden. Earlier READS failures and the original
empty-log uncertain run remain preserved in their existing external evidence.

Only eight new paths differ from joint f54: the contract, four runtime modules,
two focused test files and this report. Existing files and historical manifests
are byte-identical to joint f54; no existing proof row is silently repinned. The
accepted control factory at 57d4 remains a separate four-path custody slice and is
not implicitly integrated by this branch. No migration is needed or allocated.

## Pending integration and real authority

Source review and acceptance of this new slice are pending Qualification. Startup
owns the canonical ready-map lookup (never ensure/bootstrap), explicit refusal of
control capabilities on reads routes before the generic control-cap path, immutable
approvedReads compilation, same-config original/target controller propagation,
candidate/registry/controller mounts, worker task bootstrap/config and the final
ordinary/remote caller. Its gateway helper currently has no production caller;
route support in that helper is not proof of actual transport. No shared path was
edited here and no automatic integration is authorized by this report.

Real ordinary no-skill allocation, measured installation/discovery, current retained
scope and the Core principal/delegation broker remain unavailable. Core's proposed
fixed retained-authority siblings are a separate source contract under review;
existing Clerk native-user verification does not establish delegated workload
verification. The trusted adapter must compare deterministic current resource
revision vectors across source awaits (portfolio detail linked walls, changes
denied-client walls, and canonical Florida feature/member/folder/client rules),
while preserving the accepted local readCurrent shape. Meri conversation/actor IDs
must not be assumed equivalent to legacy Core IDs. No bearer forwarding, new key,
credential fallback, issuer activation, grant or trust resource was introduced.
Activation requires separate approval naming actual issuer, audience, principal
scope, original TTL/revocation, workload secret access and concrete resource owner.
All production availability remains zero until those prerequisites are qualified.

Startup's f54 source scan establishes an additional original-entry fact gap:
`assemblePreparedCandidate` has static approved configuration, grant intents and
durable allocation, but no canonical original task `run_issuances` receipt or
`factsSha256`. The target registry has `issued.issuance.factsSha256` and its row's
request hash. Original READS therefore stays unavailable even when optional config
is propagated. Hashing current startup config would fabricate an issuance proof
and could accept a changed allowlist after restart. READS has no alternate producer.
If original READS is expected, parent must allocate the existing canonical issuer's
original-task issuance/material/approved-config durable binding and exact record
correlation. No new journal, framework, migration, key or credential is proposed.
Targets may consume their actual already-issued facts only after exact task/grant/
request/allocation/config correlation and current accepted-entry checks. This is an
absent prerequisite, not a denied action or a completed runtime qualification.
