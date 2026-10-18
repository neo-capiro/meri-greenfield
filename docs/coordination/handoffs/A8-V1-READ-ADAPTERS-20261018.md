# A8 native read source audit — 18 October 2026

Meri base: PR157 `c1bd0336984fd28a28aead9851090cf64a0cbf72`.
Canonical Core inspected read-only: PR86
`b40971b1f8de888687a8fb92fbdf4ff653fe10d3` in
`neo-capiro/capiro-backend`. PR87 `614da32b39a270d10294e3f216efddaf949c20d9`
was also inspected; it adds no news observation support.

Historical source lineage remains `96f484259e5238bb7437a9fc512a2784ebcea483`
and the names/explicit-client folder extension `1fc1b0cf`, documented in
`docs/shipping/20261017/lanes/lane-2-read-tools.md`.

The eight-operation A8 set is owned on this separate branch after the [PR121
handoff and current-owner check](https://github.com/neo-capiro/meri-greenfield/pull/121#issuecomment-6250611148).
The native-read receiver already composes these families; this pass preserves
their existing adapters and does not treat a Core handler's existence as a live
or qualified read. No operation is hidden or revoked to improve installation.

| Operation | Meri source at this base | Actual remaining dependency |
| --- | --- | --- |
| `get_state_bill_status`, `search_state_floor_votes` | Complete; exact body, selector and result rails retained | Core Option B requires the exact canonical delegated selector where applicable; live qualification remains open. |
| `search_tracked_bills`, `search_committee_hearings` | Complete; client resolution, source lineage and limits retained | Core Option B requires a client selector for hearings even when the contract permits null; raw uppercase/padded UUIDs can fail exact token admission. |
| `search_legislative_research` | Complete; no rewrite needed | Core route/current authority and live qualification. |
| `get_legal_reference` | Parser-independent reads admitted; parser-dependent reads refuse before credentials | Core must return authenticated citation resolution: effective reference identity and constitution edition suppression. |
| `search_legiwatch_news` | Exact source and explicit-year personnel reads admitted; this branch validates typed selectors before name lookup | Four Core/product facts listed below remain absent. |
| `query_outreach` | Explicit selected-client campaign list admitted; this branch refuses unsupported branches before credential factories | Core lacks client/actor walls for unscoped list and nested exact-record data; unscoped product scope remains undecided. |

State/votes, tracked-bills, hearings and legislation adapters were independently
audited against Core PR86 `b40971b1` and required no owned file changes. The
historical complete-source classification stands; their current Core Option B
selector mismatch is a cross-owner admission contract, not a reason to alter
the exact native request body without an agreed Core bridge.

## News source change and preserved behavior

`assertNewsRawRequest` now uses the existing canonical normalizer to validate
request-owned selectors before CONTROL can resolve a named client. A temporary
client-null copy validates typed source identity, folder length and personnel
scalars without inventing client authority. The frozen original request is
returned unchanged. Actual normalization still requires the current native
client resolution and the matching client subject.

Exact typed sources (`news`, `budget`, `personnel`, `research`) and explicit-year
personnel remain admitted. A selected client requires the current native roster
and a matching task client. Names require the existing per-call credential owner;
the transport substitutes only its observed UUID, preserves the original request
digest and binds the tool credential target to the exact outgoing JSON bytes.
An explicit client with a folder delegates the folder/client mismatch check to
Core/Intel. Source attribution, original body/rights/completeness, proposal stage,
personnel wording and continuation remain unchanged.

## News blockers

All blocked branches return `UNAVAILABLE` before native credential acquisition or
source HTTP. These are pending Core/decision dependencies; no operation was
denied by approval review and no live outcome is uncertain.

| Target | Missing fact or decision | Pinned Core evidence | Required owner |
|---|---|---|---|
| News/default/`articles` views | The exact clock used for this read's cutoff is not available to Meri or consumed from its observation transport. `generatedAt` is a separate clock. | `apps/intel-api/src/tracker/editorial/evidence.service.ts:199` samples `Date.now()`; `apps/api/src/meri/meri-funding-read-observation.ts:30` defines only funding/KB clocks and mode arms. Meri's shared codec likewise excludes this operation. | Core must provide the read's clock through an agreed, bound observation; coordinate any shared codec/transport extension. |
| Folder without an explicit client | The folder's effective client is unobserved. A roster alone cannot identify which client the folder selected. | `apps/intel-api/src/tracker/editorial/evidence.service.ts:75` loads the folder and assigns `scope.clientId`; exact-source and personnel responses do not expose that scope. | Core must provide the effective folder/client fact under current folder and client walls. |
| Monitor view | The native identity receipt carries the internal UUID actor, not the Clerk ID used by the monitor rows. The actor UUID cannot stand in for the Clerk ID. | `apps/api/src/auth/application-authority.ts:5` and `:116` restrict the public principal to tenant/actor; `apps/intel-api/src/tracker/editorial/evidence.service.ts:383` filters `owner_clerk_id` by `ctx.clerkUserId`. Core's internal retained delegation contains a Clerk ID but is not this adapter's native identity contract. | Core must supply the current Clerk identity through the supported news authority path. |
| Personnel with absent/null year | The local server calendar year is sampled inside Intel, with no agreed product timezone/default-year observation for Meri. | `apps/intel-api/src/tracker/editorial/evidence.service.ts:303` uses `new Date().getFullYear()`. | dot/Neo decide default-year semantics; Core provides/consumes that exact fact. |

The Core wrapper continues to resolve client references before calling Intel
(`apps/api/src/meri/meri-tools.service.ts:2507`), and the Intel controller retains
feature/member/folder checks for exact sources and personnel
(`apps/intel-api/src/tracker/keywords/keyword-meri.controller.ts:61`). Those source
implementations establish no deployed or live acceptance.

## Legal reference and Outreach owner gaps

Core `ResearchService.references` at PR86 `b40971b1` parses a citation to choose
an implicit reference ID and suppresses edition for parsed constitution
citations. Meri's `research-legal-legislation/request-context.mjs` permits the
parser-independent search/name/folder/rules/versions/explicit-ID slices and
keeps parser-dependent citation branches unavailable before credential or
HTTP calls. Core's present read-mode observation covers only five evidence
mode operations, not this citation choice. An authenticated request-bound
citation observation from that same canonical owner is needed to complete
`get_legal_reference`; Meri must not reproduce Core's parser as an authority.

Core `EngagementService.listCampaigns` at PR86 `b40971b1` performs a tenant-wide
unscoped query without the selected actor/client wall. Its exact record query
checks root ownership but returns nested client, meeting, prep and debrief
without current admission checks. `outreach-query/handler.mjs` therefore keeps
both unscoped and detail branches unavailable. The supported explicit-client
list now runs its canonical selection/current-subject check before any
per-call credential factory, so a denied branch cannot allocate that factory.
The original request and outgoing body/hash remain unchanged. Core must add
the missing owner walls; dot/Neo must define the unscoped-list scope before
either branch can be admitted.

## Focused verification

Node `v24.19.0`, one process per file, `--test-concurrency=1`,
`NODE_OPTIONS=--max-old-space-size=256`:

| File | Passed |
|---|---:|
| `apps/gateway/sources/research-legal-news/test/handler.test.mjs` | 37 |
| `apps/gateway/sources/research-legal-news/test/selectors.test.mjs` | 16 |
| `apps/runtime/native-authority/native-read-credentials/test/client-reference-context.test.mjs` | 69 |
| `apps/runtime/native-authority/native-read-credentials/test/source-slices.test.mjs` | 36 |
| Total | 158 |

Other focused A8 reviews, with overlapping runtime test files counted only
within their own runs: state/votes + tracked bills + hearings **95/95**;
research legislation **70/70**; Outreach source/contract/current-authority
**116/116**. The Outreach before-fix regression produced three expected failures
and its after-fix focused run passed. No full installation, SDK or live read
qualification was run.

The new malformed-name preflight assertion was also run against the exact Meri
base module: it failed with `Missing expected exception` (exit 1), confirming
the regression. With the fix it passes. Added focused cases also verify all five
admitted named-client selections, exact outgoing target hashes and capability
output-byte refusal without fallback. Existing tests retain current authority,
native failure, cancellation/deadline, typed evidence and pagination checks.

No shared contracts or runtime files were changed. No Core tests, dependency
installs, AWS/SQL/credential reads, model calls, deployment or live validation
were performed. Status remains **partial source**, with the news blockers and
the legal-reference and Outreach owner gaps above.
