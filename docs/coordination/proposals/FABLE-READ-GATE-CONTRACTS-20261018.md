# Read gate contracts P1, P2, P3, P5: source contracts and disabled producers

| Field | Value |
|---|---|
| Status | **Source only, composed disabled.** Nothing is rendered, pinned, installed or activated. |
| Owner | Reads lane (rt-reads), per R0 after dot's 6246093575 ("continue the operation tariff/allocation wiring") |
| Review | dot (contracts); R0 (startup composition and render keys) |
| Basis | `FABLE-GENERAL-READ-TOOLS-20261015.md` §2.3, §2.7 and table §7 (P1, P2, P3, P5); `DECISIONS.md` D016 and D016-A |
| B1 (decided) | D016 3, refined by D016-A 3: the **default** integration run profile is 20 turns / 20 tool calls / 900 s / $2 (`GENERAL_READ_DEFAULT_RUN_BUDGETS`). It is a default, not a ceiling: per-tenant and per-run values come from the existing budget owners. The base allocation's `maxToolCalls` is the run's own `maxToolCalls`. Admission is "one worst-case hold fits" (D016 3); spend is enforced per call by the reservation and the typed budget-exhausted stop. |
| Follow-up (dot 6247557126, 6247571077, 6247587388) | Closed in source: admission semantics, a configurable read-bytes profile, the effective output hold, evidence-bound tariff assumptions carried in the allocation, and evidence-priced `read_client_documents`. Section "P3 follow-up" below. |
| G2 (decided) | D016 2: the run capability policy's `readFamilies` are the lane 2 families (`PROPOSED_PREVIEW_CAPABILITY_PLATFORM`), so P1's family filter admits all 76 registered reads before the allocation and approved-reads intersection. |

## Summary

| Gate | What exists now | Where | Default |
|---|---|---|---|
| P1 discovery grant | Producer over the run's allocation ∩ approved reads ∩ the run capability policy (`createRunCapabilityPolicy.forRun`) | `apps/gateway/general-reads/discovery-producer.mjs` | disabled |
| P2 installation receipt | In-image measurement plus a control-side issuer that restates the pinned measurement per run; the installation owner re-measures source bytes on every read | `apps/gateway/general-reads/installation-issuer.mjs` | disabled |
| P3 base allocation | Closed `GeneralReadManifest`, the allocation parser branch, the aggregate-bytes reserve bound, a tariff schedule for the 76 reads, and skill narrowing | `apps/gateway/budget/general-read-{manifest,allocation,tariffs}.mjs`, `tool-budget-binding.mjs`, `postgres-tool-budget.mjs` | not rendered |
| P5 trusted dispatch contexts | Key → trusted-source map for every read context key, pinned against the canonical bindings and the SDK registry | `apps/gateway/dispatch/context-key-sources.mjs` | data only |

Startup composition (`apps/runtime/native-authority/reads-composer.mjs`):
- `createControlReadsComposer(...)` now composes the P2 issuer and the per-task P1 producer itself.
- They stay **disabled** unless `installation.enabled` / `discovery.enabled` is `true`. `reads.missing` reports `installation.enabled` and `discovery.enabled` until then, so every task keeps the unavailable runtime.
- An explicit `gateway.readCurrentInstallation` / `gateway.discoveryOwner` port still takes precedence.
- `gateway.authority` and `gateway.limits` remain required inputs (the Core tool.read decision ports).

## P5: trusted dispatch contexts

- **Coverage:**
  - The 15 Oct finding (35 contracts whose context keys `operation-context.mjs` did not supply) has since been closed in source by the read chain's native, retained, bill-text and projection context paths.
  - `context-key-sources.mjs` names the trusted producer of every key per path.
  - `test/context-key-sources.test.mjs` pins that all **34** registered reads with context keys take a non-generic path with a named producer for each key, with and without native ports composed.
- **Keys with no trusted producer** exist only on reads that are **not registered**, and the test pins exactly this list:
  - `search_research_sources`, `search_sam_opportunities`, `get_state_rule_status`, `get_certification_status` (the four absent reads; their keys need the Core observation arms already listed in the lane 2 notes);
  - `read_chat_attachments` (no read family).
