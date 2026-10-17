# Candidate source-slice feasibility audit

**Result: no existing safe selectable slice for either operation audited.** This is a read-only source audit plus this report; no adapter, SDK, contract, central registry, credential, runtime or live service was changed. Other source-slice work remains owned by the coordinator.

The inspected Meri checkout is `08f65a79b99e5b269a8c7f7e82b6b8de225caae8`. Native source is pinned to Core `b525032222515d636b0dae2d46e40c7c3d8b5528`, read through supported GitHub access. Neither a returned row nor a convenient empty fixture establishes a source-selection guarantee.

## search_research_sources

The existing route is the fixed native `POST /api/clio/tools/search_research_sources`, dispatched to `MeriToolsService.searchResearchSources(ctx,input)`. The [advertised native input](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L1034-L1041) and frozen `ResearchLegalCandidatesRequest` expose only required `query` and optional `clientId`/`limit`. There is no source, type, domain, mail-only, meetings-only, own-note-only or unlinked-only selector. The frozen request is closed, so adding such a field in Meri would also violate its current contract.

The actual [producer, lines 6701–6897](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L6701-L6897), resolves an optional client then launches all six reads together inside one tenant transaction:

| Native branch | Existing selection | Why it does not supply the requested safe slice |
| --- | --- | --- |
| Clients | Same tenant, non-archived, text matches, optional exact resolved ID | Always queried; no source exclusion knob or visible client-wall predicate |
| Meetings | Same tenant, optional client, text matches | Always queried; ownership issue below also prevents accepting the apparent own-meeting restriction |
| Mail threads | Same tenant, current user's connection and active mail state, optional client | Real source predicate exists, but the other branches still execute; linked client walls are not established by mailbox ownership |
| Mail messages | Same tenant, current user's connection and active mail state, optional thread client | Same limitation; cannot request this branch independently |
| Meri notes | Same tenant and `ctx.userId`, optional client | Same limitation; no own-note-only or client-null-only selector |
| Directory contact notes | Same tenant and text matches | Always queried and remains tenant-wide even when `clientId` is supplied |

The per-branch limit is clamped to 1–25, default 8. Sorting and the final `limit * 3` cap happen **after** all six reads. A smaller limit, a query unlikely to match client names, omitted/null `clientId`, or dropping client/directory rows from the result therefore cannot provide pre-read source exclusion. Invalid input can refuse the entire operation but cannot produce a useful partial read.

The actual [client resolver, lines 9714–9754](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L9714-L9754), accepts a UUID or resolves one case-insensitive name match among same-tenant non-archived clients. It does not invoke the memory-wall predicate. The adjacent scheduling-specific method explicitly adds `clientMemoryAllowed`, demonstrating that the candidate method is not calling that stronger owner. A trusted `clientResolution` receipt can bind the selected ID; it cannot retrospectively authorize all client content already queried or turn tenant-wide directory notes into a client-scoped source.

### Additional source defect relevant to a future meeting slice

