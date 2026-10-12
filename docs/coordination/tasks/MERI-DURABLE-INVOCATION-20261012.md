# Durable invocation producer and accounting reconciliation — 2026-10-12

Base PR18 `6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e`; author branch/worktree `task/meri-durable-invocation-20261012`, `/workspace/meri-durable-invocation-20261012`. Root outline `3cfdec5569aeeb15d63900621161f9a0825278ff` assigns discovery before centrally allocated production/migration edits. Read AGENTS, implementation standards, adopted R2, existing gateway budget/dispatcher/outcome, proxy grants/store/migrations, Temporal activities and SDK fixture/discovery ownership. No relevant repository or environment `.agents/skills` exists. No recursive delegation.

## Discovery and proposed source outline

Actual durable gateway consumes the canonical PostgresToolBudget and shared proxy aggregate lock. It currently requires the caller to manufacture invocationJson; no durable producer owns its identity before reserve. Original reservation is durable UNKNOWN before handler execution, and the existing internal readback observes historical accounting. The checkpoint registry uses a different schema; no identity mapping may be fabricated between it and the proxy ledger. The discovery SDK adapter is explicitly synthetic; its raw SDK metadata is not trusted authority and must not become an invocation producer.

Proposed production control call graph: a trusted run-bound control owner consumes the actual durable gateway; execute issues or recovers exact durable invocation metadata, then enters existing dispatch; explicit reconcile uses the durable invocation's recorded canonical expectation and existing accounting. The immutable delivery identity must originate from trusted control context and be supplied separately from worker/model tool arguments. Across owner restarts the same delivery key must locate the same invocation UUID; conflicting context/request/operation must refuse instead of minting a new identity.

Propose centrally allocated0003 qualification migration for invocation provenance metadata keyed by run+trusted delivery digest: stable invocation UUID, original full grant/run/task/fence/capability/allocation facts, raw request digest and operation, creation time, normalized digest initially absent and bound only at the canonical reserve boundary. The raw request digest is not normalized argumentsSha256. Claim metadata and the existing UNKNOWN reservation are written under the original aggregate lock before physical handler dispatch. Concurrent/replayed delivery or lost claim acknowledgement cannot run the handler twice. This table stores invocation provenance, not a parallel financial ledger or an in-memory fallback.

Consequential reconciliation decision awaiting root: an optional immutable validated-completion fingerprint/byte count can be recorded only by the actual dispatcher settlement boundary after result validation and current release checks. Explicit reconciliation may perform existing conservative UNKNOWN→SETTLED accounting once only from that persisted fact; absent proof keeps UNKNOWN held. SETTLED is accounting only, never recovered tool output or permission to release/retry/refund. No external completion-proof submission method, inferred no-dispatch result or automatic recovery of unknown effects. Preserve direct legacy execute/settle contracts/tests.

Proposed allocated paths awaiting root: cohesive gateway invocation-record and invocation-owner modules; narrow existing budget owner/durable composition/index wiring; an additive internal validated-result fingerprint at tool-dispatch settlement; actual control entry module and focused source tests; explicitly allocated0003 migration. No external contract/dependency/lock change. Native database application and execution remain forbidden.

Source checks will use actual control→gateway→dispatcher→budget transaction code with scripted inert database boundaries, current/stale/foreign context, concurrent keys, restart, prepare/reserve/completion/settle acknowledgement loss, changed raw/normalized input, cancellation and idempotent reconciliation. Preserve original tests and all failed evidence. Native SQL/driver/locking/durability, SDK provider loop, Temporal server/worker, target runtime, image/cloud/provider actions are UNRUN and unauthorized. Source connectivity remains disabled and all original capability scope is preserved.

## Root allocation and consequential decision before implementation

Root explicitly approved0003_tool_invocations.sql (original0001/0002 unchanged) and the proposed gateway record/owner modules, narrow budget/dispatch/index changes, new apps/control/tool-invocations.mjs and focused tests. No Python migration method is currently needed; migration source remains explicitly unapplied. Reserved owned_<UUID> invocation namespace prevents bypass through old execute/forInvocation APIs; all original nonproduced APIs/tests remain.

Root approved immutable trusted completion provenance as the sole additional basis for historical UNKNOWN→SETTLED. The full original hold is charged once, preserving total liability; this explicitly clears per-grant UNKNOWN blocking only after the marker. The marker binds original invocation/reservation/grant/allocation/raw request/operation/canonical normalized digest/result digest/output bytes and is written only by canonical validated-result settlement after the current release check. There is no external marker submission. A separate marker transaction provides recoverability; signal/deadline must be rechecked after its acknowledgement before starting accounting. Lost/late acknowledgement stays HOLD until explicit exact historical reconciliation. SETTLED never means delivered output, retry/refund permission or new grant.

Production control prebinds bounded trusted context and producer identity, creates the canonical disabled gateway, and calls its actual prepare/executeOwned/reconcile methods. Delivery ID remains separate from tool arguments and is correlation, not authentication or native SDK/Temporal attestation. Criteria frozen0687e5c before production edits. First source freeze is bounded; any genuine failures remain in the packet and are repaired without weakening original controls.


## Independent provenance defect and allocated repair

Reviewer retained an actual counterexample: the first general budget-owner API exposed forOwnedInvocation().settle, allowing invented completion facts to charge10 with zero handler calls. Root allocated tool-budget-dispatch.mjs for an acyclic composition repair. Private assembleBudget retains the real producer.bind closure; general owner exposes only legacy safe paths, preparation/read/reconciliation. The canonical dispatch factory alone captures the marker writer; no returned owner/control/gateway method submits completion. Existing durable entry delegates without accepting a callback that could capture private ports. This preserves the counterexample as failure evidence instead of treating its passing functional tests as provenance acceptance.

Root also allocated additive PostgresStore.migrate_tool_invocations() for explicit0003 upgrade source only; no migration method runs automatically and no existing native command set is expanded.

Root additionally allocated optional per-call live checking in postgres-budget-store.mjs. New produced live transactions check before/after connect and transaction setup and before/after COMMIT; BEGIN sets begun before post-check, COMMIT sets committing before issue. ROLLBACK/release cleanup remains allowed. Historical and original legacy transactions retain default behavior; no physical cancellation claim follows.


Final narrow deadline refinement: reviewer preserved a marker ACK arriving after
only the original request deadline (while grant/schedule remained current), which
incorrectly began live settlement. Private bind now carries the minimum retained
preparation/current request cutoff, narrows synchronously on trusted authority
callbacks/results and canonical reservation bounds, and uses it across every live
transaction. Preparation likewise uses its shortened trusted grant/allocation
cutoff through its COMMIT check. No new public cutoff/marker API is exposed.
Exact historical preparation replay may recover original expired metadata only;
current execution and automatic accounting cannot inherit a refreshed deadline.
Explicit historical reconciliation remains an owner accounting operation.
