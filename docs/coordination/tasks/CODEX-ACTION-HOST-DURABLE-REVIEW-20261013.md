# Independent durable action composition review

Base: `f8e3507307640ee6b4904782cfb20f2b05e5e7b0`. Criteria frozen before author candidate inspection. Exclusive reviewer test: `apps/control/action-host/durable/durable-independent.test.mjs`; task/report and durable-review packet only.

1. Production composition reuses canonical PostgreSQL lookup delivery/store, immutable approval metadata owner/store, command journal, durable budget and executor. No fixture/test imports, new SQL engine, policy or approval loop, new migration, implicit enablement or import-time allocation.
2. Default source disabled and trusted configuration closed. Request/body data cannot grant authority. Exact original binding, command, proposal, scope, execution and immutable result identity correlation remain with existing owners.
3. Reconstruct owners over the same explicit synthetic fixture state; pending approval has zero source effects, explicit exact current approval permits one observed source invocation, repeated execution/reconstruction returns retained outcome without re-effect or double accounting. No native crash/durability/exactly-once claim.
4. Lost ACK, uncertain effect, cancellation and deadline preserve liability and refuse automatic redispatch/refund. Fresh read/approval/current authority checks apply after reconstruction and at release. Stale, revoked, mismatched identities refuse.
5. Borrow pools/ports; no end/close calls on caller resources. Inert import/construction, finite operation checks and resource release remain canonical.
6. Preserve every original source/test and raw failure. Use meaningful focused controls with ≤240s captures, exact source/packet audit and owned group absence; remove only own temporary dependencies. Native SQL/service/provider/model/cloud/runtime gates remain UNRUN. No recursive delegation.

Root clarification28a7d9de before candidate: default-disabled blocks new lookup before delivery SQL and command effects. Retained lookup reads remain canonical current-authorized. Disabled command.readOutcome retains its existing refusal; no new observer semantics. Added independent control for this distinction.
