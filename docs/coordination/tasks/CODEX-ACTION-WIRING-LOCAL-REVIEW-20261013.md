# Independent local application composition review

Base: `f3127d742b6b4ec556b00dba939d35e5622a9ad1`. Criteria frozen before candidate source inspection. Reviewer owns only this task/report, local-review evidence, and `apps/control/action-application/local/local-independent.test.mjs`.

## Frozen behavioral criteria

1. Exercise actual Fetch Request/Response query → retained authorized result → selected draft → immutable proposal through accepted control, gateway, metadata and executor owners. Source and SQL ports may be explicitly synthetic; no native durability or model-quality inference.
2. Opaque local bearer credentials select trusted server state on every request. Wrong, missing, revoked, expired and cross-session credentials/records must refuse; request body fields cannot grant tenant, actor, client, scopes, capability or approval.
3. Draft and prepare cause zero task effects. Pending approval refuses execution; only explicit trusted synthetic approval for the exact immutable proposal permits one observed task effect. Replay and mutation cannot cause another effect or infer durable exactly-once execution.
4. Current policy, session expiry and cancellation apply through release. No implicit approval or retry. Unknown and stored-but-not-released outcomes remain distinct from rollback/success. Errors and CLI output exclude credentials/source errors.
5. Safe imports and CLI help/invalid arguments allocate no services. Explicit synthetic-local mode only; bounded one-shot run or explicitly owned loopback server, with deterministic cleanup and repeated close/revoke behavior. No borrowed-resource disposal.
6. Verify exact source/dependency pins, original preservation, focused checks ≤240 seconds and owned process absence. Preserve all failing controls and fixture corrections. Runtime/service/native/DB/provider/model checks remain UNRUN.

Implementation will use independent end-to-end controls plus small targeted hostile-input checks, then exact metadata audit. No production edits or recursive delegation.
