# Funding explicit-anchor source slice — implementation outline

Base: local `615a5467ffa555f913ad49258b3919723ecf207d`, published PR107 `526b6be7c906c15298f13430fe5dd5a9db458e03`, tree `fe07e12c2539b39604317c7f48b670e8e5818849`. Task-owned branch: `codex/meri-funding-asof-20261017`; the clean existing task worktree is reused. Approximately 2.49 GiB free at preflight; dependencies remain borrowed through the existing exact-version overlay. No install or archive is needed.

Parent allocates the five existing funding methods' explicit `asOf` source adapter/DTO proposal in [the observation seam report](CODEX-READ-OBSERVATION-SEAMS-20261017.md), section A. The Core counterpart has not been allocated to this lane. Its supported native routes and existing optional third argument are source facts, while the observation header consumption remains pending.

## Owners and exact change boundary

- `packages/contracts/native-read-observation-0.2/{schema.json,validate.mjs}` and local tests: closed funding-only DTO, canonical encoding/hash correlation and golden wire fixtures. No retrieval schema, catalog contract or shared export mutation.
- `apps/gateway/sources/funding-opportunities/{handler.mjs,request-context.mjs}` and local tests: five fixed native routes, exact client-resource admission and unchanged canonical receiving. Native funding business logic, SQL clocks, feature gates and refusal states remain with Core.
- `apps/gateway/sources/retained-reads/{native-handler,http-transport}.mjs`: a finite `observation:'funding-asof'` source specification; require call-bound credentials; emit the header only after current proof checks and preserve the original flat body. No arbitrary header interface, delegated observation fallback or result rewriting.
- `apps/runtime/native-authority/native-read-credentials/source-read-context.mjs`: require the exact selected client subject/scope and fresh native visible-client membership for all five operations, capture trusted canonical `asOf` once per delivery and reuse it on rechecks. Existing credential owner pins the context, task/native revisions, request and delivery lifetime.
- Native family eligibility, `apps/gateway/general-reads/families/funding-opportunities.mjs`, source integration/manifests and focused tests: passive source construction only. The worker `READ_FAMILIES` registry, runtime startup/bindings, installations and shipping configuration remain outside this slice. Funding remains absent from SDK eligibility.
- Remaining-family ledger/report: distinguish the new Meri source slice from the pending matching Core bridge and from qualified/live support. Preserve research portfolio, portfolio changes and Florida budget reads.

Dependency direction is CONTROL current authority → frozen funding context → canonical call proof → finite source transport → actual native producer → unchanged frozen receiving. Model arguments never supply the clock or authority. All five frozen funding inputs require an explicit client UUID. A matching `asOf` in a response does not establish that an old server consumed the header.

No new response acknowledgement protocol, mode endpoint, migration, startup, lockfile, deployment, credentials or live AWS changes are allocated. The additive Core proposal needs actual service verification (observe-mode guard success is insufficient), original-body and route correlation, request-local observation admission and five dispatch calls passing the existing third parameter. It preserves old requests' default clock behavior.

## Verification and acceptance

Use exact Node 24, serial focused tests and bounded heaps. Verify canonical closed wire/body substitution/size cases; five fixed routes and canonical receiving; once-captured clock across current rechecks and revocation; no source secret release on mismatched subject/client/native visibility; no static/delegated or legacy fallback; restricted/unqualified installations and all five funding SDK operations unavailable. Run the affected existing source/authority/integration/ledger checks once after integration. Preserve failed check evidence and obtain independent source acceptance with exact production hashes before draft publication.

PR107's immutable checkpoint was delivered to **Resume Capiro on jumpbox**, the verified Meri shipping handoff owner. A Core ownership coordination message to **Resume backend integration** returned `invalid turn/start params: AbsolutePathBuf deserialized without a base path`; ownership remains pending. This does not block the authorized Meri source-only slice.

Later parent direction cancels the Fable transfer for Meri: dot again owns shipping and acceptance. This independent source lane continues without waiting for that shipment and preserves the qualified Core/frontend image pins. The handoff delivery above is a completed historical checkpoint, not a transfer of current ownership.
