# Knowledge graph source slice - 2026-10-17

Base: `74bf703` (tree `118c`), task branch `codex/meri-general-reads-remaining-next-20261017`.

## Implementation outline

The operation-specific `apps/gateway/sources/client-knowledge-search/handler.mjs` owns only the fixed `POST /api/clio/tools/query_knowledge_graph` bridge. It composes the existing stored-native HTTP transport, retained call/decision admission, exact credential correlation, request hashing, canonical normalization and complete result validation. It preserves the original flat request and every accepted native result byte represented in JSON; it performs no result filtering, graph reconstruction or provider/database access.

CONTROL remains the current native tenant/user/client visibility owner. Before HTTP, its task-bound credential observation must validate any explicit client selector against fresh membership client IDs and an exact current single-client subject when scoped. A client-scoped subject without an explicit matching selector must refuse rather than accidentally send a firm-wide request. The native graph owner retains per-row wall policy. Missing eligibility/authority wiring must fail closed; the adapter does not create a second policy owner.

The source directory will include a synthetic HTTP fixture and focused tests covering exact routes/payloads, complete nonempty/empty/refusal DTOs, client isolation received from Core, malformed/foreign outputs, credential correlation, cancellation, deadlines and response limits. Shared eligibility, CONTROL changes, general composition and SDK exposure belong to the coordinator. No shared files or contracts are allocated to this lane.

`search_client_knowledge` remains unavailable: its canonical output requires `generatedAt === trusted asOf`, while the native wrapper generates an independent timestamp. This operation is neither routed nor advertised by this graph-only factory. Family completion is not claimed.

## Pinned native evidence

All backend references below are pinned to `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`; the [scoped producer packet](https://github.com/neo-capiro/capiro-backend/blob/384325afaaf7ad34aeb9ff9b2f183d667ee17343/docs/retained-read-producer-mapping-20261016/scoped-producers.json) records the common authenticated tool ingress and operation mapping.

- [Graph source and projection](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L3157): `withTenantUser` loads current denied clients, applies wall exclusions to memory/wiki reads, removes denied-client FK relations and filters cache traversal clients. Tracked-bill/person FK rows are read tenant-wide and then filtered by the canonical native owner; this adapter adds no post-read filtering or stronger source-read claim. Cache enrichment failures retain the baseline graph.
- [Exact tool operation](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L3273): optional seed/client selectors use the native trim/clip pass, depth is bounded, client narrowing restricts the graph, foreign client seeds produce an in-band error, empty results use `edges:[]`, and nonempty results use bounded `connections` strings. The connection labels are opaque source text, not a parseable authorization proof.
- [Current denied-client owner](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/memory/memory-wall.helpers.ts#L83): exact tenant/user wall grants are queried in the caller's transaction. Grants are hard-deleted on revocation. No invented grant lifecycle or administrator bypass is introduced.
- [Graph merge owner](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/memory/memory-graph.helpers.ts#L110): visible memory wikilinks can add destination nodes with a slug-only label. This is authored mention content from an authorized source row; it does not establish visibility of that destination's private client record. Neither a seed nor a returned node is used as a grant. Client-scoped graph restriction removes other explicit client nodes; connection strings remain opaque.
- [Native client-scope tests](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-client-scope-fail-closed.spec.ts#L155) pin client graph restriction and conflicting client-seed refusal; these source tests were read, not executed here.

The frozen receiver is `packages/contracts/retrieval-0.2/client-knowledge-search-validation.mjs` and its schema. A Node UTF-8 codepoint check confirmed its invalid-UUID message uses U+2014 and matches the pinned native source; terminal rendering was not used to infer punctuation drift.

## Verification and status

Implemented source slice: `query_knowledge_graph` only. `createKnowledgeGraphHandlers(configuration, operations)` admits only its finite route and rejects the embedding sibling, other operations, duplicates and wrong versions. The factory remains a small composition of existing transport and contract owners; it adds no framework or graph implementation.

The synthetic fixture exports `storedCase`, operation `id`, `clientId`, `visibleClientIds`, `emptyGraph` and the canonical error constants. It supplies context `{}` and an echo-only context port for generic synthetic gateway composition. Mounted CONTROL tests must replace that port and synthetic credentials with the real owner; this source test lane does not mistake them for real authority.

Focused verification used the existing exact dependency overlay and Node 24 with `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=20000`. `apps/gateway/sources/client-knowledge-search/test/handler.test.mjs`: **13 passed, 0 failed**. Checks cover exact raw request and correlated hashes, full private result carriers, firm and client-scoped result projection, empty/refusal branches, opaque 120-connection windows, foreign client node refusal, malformed/duplicate results, missing/current credential denial before HTTP, all credential correlation fields, abort/deadline/response limits, per-call composition and unsupported sibling registration. The first run had 12 constructor failures while the coordinator's shared finite-operation eligibility was still pending; after that coordinated prerequisite landed, the unchanged focused test assertions passed. No eligibility check was bypassed.

The owned-path diff whitespace check passed. No dependencies were installed and no task-owned background process was created; the focused test process exited successfully. Disk capacity was checked before implementation (about 3.1 GB free), and the existing sparse worktree/dependency overlay was reused.

Source exposure and current-owner mounted integration remain the coordinator's work, followed by independent source review. Whole-family completion and SDK family exposure are not claimed: `search_client_knowledge` still needs the trusted native `asOf` seam. Qualification/live remain unverified. No source flag, live/native request, provider, SQL, credential, migration, deployment or contract mutation was performed by this lane.
