# Five read operations: producer dependencies and receiving order

Meri base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`. Core inspected read-only at `138c04373b18bb730b1ad0f8f9338342f628b8c6`. No Core/frontend file, deployment input, database, credential, infrastructure or frozen build candidate was changed. No live provider/Core request was made.

Source presence was rechecked. All five selected operation contracts exist in `packages/contracts/retrieval-0.2`, and all five have actual legacy producers in Core. None is in Core's `MERI_DELEGATED_READ_TOOLS` or `MERI_RETAINED_SOURCE_TOOLS` at the inspected pin. A route's existence does not make it eligible for run-bound authentication. No operation below is qualified, deployed or live verified by this lane.

## Current operation status

| Operation | Actual producer | Meri work and remaining dependency |
| --- | --- | --- |
| `search_research_sources@0.2.0` | `POST /api/clio/tools/search_research_sources`; `apps/api/src/meri/meri-tools.service.ts`, `searchResearchSources` | New focused source/family modules use the canonical contract and existing retained native transport. Central registration/context composition belongs to the integration owner. Core must admit this exact read-only operation through Option B and qualify actual actor/tenant/client/source checks and release revocation. Six source branches remain candidate evidence, with tenant directory notes explicitly outside the optional client filter. |
| `get_certification_status@0.2.0` | `POST /api/clio/tools/get_certification_status`; `getCertificationStatus` -> `fetchFedrampProducts` | Contract exists; no production-capable handler was added. Actual producer uses ambient `toLocaleLowerCase()` while receiver requires the actual canonical comparison locale. Dot must agree/implement the private locale binding below and exact delegated-read eligibility. |
| `get_state_rule_status@0.2.0` | `POST /api/clio/tools/get_state_rule_status`; `getStateRuleStatus` -> `formatRuleStatus` -> shared lifecycle/comment helpers | Contract exists; no handler was added that can only fail receiving validation. Actual producer's independent stage/comment clocks must consume the exact trusted observations below. Dot must also admit exact delegated-read eligibility. |
| `search_sam_opportunities@0.2.0` | `POST /api/clio/tools/search_sam_opportunities`; `searchSamOpportunities` -> Program Element stored SAM catalog and `opportunityTools.readSamSourceFreshness` | Contract exists; no naive handler was added. Generation/deadline clock, source-staleness clock, freshness-health clock and current evidence mode need one explicit, privately bound producer contract. SAM is outside the current native observation operation set. |
| `read_chat_attachments@0.2.0` | `POST /api/clio/tools/read_chat_attachments`; `MeriChatAttachmentReadService.read`, `meri-chat-attachment-transport.ts` | Contract exists; native Core owner exists. Missing authoritative greenfield-to-native conversation/turn/attachment custody prevents safe composition. The native service cannot accept an arbitrary greenfield conversation UUID as proof of an owned Core `clioConversation`. See the exact dependency below. |

## Research candidates: receiving details

Canonical modules added:

- `apps/gateway/sources/research-legal-candidates/request-context.mjs` admits only the canonical raw request and produces `{clientResolution}` using the existing research client-reference capture.
- `apps/gateway/sources/research-legal-candidates/handler.mjs` validates selected-client subject correlation before credentials; requires `credentialsForCall`; sends only the exact fixed Core POST; preserves raw limit/query values and substitutes only a trusted resolved UUID for a client name. The shared native transport retains deadlines, output budget, request-target digest, service identity and safe failure behavior. Output uses the unchanged canonical candidate validator.
- `apps/gateway/general-reads/families/research-legal-candidates.mjs` derives operation references from the existing canonical catalog.
- Focused tests/fixtures live under that source directory and label all HTTP/credential/source stand-ins synthetic.

Central owner must add the family to the native and worker read universes, installation source closure and family import map, and implement native context selection using `researchCandidatesContext`. Named references must pass the existing current native client-reference owner; a returned UUID must equal the currently authorized selected-client subject. Null resolution must never widen a client subject into an unscoped search.

No paging protocol is invented: Core fetches six independently capped branches then retains at most `limit * 3` candidates. There is no cursor, corpus total, freshness proof or complete-history proof. The receiver preserves directory notes with `clientId:null`; it cannot relabel them as evidence for the selected client. Core must qualify the actor's independent directory-note visibility before activation. Option B's selector guard requires an explicit client selector for schemas that declare one, so a selected-client call must carry its authorized UUID after trusted name resolution.

## Proposed private observation extension — awaiting producer agreement

Reuse the existing `x-meri-read-observation` canonical base64url carrier, exact original flat-request digest, operation/version correlation, verified service identity and Option B target binding. Do not put context in model arguments or a provider URL, and do not treat an observation as a grant. The common outer shape remains:

```json
{
  "schemaVersion": "meri-native-read-observation/1",
  "operation": {"id": "<one exact reviewed operation>", "version": "0.2.0"},
  "requestSha256": "<canonical digest of original flat tool request>",
  "context": {"<only fields for this operation>": "<trusted observation>"}
}
```

This is a proposal, not an implemented contract extension or authority to activate an installation. All contexts must be closed per exact operation; existing funding/KB/mode shapes retain their behavior and bounds. The integration owner owns canonical schema/validators, source transport observation admission and startup context composition; dot owns the matching Core DTO/consumer and authorization eligibility.

| Exact operation | Closed proposed `context` | Required Core consumer behavior |
| --- | --- | --- |
| `get_certification_status` | `{comparisonLocale:string}` | Validate one canonical supported locale. Bind it through verified private observation. Pass it explicitly to every query/product-ID/CSP/CSO `toLocaleLowerCase(comparisonLocale)` call. Preserve exact product-ID precedence, ten-candidate cap, ambiguity, entire fetched-dataset semantics and original source URL/observedAt. Canonical spelling or local ICU support alone is not evidence that a producer used the locale. |
| `get_state_rule_status` | `{stageAsOf:canonicalISO,commentAsOf:canonicalISO}` | Pass the exact stage clock to `deriveRuleLifecycleStage` and exact comment clock to `isRuleCommentOpen` for the selected result. Propagate observations through both exact-ID and keyword lookup paths. Preserve state filter, ambiguous candidates and missing-deadline note. The later `generatedAt` is a separate actual source observation; do not infer either lifecycle clock from it or rewrite fields after receiving. |
| `search_sam_opportunities` | `{asOf:canonicalISO,sourceStatusAsOf:canonicalISO,sourceHealthAsOf:canonicalISO,evidenceAccuracyMode:'off'|'shadow'|'enforce'}` | Use `asOf` for generatedAt and deadline status/daysRemaining; use `sourceStatusAsOf` for the 48-hour stale-source comparison; pass `sourceHealthAsOf` to the actual freshness owner for hoursSinceLastSuccess. Obtain current evidence mode from Core's policy owner, compare it with the privately bound mode and refuse on drift; a supplied enum cannot select tenant policy. Preserve never-synced/unknown/degraded, raw freshness timestamps, separate local count and explicit incomplete-source notes. |

For these operations the control owner must retain immutable per-call observations across current-authority rechecks, credential acquisition and resume/release as appropriate; changed mode or authority refuses. A compatible Core implementation may explicitly accept equal clock values, but the contract keeps the separate roles named rather than assuming independent native observations were equal.

Required focused cross-repository tests before installation eligibility: substituted/missing/extra observation fields; request/hash/op/version mismatch; malformed canonical timestamps/locale; no verified service identity; wrong user/tenant/client; expired/revoked delegation or source permission; mode drift; stage/comment boundary equality; SAM never-synced/stale/failed freshness; exact-ID certification precedence and ambiguous/absent products. Real FedRAMP source fetch and SAM catalog freshness remain separate qualification gates.

## Attachments: exact producer/custody dependency

The existing Core transport requires a verified internal service identity and exactly this request envelope:

```json
{
  "version": 1,
  "input": {"conversationId": "<native owned conversation UUID>"},
  "currentTurn": {
    "tenantId": "<actual tenant UUID>",
    "userId": "<actual actor UUID>",
    "conversationId": "<same native conversation UUID>",
    "selectedClientId": "<actual selected client UUID or null>"
  }
}
```

The Core owner checks the current branded turn, actual tenant/user, unarchived `clioConversation`, exact conversation client and current client memory wall. Cursor scope includes native `conversationVersion` from persisted `updatedAt`, actor, tenant, conversation, client, source message and original-byte hash; the native owner authenticates the cursor and rechecks source custody after reading. Meri's contract decoding cannot replace that authentication.

Dot must supply one authoritative producer contract that establishes how an admitted greenfield conversation/turn identifies the native owned conversation and its persisted attachment messages/bytes (or a separately approved greenfield attachment producer). It must return/recheck the actual native conversation version and selected-client scope under current authorization. No mapping endpoint was identified in the inspected source, and this lane invents none. Existing native IDs cannot be silently substituted for model IDs or copied between conversations.

An additional clock mismatch remains even after custody: the Meri attachment output contract binds `generatedAt` exactly to trusted `context.asOf`, whereas the native service currently stamps its own later `new Date()`. Agree a private producer-consumed asOf or an explicitly reviewed receiving contract change; do not read a response timestamp back as supposed pre-read trusted context. Any new Option B attachment admission must bind the exact envelope bytes and prevent model-supplied currentTurn fields from becoming authority.

## Integration order and evidence limits

1. Receive the research source modules and the central owner's registry/context/source-closure changes together. Run the focused source and native-authority integration tests at that coherent point. Keep operation installation unqualified until Core eligibility is present and actual scope/revocation release is exercised.
2. Dot reviews the exact cert/rule/SAM observation proposal, publishes one producer contract/consumer slice and explicit read allowlist changes. Only then add Meri adapters/observations and qualify the matching source pair. No failing placeholders were added here to increase counts.
3. Resolve attachment conversation/turn/byte custody and generation-clock contract, then implement its separate retained source family and cursor/source release tests.
4. Regenerate reviewed installation/discovery/source hashes after the full receiving point. Preserve frozen image-build inputs, old evidence pins and PR175 unchanged. No qualification, build, merge or deployment is authorized by this document.
