# REL-02 federal-market input contracts — bounded remote source handoff

Base `0007b2f` on branch `task/remote-rel02-federal-inputs-20261011` (allocation commit `2486d6d`). One Hermes session. Codex owns independent review, integration and acceptance; nothing here is accepted. Frozen source reference `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1`, read only through Git objects.

## 0. Implementation outline (recorded before coding)

- **Responsibility split.** The JSON Schema owns structure, types, bounds, closure and required fields. The validation module owns boundary behaviour: inert-data enforcement, per-tool rules (contract-vehicle `fiscalYear` refusal, district geography requirement), casing/whitespace normalization, default materialization and the explicit non-authoritative client-scope result. Neither module authenticates, authorizes, loads a handler or reaches a source.
- **Canonical owner.** The existing private retrieval-0.2 contract family (`packages/contracts/retrieval-0.2/`, family version `0.2.0`, `$id` prefix `urn:meri:retrieval:`). One new cohesive schema plus one small validation module; no second catalog/registry, no alias and no availability/handler mapping.
- **Reuse.** The pinned Ajv 8.20.0 (`ajv/dist/2020.js`) and ajv-formats 3.0.1 already in `packages/contracts/package.json` and the root lockfile. No new dependency, no lockfile or `package.json` change. The data-search `assertInertData` idea is re-expressed locally rather than importing the shared `validate.mjs` (no shared edit was permitted).
- **Input specification.** `docs/coordination/reports/CODEX-G1-REL02-FOUR-GAP-METADATA-REMOTE.md` §6–§7, re-verified against the frozen Git objects below.
- **Verification.** Focused test, all existing contract tests, the package distribution check and the repository `check` script; `git diff --check`; exact changed paths inspected before commit.

## 1. Frozen identity re-verification (read-only)

`git -C C:/dev/capirov2 cat-file -t fd8765ec01d292013758606204f2c9d886cd31c1` → `commit` (exit 0). The dirty `capirov2` working tree was never read or written; facts came from `git show <commit>:<path>`.

- `apps/api/src/federal-spending/federal-market-meri-tools.service.ts` blob `7c5b09c86ca519996d63cecb8c95d7b54bad5c6b` (exit 0), raw SHA256 `a370a3289b69911263905db7cc0ddbc4afda40d9fb73a54e5991ba424908a4b5` — both equal the frozen packet values.
- Re-read directly at that commit: `commonProperties` (L23–35), the five `schemas` entries (L37–83), and the `execute` dispatch (L207–272) including `search_contract_vehicles` rejecting a present `fiscalYear` (L209–211), the forecast strip of `clientId` for global public data (L249–259) and the district `state`+`district` requirement (L260–269). `MAX_TOOL_PAGE = 10_000`.

The other three frozen files were not needed for these shapes; their metadata packet seals remain the authority for the domain/query enums and client-context sections.

## 2. Owned files and exact bytes

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `packages/contracts/retrieval-0.2/federal-market.schema.json` | 8722 | `1fef8dfea754b77ad50af02d998e6532130e36385a4ebe90736d12b0d9052497` |
| `packages/contracts/retrieval-0.2/federal-market-validation.mjs` | 6540 | `15bd71ed4c50e64a69a6124ce6690577890e5eedd8716116d0e0c32189eff890` |
| `packages/contracts/test/retrieval-federal-market.test.mjs` | 13867 | `acfe4aab1c759aaebd017bf07cee58c77d5e155344b3b03b3322ee6502172eef` |

No catalog, common schema, shared `validate.mjs`, package export, lockfile, handler, source adapter or other tracked path was changed. `.task-inputs/remote-rel02-federal-inputs-1/` scratch was not needed (all checks ran inline).

## 3. The five input shapes

One `$id` `urn:meri:retrieval:federal-market:0.2.0` (candidate; the family contract stays `0.1.0`), with a `$defs` entry per distinct operation and shared field definitions.

| Operation ID | Definition | Shared fields | Specific | `required` |
| --- | --- | --- | --- | --- |
| `search_federal_contract_awards` | `SearchFederalContractAwardsInput` | clientId, query, agency, state, district, fiscalYear, page, limit | recipient, dateFrom, dateTo | none |
| `search_federal_subawards` | `SearchFederalSubawardsInput` | same | recipient, dateFrom, dateTo | none |
| `search_contract_vehicles` | `SearchContractVehiclesInput` | clientId, query, agency, state, district, page, limit (no fiscalYear) | — | none |
| `search_procurement_forecasts` | `SearchProcurementForecastsInput` | clientId, query, agency, state, district, fiscalYear, page, limit | — | none |
| `get_district_federal_market` | `GetDistrictFederalMarketInput` | clientId, state, district, agency (no fiscalYear, no page/limit) | — | `["state","district"]` |

`FederalMarketOperationId` re-lists the same five IDs and the test asserts each maps to exactly one distinct definition that exists in `$defs`.

Bounds: `page` integer 1–10000 (`default` 1), `limit` integer 1–25 (`default` 10), `fiscalYear` integer 1900–2200 (applied to all three shapes that allow it, including subawards and forecasts, which the frozen advertised schema left unbounded). `state` pattern `^[A-Z]{2}$`; `district` pattern `^(?:[0-9]{1,2}|00|AL)$`; both validated on the normalized (trimmed, uppercased) form.

