# Durable invocation and accounting reconciliation source — 2026-10-12

Base PR18 `6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e`; dedicated branch/worktree `task/meri-durable-invocation-20261012`, `/workspace/meri-durable-invocation-20261012`. Root scope and consequential marker decision are retained in the matching task. Native PostgreSQL, migration application, SDK/Temporal/provider/runtime execution remain UNRUN.

## Actual production path and behavior

The new trusted `createToolInvocationControl` constructs the actual canonical source-disabled gateway, prebinds exact grant context/producer identity, and calls its `executeOwned` and `reconcileInvocation`. Its internal composition seam also drives the actual enabled synthetic dispatcher in tests. Control does not mint grants, own a model loop, retain a second ledger or derive authority from model arguments. Runtime SDK issuer and Temporal delivery mapping remain unqualified; supplied delivery identity is trusted-owner correlation, not attestation.

The canonical budget owner now persists a stable owned_<UUID> identity for run+producer/delivery digest, original full grant/run/task/fence/policy/capability/allocation facts, canonical raw-request digest and operation. Initial issue requires the already-bound ACTIVE current grant; exact replay recovers original metadata without refreshing its deadline. Conflicting original context/request refuses, including after replacement. The legacy direct execute/forInvocation API rejects this reserved namespace; existing nonproduced behavior remains.

The actual dispatcher computes normalized arguments after authority/context normalization. Its existing UNKNOWN reservation and retained normalized-digest/reservation claim are written in one aggregate-lock transaction. This is the sole effect claim. No second claim engine or normalizer exists. Concurrent delivery/restart/lost acknowledgement cannot dispatch a second handler for the same durable identity. Raw request identity is explicitly distinct from normalized arguments.

Only the canonical dispatcher's privately captured settlement closure can persist completion metadata after validated result and completed release-authority checks. The marker binds original invocation/reservation/grant/allocation/raw request/operation/normalized digest/result digest/output bytes. It stores no result body and is trusted application provenance, not a cryptographic provider signature or delivery receipt. General owner/control/gateway APIs expose no completion-submission method or bound marker-writing ports.

Marker and accounting acknowledgements are separate recoverable transaction boundaries. Live cancellation/expiry after a marker or between accounting writes stops the next owned SQL port and retains/rolls back state as applicable; rollback/cleanup itself remains required. A caller timeout does not establish physical transaction cancellation or completion. Explicit historical reconciliation reads exact retained normalized expectation rather than asking callers to fabricate it. ABSENT/PREPARED are observations only. UNKNOWN without marker remains held. Exact marker-backed UNKNOWN can become SETTLED at the full original fixed hold once; repeated reconciliation returns terminal accounting without another charge. Root explicitly approved that this preserves total liability and clears per-grant UNKNOWN blocking only from confirmed completion provenance. No tool output is recovered/released; no retry, refund, redispatch or grant permission follows.

## Modules, migration and boundaries

`tool-invocation-record.mjs` validates closed provenance; `tool-invocation-owner.mjs` composes canonical transactions and reconciliation. Private assembleBudget in postgres-tool-budget retains producer binding; the acyclic tool-budget-dispatch helper captures it in canonical dispatch. The existing durable entry stays a small public delegate. Original reservation/settlement accounting remains one implementation. The only tool-dispatch change adds the validated result digest to its internal settlement call. The gateway index/public contracts are unchanged.

Root allocated explicit qualification migration0003_tool_invocations.sql and additive PostgresStore.migrate_tool_invocations() source. Sequence is0001→0002→0003; it is never automatic. Original0001/0002 and native test command sets remain unchanged. Frozen L1 authority is not expanded. No migration, real SQL, pg Pool, database connection, target binary, provider or cloud action occurred. Existing Aurora choice, SDK sole model loop, source disable,14 unavailable descriptors and original capability scope remain.

## Verification and preserved failures

