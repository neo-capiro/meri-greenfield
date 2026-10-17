# Retained news source/personnel slice - 17 October 2026

Disposition: **PARTIAL_INPUT / SOURCE-ONLY; independent review pending**. The `search_legiwatch_news` adapter admits exact typed retained sources and explicit-year personnel requests without selected client/folder. It does not complete the operation or research-legal-news family; the remaining full-read inventory is unchanged and SDK exposure remains withheld. No publisher intake, source rights, current employment, corpus completeness or live authority is qualified here.

Local base: `74bf7032285ed83b17a67e2fc2b0f5308eb9862b`, task-owned checkout `meri-remaining-next`. This lane owns only `apps/gateway/sources/research-legal-news/**` and this report. Root owns the finite partial whitelist, thin general-read composition, CONTROL/native-authority integration, measurements, SDK exposure, ledger, independent review and publication. No central contract, shared helper, startup, lock, infrastructure or credential source changed in this lane.

## Actual route and request-determined context

All native references are pinned to `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`. The adapter uses only the existing fixed `POST /api/clio/tools/search_legiwatch_news`. The [Core tool controller](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri.controller.ts#L512-L575) retains its service guard and authenticated current tenant/user dispatch. The [Core LegiWatch bridge](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L2505-L2566) requires native actor and service identity, resolves optional nonblank client references before forwarding, and wraps the unchanged native result with `tool`, `generatedAt` and the established source-quotation authority. Native errors remain failures.

The [actual multiplex controller](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/intel-api/src/tracker/keywords/keyword-meri.controller.ts#L48-L69) selects exact source only for raw `view === 'source'`, personnel only for raw `view === 'personnel'`, monitors only for raw `view === 'monitors'`, and ordinary news otherwise. No trimming, alternate case, unknown-view fallback or new endpoint is introduced. Exact budget source uses the budget feature lane; other exact kinds and personnel use the news lane. Read/apply mismatch remains rejected by the native owner.

[Phase8 scope/context/run](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/intel-api/src/tracker/editorial/evidence.service.ts#L48-L115) fixes jurisdiction to `FL`, uses `String(sessionKey ?? '')`, and has null folder/client when neither is selected. The Core bridge replaces absent/blank client selection with no resolved client before that scope is constructed. A selected folder could change effective client; this slice refuses it. Native feature authorization, authenticated actor transaction and existing [ResearchService context checks](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/intel-api/src/tracker/research/research.service.ts#L131-L158) remain with the native owner.

These branches therefore have five request-determined context fields, with no result-derived observation:

```js
{
  clientResolution: null,
  effectiveScope: {
    jurisdiction: 'FL',
    sessionKey: rawRequest.sessionKey ?? '',
    folderId: null,
    clientId: null
  },
  windowAsOf: null,
  defaultYear: null,
  owner: null
}
```

`clientResolution:null` expresses the unused client-resolution branch. `windowAsOf:null` expresses that neither admitted view uses the ordinary news cutoff. `defaultYear:null` expresses exact source or an explicit non-null personnel year. `owner:null` belongs to these non-monitor branches, even though native personnel tracking joins still use the authenticated tenant and actor. These values are established before source execution; the adapter never infers them from result scope, generated time, returned year or tracking rows.

## Owned modules and preflight interface

The implementation outline preserves existing ownership: a pure family admission/context module feeds CONTROL and the source handler; the existing shared native handler owns authority, credentials, bounded HTTP and exact receiving; the native service owns feature/member/context/source selection. No persistence, source lookup, parser, second authorization system or background worker is added.

- `request-context.mjs` exports `assertUnscopedNewsRequest(operation, rawRequest)` and `newsSliceContext(operation, rawRequest)`. It snapshots inert data, validates the existing closed request shape, refuses unsupported branches/scope, then calls the frozen canonical normalizer with the exact context above. This last pure validation rejects malformed source identity or invalid explicit personnel scalars before the native credential owner runs, without duplicating the source selector parser. The returned request/context are frozen.
- `handler.mjs` exports `createResearchLegalNewsHandlers(configuration, operations)`. Only `search_legiwatch_news@0.2.0` and its fixed Core POST route are selectable. It repeats the shared preflight before invoking the native helper or per-call credential factory. Its request-body seam rechecks the exact five-key context and returns the original flat request; there is no request/output projection.
- `test/fixture.mjs` exports `storedCase(id = 'search_legiwatch_news', options = {})`, with the established bill-text-compatible scene, synthetic current credential proof, raw JSON transport, `state.page`, `state.resultMutator`, `state.afterSource`, cancellation and context ports. It also exports `ids`, `requests`, `storedPage`, `person`, `authorityNote` and `personnelNotice`. Default request is `{view:'source',kind:'news',id:'synthetic-source'}`. Current-context receipts derive context from each current request rather than a fixture clock or response.

Root must invoke this same preflight **before** native credential work and canonical CONTROL normalization, and use `newsSliceContext` through the current context owner. Its integration also requires a non-client current business subject so an unscoped request cannot broaden a client-scoped turn. Root's source measurement includes both `handler.mjs` and the globally imported `request-context.mjs`. Mounted current-authority behavior is verified separately by root; this lane's direct synthetic adapter tests do not qualify it.

The canonical owner remains `normalizeResearchLegalNewsInput` and unchanged receiving in `packages/contracts/retrieval-0.2/research-legal-news-validation.mjs`. Supported raw branch grammar is deliberately bounded:

| Raw request selection | Disposition before native tool execution |
| --- | --- |
| `view:'source'`, `kind` exactly `news`, `budget`, `personnel` or `research`, nonempty string `id` of at most 200 UTF-16 units; no selected client/folder | Admitted after canonical normalization. Exact source identity and kind retain native semantics. |
| `view:'personnel'` with explicit non-null `year`; no selected client/folder | Admitted after canonical scalar validation. Native `Number(year)`, `kind` default/change/registration, branch, q clipping and offset truncation remain unchanged. |
| Any selected client, including an explicit UUID; any truthy folder, including whitespace | `UNAVAILABLE` before private credential acquisition or tool HTTP. No client/folder observation is fabricated. |
| Ordinary/default/unknown/null view, monitor view, or personnel year absent/null | `UNAVAILABLE` before private credential acquisition or tool HTTP. No cutoff, private monitor owner or source-local default year is fabricated. |
| Malformed exact source kind/identity, invalid personnel kind/branch/year/offset, unknown caller fields or hostile data | `INVALID_ARGUMENTS` through inert closed-shape/canonical admission, before native credentials. |

Absent/null/blank trimmed client selectors and absent/null/empty folder selectors remain unscoped. The original raw values are forwarded unchanged to Core, where existing optional-client normalization still executes once. Explicit year strings, zero, negative int32 years and an empty string converting to zero retain actual native semantics; the adapter does not silently substitute the current year. Source requests may carry unused ordinary-news scalar fields because the native exact branch ignores them; no branch is selected from those values.

## Preserved receiving and remaining dependencies

The actual [exact source producer](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/intel-api/src/tracker/editorial/evidence.service.ts#L116-L186) reads retained news, Florida budget, personnel or research source identities. The adapter preserves typed raw columns, source URL/observation aliases, revision, rights, confirmation, stage, sections and source quotation authority. Headline-only news stays headline-only; a budget proposal does not become enacted; personnel withdrawal wording does not become an employment conclusion; unresolved identity remains unresolved. No new publisher intake or provider fallback runs in this slice.

The frozen contract checks raw URL aliases for news/budget/personnel and their `Date`-to-`String` whole-second observation alias, including negative epochs. Research instead preserves direct ISO precision and section/text consistency. Research has no separate raw URL alias in its DTO; receiving validates its typed locator but does not independently establish that locator's authenticity. The adapter does not add an invented locator correlation or provenance claim. Exact-source completeness and rights retain their existing source meaning, rather than an adapter-created qualification.

The actual [personnel producer](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/intel-api/src/tracker/editorial/evidence.service.ts#L301-L324) only evaluates its local default-year clock when `year` is nullish. An explicit year avoids that observation. It reads latest source identities, joins tracking by authenticated tenant/actor/folder, and returns up to 100 rows plus exact offset continuation. Receiving preserves selected year/kind/branch, null registration year, unique current source keys, raw confirmation/withdrawal/identity fields, and saved/tracking-version consistency. Each caller-requested page acquires its own proof; the adapter does not auto-page or derive total counts/absence from an empty page.

Outstanding full-input dependencies remain: capture the actual ordinary-news source window; source-local default year when omitted; current named/client and folder effective-scope observations and rechecks; and exact native owner context for private monitors. Ordinary news coverage/intake/window semantics remain in the frozen full contract but are not made available by this slice. Feature/member/current-wall behavior, source database execution, corpus freshness/completeness, publisher intake, rights authenticity and live authorization remain unrun. This is no basis to reduce the remaining full-operation count or expose the SDK family.

## Verification

Node `24.19.0` used existing task-local dependencies with `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1`. No install or heavy archive was created.

| Check actually run | Result |
| --- | --- |
| Initial adapter suite | 29/30 passed. A broad negative test incorrectly expected a changed research source URL string to fail raw-alias correlation; research has no raw alias in this frozen DTO. |
| Corrected and expanded adapter suite | **31/31 passed**. The common test now verifies typed locator rejection, and a separate test verifies raw alias correlation for the three DTOs that actually return it. No production receiving rule changed. |
| Unchanged `packages/contracts/test/retrieval-research-legal-news.test.mjs` | **34/34 passed**. |
| Owned source syntax, authored-file whitespace, report local links and ownership review | Passed. |

The final distinct focused set is **65 passing tests**. It covers all four exact source kinds and explicit-year personnel across actual JSON bytes; exact fixed route/raw request/private carrier and proof correlation; names/UUIDs/folders/default clocks/monitors refused before credentials and per-call factory; malformed typed selectors refused by shared preflight; current tenant/actor/operation/source grants; missing native user/service credentials; feature/current-member/source failures remaining failures; type, identity, authority, rights/projection, date precision and source alias rejection; personnel page continuation and fresh proofs without total/absence inference; inert hostile input, bounded bytes, deadline and cancellation. Synthetic tests do not execute Core/Intel/database/provider code or establish source freshness, rights, employment or live authority.

Task-owned commands exited; no task-owned background process remains. No live Core/Intel/provider/database calls, credentials, source-system writes, cloud actions or activation occurred. The producer source files are frozen for root's independent review, measured partial integration and draft publication.
