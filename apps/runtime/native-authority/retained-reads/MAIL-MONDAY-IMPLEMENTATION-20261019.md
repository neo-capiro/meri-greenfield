# Monday and mail retained read slice

Base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`.
Owner: `codex/meri-mail-monday-reads-20261019`. Shared startup, contracts and credential relay belong to the integration owner.

## Implementation outline (before coding)

- Compose existing `client-knowledge-monday` and `mail` families behind one small task-local port factory. Reuse their canonical signed HTTP adapters and operation contracts; no provider client, permission issuer, registry, endpoint or source is invented.
- Fixed source boundary: `POST /api/clio/tools/read_monday_client_boards` and `POST /api/clio/tools/mail.{list_messages,search_messages,read_thread}` at the validated Core HTTPS origin. Trusted current credential callbacks, selected task scope, installation operations and task limits remain caller-owned.
- Monday's native Core producer checks the current user/client managed board mapping before and after the source read. Inspect its actual response receipt before changing the existing mapping check: a token-issue response alone does not contain the mapping.
- Mail requires canonical mailbox scope in the current grant and subject, plus the selected client. The existing startup admits exactly one client scope; this slice must not derive mailbox scope from model arguments. Source-integrated adapters cannot be called production-ready until the authoritative admission owner supplies that scope and a durable continuation owner.
- Where a task-scoped mail continuation callback is explicitly supplied, preserve its receiver and require inert synchronous construction of `loadPrevious` and `retain`. No in-memory production fallback or unallocated migration.
- Focused verification: exact route/handler composition; original actor/tenant/client/scope binding; missing or disabled source authority; expiry/revocation; wrong board or mailbox/folder; opaque pagination and truthful unavailable/empty states. Tests use explicit stand-ins and do not prove native producer, live database or installed-image qualification.

## Initial dependency findings

1. `retained-read-credential-relay.mjs` refuses Monday because it expects no connected current mapping producer. Core `138c04373b18bb730b1ad0f8f9338342f628b8c6` already enforces current mapping before/after the same read but exports neither token nor body mapping receipt. The integration owner accepted the explicit producer trust contract: preserve exact signed route/body/correlation credentials and Meri actor/client validation, leave board admission to that existing Core producer. The signed adapter is corrected; the passive mapping adapter is unchanged. The integration owner must remove the relay's blanket Monday refusal and compose the task module.
2. Mail source context requires mailbox scope; `reads-composer.selectedClientOf`, read delegation, and initial run admission currently permit exactly `[client]`. Any change needs a server-owned source-scope admission contract; selectors are insufficient.
3. No production durable mail candidate continuation journal exists. The existing memory proposal journal has different record and retention semantics and cannot be silently reused as mail storage.

## Final source receipt

Source commits, in order:

- `43b91fca4abae093047f46fd738838b4dab10f20`: Monday signed Core contract correction and task ports.
- `3d59016cf0c672a402c780c450a4a1f693e711a2`: mail composition with explicit pre-admitted mailbox scopes and durable continuation callback; malformed-response guard for the signed Monday receiver.

| Operation | Core endpoint | Source status | Production dependency |
| --- | --- | --- | --- |
| `read_monday_client_boards@0.2.0` | `POST /api/clio/tools/read_monday_client_boards` | task composition + canonical signed handler checked | integration owner adds startup/source manifest entry and removes the relay's unconditional Monday refusal; qualified Core preserves pinned mapping producer |
| `mail.list_messages@0.2.0` | `POST /api/clio/tools/mail.list_messages` | conditional task composition + actual canonical dispatcher path checked with stand-ins | trusted mailbox-scope admission and durable mail continuation producer absent |
| `mail.search_messages@0.2.0` | `POST /api/clio/tools/mail.search_messages` | conditional task composition + actual canonical dispatcher path checked with stand-ins | same two dependencies; folder/query/offset/asOf remain exact selections |
| `mail.read_thread@0.2.0` | `POST /api/clio/tools/mail.read_thread` | conditional task composition + actual canonical dispatcher path checked with stand-ins | trusted mailbox-scope admission absent; family admission also requires its candidate continuation owner |

No source in this slice is exact-image/native-provider/database qualified, deployed, or live verified. Source registration does not activate an installation. No frozen build input, PR175, Core/frontend source, infrastructure, credentials or live database changed. No external messages, paid calls, builds or deployments occurred.

### Canonical module and integration API

`createMailMondayTaskPorts({coreOrigin,fetchImpl,now,familyIds,mailContextPortsForTask?})` returns a synchronous task factory accepting `{task,getSignedSourceCredentials}`. It returns `{families,contextPorts?}` for the existing reads composer. It constructs only requested families, uses the existing operation registry, and issues no credential itself. Task lifetime, binding, tenant, policy, selected client, approved operations and cancellation are checked before callbacks or source reads.

`MAIL_MONDAY_TASK_FAMILIES` lists both supported family IDs. **The production receiving owner must currently request only `['client-knowledge-monday']`.** Mail composition requires already-admitted task scopes containing exactly one client plus one or more mailbox scopes, all for the actual tenant/current policy; the existing production `[client]` task refuses before calling the continuation callback. This is a conditional source interface, not a claim that a callback supplies mailbox authority.

The mail continuation callback receives frozen `{binding,clientId,scopes,policyRevision,expiresAtMs,signal?}` and must synchronously return an inert `{loadPrevious,retain}` durable owner. Methods retain their receiver. The existing gateway owns canonical previous-page hashes, next-offset/asOf correlation, source authorization rechecks, reservation, settlement and final release. Test storage is an explicit Map stand-in and is never a production default.

### Pinned Core producer contract

Core repository: `neo-capiro/capiro-backend`, commit `138c04373b18bb730b1ad0f8f9338342f628b8c6`.

- `apps/api/src/meri/retained-source-v02/admission.ts` verifies the `CapiroMeriRead` operation/body/correlation bindings and task-selected client before reading. Core's route dispatch and grant release remain canonical owners.
- `apps/api/src/meri/retained-source-v02/monday-current-source.ts`, `readWithCurrentMondayMapping`, obtains the current mapping from `meetingPrepMondayMapping` using actual tenant/user/client; it rejects unavailable mappings and version/board-set changes across the source read. `documents-monday.ts`, `projectMondayRead`, validates source actor, client, exact mapped boards and canonical output. Mapping receipts are internal, so Meri's signed adapter trusts that authoritative route and separately validates its own actual actor/client/result boundary. The legacy passive mapping adapter is preserved.
- `apps/api/src/meri/meri-tools.service.ts`, `readRetainedMailSourceV02`, derives `authorizedMailboxIds` only from the verified subject's mailbox scopes, passes them to existing Engagement search/thread owners, and binds client separately. `apps/api/src/meri/retained-source-v02/mail.ts` validates current mailbox inventory/row owner lineage, projects row scopes as mailbox scopes, and preserves partial stored-history/unknown freshness. It supports no invented immutable full-history claim.

### Precise mail dependencies for dot and the Meri admission owner

1. Supply a reviewed **server-owned mailbox-scope admission producer** for the actual actor/tenant/selected client. It must bind authorized mailbox IDs into current task/capability/subject scope facts, recheck revocation and source availability, and preserve source connection/folder policy. The current Meri initial-run scopes, `reads-composer.selectedClientOf`, read delegation `selectedClient`, and signed retained credential relay admit exactly `[client]`; canonical mail requires a mailbox scope, while `createCurrentToolAuthority` requires subject scopes to be a subset of capability scopes. Model-supplied mailbox/thread/folder IDs cannot resolve this mismatch. No new route or permission is proposed as already supported.
2. Supply a **durable task-bound mail candidate continuation owner** with canonical `{loadPrevious,retain}` semantics and retention/suppression integration. `mail-read-context.mjs` expects records `{key,previousPage,previousSha256,recordedAtMs,expiresAtMs}` and keys containing the complete stable subject and selection. The existing memory proposal journal stores a different shape and has a memory-specific retention relation; silently storing mail there would be incorrect. No migration ID/table or production Map fallback was added.

After those producers are reviewed, the integration owner can compose `mail` and its context callback, update the source/installation measurement, and qualify actual authorization, revocation, paging, connection and folder behavior. Until then mail stays held even though its source adapter and conditional composition exist.

### Changed files

- `apps/gateway/general-reads/test/family-cases.mjs`: Monday fixture now echoes the actual signed credential contract without a fabricated external mapping receipt; other families unchanged.
- `apps/gateway/sources/client-knowledge/MONDAY-SIGNED-RELAY.md`: exact producer trust contract.
- `apps/gateway/sources/client-knowledge/monday-signed-adapter.mjs`: actual Core credential shape; canonical result/actual actor/client checks; typed HTTP refusal; no passive adapter change.
- `apps/gateway/sources/client-knowledge/test/monday-signed.test.mjs`: signed body/correlation/actor/client/malformed/paging/unavailable regressions.
- `apps/runtime/native-authority/retained-reads/mail-monday-task-ports.mjs`: small task-local composition; no IO or new authority.
- `apps/runtime/native-authority/retained-reads/test/mail-monday-task-ports.test.mjs`: Monday task composition and refusal checks.
- `apps/runtime/native-authority/retained-reads/test/mail-task-ports.test.mjs`: conditional mail composition through actual canonical dispatch, paging, truthful empty state, wrong scope/folder/client, expiry, revocation and unavailable source checks.
- This implementation outline/handoff.

### Focused commands and outcomes

1. `node --test apps/gateway/sources/client-knowledge/test/monday-signed.test.mjs apps/runtime/native-authority/retained-reads/test/mail-monday-task-ports.test.mjs apps/runtime/native-authority/retained-reads/test/mail-task-ports.test.mjs`: **39/39 pass**, zero skipped/cancelled. Provider, current authority and continuation storage are stand-ins; actual canonical adapters/validators/dispatcher execute.
2. `node --test --test-name-pattern='read_monday_client_boards' apps/gateway/general-reads/families.test.mjs`: **5/5 pass**, including real gateway family composition and release revocation.
3. `node --test packages/contracts/test/retrieval-client-knowledge-monday.test.mjs packages/contracts/test/retrieval-client-knowledge-monday-independent.test.mjs apps/gateway/sources/client-knowledge/test/read-adapter.test.mjs`: **100/100 pass**, preserving the existing passive mapping/memory behavior. Counts overlap other groups and are not additive.
4. Runtime TypeScript: `tsc --project apps/runtime/tsconfig.json --noEmit`: **0 diagnostics**, using the existing exact runtime dependency tree read-only. The first attempt lacked runtime dependency resolution and reported ten missing-module/Node-type diagnostics; supplying the borrowed runtime `node_modules` path resolved that setup issue without package/lock changes.
5. `git diff --check`: pass. New source module is 81 lines and introduces no generic framework or registry.

The first combined check had two setup/test-author mistakes: sparse checkout omitted an existing qualification fixture, and the new test treated a measured handler record as a function. Restoring that existing fixture and invoking `.execute` resolved them. A new malformed-response test initially counted the JavaScript promise-resolution `then` lookup as a source accessor; it now permits that language-required lookup and still proves no response-field access occurs on a rejected proxy. No production guard was weakened.

One general family run completed at **347/353 pass**. Its six failures are `actions.query`, `query_tasks`, and `query_action_items`, each canonical-success and release-revocation case failing `INVALID_RESULT`. Replacing only the shared fixture with the exact base `98d3c96` fixture under a restore-on-exit block reproduced the same **9/15 pass, six failures** in the targeted action group. This shows the Monday fixture edit did not cause those action-family failures; it is not a full isolated baseline run. The task-query owner received the findings. No assertions were weakened.

### Receiving order

1. Receive the two source commits above, resolving the disjoint Monday/action fixture changes without losing either.
2. Integration owner adds this task module to selected startup composition and source measurement closure, passes `now`, and requests only the Monday family for production.
3. Integration owner removes Monday's blanket credential relay refusal while preserving exact selected client, task binding, sources, normalization `{}`, invocation, target/body digest, correlation, expiry and current grant/budget checks.
4. Run the coherent receiving checks once; root owns shared startup/contracts/lockfiles. Keep actual installation qualification and frozen image builds separate.
5. Receive the two missing mail producers before any mail production installation/activation; then exercise the real native Core path and durable database under the approved qualification lane.
