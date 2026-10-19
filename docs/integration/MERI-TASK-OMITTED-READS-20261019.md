# Task and omitted read completion

Base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`. This independent source branch does not advance the frozen image candidate or authorize activation.

## Implementation outline

The existing original-tracking adapter owns task normalization, fixed Core routes, native result validation and pagination/evidence projection. The operational task port owns task-bound credential acquisition; extend its existing original-action Option B exchange to original task queries and remove the query-task attended Bearer transport. Trusted gateway dispatch supplies the invocation ID. Native task authorization and Core retain actor/tenant/selected-client authority and grant revocation; a model-supplied ID never grants access.

Root owns startup composition, discovery registries, contracts and lockfiles. This lane will request the small receiving changes rather than edit those files. Existing native source adapters for LegiWatch news, legislative research, legal reference, outreach and business development are reused. Core producers and Option B support are inspected before suggesting their exposure. Unsupported selector branches and absent producers stay truthfully unavailable.

Verification uses focused synthetic Core transport/task fixtures, with exact original body issuance, pagination, expired/revoked grants, unavailable source and incorrect client scope. These establish source behavior only; no real provider, Core service, database, image build, deployment or live chat qualification is performed.

## Task slice receipt

`query_tasks@0.2.0` now shares the existing original-action exact-body Option B exchange. Dispatch requires and forwards its trusted invocation ID. The original-tracking adapter preserves the original flat POST body, trusted actor-derived `assignedToMe`, frozen overdue timestamp, opaque pagination and native proof projection. The port refuses missing/expired/revoked tool issuance and ordinary Bearer responses; no opaque per-call handle reaches Core as an authorization token. The production port remains selected-client only; the native adapter's existing broader authorized-task behavior does not silently grant that broader task scope through this startup composition.

Existing Core producer: `POST /api/clio/tools/query_tasks`, confirmed at Core `138c04373b18bb730b1ad0f8f9338342f628b8c6`, through `MeriToolsService.queryTasks` and `EngagementService.readMeriTasksExact`. That owner retains active membership, current client wall, task-specific Portfolio grants and aligned count/page filtering. Core's existing read-delegation allowlist includes the operation. No Core change is required for this selected-client request contract.

Files in this slice:

- `apps/runtime/native-authority/retained-reads/operational-task-ports.mjs`
- `apps/runtime/native-authority/retained-reads/test/operational-task-ports.test.mjs`
- `apps/gateway/dispatch/tool-dispatch.mjs`
- `apps/gateway/sources/original-tracking/request-context.mjs`
- `apps/gateway/test/original-tracking-mounted.test.mjs`
- `apps/gateway/general-reads/test/family-cases.mjs`
- This handoff.

Focused command: `node --test apps/runtime/native-authority/retained-reads/test/operational-task-ports.test.mjs apps/gateway/test/original-tracking-mounted.test.mjs` — **61 passed, zero failed/skipped** on Node `24.19.0`. An earlier expanded run was 60/61 because a new test incorrectly expected the outer abort lifetime to replace the source credential's narrower independently reported deadline; the corrected assertion preserves both existing boundaries and the final 61 cases pass. The initial 57-case predecessor also passed. No product change was made to accommodate that test.

Receiving owner must remove `selected-task-ports.mjs`'s explicit `query_tasks` rejection, include it in the reviewed operation refs/startup composition, and regenerate source measurement through the canonical receiving process. The dispatch and port changes are source-tested, not installed, qualified or live-verified. No deployment input or historical image receipt was changed.

The receiving audit also reproduced six pre-existing `families.test.mjs` failures on exact base `98d3c96a`: success and release-revocation for `actions.query`, `query_tasks`, and `query_action_items`. Their synthetic credentials still used the older unsigned response. The task slice corrects both original-task fixtures; a follow-up uses the existing signed fixture for `actions.query`, including its exact target and correlation. `node --test --test-name-pattern='synthetic (actions.query|query_tasks|query_action_items):' apps/gateway/general-reads/families.test.mjs` then passes **15/15**, retaining all original assertions. The unrelated Monday fixture correction is owned by the mail/Monday lane and must be preserved during receipt.

## Omitted-family reconciliation and evidence slice

The existing `research-legal-news`, `research-legal-legislation`, `outreach-query` and `business-development` source adapters already use the native per-call authority owner. The receiving root owns their missing discovery/registry exposure. Reuse their finite existing routes and supported selectors; do not rewrite their source integrations.

| Operation | Actual current Core route | Receiving status and boundary |
| --- | --- | --- |
| `search_legiwatch_news` | `POST /api/clio/tools/search_legiwatch_news` | Reuse stored exact-source / explicit-year personnel slice with an explicit delegated client. Inferred clock/default-year branches stay unavailable. |
| `search_legislative_research` | `POST /api/clio/tools/search_legislative_research` | Existing selected-client stored-source search. Preserve incomplete inventory coverage. |
| `get_legal_reference` | `POST /api/clio/tools/get_legal_reference` | Existing parser-independent legal-reference slice, selected client. Citation-parser-dependent branches remain unavailable. |
| `query_outreach` | `POST /api/clio/tools/query_outreach` | Existing explicit-client campaign list only. Native detail branches with linked meeting/client records stay unavailable. |
| `get_business_development_context` | `POST /api/clio/tools/get_business_development_context` | Existing trusted current native prospect-conversation context, exact delegation conversation UUID. |
| `get_business_development_recent_changes` | `POST /api/clio/tools/get_business_development_recent_changes` | Existing context scope plus watch-feature owner; preserve inference wording, independent unread count and partial first-page truth. |
| `get_business_development_evidence` | `POST /api/clio/tools/get_business_development_evidence` | New Meri adapter reuses actual `MeriBizDevToolsService.getEvidence` and existing `BusinessDevelopmentEvidenceOutput@0.2.0` contract. **Core Option B allowlist currently omits this operation**. No live acceptance is claimed. |

The new evidence handler preserves exact dossier rows/facts, citation aliases, source dates, identity basis, section states, the 24-record cap and partial/omitted-fact flags. It adds no provider fetch, JEV evaluation, mutation, model-selected prospect or new permission. It is restricted to a selected-client subject and `CapiroMeriRead`; ordinary native Bearer and personal-scope paths refuse before source HTTP.

Authority remains in the native credential owner and Core's existing `read-delegation.service.ts::current`. For BD that Core current owner loads the actor-owned active native conversation, re-resolves its prospect scope, explicitly refuses `prospect.linkedClientId !== grant.clientId`, checks current client visibility/security scope, and includes prospect identity/scope in the opaque conversation revision. Meri's existing `readConversation` checks exact conversation/client and rechecks that revision around secret acquisition, dispatch and release. Evidence does not infer a client grant from its payload (which carries no linked-client field). The older standalone `BizDevMeriScopeService` tenant-only gate is insufficient by itself; this is why new evidence refuses ordinary Bearer use.

The existing native Core conversation must actually exist under the same UUID and owner as the greenfield delegated conversation and must carry valid prospect metadata. This source introduces no guessed mapping. Dot must supply/qualify that real relationship and admit the evidence operation through the existing read-only Option B allowlist, preserving all current selector/prospect/client/dossier scope checks. Core's incomplete history-release route and first-chat work remain outside this lane.

Files in the evidence slice:

- `apps/gateway/sources/business-development/handler.mjs`
- `apps/gateway/sources/business-development/request-context.mjs`
- `apps/gateway/sources/business-development/test/fixture.mjs`
- `apps/gateway/sources/business-development/test/handler.test.mjs`
- `apps/gateway/sources/business-development/test/evidence.test.mjs`
- `apps/runtime/native-authority/native-read-credentials/test/omitted-read-completion.test.mjs`
- This handoff.

The evidence slice depends on the receiving root's shared native subset and runtime operation registry inclusion; by ownership it does not edit those files. Syntax and whitespace checks pass. Behavioral tests must run after the root receives both the source and its registry change. The new omitted-family test uses the real native authority, run delegation, exact one-use token, durable dispatch and source transport owners over synthetic Core/SQL bytes; its evidence case deliberately refuses token issuance to model the actual missing Core admission. Neither synthetic source fixtures nor that refusal are proof of installed or live producer compatibility.

## Authored pins and receiving checks

Authored branch: `codex/meri-task-omitted-reads-20261019`. Source commits, in receiving order:

1. `5f56a8b23feb157bf537065279817574d3083157` — selected task Option B exchange, trusted dispatch invocation and original source regressions.
2. `6fd2a6f690d57284e43dbe30968203a7267d9977` — repair the remaining stale signed action-family fixture.
3. `8e4b3fbb0b2898de8354e32ae80cd5b01999325a` — BD evidence source and omitted-family chain tests; requires the root's shared registry inclusion.
4. `be36db054c7d6f39227b22323463740acfacd33a` — retain the native-authority fixture reference separately from the delegation fixture; preserve signed scheme in the expiry mutation.
5. `65dd04abf98138e4d2096eddb87a46e4bea3caf9` — preserve returned credential-getter callback validation through the evidence wrapper and add a zero-proxy-effect regression.

The root received evidence as `d7edcd9f`, the fixture correction as `7aa91e00`, and the wrapper guard as `c07cdf00fba0979d01186e2d14eb903ed940fc31`. Its exact shared registry/startup commit and final coherent integrated suite are the receiving root's responsibility; these authored commits do not include or advance those shared files.

On the receiving worktree with the root's native evidence subset change, `node --test apps/gateway/sources/business-development/test/evidence.test.mjs apps/runtime/native-authority/native-read-credentials/test/omitted-read-completion.test.mjs` passed **26/26** after `be36db05` receipt. The first run was 19/26: six source chains completed but their new assertion incorrectly inspected the delegation's network-call list instead of the original native-authority list, and the expired-credential fixture accidentally removed its signed scheme and hit the intended earlier signed-only refusal. The correction changes fixtures only and preserves both security assertions. Those failed controls are recorded rather than relabeled as product defects.

After `65dd04ab` receipt, `node --test --test-name-pattern='wrapped credential factories' apps/gateway/sources/business-development/test/evidence.test.mjs` passed **1/1** at receiving `c07cdf00` plus the root's pending shared changes. The receiving integrated suite should include all eight evidence cases and all nineteen omitted-chain cases at its final committed pin. All owned changed production modules pass `node --check`, and `git diff --check` passes.

No live Core request, actual source installation, real source/provider read, image/native runtime qualification, deployment or live chat was run. Task queries and the six already existing omitted sources have genuine Core Option B routes but still require the receiving installation/image and authenticated checks. BD evidence remains blocked on dot's exact read-only Option B allowlist admission and real native prospect-conversation relationship qualification.
