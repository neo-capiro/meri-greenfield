# Trusted memory context source candidate

Author: gateway_author. Base: `5db2714b6dcbd3109c528e0afafcb654216133ca`.
Separate reviewer: gateway_reviewer. Integration and acceptance owner: root.
This is a source candidate; independent acceptance is not asserted here.

The dispatcher can now compose the existing private memory proposal contract
with fresh server-owned subject selection and a private result wrapper. The
canonical binding owns the single `memory-proposals/1` profile field. Existing
normalization and family validation remain authoritative; public 0.1, raw private
contract APIs, schemas and catalog.json are unchanged. All 14 real descriptors
remain null/unimplemented/pending; production source connectivity remains false
and discovery remains empty.

`operation-context.mjs` selects the canonical profile, performs raw shape
admission before trusted ports and obtains fresh preflight subject facts.
Preflight sees canonical raw/defaultable arguments; normalized authorization
still runs before reservation and effects. Stable binding, policy and subject
selection must agree across checks; refreshed decision IDs are permitted.
`memory-read-context.mjs` validates injected retained-page ports and receipts.
`read-result-envelope.mjs` checks the exact private wrapper's operation, normalized
argument digest and current effect lineage, then delegates the unchanged raw DTO
to the canonical memory validator. The coordinator reuses the existing authority,
lifetime and budget owners; no second registry, grant engine or model loop exists.

Both trusted context ports are required even on first-page requests, so an
unexpected nonterminal page cannot execute without retention configuration.
Continuation records bind the full run/attempt/worker/fence/actor/tenant/
conversation binding, operation, policy, stable subject and cursor. The previous
request and page have a canonical digest. Raw JSON admission prevents object or
proxy response introspection; outgoing context is deeply frozen. Canonical family
validation still checks actor/client, prior cursor, limit and advancing page order.
Checked-at times must lie within each injected-clock port call; record times and
expiry must be finite safe integers and expiry remains bounded by authority.
A record whose expiry exceeds a newly shortened authority deadline is refused;
this deliberate fail-closed restriction can require restarting pagination.

A nonterminal page is retained only after a valid release check. Settlement then
runs, followed by final current authorization before output release. A port that
ignores cancellation may still complete a storage write, but its late completion
cannot start later effects or release output. No compensation or physical-stop
claim is made. Revocation during retention can leave an acknowledged budget
settlement followed by denied output; it cannot create approved facts, authorize
review actions, or assert complete memory coverage.

## Checks and preserved evidence

Raw stdout/stderr and a byte-preservation manifest are in
`docs/qualification/candidates/trusted-memory-context-20261012/author/`.
Scoped attributes preserve their raw bytes. Local dependencies were installed
with `npm ci --ignore-scripts --no-audit --no-fund` in the root and contracts
package, using task-owned temporary caches; both exits were 0 and locks unchanged.

- Initial unchanged gateway suite: 34/34 passed.
- Initial author memory suite: 13/13 passed.
- Final gateway suite: 47/47 passed, including all original 34 and the 13 new groups.
- Root `npm run check`: 244/244 passed.
- Public distribution checks: 7/7 passed.
- Source/docs whitespace check passed; all test processes returned exit 0.

The author groups exercise actual canonical normalization, current authority and
raw result validation through synthetic ports: client selection, model context
injection, preflight subject drift, decision refresh, retained pagination,
missing/corrupt/replayed context, result binding and pending-fact semantics,
parked-port deadlines, late completion and revocation after retention.

Independent reviewer preserved baseline failures and a prefreeze 50-pass/1-fail
run. That failure showed malformed memory shape unnecessarily entered initial
identity ports; it did not reach business authorization or expose data. Raw shape
admission was moved before identity, as root requested, without changing the
frozen independent control. This report does not relabel the independent failure
as an authorization bypass. The reviewer owns exact frozen replay of the new
controls, the original 79 deadline/cancellation/budget controls and original
release-deadline negative control; their results are separate evidence.

## Remaining gates

Storage is caller-injected. No production store adapter, live memory handler,
durable/native checkpoint recovery, runtime authorization service or actual
source connection was installed or qualified. Record digests bind source-owned
data; they do not authenticate a compromised trusted store or provide durable
write/replay guarantees. G1 remains open, including supported patched image,
task identity/expiry/revocation, durable budgets, task-A/B recovery/stale rejection,
browser/renderer sandbox, egress/watchdog/teardown and artifact inspection.
No provider, cloud, customer-data, paid-model, frontend, capirov2 or Hermes action
was taken. No external jobs were started; bounded local test processes completed.
