# Read observation seams - 17 October 2026

Disposition: **READ-ONLY SOURCE AUDIT; ADDITIVE PROPOSAL, NOT IMPLEMENTATION**. Meri base: `e1845c3b0d7caa8fd3309ad96f6cb4e17f25ccce`. The bounded scope is 11 reads: program-elements (3), public grants/awards (2), funding-opportunities (5), and SAM (1). Only this report is written. No source, backend, retrieval contract, credential, startup, lockfile, installation or live system is changed.

Native source pin: `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`, tree `16723770a8e111fc66bcf70d36ff32ab71eb9928`. Actual native dispatch, presenters, funding adapter, request controls, rollout resolver, membership boundary and relevant downstream readers were inspected through the supported GitHub connector. Frozen receiving contracts were read from this Meri checkout. The [existing producer index](../../../scripts/scope-ledger/backend-producers.json) and [preceding dependency audit](CODEX-REMAINING-READ-DEPENDENCIES-20261017.md) remain unchanged.

## Outcome and implementation order

No complete existing HTTP observation seam was found in the inspected paths. There are genuine source owners to extend, rather than missing producers:

1. **Funding's five methods already accept the caller's explicit `asOf`.** Their fixed tool dispatch omits that argument. A narrow authenticated transport-to-parameter bridge is the smallest next proposal and does not require new retrieval context fields.
2. **PE's three reads and public grants/awards need a current native tenant/chat mode observation.** The actual rollout resolver exists, but current identity/membership and execution-control receipts do not expose it. A fixed, authenticated native observation projection plus a before-use mode comparison would close that gap. Copying environment settings into standalone Meri does not.
3. **SAM needs mode plus three separately named time anchors.** Its current formulas have real owners, but no request/context parameter carries those anchors through the HTTP route. Extend those exact owners, preserving their distinct predicates; do not infer anchors from output.

This ordering could enable five funding capabilities, then five PE/public capabilities, then SAM, subject to separate adapter implementation and independent receiving/source review. This audit implements none of them and changes no implemented/exposed/live count.

Two earlier broad blocker descriptions need precision. Public grants already return their actual deadline calculation clock; they do not need an additional clock context under the frozen contract. Funding's SQL/current-health clocks are independent source observations; the frozen contract does not require them all to equal the envelope `asOf`. They limit snapshot/determinism claims, rather than automatically blocking a source adapter after the explicit `asOf` bridge is supplied.

## Exact operation and observation inventory

Every operation below already has its fixed `POST /api/clio/tools/<operation>` dispatch. The last column identifies the current wire gap, not an absent endpoint or a missing credential claim.

| Operation | Frozen trusted context | Actual producer observation site at the native pin | Existing parameter / current wire gap |
| --- | --- | --- | --- |
| `search_program_elements` | `evidenceAccuracyMode` | `MeriToolsService.searchProgramElements`, L4953: server tenant/chat rollout before the PE list; model-safe budget projection uses that value | No mode input/receipt on the current tool wire |
| `get_program_element` | `evidenceAccuracyMode` | `getProgramElementDetail`, L5077: rollout before detail; off/shadow/enforce also controls lineage read/log/output | No mode input/receipt on the current tool wire |
| `get_pe_budget_timeline` | `evidenceAccuracyMode` | `getPeBudgetTimeline`, L5125: same owner; dispatch supplies the authenticated context | No mode input/receipt on the current tool wire |
| `search_federal_grants` | `evidenceAccuracyMode` | `searchFederalGrants`, L5315-L5318: local calculation instant, its Eastern calendar day, then current tenant/chat enforcement decision | Mode is missing. Native `asOf` already equals `generatedAt`, and both anchor the emitted deadline arithmetic |
| `search_federal_awards` | `evidenceAccuracyMode` | `searchFederalAwards`, L4905 after the stored market read: current tenant/chat rollout controls the additional typed date projection | Mode is missing. Existing serialized source dates and `generatedAt` require no caller clock context |
| `search_funding_opportunities` | `asOf` | `MeriOpportunityToolsAdapter.searchFundingOpportunities`, L302-L381 | Third parameter `asOf: Date = new Date()` exists at L312; tool dispatch L2747-L2755 passes only actor/input |
| `get_funding_opportunity_requirements` | `asOf` | `getFundingOpportunityRequirements`, L384-L452; same instant is passed into the requirements owner | Third parameter exists at L393; dispatch L2757-L2764 omits it |
| `get_funding_opportunity` | `asOf` | `getFundingOpportunity`, L454-L497; envelope uses caller anchor | Third parameter exists at L464; dispatch L2766-L2773 omits it |
| `get_opportunity_client_context` | `asOf` | `getOpportunityClientContext`, L559-L621; top-row deadline/count/next-deadline presentation uses the anchor | Third parameter exists at L562; dispatch L2782-L2785 omits it |
| `get_opportunity_government_landscape` | `asOf` | `getOpportunityGovernmentLandscape`, L625-L688; passes the anchor to `GovernmentLandscapeService.compose` | Third parameter exists at L628; dispatch L2787-L2792 omits it |
| `search_sam_opportunities` | `asOf`, `evidenceAccuracyMode`, `sourceStatusAsOf`, `sourceHealthAsOf` | Presenter L8450-L8529; adapter freshness arithmetic L205-L215; canonical health state L703-L726 in funding v2 SQL owner | No explicit presenter/freshness clock parameters or mode receipt on the current tool wire |

