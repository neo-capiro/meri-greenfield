# Outreach detail feasibility - 2026-10-17

## Scope and proposed bounded interface

This lane owns only `apps/gateway/sources/outreach-query/` and this report in the existing `meri-remaining-next` sparse worktree. It read the canonical outreach contract and the pinned native source. AGENTS and the previously read implementation standards apply. Disk capacity was checked (about 2.7 GB free). No dependency installation, native/provider/SQL request, credential, migration, deployment, commit or shared-file edit was performed.

The candidate is detail-only `query_outreach` through fixed `POST /api/clio/tools/query_outreach`, preserving the raw request and canonical full output. The exact frozen detail context is `{clientResolution:null}`. A proposed shared pure preflight would validate the canonical raw request, apply the canonical single trim/clip-80 outreach-ID normalization, require a resulting explicit UUID and refuse missing/malformed IDs and client/name/list selectors before CONTROL native credentials or tool HTTP. CONTROL would retain task/current tenant/current user grants and the native actor-owned record lookup would remain the source owner. No list/count fallback, output redaction or alternative campaign endpoint is proposed.

The request's `outreachId` selects an **OutreachRecord**, not an `EngagementCampaign`. The separate list branch reads campaign rows. Treating those UUIDs or policies as interchangeable would be an incorrect source binding.

## Verified positive branch evidence

All native references are pinned to `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`; the [scoped producer packet](https://github.com/neo-capiro/capiro-backend/blob/384325afaaf7ad34aeb9ff9b2f183d667ee17343/docs/retained-read-producer-mapping-20261016/scoped-producers.json) maps the existing tool route and owners.

- [Meri detail dispatch](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/meri/meri-tools.service.ts#L8848) normalizes `outreachId`; a truthy ID awaits `getOutreachRecord` and returns the exact-record branch. The list branch is after that return. There is no catch or no-match fallback to lists. The wrapper summarizes only the body and adds its native timestamp.
- [Current root lookup](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/engagement/engagement.service.ts#L2690) uses `outreachRecord.findFirst` with exact ID, current tenant, `ownOutreachRecordWhere(currentUser)` and `deletedAt:null`. A missing row throws 404. It requests nested includes as part of that actor-owned lookup.
- [Canonical owned-record predicate](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/engagement/engagement-access.helpers.ts#L96) requires `createdByUserId` equal the current user and excludes reserved internal outreach types. The tenant predicate remains separately mandatory. This is real current root ownership, not a model assertion or an inferred creator name.
- The frozen `outreach-query-validation.mjs` already separates exact and list requests, suppresses client resolution in the exact branch, validates the complete nested record and correlates its selected ID. No descriptor/schema change is needed merely to represent the exact result.

## Concrete unresolved nested-read boundary

The exact detail producer is not a root-row-only projection. [Its include owner](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/engagement/engagement.service.ts#L10962) expands:

- The linked client's name, website, primary contact and intake data.
- The linked meeting's subject, organizers, metadata, linked client and attendees.
- The latest meeting prep with its full selected scalar content.
- The latest debrief's metadata and author, while excluding its encrypted body.

Those includes contain no additional current client-wall, current meeting-owner or prep-access predicate. A current actor-owned outreach root is established, but the inspected source does not independently establish current access to every linked client and prep. [Parent validation](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/engagement/engagement.service.ts#L9084) checks same-tenant client existence and meeting ownership when an outreach record is written. That historical validation is not a fresh read-time observation after a client wall/grant or meeting relationship changes.

A request with no `clientId` still reaches these includes when the selected stored record has client/meeting links. Restricting model request fields therefore cannot prove that the read has no linked private subjects. Inspecting returned IDs and dropping unauthorized fields would occur after the nested reads and would alter the frozen whole-record result. Neither approach is proposed.

The concrete owner action is to establish and enforce current authority for the linked resources **before** their compound reads, or provide a supported native detail observation/read mode which binds the selected record and its current relationships/revision to those decisions. Existing native membership/client-ID owners can be reused for the current client checks, but the inspected compound detail method does not consume such a proof. This report does not invent a replacement owner or a new metadata protocol.

The separate [campaign list owner](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/api/src/engagement/engagement.service.ts#L10530) still queries same-tenant campaign rows with optional client/status and includes recipients; it has no current actor/wall filter in that range. It is not made safe by the exact-record ownership predicate. Named client resolution also remains outside this bounded slice.

## Status

Root ownership and no-fallback feasibility are verified; whole-compound-read authorization is held for the coordinator's source-policy review. No adapter, registration, SDK exposure or executable source claim has been published by this lane. This is a concrete native authority seam, not a missing live credential or a claim that no native producer exists. No runtime tests are claimed for this read-only feasibility report. The owned Markdown whitespace/newline check passed. No action was denied and no external mutation has an uncertain outcome; implementation remains pending the native compound-read authority decision/seam described above.
