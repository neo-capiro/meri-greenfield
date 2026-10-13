# Task lookup integration: ACCEPT_SOURCE

Accepted candidate: `a82543fcff94e4ed31c27185408e3e6f0ae3ece6`, from PR38 `77cedb126d57a0223d2df42ad2f3fe988eb51759`. This accepts the local source composition, not runtime/G1, deployment, real PostgreSQL durability, or evaluation quality. No production source was edited by this reviewer.

The actual path is control delivery → canonical durable gateway and budget owner → current authority and dispatcher → fixed-route HTTP adapter → canonical result validation → PostgreSQL lookup-store source → independently authorized recovered read → evaluator. HTTP and SQL boundaries in the replay are explicitly inert. No provider, database service, model, native worker or customer source was invoked.

## Exact source and preservation

The [independent audit](../../qualification/candidates/task-slice-20261012/integration-review/final-audit.json) verifies 17 production files against these accepted source commits:

- Shared action profile/context/envelope: `84a9313735ec9fb079e35a92adb074f6afaf32e7`.
- Concrete action HTTP adapter and handler: `eaa00fd0ea8ec98bc77b050caaa6526a2738405e`.
- Control delivery and PostgreSQL store: `6f14d780a40e878fa62bc928c4d520286313f56c`.
- Corpus and observation evaluator: `a57f5cf0e2345975ec11a3c2f43157c6e6769a73`.

All 9,667 PR38 entries remain; 9,663 are byte-identical. Three existing production files have exactly the previously reviewed changes. The fourth changed original is the test helper `vertical-source-expectations.mjs`: removing exactly ` ['actions.query','actions-complete/1'],` restores its original bytes. No historical test module/assertion was removed or weakened. Public contracts, catalog JSON, worker/proxy/runtime and native qualification trees remain unchanged. The catalog remains 139 original/96 selected/43 deferred and 97 unimplemented, pending, null-handler descriptors. The unchanged whole-plan ledger retains 51 pending requirements and zero runtime-qualified requirements.

## Verification

- Independent actual-owner controls: **17/17**, zero skipped, source `3ea5d8736c4c7f39f4f076494f003cc69232e5e1`. The earlier 15/15 receipt remains preserved.
- Root consolidated check: **691/694**, with all three failures preserved at `565c01b10d3a26ec499ac810bb56fb3f6fdf8f84`. The failures were two new evaluator-fixture source-list expectations and one historical profile-list expectation.
- Exact affected-file correction: **57/57**, zero skipped, at `9377ffed70b5cae6f8d1a485855929dae61347b9`. The evaluator corpus now freezes the complete source list from a separate reference-owner instance before the evaluated dispatch. Strict result-source and semantic assertions remain. This synthetic reference tests interface composition; it is not an independent quality oracle.

The independent controls exercise full SQL state transitions and canonical accounting; changed request and UUID-alias replay; task-B current-authority reads of task-A records; narrowed authority; stored digest/binding/event corruption; committed claim, dispatch, reservation, completion-marker and result acknowledgement loss; cancellation while marker acknowledgement parks; explicit marker-backed accounting reconciliation without result delivery or redispatch. Scorer controls consume the actual denied-read callback and caught exception. Removing either evidence item cannot become a denied pass; a retained UNKNOWN outcome remains failed and reserved liability is not refunded.

One reviewer audit initially used the wrong availability label (`unavailable` instead of canonical `unimplemented`). Its checker preimage and failed raw output remain in the packet. Only the audit assumption changed. No independent runtime control failed.

The [cleanup receipt](../../qualification/candidates/task-slice-20261012/integration-review/cleanup.json) verifies reviewer groups 419004 and 420549 absent, exact raw stream hashes, and removal of only seven reviewer-owned dependency copies. Root receipts report groups 419799 and 421029 absent. No timeout or kill was needed. These are local check-process facts, not physical source-transport or task teardown proof.

## Remaining limits

Live JWT/actor mapping, current producer policies and cursor semantics, PostgreSQL constraints/concurrency/restart durability, physical cancellation, the SDK/proxy/native execution path, and an authorized real evaluation corpus remain unqualified. Recovered reads preserve original identity and require fresh authority; source observations remain recommendations, not accepted tasks or proof of complete absence. The source-disabled catalog, approved memory exception and original full-plan scope are unchanged.

Reproducible focused command: set `MERI_REVIEW_SOURCE_ROOT` to this checkout, then run `node --test apps/gateway/test/action-lookup-slice-independent.test.mjs` under the committed `integration-review/capture-reaped.py` supervisor. The packet contains exact commands, raw streams, failure history, source pins and a small manifest. No broader replay was required after the focused corrections.