The candidate meeting query spreads the [local `ownMeetingWhere`, lines 10078–10082](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L10078-L10082), which returns an `OR` ownership condition, then supplies a later `OR` for text matching in the same object literal. The later property replaces the earlier one under JavaScript object semantics. Thus the inspected candidate query does not preserve the apparent ownership `OR`. The [shared engagement helper](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/engagement/engagement-access.helpers.ts#L26-L42) additionally excludes deleted events; that is a different implementation from the local helper. This is a static finding, not a claim that the native route or database was exercised. No fix was made in this audit.

### Missing boundary and smallest backend seam

A source-only candidate adapter cannot be implemented against this route by selecting a genuine existing knob. The smallest useful native extension would be a finite, server-admitted effective source set checked **before** constructing or invoking any content read. Its source identity and requested/effective set would need to be captured in the trusted call context and rechecked when results are accepted; filtering returned rows is insufficient.

For mail, meetings or notes, the selected source owner must also apply the current actor's authorized client allow-set, or an explicitly authorized unlinked-only predicate, before reading linked row content. Client-name resolution needs the same current permitted-client boundary in its lookup rather than resolving private names and applying a later wall check. Directory-note access needs an explicit existing authority decision; it cannot be silently inherited from the optional client selector. A future meeting branch must compose ownership and text predicates without the `OR` replacement and preserve the canonical deletion policy. These are backend/source-owner requirements; this report allocates no new selector, contract, grant or operation.

The existing frozen receiving context is `clientResolution` only. It has no effective-source set, current per-result client-grant proof or native source-slice revision contract. Full `search_research_sources` remains blocked; the separate already implemented mail/meeting reads do not establish parity or an alias for this operation.

## get_business_development_context

The frozen `BusinessDevelopmentContextInput` requires only a canonical `conversationId` and refuses other keys. The actual [MeriBizDevToolsService scope gate and context producer, lines 163–245](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-bizdev-tools.service.ts#L163-L245) rejects authority-like keys including `prospectId` and `linkedClientId`; checks an active native legacy `clioConversation` owned by the current tenant/user; authorizes its persisted prospect metadata; then reads prospect, firm preferences and history. The same handler projects `linkedClientId` whether null or non-null. It has no unlinked-only input branch.

[BizDevMeriScopeService, lines 133–230](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/business-development/bizdev-meri-scope.service.ts#L133-L230), requires both tenant feature flags, resolves the tenant's prospect, captures its canonical organization and linked client, and rejects changed persisted identity/scope on current re-resolution. It does **not** select only unlinked prospects. Whether a conversation's prospect is linked is discovered from stored scope/prospect data, not guaranteed by the caller's UUID or an accepted input constraint. `ownerUserId` is projected data and is not a substitute for the missing resource authorization bridge.

There is also no proved mapping here from the new Meri run/conversation identity to the legacy Core `clioConversation` and persisted prospect scope. A UUID-shaped ID is not that mapping. Even a fixture whose persisted scope happens to have `linkedClientId:null` cannot justify an input-guaranteed unlinked slice.

The smallest backend seam is a trusted native Meri conversation/prospect binding to the existing saved-scope authorization owner. It must bind tenant/user/legacy conversation/prospect and scope version, recheck current scope, and establish linked-client authority before prospect content/history reads. If an unlinked-only variant is desired, its effective mode and null-linked-client condition must be enforced at that owner before those reads and reflected in a coordinated contract. No such existing variant was found. The context method itself uses stored reads; this finding does not qualify dossier evidence, provider behavior, live authority or the other business-development operations.

## Exact inspected source and contract pins

| File | SHA or Git blob |
| --- | --- |
| Core `apps/api/src/meri/meri-tools.service.ts` | Git blob `32a7a744ba9ab812337baaf6093a37540864333b` |
| Core `apps/api/src/meri/meri-bizdev-tools.service.ts` | Git blob `e87c4f22bb0e53741de5ad8f63a5419f589b3d0e` |
| Core `apps/api/src/business-development/bizdev-meri-scope.service.ts` | Git blob `2cb7e71ff5929a6a78a97d60d27668409633572d` |
| Core `apps/api/src/business-development/bizdev-meri-scope.authorization.ts` | Git blob `764c22f72d46587cceba491c30c39fd0c31c1ada` |
| Meri `research-legal-candidates.schema.json` | SHA256 `a10095eb41c9185259b65189a966294cc92b8e53236a889d5029d70f09b76aae` |
| Meri `research-legal-candidates-validation.mjs` | SHA256 `1f7a82b92d42d838982172dc0b51656ec519b0912c95d933c82bf17ea7daf15c` |
| Meri `business-development.schema.json` | SHA256 `fff7362e49e0d981b1aeaeec881ea2e72e2fa263d9f64dfad94456fd50b330f1` |
| Meri `business-development-validation.mjs` | SHA256 `c6ede747a9ffce2acba96130bef2afd1fdaa0460b54dfd1603bde2b8911ffe5a` |

No denied or uncertain mutation occurred. The adapter action is **blocked by missing native pre-read selection/authorization contracts**, not pending user approval or a failed tool write. This audit completed the assigned feasibility check and leaves both operations unimplemented/unexposed/unqualified. No tests or live/provider/database calls were run because no executable source change was made.
