# Passive identity/contact source adapters

Internal source implementation for existing `resolve_entity@0.2.0` and `find_contacts@0.2.0`. Factory imports make no source/provider/database connection; configured endpoint compatibility, current policy/native identity and production activation remain separate qualifications. Existing catalog/contract/lockfiles/public exports are unchanged.

```js
const adapter=createIdentityContactsHttpAdapter({
  endpoints:{resolve_entity:trustedEntityEndpoint,find_contacts:trustedContactsEndpoint},
  getCredentials:trustedSourceBroker,now:Date.now,
});
const execute=createIdentityContactsReadHandler({
  operation:{id:'resolve_entity',version:'0.2.0'},adapter,now:Date.now,
});
// The canonical current gateway supplies this call, never model/UI authority:
await execute({input,request,authority,argumentsSha256,
  normalizationContext:{defaultCongress:119},signal});
```

Contacts require explicit trusted `normalizationContext:{}`; entity resolution requires `{defaultCongress}` from root configuration. There is no ambient Congress/current-year default. Root gateway owns the current-authority source of this context and canonical normalization, budgets and final release policy. These adapters check internal coherence; they do not authenticate a caller-supplied authority object. They accept full existing RunBinding/ResolvedSubject/CapabilityClaims/AuthorizationDecision coherence, current policy/scope/operation/source IDs and bounded lifetime. Worker/model arguments cannot establish authority.

Both endpoints are explicit trusted HTTPS configuration without embedded credentials, query or fragment. No guessed source route, provider fallback or retry is supplied. Each broker request binds operation, normalized input and its hash, canonical metadata, normalizationContext, requestSha256 over `{input,metadata}`, full binding/subject/policy/source IDs, deadline and cancellation signal. Broker response must echo operation, metadata/context/hashes/full lineage/policy/source IDs and supply finite expiry bounded by admitted authority plus header-safe tokens. The source POST body is exactly upstream `canonicalize({input,metadata})`; the SHA of its literal UTF8 bytes equals requestSha256. Bearer and internal-service credentials stay in headers; no credential or claim object is added to result/body. Source producers must derive trusted context from their scoped broker credential and emit this closed wrapper:

```js
{binding,subject,operation,argumentsSha256,result}
```

`result` preserves the original canonical raw DTO. Native Request/Response/UTF8 receiving reuses the existing bounded JSON decoder, strict status/content type/encoding/length checks and owned deadline/reader cleanup. The handler invokes `read.call(adapter,...)`, preserving the borrowed receiver, and repeats canonical validation before serialization. Borrowed adapters/brokers remain caller-owned. Late/aborted body acquisition is cancelled; errors expose only existing content-free GatewayDenied codes.

Entity candidates preserve direct/crosswalk/name phases and precedence, exact contextual IDs, family/current-first ordering, legitimate duplicate crosswalk rows and stored current/former/session/Congress observations. A candidate is not a verified identity or authorization grant. Canonical no-match/missing-query notes remain explicit source statements, without authoritative absence, complete enumeration or source freshness. Crosswalk existence, hidden database name collation, roster currentness and latest state-session truth are unprojected source facts that require producer qualification. generatedAt and isCurrent are supplied observations; this implementation never labels an old result fresh or adds verification/coverage fields.

For contacts, a nonnull normalized clientId must equal the already-resolved current client subject ID; unresolved names are refused until the trusted caller resolves them. Returned clientId must equal that authorized subject. Canonical query/domain/limit normalization, OR predicates, nullable projections, lastContact ordering/nulls, email-less history and profile guidance are retained. Unprojected per-row linked-client membership, current People-tab state, inferred organization and full underlying mail/calendar coverage cannot be reconstructed from the DTO. Producers must enforce current tenant/client/row access and qualify those relationships; these tests do not certify them. Legacy profile-update guidance is passive source text; no mutation or new profile capability is invoked.

Synthetic exported fixtures for root gateway/brief integration are in `test/fixtures.mjs`: `createIdentityContactsFixture(operationId,{linked?,defaultCongress?})`, member/committee/bill/contact constructors, endpoints/NOW/id. They contain synthetic records, unusable credential literals and `.example.invalid` endpoints. Test network behavior uses injected Fetch with real native Request/Response bytes; no external endpoint is contacted.

Author checks:69focused tests pass, plus123unchanged canonical entity/contact regressions. Initial run retained63passes/6failed expectation assertions: structuredClone preserved shared binding/scope references between current and claimed authority, so those mutations changed both sides coherently. The corrected fixtures independently clone claimed/current components to test actual substitutions; no production check was loosened. Raw initial and rerun TAP are retained byte-exact compressed in `test/evidence/`. All owned child/test processes exited; borrowed dependency link removed at handoff. Root independent source review, actual gateway integration and publication remain required; live producers/current authority/source activation remain unqualified.
