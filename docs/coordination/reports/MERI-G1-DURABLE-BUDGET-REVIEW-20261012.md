# Independent G1 durable tool-budget review — 12 October 2026

Initial discovery: **HOLD**, no author candidate reviewed yet. Intake is PR14
`1e6d430cf9c239caca4198aea42a762f13021cd5`. Reviewer is Codex
`/root/memory_reviewer`, isolated branch `review/meri-g1-durable-budget-20261012`.
Frozen behavioral criteria and exact source intake hashes are under
`docs/qualification/candidates/g1-durable-budget-20261012/review/`.

The gateway's actual `tool-dispatch.mjs` only calls injected `reserve`, `settle`
and `markUncertain` methods. Its tests use canned acknowledgement strings.
The source-disabled production constructor accepts the same budget port but
has no persistence-backed implementation. Reservation passes the public full
RunBinding, operation, argument digest, limits and deadline. Capability ID,
policy revision and trusted subject identity are not included. Settlement
passes reservation ID, outcome and output bytes; uncertainty receives only the
reservation ID. Each execution obtains `newId()`, which does not independently
establish a stable invocation identity for retry/replay accounting.

The proxy's `PostgresLedger` is a distinct qualification model-send ledger. Its
admission binds native body/count/pricing, a five-field run/worker/fence binding
and an opaque capability hash, records UNKNOWN before send, and supports trusted
usage or positive no-dispatch reconciliation. Its existing transaction locks
the aggregate qualification budget and evaluates expiry after that lock. These
properties must be preserved. They do not implement gateway tool accounting:
there is no gateway composition, identities differ, and tool output bytes do
not establish native token cost. No model-send ledger claim closes this gap.

Before code, the owner must allocate production paths and any migration and
define trusted invocation identity, complete accounting bindings, authoritative
tool cost/usage policy and how aggregate tool/model liability avoids duplicate
accounting. Independent criteria require actual-dispatch integration, single
debit on replay, stale/revoked/expired rejection, retained unknown liability and
no automatic retry/refund. Current source connectivity stays disabled.

No database, SQL migration, cloud, provider, paid model or native runner action
is authorized by this review. Any local recording/fake executor proves source
control flow only. Actual engine atomicity, cross-process contention, crash and
reconnect durability remain UNRUN unless separately authorized and performed.
This discovery retains the prior source acceptances and all runtime gates.
