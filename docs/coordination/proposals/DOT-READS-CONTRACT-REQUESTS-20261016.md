# READS-A / READS-B exact owner requests

Base: `eca78d458acb46cbfd54a94cf870841d999ef6b1`. Proposals only; no frozen-contract, migration, activation or endpoint change is made.

## R-READ-1: three retained reads need producer contracts and trusted dispatch

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
