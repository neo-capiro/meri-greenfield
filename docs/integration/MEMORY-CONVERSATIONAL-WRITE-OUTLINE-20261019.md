# Conversational memory proposal implementation outline

Base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`. Lane owns new memory-only modules and focused tests. Root owns shared command-kind lookup, metadata factory, intent catalog/mount/validator and runtime composition. No Core/frontend, frozen shipment, deployment, provider or live database action belongs to this lane.

Canonical boundaries:

- `packages/contracts/commands-0.2/memory-propose*` owns memory request normalization and immutable command/result validation. Preserve the selected conversation client, original binding, empty attachments and pending-only result.
- The existing approval-metadata owner/store owns policy rechecks, immutable records, expiry, SQL and uncertain acknowledgements. Add one memory codec and delegate its owner wrapper to the root's shared `createCommandApprovalMetadataOwner(configuration,action)`; do not copy persistence or authority logic.
- The existing command tool interface and prepare-only command preparer own proposal formation and uncertainty classification. Add a memory-specific composition helper over those owners. It cannot call an executor while preparing.
- The existing intent journal owns delivery idempotency and durable proposal result replay; the command journal and budget owner retain execution idempotency/UNKNOWN behavior.
- `apps/control/memory/command-source.mjs` and the memoized runtime `memoryComposition(context).commandSourceFor` own pending candidate creation. Core's review/decision owner remains the only publisher. Never invoke legacy `save_memory` to implement this route.

Modules: `approval-metadata/memory-kind.mjs` (closed canonical codec), `approval-metadata/memory-owner.mjs` (delegating factory), `intents/memory-preparer.mjs` (canonical services composition), and new memory-specific fixture/tests. Dependency direction is preparer -> command tool/metadata -> canonical memory contracts; approved execution -> existing durable executor -> governed memory command source -> producer/journal/Core review.

Verification: request/context/selected-client and raw-authority refusal; full immutable payload/readback; prepare/read/release policy denial and expiry; no inline execution; metadata ACK loss; intent replay/conflict/UNKNOWN; approved execution denied on revocation, then pending candidate and durable command replay with no second source submission. Tests use explicit scripted SQL/authority/Core stand-ins and cannot establish live qualification.

Activation dependency: current Core execution-capability issuance/receiver is `create_task`-only. The memory source must be supplied from the same trusted product context after live-session relay and retention bind, with exact executor binding and selected client. A task HTTP executor or task source-body projection cannot authorize memory. Root must retain the conversational row's hold until that full governed execution composition has an agreed producer contract.
