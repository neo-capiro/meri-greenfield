# Independent trusted memory-context source review

Status: **ACCEPT_SOURCE** for exact author freeze `5ebe58d6480496689f409b03060b5fdb76c5d7fe`; runtime acceptance remains withheld. Base `5db2714b6dcbd3109c528e0afafcb654216133ca` (PR11). Reviewer branch `review/meri-trusted-memory-context-20261012`, isolated worktree `/workspace/meri-trusted-memory-context-review-20261012`. Production author is a separate role and worktree. Reviewer owns only this report, the new review evidence directory, and `apps/gateway/test/memory-context-independent.test.mjs`.

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


## Final independent decision

**ACCEPT_SOURCE**, restricted to the private trusted memory-context consumption prerequisite. The exact author commit `5ebe58d6480496689f409b03060b5fdb76c5d7fe` is retained in reviewer ancestry by an unmodified merge. No production source was edited by the reviewer.

| Independently replayed check | Result | Receipt |
| --- | --- | --- |
| New memory suite: 54 independent + 13 unchanged author cases | 67/67 PASS | `review/frozen-memory67-corrected-fixture.json` |
| Unchanged gateway, inner deadlines, late cancellation, issuance and budgets | 79/79 PASS | `review/frozen-legacy79.json` |
| Exact PR7 accepted 13-operation contracts with new frozen gateway | 35/35 PASS | `review/frozen-accepted13.json` |
| Original freshly shortened release deadline with parked settlement, current composition | PASS | `review/frozen-original-release.json` |
| Same original deadline control, exact accepted 13-operation composition | PASS | `review/frozen-accepted13-release.json` |
| Exact original file byte preservation | PASS | `review/source-preservation.json` |
| Final source/evidence whitespace | PASS | `review/final-whitespace.json` |

The 13-operation composition uses exact Git contract bytes from accepted `5ee46446b5f60034916f00b2a665b3e2bef9cf60` and exact gateway bytes from the author freeze. It is an explicit temporary source composition, not an invented historical commit. Its 64-file hash manifest is `review/accepted-composition.json`. The current 14-operation catalog is separately checked by the new independent suite and remains entirely unavailable.

Of 2,134 base tracked files, 2,132 are byte-identical. The only changed original files are the existing dispatcher and exactly one memory dispatchProfile registry line; all 55 other contract files and every original gateway test/fixture remain identical. Three cohesive production modules and one author test are new. Schemas, catalog.json, public 0.1 exports, locks, authorization, lifetime and disabled production composition are unchanged. No new private-source bodies or external data were read or written in this review.

The first frozen 67-case replay yielded 65 PASS / 2 FAIL in the two added hostile receipt cases. Their synthetic async ports returned proxies whose `then` getter intentionally threw, so JavaScript Promise assimilation failed before any value reached the gateway boundary. The gateway returned content-free INTERNAL_ERROR, and no source defect was claimed. A standalone language diagnostic proves this without invoking production code. The only correction makes the unavoidable `then` lookup inert; every other property/reflection counter, non-JSON rejection assertion and source code remains unchanged. These cases were two of the three added in `d316c0c`, outside the original 51 controls frozen in `738d5f1`; all original 51 assertions are unchanged. Initial frozen stdout/receipt, diagnostic, original test Git hashes and the final corrected test hash are preserved in the evidence packet.

Author-reported root contracts 244/244 and public distribution 7/7 passed; those broader author checks were inspected as author evidence, not relabeled as independent executions. The independent checks above directly cover the changed source boundary and retained compatibility.

## Remaining gates and cleanup

All actual 14 descriptors retain `unimplemented` / `pending` / null handlers, discovery returns no tools, and the production gateway remains `sourceEnabled:false`. The new context ports have no concrete production storage adapter. This review does not qualify live grants/walls, source accuracy, storage consistency/durability, native checkpoint task-A/B recovery, revocation latency, sandbox/egress/teardown, runner images or budgets. G1 remains OPEN, and later gates remain unentered. No runtime or deployment permission is requested or inferred.

Every supervised review receipt records exited processes and absence of its owned process group; no test timed out. Parked synthetic promises were released and drained. Owned ignored dependencies, local cache and the exact accepted-13 composition are retained for reproduction. No other owner's resources/processes were touched. No cloud, credential, customer, database, paid-provider, image build/push, frontend or Hermes action occurred. Parent owns integration/publication; this branch is local and reviewable with no further source blocker.