The exact receiving owners are [program-elements](../../../packages/contracts/retrieval-0.2/program-elements-validation.mjs), [public-data](../../../packages/contracts/retrieval-0.2/public-data-validation.mjs), [public deadline/date relationships](../../../packages/contracts/retrieval-0.2/public-data-deadlines.mjs), [funding](../../../packages/contracts/retrieval-0.2/funding-opportunities-validation.mjs), [funding envelope relationships](../../../packages/contracts/retrieval-0.2/funding-envelope-validation.mjs), [requirements](../../../packages/contracts/retrieval-0.2/funding-requirements-validation.mjs), and [SAM](../../../packages/contracts/retrieval-0.2/sam-opportunities-validation.mjs). Their context objects are closed. Adding policy revisions, receipts or extra clocks to those context objects would require a separately allocated contract change; the proposal below retains those facts privately instead.

## Existing trusted owners and their actual limits

### Native rollout mode

[resolveEvidenceAccuracyModeForTenant](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/common/meri-evidence-accuracy-flags.ts#L13-L19) calls the adopted [evidence-accuracy owner](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/packages/meriv2-core/src/rollout/evidence-accuracy.ts#L11-L23). [The rollout implementation](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/packages/meriv2-core/src/rollout/capability-rollout.ts#L89-L123) considers the configured mode, tenant enrollment and surface enrollment; an unenrolled tenant/surface resolves to off even when the raw mode variable says enforce. Observe the resolved value for the authenticated tenant and literal `chat` surface, not one environment variable in isolation.

Off and shadow often have the same output shape. Empty data likewise carries no reliable mode signal. Mode inferred from a response, selected by model arguments, hardcoded in an adapter, or recomputed from another deployment's environment is not a current native observation.

The existing [application membership controller](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/auth/application-membership.controller.ts#L11-L37) accepts its closed identity body. Its [service](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/auth/application-membership.service.ts#L24-L56) checks current native identity and repeated membership snapshots, then returns role, visible clients and revisions. It returns no rollout-mode field. Meri's [native authority client](../../../apps/runtime/native-authority/native-read-credentials/core-client.mjs) validates that exact receipt and knows principal/role/client grants; it cannot presently provide the missing mode. Adding unsolicited fields to the existing membership response would break its closed consumer.

### Request execution control

[ToolExecutionControl](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/packages/meriv2-core/src/registry/tool-execution-control.ts#L1-L17) contains cancellation and an absolute execution deadline. [The API request wrapper](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tool-request-control.ts#L1-L71) parses `x-meri-deadline-at` only to shorten execution. A deadline is not a deadline-calculation `asOf`, rollout observation or source-health timestamp. There is no existing observation field to repurpose.

[MeriController's tool boundary](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri.controller.ts#L506-L574) retains current native tenant/user, service-secret guard, request control and the existing attachment/portfolio transport admission. [Read dispatch](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L2467-L2478) uses producer-specific raw input parsing. Those special transport owners do not authorize an arbitrary new read-observation body field. None of these 11 operations may borrow the three-operation retained-principal protocol or claim an already-installed observation route.

Meri already has a suitable trusted capture/join location: [native read credential owner](../../../apps/runtime/native-authority/native-read-credentials/owner.mjs), [finite source context builder](../../../apps/runtime/native-authority/native-read-credentials/source-read-context.mjs), and [gateway context receipt checks](../../../apps/gateway/dispatch/native-read-context.mjs). It pins current task/native identity/resource observations to the original request and one delivery lifetime, and compares context on every recheck. Its injected `now()` can capture a funding anchor once, just as the existing public-domain query branch retains a captured default. That is a reusable CONTROL owner, not evidence that today's native HTTP producer consumes a new anchor.

### Funding clocks: what must and need not be bound

The [funding adapter](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/funding-opportunities/meri-opportunity-tools.adapter.ts#L302-L381) already gives the caller explicit anchor ownership. Every refusal envelope also carries that anchor, so a refusal-only path does not bypass the missing wire. [The five dispatch branches](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L2747-L2792) never forward a body `asOf`. The related requirements/landscape HTTP controllers also omit their owners' optional anchor; they return different DTOs and are not a compatible alternate tool route.

Frozen receiving binds the envelope `asOf` to trusted context, validates deadline arithmetic against it, and requires requirement-page `generatedAt` to equal that same anchor. Search's nested `generatedAt` only needs a valid source instant. Existing lifecycle classifications are queried with [SQL current date/timestamp](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/funding-opportunities/funding-opportunity-v2-search.sql.ts#L370-L423); [health state](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/funding-opportunities/funding-opportunity-v2-search.sql.ts#L703-L726) and [search health generation](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/funding-opportunities/funding-opportunity-v2-search.service.ts#L250-L264) also have their own current observations. They must remain truthful. They are not currently required to be a database snapshot at envelope `asOf`.

Therefore the minimal five-read proposal does **not** replace SQL clocks, change lifecycle selection, or add database-clock fields to the frozen context. It must also avoid asserting byte-for-byte determinism or a globally pinned catalog snapshot. A future uniform historical/snapshot capability would be a separate owner/contract decision.

Funding search and client context independently resolve the native evidence mode for their optional deadline projection. Frozen funding context deliberately contains only `asOf`; its receiving rules accept the native projection variants and require internally consistent returned-row counts. Do not add a mandatory mode context to this family merely because the native adapter uses the rollout resolver internally. Preserve its current feature, role, source-enabled, visible-client and profile-wall gates.

### SAM clocks: preserve the distinctions

[The presenter](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L8450-L8529) computes source-status staleness with `Date.now()` at L8481, then captures presentation `asOf` at L8492 and mode at L8493. [The freshness adapter](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/funding-opportunities/meri-opportunity-tools.adapter.ts#L204-L215) separately calculates hours since last success at L214. Its SAM result contains at most one freshness row under the frozen schema. [The stored catalog query](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/program-element/program-element-read.service.ts#L2686-L2732) uses stored active/NAICS/query filters; it is not a live SAM lookup.

The frozen relationships require:

- `asOf`: exact emitted `generatedAt` and any structured deadline arithmetic.
- `sourceStatusAsOf`: the presenter's 48-hour stale comparison and existing reason precedence.
- `sourceHealthAsOf`: the freshness adapter's `hoursSinceLastSuccess` arithmetic.
- `evidenceAccuracyMode`: the actual resolved tenant/chat mode deciding structured deadline presence.

Canonical `healthSql` also classifies a source stale using its own clock and a strict greater-than-48-hours condition. The presenter uses greater-than-or-equal and first respects the canonical source state. Preserve both formulas and their precedence. The frozen receiver checks the adapter hours against `sourceHealthAsOf`; it does not require the separate SQL health-state clock or database lifecycle clock to be equal to it. A later decision to pin every health read is broader than the minimal receiving seam and must not be silently bundled.

## Proposed additive interface before any code allocation

These are **proposed names/types/routes**, not claims of current API support. The Core owner and Meri contract owner must agree the small private wire before implementation. Keep the existing retrieval request/output schemas and public tool arguments unchanged.

### A. First slice: funding's existing parameter bridge (five reads)

Use a closed internal transport observation, separate from the flat tool JSON body:

```ts
type FundingReadObservation = {
  schemaVersion: 'meri-native-read-observation/1';
  operation: OperationRef;       // exactly the five existing funding read IDs
  requestSha256: Sha256;        // canonical hash of the original flat body
  context: { asOf: CanonicalIsoInstant };
};
```

Proposed carrier: one `x-meri-read-observation` header containing unpadded base64url of canonical UTF-8 JSON, with at most 2,048 decoded bytes and the finite shape above. Freeze cross-repository canonical encoding/hash fixtures with the wire owner before implementation. It is emitted only by trusted CONTROL transport after current authority/credential checks. It is not accepted in worker/model arguments or merged into the original request. The header is not a grant or a replacement for the current native user/service identities.

Core admission must require an **actually verified** internal-service identity for this opt-in header, including development/test. The existing [ToolServiceSecretGuard](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/tool-service-secret.guard.ts#L20-L62) can observe failures in development/test; merely reaching its `true` result does not prove a secret matched. Reuse its constant-time verification through a server-only verified marker/helper rather than trusting header presence, duplicating secret handling, or changing the legacy observe-mode policy for unrelated requests. Keep the ordinary verified native JWT/current tenant/actor checks too.

Admit only the exact operation/header version/context shape, match operation to fixed route and `requestSha256` to the unmodified body, enforce cancellation/deadline/size limits, and refuse malformed/missing required observation in the new opt-in path before producer I/O. Store the validated observation in a separate request-local read context, rather than changing the generic deadline-only `ToolExecutionControl` or mutating process time/environment.

The five dispatch calls then pass `new Date(admitted.context.asOf)` as the existing third adapter argument. All producer business rules, refusal DTOs, caps and downstream clock semantics remain with their existing owners. Old requests without the opt-in carrier continue using the existing default argument. The new Meri source must require its observation path and never retry the legacy path after an observation refusal or unsupported server. There is no response timestamp rewriting.

CONTROL captures the canonical instant once with its trusted clock, pins it with the original request/delivery, and reuses it on rechecks. The fixed native producer consumes that exact supplied anchor. No Core mode-observation endpoint is necessary for this first slice, and no new body `asOf` field should be advertised to the model.

### B. Mode observation projection (PE three, public grants/awards two, then SAM)

Propose a fixed sibling endpoint, **`POST /api/clio/application-authority/read-observation`**, with a closed, bounded request carrying only the finite operation reference and original request hash. Derive tenant/actor from the current native principal; do not accept tenant, actor, role, conversation, client grants or environment settings in the body. Require verified native identity plus actual internal-service identity for this service-only projection. Reuse the existing membership/identity request lifetime and before/after native-current checks.

```ts
type NativeEvidenceModeObservation = {
  schemaVersion: 'meri-native-evidence-mode-observation/1';
  operation: OperationRef;       // PE3, grants, awards, or SAM only
  requestSha256: Sha256;
  principal: CorePrincipal;     // actual native tenant/actor UUIDs
  surface: 'chat';
  evidenceAccuracyMode: 'off' | 'shadow' | 'enforce';
  rolloutRevision: Sha256;      // opaque revision of the actual resolver inputs
  checkedAtMs: number;
  expiresAtMs: number;
};
```

The native service resolves mode through the existing canonical resolver against one snapshot of its three rollout inputs, current tenant and literal chat surface. Return an opaque revision, never raw environment or tenant enrollment lists. A later recheck resolves current native policy again and compares the pinned mode/revision. This remains an ordinary authenticated current-facts observation, not a new credential, issuer, durable token or Meri authorization decision.

Meri keeps the full mode receipt privately in its credential/context owner's per-delivery state. The frozen retrieval context receives only `{evidenceAccuracyMode}`. Preserve task/native identity/membership/resource vectors and original request hash in the join. The initial metadata request uses genuine credentials inside CONTROL; workers never receive them. Re-fetch/recheck mode before releasing data-tool credentials and before accepting output. Observation failure stops data-tool HTTP. Receipt expiry cannot extend the existing task/native/source execution lifetime.

The opt-in observation carrier supplies the expected mode to Core. At the presenter's actual mode-use point, Core resolves current mode with the canonical owner and refuses drift; the caller cannot force enforcement or disable it. A server behind a different rollout revision fails closed instead of making a guessed selection. Recheck mode after relevant awaits and at release; a changed receipt restarts with new authority/context rather than silently mutating a signed/normalized call.

Public grants keep their existing native `asOf === generatedAt` calculation anchor and Eastern end-of-day rules. Public awards keep their source date meanings. No extra caller clocks are introduced for these five reads.

### C. SAM's three explicit calculation anchors

Extend the private carrier with the exact existing `SamOpportunitiesContext`, using three distinct fields. Capture them once through trusted CONTROL (or a deliberately allocated Core capture response), then make the actual native calculations consume those explicit values. Do not sample new values on each authority recheck, derive them backward from hours/returned dates, or equate them merely because calls occur close together.

The narrow native additions are optional typed calculation inputs to `searchSamOpportunities` and `readSamSourceFreshness`. Use `asOf` for generation/deadlines, `sourceStatusAsOf` for the existing presenter stale predicate, and `sourceHealthAsOf` for the adapter's hours calculation. Preserve the existing default native clocks for legacy callers and the separate canonical health-state owner. Mode follows proposal B. The stored SAM list/count query, source-enabled checks, unavailable/never-synced/error distinctions and absence disclaimers are unchanged.

## Exact proposed file ownership and compatibility

| Owner | Existing/new files to allocate | Bounded responsibility |
| --- | --- | --- |
| Core private wire owner | New `packages/shared/src/meri-native-read-observation.ts` plus shared export; matching new Meri `packages/contracts/native-read-observation-0.2/{schema.json,validate.mjs}` | Agree finite operation/context union, canonical encoding/hash correlation and bounded carrier; no retrieval schema edits |
| Core HTTP admission owner | New `apps/api/src/meri/meri-read-observation-context.ts`; existing `meri.controller.ts` and service-identity helper/guard | Decode/validate only the opt-in carrier, require actual service verification, correlate original body/operation, establish request-local read context and cleanup |
| Core funding owner | Existing `apps/api/src/meri/meri-tools.service.ts` five funding dispatch calls; existing funding adapter remains business owner | Pass the already-supported third `asOf`; preserve old default behavior and all funding gates |
| Core current-policy owner | New `apps/api/src/auth/application-read-observation.controller.ts` and `.service.ts`; register in existing `application-authority.module.ts` | Fixed service-only mode observation using current native principal, canonical rollout resolver and existing identity/membership lifetime owners |
| Core PE/public/SAM presenter owner | Existing `meri-tools.service.ts`; small observation helper calls at actual mode/clock-use sites | Compare current mode against the observed selection; consume SAM's explicit anchors without reimplementing domain rules |
| Core SAM freshness owner | Existing `funding-opportunities/meri-opportunity-tools.adapter.ts`, `readSamSourceFreshness` only | Optional explicit anchor for hours arithmetic; no SQL lifecycle rewrite or unreviewed health snapshot claim |
| Meri native current-facts owner | Existing `apps/runtime/native-authority/native-read-credentials/{core-client,owner,source-read-context}.mjs`; add a small fixed observation client if needed | Native mode request, strict receipt validation, private revision pinning, once-per-delivery clock capture, current rechecks and exact frozen contexts |
| Meri source transport owner | Existing `apps/gateway/sources/retained-reads/{native-handler,http-transport,call-context}.mjs` as needed | Emit only the reviewed finite internal carrier after credentials, preserve raw request/body and output, measured source provenance |
| Meri family owners / coordinator | New program-elements/funding/SAM adapters and finite current registrations; public-data adds only its two reviewed sibling handlers | Implement exact producer/receiving behavior after the seam is agreed; SDK/ledger exposure advances only after independent source acceptance |

The new private protocol is additive. Existing membership and identity response shapes, generic deadline control, old tool requests, frozen retrieval request/output/context shapes and the three retained native operations remain intact. Do not import Core implementation into standalone Meri, add a generic query/authority endpoint, or add a provider credential. Existing native source gates remain decisive; trusted context is not a permission grant. No live AWS, migration or startup change is part of this proposal.

## Focused acceptance required after allocation

No settled test suite was rerun for this document. The eventual seam work needs new checks for: all three modes and tenant/surface enrollment; off versus shadow with identical DTO shape; mode/revision drift across awaits and load-balanced source servers; raw body/hash/operation substitution; header spoofing and observe-mode guard bypass; expiry, cancellation and per-call isolation; once-captured funding/refusal/requirement clock equality; SAM's exact 48-hour boundary and separate health/status clocks; malformed/empty source-health cases; public grants at Eastern day/DST boundaries; preservation of funding lifecycle, wall/feature/source gates, truncation and unavailable-versus-empty truth. Those checks supplement, rather than replace, existing domain/receiving tests.

Report checks: exact base and backend pin confirmed; the table covers 11 distinct operations; referenced local source/contract files were inspected; no proposed endpoint/type is labelled implemented. Disk had approximately 2.48 GiB free at inspection. No dependency install, additional worktree, heavy archive, subprocess left running, live tool call or source mutation occurred. Remaining blocker: the parent/Core wire owner must allocate and review the additive observation carrier/mode projection before source implementation can consume these observations.
