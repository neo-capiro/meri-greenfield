# Registrant intake checkpoint

## Outline and source boundary

- Base: `5c66b68a0add1e2498767a35fc04cec53fc9d080`; branch `codex/portfolio-registrant-intake-20261011`; isolated checkout `C:/dev/meri-portfolio-registrant-intake-20261011`.
- Current policy: local clean ops `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, fetched main `b2b0ce8c2bf03817b81e671d968b7892985b8d06`. Read bootstrap, policy, machine map, repository and app instructions.
- Own only the new `features/intake/registrant` feature, focused tests and this report. Existing intake composition is `features/client-intake` and remains root owned.
- Implement CORE-019–023: search → explicitly link firm → review unique client IDs → explicit bounded import → exact partial receipt. CORE-018 has no baseline Figma reference and is not resurrected.
- Design context and screenshots inspected: current Prototype 3.1 search `411:44770`, dialog `411:44870`; review `411:44899`, dialog `411:44999`. Reuse shared Dialog, tokens, HTTP client, identity and React Query. No Figma edits.
- Public interface for root composition: `RegistrantImportDialog({open, onOpenChange, onImported?, onBack?, onCloseAutoFocus?})` from `features/intake/registrant/public`. Completion callback receives only a validated documented receipt. Results stay open. Optional Back returns to the root-owned method chooser; absent callback closes. Opener focus is restored by default, with caller override honored.

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
- Root owns entry-point composition, shared fixtures/proxy/config and live GET checks. Current proxy does not allow `core/firm`; root is adding the exact five reviewed method/path contracts above, preserving origin/session/traversal checks. Isolated intercepted browser tests do not validate that proxy. No hosted preview or live import acceptance is claimed.
- Root can mount the NEW test-only `RegistrantIntakeHarness` at `/__test/registrant-intake` in its shared browser main. The focused spec uses this explicit callback/identity-refetch probe. The helper is not imported by production routes; existing shared fixture files are unchanged here.

## Feature structure

`contracts` owns canonical response types, `domain` owns unique-ID grouping/selection/receipt invariants, and `api` owns Core routing and the boundary between preflight read rejection and uncertain dispatched writes. `queries` retains cache/mutation ownership and checks the current identity query before writes. `useFirmLink` owns link confirmation/readback; `useImportAttempt` owns one attempt and read-only recovery. Search/review/receipt/recovery/firm confirmation render separately. The dialog composes identity, firm scope, selection and these feature interfaces; it performs no direct requests.

The service's reported alias figures remain separate. Compact USD display follows current Figma, with full reported value in the title. Added firm-wide confirmation, scope notice, and explicit partial/uncertain outcomes are deliberate contract-driven visual states. No displayed client data or amounts are hardcoded in production source. Shared Dialog, approved gradient, Geist, tokens and responsive styles are reused. Light desktop and mobile dark were visually reviewed; no baselines were regenerated.

## Validation

### Review follow-up outline

The root reviewer identified that an old attempt could resume after identity/tenant changes during async preflight. Capture the verified user+tenant at mutation start and synchronously assert the same current verified actor immediately before POST. Missing user ID, pending/error identity, changed actor or reduced role must reject before dispatch (`uncertain:false`). Keep the pure adapter's guard optional for focused tests, with the production hook always supplying it. Add source and browser race evidence without changing public UI contracts or unrelated flows. Refreshed policy remains local `b32b4803933760dc0a93fffdcd8fba30a89c3aac` / fetched `b2b0ce8c2bf03817b81e671d968b7892985b8d06`.

`SessionBoundary` replaces the cache on scope changes, so an old cache may retain its old successful identity after unmount. The import hook additionally captures a mount lifetime and revokes it synchronously on layout cleanup; the old attempt cannot pass the dispatch guard even when its old cache has not changed. This uses the documented cleanup-before-removal semantics of [React useLayoutEffect](https://react.dev/reference/react/useLayoutEffect); it performs no layout measurement or state update. The guard protects observed frontend session changes and does not replace server authorization or add the missing atomic expected-registrant backend contract.

### Follow-up qualification

- **21/21** focused unit checks, including the post-read actor gate refusing dispatch as `uncertain:false`.
- **19/19** isolated browser cases, including changed user and changed tenant while candidate GET is held (zero POST), empty user ID (no write controls), and unmounted old hook/stale cache (zero POST after preflight settles).
- Full application TypeScript, scoped ESLint, architecture248, touched-file formatting and diff checks pass under explicit Node24.19.0.
- One launcher failure is retained: absolute Windows `--import C:/...` was rejected by Node before tests started (`ERR_UNSUPPORTED_ESM_URL_SCHEME`, exit1). Rerun used the working task-relative resolver path; source and assertions were unchanged.

### Initial qualification at `0cd36817`

- Node **24.19.0** explicitly: bundled `dependencies/node/bin/node.exe`. Existing installed dependencies borrowed read-only; no install/full build/deployment or backend/provider calls.
- **20/20** focused unit checks: exact Core routes/bodies, search constraints, link/candidate scope receipts, alias grouping, bounded IDs, complete import ID partition/count, partial skips, observed anchor drift, preflight failure classified as not dispatched, dispatched transport/5xx/foreign receipt ambiguity, slot refusal and truthful readback.
- **15/15** isolated component browser checks, zero retries: search/link/review/partial receipt; validation/empty/error/query retention; read-only standard-user role; stale identity error fail-closed; alias/imported selection; anchor drift; pending duplicate/close refusal; lost receipt readback; slot error/input retention; empty feed; lost firm-link receipt; foreign receipt; 100-ID cap/filter retention; desktop focus/font/layout; mobile dark overflow/actions.
- Full application TypeScript, scoped ESLint, architecture **248 modules**, touched-file Prettier and diff checks pass. The dependency-less isolated checkout emits React autodetection's existing warning; the actual browser uses the installed React19.3 runtime and Geist font-load assertion.
- First evidence retained: unit **18/19** and type error caused by `it.each` spreading numeric arrays rather than passing an array argument; corrected to named case objects with unchanged boundary assertions. Browser **10/12** initially: pending request-count assertion ran before read preflight reached POST (now waits for dispatch), and missing default opener focus restoration was fixed in the feature. No test/visual baseline or shared behavior was weakened.
- Owned preview: **http://127.0.0.1:5199/__test/registrant-intake**, standalone Vite fixture with intercepted synthetic HTTP. Four screenshots cover search, partial receipt, desktop review and mobile dark review. Root integration, authenticated live reads/writes and hosted preview remain **NOT RUN** in this slice.
