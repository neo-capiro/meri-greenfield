# Trusted memory gateway source integration

Decision: **ACCEPT_SOURCE; G1/runtime HOLD**. The gateway now consumes the accepted
memory proposal-read contract with a current server-authorized subject, validated
retained continuation state and a private result envelope. Before this change,
dispatch supplied only the legacy clock/actor context and could not validate a
memory result against gateway lineage. This is an unblocked G1 source prerequisite,
not a new catalog binding or a claim that the production operation is available.

Preserved PR11: `5db2714b6dcbd3109c528e0afafcb654216133ca`.
Author: `5ebe58d6480496689f409b03060b5fdb76c5d7fe`.
Independent reviewer: `fc725f80a52a13c3958fc615880f9d65821a95d7`.
Combined tested source: `7fadbbf987b85755a39898527509e17953f1a750`, tree
`34f69c07bc59447b76a5ac1abb5c03a4a92d4260`.
Branch: `task/meri-g1-source-continuation-20261012`; later publication metadata
commits do not change the tested product source.

## Implementation and ownership

The canonical private memory binding gains one dispatch-profile field.
`operation-context.mjs` admits canonical raw argument shape before trusted ports
and obtains the current subject through existing authority. It normalizes the
accepted family with that subject, then requires unchanged authority selection
for normalized execution. `memory-read-context.mjs` validates caller-injected
load/retain ports, complete run/attempt/worker/fence/policy/subject/cursor ownership,
request/page digests, current receipts and expiration. The existing family owns
cursor, order, limit and coverage rules. `read-result-envelope.mjs` validates
binding, subject, operation and normalized argument digest while delegating the
unchanged raw result DTO to that family. The existing dispatcher, current-authority
and lifetime modules retain their roles; no model loop, authorization engine,
alternate registry or concrete storage adapter was introduced.

Authorization decision IDs may refresh; stable selection may not drift. Every
context port is bounded by the same lifetime. Retention occurs after current
release authority; settlement and final authorization precede result release.
Late completions cannot release output. This does not establish physical I/O
cancellation or durable/exactly-once state. First-page memory calls also require
both trusted context ports. A previous record whose expiry exceeds newly shortened
authority is conservatively refused. Native recovery behavior remains unqualified.

The coordinator consumes these private interfaces in real source; tests inject
synthetic trusted ports and a synthetic internal entry using the real canonical
resolver. The production catalog and entrypoint remain unchanged and disabled.
All 14 descriptors retain null handlers, pending qualification, zero retries and
unimplemented availability. Proposal content never becomes approved facts,
evidence-ready material or a general absence assertion.

## Verification and preserved failures

| Check | Result |
| --- | --- |
| Root contracts/source suite | 244 passed |
| Combined gateway | 146 passed: 79 preserved controls plus 67 memory cases |
| Preserved independent memory binding/policy controls | 35 passed |
| Public distribution | 7 passed; generation and TypeScript checks passed |
| Original shortened release deadline, settlement parked | Passed; rejected within original 100ms control |
| Independent accepted PR7 / 13-operation composition | 35 passed; original deadline control passed there too |
| Proposed native diagnostic source | Author 8 replayed; 3 additional root controls passed |

The reviewer froze 51 independent controls before author source freeze. Their
baseline 6-pass/45-fail result remains preserved. Prefreeze source produced
50-pass/1-fail: malformed memory input reached initial identity ports before shape
rejection, though business authorization was not called. The author moved shape
admission before identity; the assertion was retained. Two subsequently added
proxy fixtures initially failed because JavaScript async return accessed their
throwing `then` property before the gateway received a value. The reviewer retained
65-pass/2-fail evidence and an isolated language-behavior proof, made only `then`
lookup inert, and reran all 67 successfully. The original 51 assertions stayed
unchanged. An offline dependency-cache failure and successful bounded retry are
also preserved. These fixture issues are not reported as authority bypasses.

[Integration evidence](../../qualification/candidates/trusted-memory-context-20261012/integration/verification.json)
verifies all seven changed source/test paths against exact author/reviewer/tested
commits, 2131 protected original files, raw check hashes and process cleanup.
Only two preexisting source files changed: dispatcher and private binding metadata;
the current G1 ledger is the only other changed preexisting file. Raw memory
schemas, other contracts, original tests, locks and public 0.1 are byte-preserved.
All five integration check groups exited, were absent, and required no kill;
successful npm descendants were reaped. npm stderr contains update notices only.

The catalog bytes are identical to PR11. The complete ledger stays 139 originals,
96 selected, 43 deferred, 14 bound unavailable and 82 selected unmapped; 14 original
skill intents remain pending. No original capability was removed or reduced to
the qualification fixtures. PR7–PR11, main and the original source branches are
preserved; original PR2 is not reintegrated.

## Native evidence and the producer handoff

The independently reviewed [complete capirov2 wording handoff](CAPIRO-MEMORY-WORDING-HANDOFF-20261012.md)
is ready for its reserved owner. It gives exact reason/message replacements and
all conflicting comments while preserving pending creation, exact administrator
roles, current authority, client reviewer requirements and rejection/withdrawal
boundaries. It was not implemented in capirov2 or the shared frontend here.

The parent reader verified the original 247272-byte/117-member ZIP with SHA-256
`44ff0a58cd5f6b34279d3844a84952bb498d5973c116127e4a8295cc9f5a9c65`.
It reports a single native collector exit 2 after 0.416425 seconds, exact generic
60-byte stderr, empty stdout, EOF and no timeout/overflow/reader errors. Root
matched all three supplied pinned source hashes and the generic stderr digest.
These are parent-reported native observations; supported Library materialization
still produces no bytes in this consumer, including the explicit renewed route.
The immutable failed attempts and later parent update remain separate evidence.

The [reviewed separate diagnostic proposal](MERI-NATIVE-DIAGNOSTIC-SOURCE-REVIEW-20261012.md)
is source-only. It proposes bounded metadata reads after exact parent path and
supervisor binding; it does not execute/import the collector or invoke AWS.
The original capture's failing stage remains unknown. The original collector,
its pins and the failed slot remain untouched; no native rerun occurred here.

## Remaining gates

G0 remains accepted; G1 is OPEN; G2–G7 are unentered. Real task identity and current
authorization/expiry/revocation, durable budgets/context storage, actual source
adapters, native checkpoint task-A/B recovery and stale rejection, supported patched
Linux image/dependency/license review, isolated browser/renderer sandbox,
egress/watchdog/physical teardown and artifact inspection remain unqualified.
The old image with 47 findings including 5 critical and 17 high must never launch.
Existing Aurora remains selected. The private operations context is reported in
the parent's unreadable ZIP here; affected host/Hermes actions remain blocked.
Paid-model aggregate remainder and exact infrastructure/security/action authority
remain unestablished. No paid model, cloud image build/push/deploy, resource,
credential, network/database/security/customer-data operation or main merge occurred.
