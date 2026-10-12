# Research Portfolio read contract author

Initial source freeze `deec763c57ba57cc4d7e7915d55b0f8719e13021`, superseded by
the narrow independent paging repair below; independent acceptance
pending. Base
`e0163fb65a639a28d9423e929058b40b48cc556d`, branch
`task/meri-research-portfolio-20261012`. No current source authorization,
source connectivity, native execution or runtime gate is accepted here.

## Change and ownership

The new private `research-portfolio.schema.json` and
`research-portfolio-validation.mjs` describe exactly two selected reads:
`get_research_portfolio` and `get_research_portfolio_changes`. The factory reuses the existing canonical `snapshotOperationData` admission
and is safe to import and receives the canonical `validateShape`, `assertSubject` and
`canonicalSha256` functions. Root owns registration, catalog, resolver and
operation-count updates. The only existing-file dependency is root-authored canonical admission export
`685fe100233da10991485be49b2a1e8e31dd8308`. No public contract, lock,
migration, source adapter or legacy implementation was changed by this author.

The factory exports `normalizeResearchPortfolioInput(operation, input, options)`
and `assertResearchPortfolioReadResult(operation, page, input, options)`.
Options contain exactly the existing canonical `binding` and `subject`.
The binding supplies the current conversation; the subject must be one
`entity` / `research-portfolio`, with canonical actor/tenant agreement. These
are required server-supplied facts, not an authorization API or proof that a
caller-supplied object is trustworthy.

Detail input permits only a compatibility `conversationId`. Omission uses the
bound current conversation; an explicit different or invalid value refuses.
Changes additionally accepts `cursor` and integer `limit` (default 25, 1–100).
Cursor text is trimmed; missing, null or blank becomes null. Normalized detail
selection is `{conversationId, portfolioId}`; changes adds `{cursor, limit}`.
`portfolioId` comes from the trusted subject, never model input.

Definition names are `ResearchPortfolioDetailInput`,
`ResearchPortfolioChangesInput`, `ResearchPortfolioDetailSelection`,
`ResearchPortfolioChangesSelection`, `ResearchPortfolioDetailResult` and
`ResearchPortfolioChangesResult`. Schema ID:
`urn:meri:retrieval:research-portfolio:0.2.0`.

The new Meri result wrapper is `{binding, subject, data}`. The wrapper is
explicitly **not** the legacy wire shape. Its data is the frozen detail DTO or
`{items, nextCursor}` changes DTO. Full run/task/fence and subject equality are
checked against supplied context. Detail checks identity, counts of returned
members/visible links, duplicate native identities and projected actor role.
Changes checks requested page size, descending event order, current recipient
state correlation and a progressing last-returned-event cursor. These checks
cannot establish actual current grants, walls, source truth or cursor authority.

## Pinned source basis and intentional limits

The [reference manifest](../../qualification/candidates/capability-next-20261012/portfolio-author/source-reference-manifest.json)
records exact Git blobs, byte counts and SHA256s for the immutable Capiro pin
`fd8765ec01d292013758606204f2c9d886cd31c1`. Every listed blob is unchanged at
observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Only schema/type/policy,
contract tests and narrow producer projection/default observations informed the
independently authored boundary. No private bodies are copied into Git.

- `packages/shared/src/research-portfolios.ts` supplies the actual imported
  detail, member, grant, client-link, event and recipient-state DTOs. The detail
  and changes services supply the exact returned projections and sorting.
- The Meri adapter and tool declarations establish the two request grammars,
  changes default/page bound and server-derived portfolio identity. Current-turn
  binding tests establish omission injection and foreign conversation refusal.
- The scope/access owner and policy tests require current conversation
  ownership, portfolio grant access and client-wall masking. Unrelated denied
  client links do not make the independently visible portfolio disappear.
  Projected grant role validation is not a new grant decision or admin bypass.
- The detail revision is current. Event aggregate revisions are historical and
  are not required to equal it. The captured conversation scope receipt, its
  digest and captured/current revision comparison remain with the trusted scope
  owner; the frozen returned DTO has no captured-revision field to synthesize.
- Recent detail history is bounded to 100 events. Changes `nextCursor:null`
  and empty rows are not promoted to complete source history or global absence.
  Opaque event payloads and unresolved input are bounded inert JSON; reported
  text or nested keys such as `approved` do not become authorization or facts.