- **Key sources (native path)**, each from an existing owner:
  - `asOf` / `defaultAsOf`: the control clock at the scope's first observation, pinned and sent as the trusted read observation.
  - `defaultCongress`: the render key.
  - `actorRole`: the Core membership receipt.
  - `evidenceAccuracyMode`: the Core read-mode observation.
  - `clientResolution`, `clientReference`, `citationResolution`, `effectiveScope`, `windowAsOf`: the request selector, resolved through the Core check-ref observation and checked against native visible clients and the subject.
  - `defaultYear`: explicit only (D015 #6).
  - `owner`: the native principal.
  - `tenantId`, `binding`, `subject`: the current gateway authority.

  Retained and profile paths are listed in the module.

## P2: general-read installation receipt

**Receipt** (unchanged consumer contract: `installation.mjs` `RECEIPT_KEYS`; `executionCatalogSha256` from `installed-catalog.mjs`):

```json
{"binding":{...RunBinding},"scopes":[...],"policyRevision":"<64 hex>","baseCatalogSha256":"<64 hex>","installationId":"<uuid>","executionCatalogSha256":"<64 hex>",
 "operations":[{"operation":{"id":"…","version":"0.2.0"},"descriptorSha256":"<64 hex>","handlerSourceSha256":"<64 hex>","qualificationReceiptId":"<uuid>"}],
 "checkedAtMs":0,"expiresAtMs":0}
```

**Measurement** (`meri.general-read-installation-measurement.v1`) is computed **in the measured image** by `measureGeneralReadInstallation({catalogJson, operations})`:
- `operations` is `installationReadOperations()` for the composed families.
- The output is `{schema, baseCatalogSha256, operations:[{operation, family, descriptorSha256, handlerSourceSha256}]}`.
- `handlerSourceSha256` is the family's source-file manifest digest, exactly the bytes the installation owner re-measures on every read (`measureGeneralReadFamilySources`, `integration.mjs`).

**Who attests.** The same in-image measurement step that already pins `sdkOptionsSha256` and the launch descriptor (`launch-measurement-receipt.json`).
- The render records `measurementSha256` in the reviewed control configuration next to the image digest; the measurement file goes in the material.
- No new signing key is introduced. The trust is the reviewed, pinned render, as for every other measured runtime input.

**Issuer** (`createGeneralReadInstallationIssuer`, control-side, disabled by default):
- **Construction:** it refuses unless the measurement hashes to the pin, its base catalog equals the runtime catalog, and every descriptor hash equals the runtime contract's. Any drift since measurement means no installation at all.
- **Per read:** it restates the measurement for the run's binding, scopes and policy revision. `installationId` and `qualificationReceiptId` are deterministic from the pin and are identifiers, not credentials. `expiresAtMs` is at most 60 s.
- **Revocation on drift:** the installation owner re-measures handler source bytes on every read, so drift refuses and the read becomes `UNAVAILABLE`. `revokedOperations` and `enabled:false` withdraw installation without a new image.

**Render keys for R0:**
- `reads.installation.enabled` (default false);
- `reads.installation.measurementSha256`;
- the measurement JSON file path in the material inventory;
- optional `reads.installation.revokedOperations`.

## P1: discovery grant

**Grant** (unchanged consumer: the runtime snapshot `discovery` and `mount.mjs`): `{binding, policyRevision, operations:[OperationRef], checkedAtMs, expiresAtMs}`.

**Producer** (`createGeneralReadDiscoveryProducer`, one per run task, disabled by default). Its operations are:
- the run's **own** allocation `allowedOperations`;
- ∩ the control's `approvedReads.operations`;
- ∩ the families of the run capability policy, when `generalReads === true`. `createRunCapabilityPolicy.forRun` already folds the platform maximum, tenant settings and role ceiling. All 76 reads need only `tool.read`, so no other role table is consulted.

Other properties:
- The grant must be for the exact binding and policy revision; otherwise `ACCESS_DENIED` before any policy read.
- `expiresAtMs ≤ min(now + 60 s, allocation schedule expiry)`. An empty list is a valid grant.
- Per-call authority (`createCurrentToolAuthority`) stays authoritative.

**Render keys for R0:** `reads.discovery.enabled` (default false). The control's `capabilityPolicy` producer (`createConfiguredRunCapabilityPolicy`) is passed in by `cli.mjs`.

## P3: base general-read allocation

**Manifest** (`GeneralReadManifest`, closed; proposal-local until dot adopts it, because `SkillManifest.skillId` is an enum of the 14 skills):

```json
{"contractVersion":"0.2.0","profile":"meri.general_reads","profileVersion":"1.0.0","allowedOperations":[OperationRef ×1..128],
 "budgets":{"maxTurns":…,"maxToolCalls":"the run's maxToolCalls (default 20)","maxRecoveryAttempts":0,"maxRuntimeSeconds":…,"maxCostMicroUSD":…,"maxOutputBytes":"profile, default 1 MiB, ≤16 MiB"},
 "maxAggregateOutputBytes":"profile, default 2 MiB, maxOutputBytes…256 MiB",
 "tariffAssumptions":[evidence …]  (only when an allocated tariff needs it),
 "documentPricing":{vision, transcription}  (only when read_client_documents is allocated)}
```

Every operation must be read-only (`sideEffect:none`, `approvalBoundary:none`).

**Parser:** `allocation()` (`tool-budget-binding.mjs`) takes this manifest when `profile` is present, and a SkillManifest otherwise. The skill path is byte-for-byte unchanged; all budget suites match base.

**Spend:** Meri is the sole owner.
- `postgres-tool-budget.mjs` reserve already enforces `maxToolCalls`, the per-result `maxOutputBytes`, the run `maxCostMicroUSD` and the shared ledger cap.
- New for general-read manifests: settled output bytes plus all unsettled holds plus this call's hold must be ≤ `maxAggregateOutputBytes`, or `BUDGET_EXHAUSTED`. The hold is computed once as `min(allocation maxOutputBytes, capability maxOutputBytes)` and used for both that check and the stored `max_output_bytes`, so a narrowed allocation never falsely exhausts (dot 6247587388).
- Model spend keeps its own reservation against the same ledger. No tool or model call can exceed the cap.

**Composition:** `composeGeneralReadAllocation({run, operations, runBudgets, catalogSha256, scheduleRevision, expiresAt})`.
- `maxToolCalls` is the run's own `maxToolCalls` (default 20, D016 3; configurable per D016-A 3).
- Read bytes come from a validated, configurable profile (`readBytes`, default 1 MiB per result and 2 MiB per run; at most 16 MiB per result, the gateway's response cap, and 256 MiB per run). Zero recovery; runtime, turns and cost come from the run's configured caps.
- Admission (D016 3): one worst-case hold fits, `max(tariff) ≤ maxCostMicroUSD`. `allocation()` applies the same rule on every parse. There is no product-of-maximums check: each call is reserved, or refused with the typed `BUDGET_EXHAUSTED` stop.
- The output is parsed by `allocation()` before it is returned.

**Narrowing:** `assertSkillNarrowsBase(skill, base)` refuses any skill operation outside the base or any budget above it. `narrowedSkillBudgets` gives the field-wise minimum.

**Tariffs** (`general-read-tariffs.mjs`, generated for the 76 registered reads). Evidence: every read path in Core #84 @ `7dd72a0e`, traced through `meri-tools.service.ts` (registry lines 2598–2842), `federal-market-meri-tools.service.ts` and the adapters they call.

| Class | Reads | Charge per call | Evidence |
|---|---|---|---|
| Database only | 64 | **1 µUSD**, the budget floor (as `get_client_context` today) | Prisma or SQL only, no outbound paid call |
| Database via internal intel-api | `get_florida_budget_project`, `search_legislative_research` | 1 µUSD | Capiro intel-api SQL; other intel-api work on those requests was not traced |
| Free external, quota-limited | `get_state_bill_status`, `search_state_floor_votes` | 1 µUSD | LegiScan live fallback only when the bill isn't stored, under monthly caps (`meri-state-bill-live.ts`) |
| Free external | `scrape_web_page` | 1 µUSD | Direct fetch, no vendor; 5 MB HTML / 15 MB PDF caps |
| Tenant SaaS | `read_monday_client_boards` | 1 µUSD | The tenant's own monday.com OAuth connection, so Capiro isn't billed per call |
| Embedding every call | `search_client_knowledge`, `search_memory` | **165 µUSD** | Bedrock Titan Text Embeddings V2: $0.02 per 1M input tokens, at most 8,192 input tokens (AWS, "Get started with Amazon Titan Text Embeddings V2"), so ≤ 163.84 µUSD, plus the floor |
| Conditional embedding | `search_capiro_data` | 165 µUSD (worst case) | Titan only for `institutional_knowledge` with `semantic_recall` |
| Rerank-conditional | `search_memory`, `search_capiro_data`, `search_committee_hearings` | as above, **only with `rerankDisabled`** | The NVIDIA hosted rerank is called only if `RETRIEVAL_RERANK_ENABLED` (default false); its price isn't in source |
| Paid if configured | `search_public_web` | 1 µUSD, **only with `webSearchProviderDuckDuckGo`** | The default provider is a free DuckDuckGo fetch. Tavily or Serper, if configured, are paid and unpriced here |
| **Priced from evidence** | `read_client_documents` | 1 + max(vision, transcription) | Core #84 @ `aabe0f17`: one document, one section, at most one paid call. See "Document reads" below |

**Assumptions (bound to evidence):**
- An assumption-gated read is allocated only with evidence of the measured Core setting:
  - shape: `{id, configKey, configValue, coreSourceCommit, coreImageDigest, configurationSha256}`;
  - `rerankDisabled` must be `RETRIEVAL_RERANK_ENABLED=false`, and `webSearchProviderDuckDuckGo` must be `CLIO_WEB_SEARCH_PROVIDER=duckduckgo`.
- The evidence an allocated tariff needs is carried in the manifest as `tariffAssumptions`, so it stays in the emitted allocation and its sha256. The parser refuses a dropped or invented entry.
- Without evidence, the base allocation has **71** reads; with it, **75**. The four gated entries stay gated in the proposal until the render supplies that evidence.

**Cost cap:**
- Per call: the budget owner reserves each call's tariff against the run's `maxCostMicroUSD`, the capability cap and the shared ledger, and refuses with `BUDGET_EXHAUSTED` when it can't.
- Admission only requires that one worst-case hold fits.

**Document reads** (`read_client_documents`, Core #84 @ `aabe0f17`, traced in full). One call reads one document section and makes at most **one** paid call.
- **Text:** listing and plain text, docx, xlsx, pptx, and PDFs with a text layer parse locally, with no paid call. Images are rejected.
- **Vision** (`AttachmentPdfVisionReader`): only when the selected PDF page has no text layer.
  - Bounds: one page of at most 5 MiB (file at most 20 MiB), at most 8,192 output tokens (8,000 requested; raised for `gpt-6-astra`), zero retries, 30 s.
  - Model: `OPENAI_MODEL`, default `gpt-6-astra`.
- **Transcription:** audio/video goes to `whisper-1` with no duration, cost or cache bound in Core (only the 25 MiB upload limit).
- **Charge:** `1 + max(vision, transcription)`, computed by `documentReadCharge` from `documentPricing` evidence. The evidence is the vision model's prices and a one-page input-token bound, plus whisper's per-minute price and **Core's transcription duration cap** (`maxAudioSeconds`), each bound to the measured Core.
- **Carried:** the evidence travels in the manifest. The parser refuses a schedule charge that differs from the evidence price.
- **Required Core work, not a deferral:** Core must cap whisper-1 duration. Until that cap and the prices are in the render, the operation stays out of the allocation, because Meri can't bound an uncapped transcription.

**`allocation.json` entries (proposal for R0's re-pin):** `docs/coordination/proposals/general-reads/allocation-read-tariffs.proposal.json`, generated by `generalReadTariffProposal()` and pinned to the tariff module by a test.
- `operations`: 71 entries in `allocation.json`'s closed `{operation, chargeMicrousd}` shape, priced unconditionally. They are exactly the schedule `composeGeneralReadAllocation` produces without assumptions.
- `assumptionGated`: 4 entries that join the schedule only when the render asserts the Core configuration.
- `excluded`: `read_client_documents`, until its `documentPricing` evidence exists (`documentPricingRequired` lists the fields and the Core cap).
- `defaultRunBudgets` and `defaultReadBytes`: the D016 profile and the default read-bytes profile.
- `assumptionEvidenceRequired`: the evidence each assumption needs.
- The committed pins are not edited here.

**Worker early ledger** (`apps/worker/conversation/reads/budget.mjs`): never spending authority, it only refuses earlier.
- **Bounds:** it follows the run's `maxToolCalls`, `maxOutputBytes` and `maxAggregateOutputBytes` through an optional `runBudgets` input to `createGeneralReadRuntime`.
- **Defaults:** 20 calls, 1 MiB and 2 MiB.
- **Pass-through:** the run-budget pass-through PR (service → activity → mounts) supplies them.

**Open item (Core):** `read_client_documents` needs a whisper-1 duration cap in Core. The vision branch is already bounded.
- **Render evidence:** the render supplies `documentPricing`: vision model prices and an input-token bound, whisper's price, and that cap.
- **Until then:** a skill that declares the operation cannot narrow from the base (`assertSkillNarrowsBase`). Narrowing isn't wired into the selected-skill path yet (composed disabled), so no skill changes behaviour today.

## Tests

Node 24.19, serial, one file per process, no POSIX shim:
- `apps/gateway/dispatch/test/context-key-sources.test.mjs`: 4/4 (P5).
- `apps/gateway/general-reads/test/read-gate-producers.test.mjs`: 9/9 (P2, P1):
  - the measurement is deterministic;
  - the enabled receipt is accepted by the **real** installation owner, which re-measures source bytes;
  - disabled refuses;
  - pin, catalog, descriptor and TTL drift refuse construction;
  - handler-source drift refuses on read;
  - revocation works;
  - the grant is the intersection, in the runtime snapshot shape;
  - empty grants are valid;
  - binding and policy-revision mismatches refuse before any policy read.
- `apps/gateway/budget/test/general-read-allocation.test.mjs`: 13/13 after the follow-up (P3). The follow-up adds:
  - one-hold admission, in compose and the parser;
  - the configurable read-bytes profile;
  - evidence-bound assumptions carried in the allocation;
  - evidence-priced document reads;
  - the narrowed-allocation effective hold. A mutation back to the raw capability bound fails that test.

  Earlier cases (some superseded by the follow-up):
  - the tariff table covers exactly the 76 reads with evidence;
  - the proposal file equals the tariff module, and its entries are exactly the composed schedule;
  - `maxToolCalls` follows the run cap: default 20, and 1 or 100 when configured;
  - the parser itself refuses a widened tool-call count or a repriced entry that breaks the cost cap (a mutation removing the check fails this test);
  - the assumption gating;
  - the cost-cap refusal at 20 × 165 = 3,300 µUSD, and at 12,122 calls under $2;
  - closed-manifest refusals;
  - skill narrowing;
  - aggregate read bytes enforced by the **real** budget owner through the durable dispatch. A mutation removing the check makes that read pass, so the test fails.
- `apps/worker/conversation/reads/test/availability.test.mjs`: 8/8, including the run-cap ledger bound.
- `apps/runtime/native-authority/test/read-composer.test.mjs`: 38/38. It includes a composed tracked-bills read through the real P2 issuer and P1 producer with no fixture ports, the disabled defaults (`installation.enabled`, `discovery.enabled` in `missing`, zero I/O), and a policy without the family exposing nothing.
- Budget suites (product model budget, settlement, runtime, native admission, durable tool budget, budget admission, tool budget, outcome) match base `af430a94` exactly: the skill path is unchanged.
- Full lane 2 regression: see the PR description.
