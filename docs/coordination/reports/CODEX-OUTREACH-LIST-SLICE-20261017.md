# Outreach campaign list slice - 2026-10-17

The explicit client-UUID **campaign-list** slice is source-bindable. Detail, named-client and unscoped lists remain unavailable through this adapter. The existing detail blocker report is unchanged. This outline was recorded before implementation in the task-owned `meri-remaining-next` checkout (`08f65a79b99e5b269a8c7f7e82b6b8de225caae8`). Only `apps/gateway/sources/outreach-query/**` and this new report are owned by this lane; central registration, SDK exposure and current native grants remain coordinator-owned.

## Pure preflight and factory interface

`request-context.mjs` exports `captureOutreachListClientSelection(request)`, returning frozen `{reference,clientId}` after inert canonical `OutreachQueryRequest` admission. It refuses **any own `outreachId` property**, including null, blank and malformed values, so no request can enter detail or depend on malformed/empty-ID fallback. It requires a string `clientId`, applies the existing single optional-string trim/clip-80 followed by the client resolver's trim, then requires the resulting exact UUID. `reference` preserves case; `clientId` is lower-case. This conservative partial-input restriction does not change the canonical contract.

`handler.mjs` exports `createOutreachQueryHandlers(configuration,operations)`, using the canonical shared stored-native helper and fixed `POST /api/clio/tools/query_outreach`. Its request bridge rechecks the captured context, canonical selected client and exact one-client subject with a matching client resource before native credential acquisition; it sends the original flat request unchanged. CONTROL consumes the same pure preflight before current-native observations and supplies `{clientResolution:{reference,clientId}}`, requiring current membership, an exact one-client subject/resource, current client permission and a matching selected ID again at use. A selector never grants access.

## Independent source proof

All native references pin Core `b525032222515d636b0dae2d46e40c7c3d8b5528`:

- [Meri queryOutreach, lines 8848–8889](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L8848-L8889) enters detail only for a truthy normalized outreach ID. With the preflight's complete exclusion of that property, it resolves the explicit UUID client, then invokes `listCampaigns` with that client and optional status. The count is the fetched selected-client campaign count; the wrapper slices the list by its normalized limit.
- [Engagement listCampaigns, lines 10530–10547](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/engagement/engagement.service.ts#L10530-L10547) queries within the current tenant and applies the explicit client predicate before the read. Its optional status predicate further narrows those same rows. It includes that campaign's client summary, creator identity and recipients. It does not include meetings, preps, debriefs, contact relations or other clients' campaigns.
- [Client summary selection](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/engagement/engagement.service.ts#L10996-L11008) reads the selected campaign client's own summary/contact/intake fields. Those are covered by the current selected-client permission established before HTTP, rather than an after-read redaction.
- [Campaign and recipient models, lines 3779–3824](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/prisma/schema.prisma#L3779-L3824) show recipients are stored campaign-owned scalar snapshots joined by `campaignId`; they do not have a private contact or second client relation. The wrapper publishes their count, not recipient detail. Creator identity is a bounded account identity projection; it does not traverse another private source.

The native client resolver establishes same-tenant non-archived identity but does not itself supply the current wall grant. CONTROL must establish that permission **before** this compound read. No root record ownership predicate from `getOutreachRecord` is borrowed for campaigns: this slice is a current client-authorized campaign list, not an actor-owned detail read.

The existing frozen `outreach-query` contract already admits the raw list grammar and receives the closed scalar campaign projection. It binds every returned campaign's client and optional status and verifies the total/limit window. No nested record is projected, redacted or fabricated. No schema, normalizer, output or descriptor change is needed.

## Verification and limits

Implemented the two modules above plus `test/fixture.mjs` and `test/handler.test.mjs`. The fixture exposes `storedCase(id,options)`, `ids`, explicit client subject/resource, visible client IDs and standard synthetic context/credential ports for the coordinator's integration tests.

Focused checks passed **13/13**, serially with Node 24.19.0, `--preserve-symlinks` and a 256 MiB heap. They cover original selector preservation, the native trim/clip chain, refusal of every detail/unscoped/named-client variant before credentials, malformed/hostile input, exact context and subject/resource matching, native JSON dates, scalar projection, list count windows, cross-client/status/duplicate/nested-row receiving refusals, credential correlation, transport ceilings, cancellation and deadlines. There were no initial focused-test failures. The test process exited successfully and the diff whitespace check passed. CONTROL/MCP integration and independent source review remain separately coordinator-owned; source files are frozen for that review.

Native source blobs are `32a7a744ba9ab812337baaf6093a37540864333b` (Meri tool service), `6eb8259f7eb77f64c6ab41d403480ac1ea3f1e82` (engagement service) and `fe07b16a73b3ca564f0e69b8be6eb8734fba35b7` (Prisma schema). These are source-inspection pins, not live producer qualification.

This source-only slice does not qualify live membership/client grants, source availability, current source truth, total corpus completeness or any send right. No live Core/provider/database call, credential creation, infrastructure change, migration, deployment or commit is authorized or performed by this lane.