First author connected/legacy run47/47 passed before independent provenance review, which was insufficient to establish canonical marker ownership. Reviewer preserved an actual counterexample: exposed forOwnedInvocation().settle charged10 with zero handler. Root-approved private composition removed it. Reviewer then preserved a cancellation counterexample: a second accounting UPDATE started after abort while the first awaited write was parked; the transaction rolled back, so no committed extra charge was established. Live guards now stop that later write and preserve historical reconciliation. A further caller options.owner override could replace the canonical owner in the internal durable composition; explicit rejection of both owner/producer injection now closes it. Reviewer owns original raw failures and exact source snapshots.

Author full source run225/225 passed before the extra cancellation regression. That regression's first full run227/228 failed when it inspected the scripted uncommitted +10 value before late rollback completed. Its no-terminal-write assertion already passed. The harness now waits for its own ROLLBACK event before asserting aggregate0, without changing production semantics. Raw failure/output remains. Original test assertions are unchanged. Final checks and exact source identities are recorded in author receipts/manifest. All tests use inert scripted SQL boundaries, not an executed SQL engine or concurrency/durability qualification.

Dependency preparation copied an existing scripts-disabled node_modules tree only after exact root lock comparison; no package acquisition, hooks or dependency/lock changes. Bounded local check process groups are verified absent. Review acceptance is independent and binds the final source freeze; author results do not close G1.

Additional independent cancellation finding: while a produced reservation count query was parked, cancellation still allowed the original reservation INSERT before the claim guard rolled back. No committed reservation/effect was established. The private produced path now wraps the entire canonical reservation operation callback with per-port live checks before lock/admission reads and the INSERT; legacy direct semantics remain unchanged. Its connected regression is additive and the original failure remains with the reviewer.


The fifth independently reproduced defect was a retained original-request deadline
gap: marker acknowledgement arrived after the request's2000ms cutoff but before
the broader grant/schedule bound, and automatic settlement incorrectly charged.
The private binding now carries the original preparation/current-call minimum,
shortens on fresh authority callbacks/results and canonical reservation bounds,
and supplies this cutoff to reserve, marker and automatic accounting. Preparation
also narrows its transaction cutoff after trusted grant/allocation discovery.
Exact original metadata replay may remain available after historical expiry;
it neither resets the retained deadline nor grants an effect.

The newly allocated PostgresBudgetStore optional live check closes acquisition/
setup/COMMIT boundaries for produced live paths. It checks before/after connect,
after BEGIN and both SET LOCAL awaits, before COMMIT and after its acknowledgement.
BEGIN is marked begun before the post-check, permitting rollback; COMMIT is marked
issued before await, preserving typed uncertainty on late/failed ACK. Cleanup can
still rollback/release. Legacy and historical transactions keep their default
behavior. This proves source control flow only, not physical query cancellation.

Final author run:240/240 PASS, including all original gateway assertions, actual
control/producer scripted transaction cases, reserved namespace/marker isolation,
request-only expiry, short-grant preparation, and8 inert store lifecycle controls.
Python migration source AST parsing passed. The exact receipt is
`author/transaction-boundary-final-check.json`; raw stdout/stderr are retained.
The earlier229/229 pass remains separately retained and predates final refinements.
Independent current-source replay reported39/39 before freeze, including a freshly
shortened release-only deadline; final independent acceptance still belongs to the
reviewer and must bind the frozen commit. All five independent counterexamples
(marker API, owner override, second accounting write, pre-claim reservation INSERT,
retained request deadline) remain in the independent reviewer packet. No failed
assertion was removed or weakened. The sole author227/228 failure is separately
classified above; it is not a production rollback failure.

All tracked base files except the6 explicitly allocated existing modules/docs
remain byte-identical. Original tests, registry/catalog, private/public contracts,
locks and migrations0001/0002 are unchanged. New source and evidence hashes are in
`author/source-manifest.json`; preservation/cleanup receipts accompany it. There
were no real SQL/pg driver calls, target child/runtime executions, cloud/provider
requests or migrations. Supported patched image, native durability/concurrency,
real SDK/Temporal delivery issuance and source connectivity remain HOLD/UNRUN.
