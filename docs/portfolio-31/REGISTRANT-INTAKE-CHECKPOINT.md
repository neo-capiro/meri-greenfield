# Registrant intake checkpoint

## Outline and source boundary

- Base: `5c66b68a0add1e2498767a35fc04cec53fc9d080`; branch `codex/portfolio-registrant-intake-20261011`; isolated checkout `C:/dev/meri-portfolio-registrant-intake-20261011`.
- Current policy: local clean ops `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, fetched main `b2b0ce8c2bf03817b81e671d968b7892985b8d06`. Read bootstrap, policy, machine map, repository and app instructions.
- Own only the new `features/intake/registrant` feature, focused tests and this report. Existing intake composition is `features/client-intake` and remains root owned.
- Implement CORE-019–023: search → explicitly link firm → review unique client IDs → explicit bounded import → exact partial receipt. CORE-018 has no baseline Figma reference and is not resurrected.
- Design context and screenshots inspected: current Prototype 3.1 search `411:44770`, dialog `411:44870`; review `411:44899`, dialog `411:44999`. Reuse shared Dialog, tokens, HTTP client, identity and React Query. No Figma edits.
- Public interface for root composition: `RegistrantImportDialog({open, onOpenChange, onImported?, onCloseAutoFocus?})`. Completion callback receives only a validated documented receipt. Results stay open.

## Verified contracts

Core only; canonical proxy `/api/backend/core/firm/...`. Backend reference `C:/dev/capirov2` HEAD `f1f672d9f459e744e126448229d62a86be89c71e`; controller/service have no uncommitted changes.

| IDs      | Route                    | Contract                                                                                                        |
| -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------ |
| CORE-019 | GET `lda-registrants?q=` | q 2–200 characters; array `{id,name,city,state,totalClients,totalFilings}`; max20                               |
| CORE-020 | GET `registrant`         | `{ldaRegistrantId:number                                                                                        | null,ldaRegistrantName:string | null}` |
| CORE-021 | PUT `registrant`         | `{registrantId:integer>=1}` → current registrant shape; changes the firm, not one profile                       |
| CORE-022 | GET `import-candidates`  | `{registrantId,registrantName,candidates:[{ldaClientId,name,filings,latestFilingYear,totalSpend,onboardedAs}]}` |
| CORE-023 | POST `import`            | `{ldaClientIds:integer[]}` 1–100 → `{created,items:[{id,name,ldaClientId}],skipped:[{ldaClientId,reason}]}`     |

Reads require `standard_user`; writes `user_admin` (role hierarchy includes `capiro_admin`). Server binds CurrentTenant. Import checks selected IDs belong to the linked registrant, skips already imported IDs and creates confirmed LDA source mappings. Each row has its own transaction/advisory lock. Slot refusal can happen before the batch (402) or per row. Partial success is normal. Successful creation also schedules SAM enrichment, so no live writes are authorized in this slice.

## Deliberate limits and owner dependencies

- Candidate grouping is `(clientId, clientName)`: aliases may share an ID. Selection is unique by canonical ID; all original alias rows/figures remain visible and no financial aggregation is invented. Disclosed totals format the service value, not a price/forecast. LD-2 dollar-source reference: https://www.senate.gov/legislative/Public_Disclosure/FAQs.htm and https://www.senate.gov/legislative/Lobbying/Lobby_Disclosure_Act/5_Reports_by_Registered_Lobbyists.htm .
- Re-read anchor and candidates immediately before import and refuse observed drift. The API has no atomic expected-registrant precondition; concurrent anchor changes after the read remain a backend contract dependency. No ignored speculative fields are sent.
- No operation ID/receipt lookup exists. Unknown POST completion freezes the original IDs; explicit GET readback shows observed onboarded state, not a fabricated transaction receipt or proof that an unobserved import cannot finish. No automatic import retry/batching.
- Per-ID locks do not establish a tenant-wide slot fence for concurrent imports of different IDs; billing owner must review shared capacity behavior. This feature does not alter billing.
- Root owns entry-point composition, shared fixtures/proxy/config and live GET checks. No hosted preview or live import acceptance is claimed.

## Validation

Pending source, focused tests and isolated synthetic browser checks. Explicit Node 24.19.0; borrowed dependencies read-only; no install/full build/deployment.
