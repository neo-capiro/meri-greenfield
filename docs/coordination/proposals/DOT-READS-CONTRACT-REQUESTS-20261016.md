# READS-A / READS-B exact owner requests

Base: `eca78d458acb46cbfd54a94cf870841d999ef6b1`. Proposals only; no frozen-contract, migration, activation or endpoint change is made.

## R-READ-1: three retained reads need producer contracts and trusted dispatch

**Successor status:** parent supplied and authorized the exact current Core producers, resolving the endpoint mapping request below. Seven SHA-verified handoff artifacts pin `neo-capiro/capiro-backend` at `016e79b585c14f20d13669e13c987c01e3dd29dd` / tree `aae45db5f9464559739fd8eb0ad6374852b1351b`, with the same mapped producer files at `cd3c51e940f14e1b2a1040b0ffa445e85d68b332`. Passive source implementation uses only `GET /api/research-portfolios/:id`, `GET /api/research-portfolios/:id/changes` (raw event-ID cursor, explicit default limit25, ceiling100) and `POST /api/clio/tools/get_florida_budget_project`. No endpoint was invented. The historical request text remains below for provenance.

Remaining production allocation is the narrow trusted port binding, **not another generic endpoint wait**:

- `retainedContextPorts.readCurrent` receives full current binding/subject, canonical operation, raw-request digest, policy revision, exact authorized source IDs, raw request, observation label, deadline and AbortSignal. It must establish the current conversation-to-Core principal/portfolio grant or Florida membership/feature/folder/client-wall resolution. Its bounded JSON receipt repeats the proof tuple plus canonical `context`, fresh `checkedAtMs` and `expiresAtMs`. Dispatch rechecks it before reservation/effect, release and final return. Missing port is `UNAVAILABLE` before reserve. This is a local owner proposal, not a newly accepted public wire contract.
- The injected `getCredentials` port receives that proof plus canonical normalized-argument digest, canonical normalization context and exact HTTPS recipient origin. It returns the identical correlation tuple, current user bearer and expiry; Florida additionally requires the existing Core service-secret credential. No ambient secret is read and no new credential is created. Absent broker is explicitly `UNAVAILABLE`. Parent must bind the genuine issuer/audience/subject/tenant/conversation mapping and recipient approval; these cannot be inferred from Core's Clerk/shared-secret guards.
- Canonical validators keep their unchanged context keys. Florida's private lineage envelope sits outside the unchanged domain output; `asOf` is an observation label, with no historical snapshot or cutoff promise. Existing independent project/document/recent-amount/exact-amount/event windows remain intact. Additional producer database columns are withheld by the declared projection, without truncating row arrays or inventing completeness.

No migration, frozen profile, lockfile or Core-source edit is requested. Native installation/discovery and real current-context, broker, Core HTTPS and PostgreSQL qualification remain separate gates.

The following private retrieval contracts already exist. Their presence does not establish an accepted Core HTTP endpoint or current authority producer. This repository contains no corresponding source adapter; the canonical dispatch context supplies none of their required trusted keys. Do not guess a route, send model scope as authority, or reclassify these reads as excluded.

| Operation | Existing canonical input / result | Missing trusted context |
| --- | --- | --- |
| `get_research_portfolio@0.2.0` | `ResearchPortfolioDetailInput` / `ResearchPortfolioDetailResult` in `research-portfolio.schema.json` | `{binding,subject}`; the current entity subject is exactly one `research-portfolio`, no roster. Portfolio ID comes from that subject, conversation ID from the binding. |
| `get_research_portfolio_changes@0.2.0` | `ResearchPortfolioChangesInput` / `ResearchPortfolioChangesResult` in the same schema | Same owner; optional conversation selector must equal current binding, cursor is bounded and opaque, limit defaults to 25 and is at most 100. Current actor state must belong to the same event/recipient. |
| `get_florida_budget_project@0.2.0` | `FloridaBudgetRequest` → `FloridaBudgetInput` / `FloridaBudgetOutput` in `florida-budget.schema.json` | `{asOf,effectiveScope,clientResolution}` from a current authority owner. `effectiveScope` includes jurisdiction/session/folder/client; every provided client/folder selector must match its current authorized resolution. |

Exact Core-owner deliverable requested: an immutable repository commit/tree and typed controller/DTO/schema pins for the read route(s), including HTTP method/path, query/body encoding, credential/broker audience, current membership/client-wall/folder/portfolio checks, response projection, cursor ordering and authenticity, cancellation/size/deadline behavior, and closed denials. Existing research evidence routes are not proof that detail/changes return these contracts. Historical DTO pins (research projection `capirov2 fd8765ec`; Florida projection author report) are not a current endpoint installation receipt.

Then allocate the canonical gateway dispatch profile(s) for those trusted keys, preserving `createCurrentToolAuthority` as the only authorizer and canonical normalizers as the only input conversion. A typed Core domain port is also acceptable if explicitly owned and installed; no domain port is fabricated here. Add family modules and availability metadata only after those owners are pinned and tested. The runtime remains unavailable without native installation receipts even after source implementation.

Required negative acceptance: foreign tenant/actor/conversation, portfolio grant or client-wall revocation, folder/client mismatch, stale trusted context, forged scope arguments, cursor reuse/substitution, incorrect recipient, invalid result lineage, output/deadline/cancellation/budget bounds, and duplicate-delivery no-redispatch. Synthetic transports are source evidence. Real Core, SDK, broker and PostgreSQL qualification remain separate.

## R-READ-2: scoped durable history and citation linkage (P9)

Proposed owner text: “A visible read receipt is a projection of an existing durable gateway invocation/completion, identified by immutable run binding and delivery ID. It carries operation reference, submitted raw-argument digest, separately named canonical normalized-argument digest, canonical result digest, decision ID, policy revision and measured execution-catalog digest. It carries no raw tool payload, credential, untrusted display label or user-supplied authority. Reading the receipt, paged history or linked citations requires current conversation membership and subject/client/source authorization; historical visibility never grants writer authority or redispatch.”

The current worker's `argumentsSha256` is the submitted-argument hash; canonical normalized identity lives in the gateway journal. Preserve both instead of silently treating them as equal. Some accepted source wrappers contain `{binding,subject,data}` rather than an added operation/hash envelope. Their authoritative operation/normalized hash comes from the durable invocation, not a guessed wrapper field.

The contract owner must allocate the frozen event/history shape and citation link, including exact source/version/hash/locator identity, current-authority gating after reload/reconnect, deduplication, withholding on revocation, and suppression/retention behavior. History should project the existing durable journal where feasible. If a separate receipt/citation index is required, its owner must propose DDL and retention data class for central migration allocation; this lane requests no migration number and creates no second journal.

Until accepted, `runtime.receipts()` remains explicitly process-local. No unsupported event type is emitted and no raw source content is added to conversation history.

## Existing common prerequisites (P1/P2/P3/P8)

The general-read installation/discovery shapes and ordinary-run allocation remain local proposals from the prior mail lane. A synthetic SkillManifest-shaped allocation in tests never grants a no-skill production allocation. Source access defaults off. Native qualification must issue measured installation receipts for each operation, and startup must supply current discovery/policy/allocation/broker owners. A family appearing in the registry does not satisfy any of those gates.

Scope note: expanding the constructible family universe also expands the default family allowlist when `assertCapabilityPolicy` is called. Any explicit narrower platform maximum must supply compatible defaults and role ceilings; widening remains refused. This branch changes no platform/tenant configuration or production startup.