## 4. Explicit boundary decisions (the report's required disclosures)

1. **Unknown fields — closed, fail-closed.** Every input shape sets `additionalProperties: false`, unlike the frozen advertised outer objects which omitted it. An extra argument is refused, not ignored.
2. **String-to-number coercion — refused.** `page`, `limit` and `fiscalYear` are `integer` only; the module raises `… requires an integer; string coercion is refused` for a numeric string before schema validation, so a `"3"` cannot become `3`. The legacy `limitOf`/`pageOf`/`queryOf` `Number(raw)` coercions are deliberately not recreated at this external boundary. A non-string `state`/`district` (e.g. the legacy-accepted numeric district) is likewise refused.
3. **`fiscalYear` for contract vehicles — excluded and explicitly rejected.** The shape omits `fiscalYear` (so the closed object already refuses it) and the module also raises the legacy-shaped `fiscalYear is not supported for contract vehicles`.
4. **District geography — requires state and district.** Enforced by `required` in the schema and by an explicit boundary message before schema validation.
5. **Dates — no inferred format.** `dateFrom`/`dateTo` stay `type: "string"` (min/max length only) with an explicit description that no date format is asserted, because the frozen source types them only as string. No `format: date`/`date-time` was added.
6. **Client scope is a server responsibility.** `clientId` is inert data. The boundary returns `clientScope: { clientId, authoritative: false }`; structural validation, even of a foreign client identifier, decides no scope. No `authorizationDecisionId`, grant or subject is accepted or produced.
7. **Forecast global query is explicit.** `normalizeFederalMarketInput` returns `queryScope: 'global'` for `search_procurement_forecasts` (and `'client'` for the other four), documenting that `clientId` must not be used to manufacture a client match. Tests assert this.
8. **Length caps are new boundary choices** (clientId ≤128, query ≤4000, agency/recipient ≤256, date bound ≤64), disclosed here because the frozen advertised strings were unbounded. Empty strings are refused (`minLength: 1`) rather than silently dropped as in the legacy helpers.

## 5. Tests actually run (exact commands and exits)

- `node --test packages/contracts/test/retrieval-federal-market.test.mjs` → **exit 0; 12 tests, 12 pass, 0 fail.**
- `node --test packages/contracts/test/*.test.mjs` → **exit 0; 111 tests, 111 pass, 0 fail.**
- `npm run check:contracts:distribution` (`check:generated` + `typecheck` + `test:public`) → **exit 0**; generated-byte check reports the unchanged six distribution records, 7 public tests pass.
- `npm run check` (`node --test packages/contracts/test/*.test.mjs evals/qualification/hermes-session.test.mjs`) → **exit 0; 116 tests, 116 pass, 0 fail.**

The 12 new cases cover: five distinct operation IDs each pinned to one definition; one positive shape per family; absent paging defaulted to 10/1 with the caller object unmutated and normalization idempotent; page 1–10000 and limit 1–25 bounds; fiscalYear 1900–2200 where allowed; contract-vehicle `fiscalYear` exclusion and explicit refusal; district `state`+`district` requirement; state/district casing normalization and malformed/non-string refusal; closed unknown fields and refused string-to-number coercion; non-authoritative `clientId`; explicit forecast global query scope; and a pure-import check.

The pure-import case is two-part evidence: (a) a static assertion that the module's import specifiers are exactly `node:fs`, `ajv/dist/2020.js`, `ajv-formats` and that no network/process/write capability name appears in its source; (b) a fresh child process that imports the module, exercises all five normalizations, and reports `network:false`, directory listings unchanged and an exactly five-name export surface with no stray stdout. Exit 0.

## 6. Setup limit

`node --version` → **v26.7.0**, while the repository `engines` field pins `>=24 <25`. No Node 24 runtime is installed on this host (checked `/c/Program Files/nodejs`, `/c/ProgramData/Hermes/tools`, the Codex runtime cache). Checks therefore ran on Node 26.7.0 and all exited 0; Node-24-specific execution is **NOT RUN**. This is an environment limitation, not a product result.

## 7. Limits

- No output/result DTO is modelled: the frozen files establish only input schemas, dispatch and the `pageResult` paging envelope, so none was invented and no availability/handler mapping was added.
- No parity, runtime qualification, source access, freshness, coverage or G1 acceptance is claimed. This is a candidate input contract for Codex review.
- No cloud, Docker, native/source/provider execution, customer data, network install, push, merge or delegation was performed. The `capirov2` working tree was not read or written.
- The advertised-versus-enforced distinction stands: this contract is a boundary choice, not proof of the legacy service's runtime behaviour. The five shells have no handler in `packages/contracts/retrieval-0.2/catalog.json`, which was not modified, so nothing here makes the tools available.

## 8. Handoff

Codex: independently review the three owned files, confirm the exact changed paths and commit SHA, and decide ACCEPT or HOLD. If integration would require a shared `validate.mjs`/`catalog.json`/package-export change, that portion is **not** attempted here and is proposed only: registering `federal-market.schema.json` in the family `validate.mjs` schema array and pinning the five candidate definitions in `catalog.json` remain an integration-owner change for Codex to serialize.