Meri intentionally rejects unknown structural fields, effectful/non-JSON input,
unsafe integers, nonfinite timestamp instants and out-of-bound transport data.
Declared grammar requires integer limit 1–100; permissive legacy runtime
clamping/non-number fallback is not adopted. IDs and text use explicit private
transport ceilings, and arrays/recursive JSON share bounded admission. These
are Meri limits, not a claim that the backend has identical maximum lengths.
Oversized responses refuse; no content is silently dropped to manufacture a
complete result. Event payload and unresolved-input interiors remain opaque
JSON because no closed event-specific payload schema was established.

`get_research_evidence` remains pending. Its pinned producer reads actor-owned
Clio research-session handoff attachments, under the `clio_chat_attachment`
owner, not a Research Portfolio. Mapping that operation under the accepted
D012 portfolio boundary would silently change owner and scope. An explicit
owner/scope reconciliation is required before a separate contract mapping.

## Verification and remaining gates

Root inspection identified the initially duplicated inert JSON admission walker.
Before source freeze, it was removed in favor of the canonical unchanged
`copyData` implementation exposed as `snapshotOperationData` by root commit
`685fe100233da10991485be49b2a1e8e31dd8308`. Original 24-pass evidence and source
hashes remain preserved. The archived initial module was reconstructed after
the correction and verified byte-for-byte by its previously recorded SHA256;
it is retained as historical evidence, not imported by production. This routine
ownership correction does not change
normalization, result rules or test assertions. The unchanged 24 assertions
passed after the ownership correction (group 130549 absent), and an exact
committed-source replay passed 24/24 as recorded in `portfolio-exact-freeze.json`.

Initial focused source check: **24/24 PASS**, exit 0, no timeout. Supplied
subreaper receipt confirms owned process group **130033 absent**, no kill or
descendant cleanup required. Raw streams and receipt remain under
`docs/qualification/candidates/capability-next-20261012/portfolio-author/`.
The initial capture diff omits untracked files; `initial-tested-source.json`
separately records their exact tested identities before any further edits.

The focused suite exercises both nonempty projections, normalization and
injection refusal, recipient/scope substitution, full run lineage, current and
historical revision separation, pagination, opaque JSON, all structural
closure, timestamp/size bounds and getter/proxy/cycle admission. It uses the
pinned Ajv with a test-only compiler while the family awaits root registration.
It imports no Capiro code and creates no source, SQL, server or native runtime.

Root must integrate the family through the one canonical loader/registry and
review exact schema pins, unavailable descriptors and original preservation.
The generic gateway currently does not supply the required binding/subject
options to this new family; a future trusted context composition and source
adapter must be independently reviewed before execution. Current conversation
ownership, scope-receipt integrity, current grants/client walls, live source
projection fidelity, cursor ownership, timeout/release checks and native
qualification are **UNRUN**. No supplied synthetic context proves those checks.
Production connectivity remains disabled; G1 remains OPEN.

## Independent paging repair

Independent review of source `deec763c57ba57cc4d7e7915d55b0f8719e13021`
reported 21/22 passing groups and one genuine projection defect: one returned
event with a non-null continuation was accepted for requested limit 2. Frozen
producer blob `60cc3c51644ae5b8c93fb93a684c544713a97349` returns a non-null cursor
only when more than `limit` visible events exist, after slicing exactly `limit`
rows. The validator now requires a full requested page for non-null continuation.
A focused regression preserves valid full-page continuation and valid short
final pages. Earlier 24-pass author captures remain unchanged; the independent
failure remains in the reviewer's `first-independent.*` evidence. This is
projection fidelity, not a cursor authenticity or source authorization claim.
Repair check: **25/25 PASS**, exit 0, no timeout; group **138263 absent** with
no kill required. `portfolio-continuation-repair.json` captures the exact
parent SHA plus tested source diff hash. `continuation-repair-source.json`
records the resulting source file identities.

Source preservation receipt: `source-freeze.json`. All 5054 of 5055 original
tracked files retain their base blob except the one root-authored canonical
admission export dependency. Original loader/catalog/public/lock bytes remain
unchanged in this author branch. No failed focused check occurred; no prior
failed check was suppressed. Source/document whitespace checks passed.
