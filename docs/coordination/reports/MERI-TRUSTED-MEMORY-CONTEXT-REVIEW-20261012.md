# Independent trusted memory-context source review

Status: IN PROGRESS, not accepted. Base `5db2714b6dcbd3109c528e0afafcb654216133ca` (PR11). Reviewer branch `review/meri-trusted-memory-context-20261012`, isolated worktree `/workspace/meri-trusted-memory-context-review-20261012`. Production author is a separate role and worktree. Reviewer owns only this report, the new review evidence directory, and `apps/gateway/test/memory-context-independent.test.mjs`.

## Before implementation: independent verification outline

Canonical ownership remains the private operation registry and existing memory family validator, current gateway authority and dispatch lifetime, and trusted ports for retained pagination context. No duplicate input schema, policy authorizer, concrete store or model loop is accepted. Only the canonical memory binding selects the new private dispatch profile; the original 13 bindings, public 0.1 exports, catalog availability and production disabled entry point must remain preserved.

The independent suite will exercise the real dispatcher consuming the real canonical memory contract, with explicit synthetic authority, handler, budget and context-store ports. It will not replace normalization or output assertions with fixture validators. First-page success and continuation success must demonstrate actual consumption; invalid caller context, result envelope and retained record controls must fail through that same composition.

Controls to freeze before source acceptance:

1. Raw model arguments must pass the canonical shape before authority ports; extra subject/previous/policy/identity/context, malformed selectors and hostile non-string caller values cannot establish context.
2. The current authority subject supplies defaults; raw-to-normalized preflight and every subsequent authority check must agree on full RunBinding, policy revision and stable subject (authorization decision ID may rotate). Stale writer fences, changed client/actor/tenant/scopes or roster cannot release data.
3. Retained pagination records/receipts bind full run/attempt/worker/fence/tenant/actor, operation/version, policy, stable subject, cursor, request/page digest and expiry. Cross-context replay, stale/future reads, tampering, mismatched prior limits and poisoned cursors must fail before handler effects.
4. The private envelope must have exact effect lineage and operation/normalized-arguments digest while retaining the existing raw result DTO. Invalid family result content, scope, progress and coverage cannot escape by hiding inside the envelope.
5. Fresh shortened deadlines must bound parked load/retain/settlement; cancellation and late completions must not start later effects or release a result. Failed context persistence and uncertain budget settlement remain content-free failures, not source acceptance.
6. Replay unchanged original gateway deadline, cancellation, timestamp, budget and accepted-catalog controls. Preserve prefreeze failures, then rerun against the exact author freeze; do not rewrite assertions merely to pass.

No cloud, provider, model, SQL, customer, frontend, Hermes or capirov2 operation is authorized or performed. Local synthetic source checks cannot qualify runtime identity, revocation latency, durable storage, isolation, physical sandbox teardown or G1. G1 remains OPEN.

## Preserved prefreeze evidence

Reviewer commit `738d5f1` froze the first 51 independent controls before author source freeze. PR11 base replay yielded 6 PASS / 45 FAIL because the gateway did not yet consume this memory context profile. Passing baseline denials do not establish the missing path. The full raw result is preserved as `review/preserved-base-memory-controls.*`.

A prefreeze author worktree replay yielded 50 PASS / 1 FAIL. Malformed shape reached initial capability/currentRun identification before canonical shape rejection; it never reached business authorization. This is unnecessary trusted-call ordering, not an authorization leak or failure of the initially approved narrower requirement (shape before authority.check). Parent agreed the cheap refinement to shape-admit before initial identify; the original stronger independent assertion remains unchanged. Raw result `review/prefreeze-author-memory-controls.*` is retained, with the exact tested implementation explicitly prefreeze rather than a frozen Git identity. Commit `d316c0c` retained this result and added three independent inert-receipt/immutable-context cases (54 total).

Initial default offline install failed ENOTCACHED. The exact lock dependencies installed with `--ignore-scripts --offline` using the existing local cache; no dependency/lock changes or network package fetch occurred. Both supervised outcomes are retained. No available `.agents/skills` files exist in this isolated checkout or the empty workspace skill directory; AGENTS.md and implementation standards were read directly.

## Architecture and bounded claims

The private registry owns one memory-only dispatchProfile field. The operation-context module handles profile selection, canonical raw shape admission and preflight context setup; memory-read-context handles retained-page keys, records and fresh bounded port receipts; read-result-envelope validates the exact five-field private wrapper then delegates the unchanged raw DTO to canonical family validation. The existing dispatcher, authority and dispatch lifetime remain the owners of authorization, effects, budgets and cancellation. No schema/public API, alternative authorization engine, concrete persistence adapter or agent loop is introduced.

The independent success fixtures deliberately inject a trusted internal catalog entry to exercise the real dispatcher with the actual canonical memory resolver and current-authority composition. They do not weaken or edit actual catalog availability. A separate control verifies all 14 actual entries remain disabled in the production composition. Thus the tests establish consumption at the private source interface; they establish no production source exposure, live adapter support or native durability.

Port records bind the complete RunBinding, operation/version, stable authorized subject, policy and cursor. Record digests cover the original raw request and raw page; existing family validation enforces request limit, cursor continuity, ordering and coverage. Shortening current authority below a previous record's expiration rejects that record rather than extending authority. This conservative source behavior is not a measured production paging policy. Injected trusted ports may continue physical I/O after abort; the coordinator rejects and never releases late output, while real storage cancellation, exactly-once retention and durability remain unqualified.
