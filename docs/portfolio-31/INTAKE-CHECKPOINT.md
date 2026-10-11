# Client intake checkpoint — 2026-10-11

## Ownership and source

Dedicated frontend worktree `C:\dev\meri-portfolio-intake-20261011`, branch `codex/portfolio-intake-20261011`, pinned base `fee93f34888ba5f420cd79807067612e8c82bb5d`. Shared operations policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, clean and fresh-fetched; machine-map timestamp `2026-09-30T00:21:48.2698715Z`. Root frontend instructions and implementation standards applied. Backend source inspected read-only in `C:\dev\cap-portfolio-prospect-stages-20261011`.

Implementation commits: `c44cb8d936c8c55aeafdd6b02cd532fcf0a84992`, `0af3e0a22658e18b509248098696a13a452e30e3`, `6326ddce76fa12889a10f62b627c84370fb51bcf`, plus the final follow-up containing this checkpoint. Parent's header integration `fdd57738966fc9045a5272760a9233d1aa2b0fa4` was cherry-picked for composed verification (local equivalent `89248620240a37b524513ec17cdcfb09aff91105`). No push, merge, deployment, migration, live write, external message or provider action was performed.

## Feature structure

- `client-intake/form.ts`: canonical intake form shape, per-step validation, dirty-field payload mapping. `catalog.ts` owns verified persisted vocabularies.
- `profile-api.ts`: fresh client read, typed create/update/archive adapters and identity/status-bound receipts.
- `logo.ts`: MIME/2 MiB validation, signed multipart POST and confirmation. Storage requests omit credentials, refuse redirects, and have a 30-second timeout. Confirmation retry reuses the staged object without retransmitting bytes.
- `mutations.ts`: existing TanStack Query mutations and canonical client/list/account-owner/calendar invalidation.
- `CompanyStep`, `RegistrationStep`, `SectorStep` compose existing fields/tokens and Radix selectors. `ClientIntakeDialog` owns transient wizard/partial-save state. `ArchiveClientDialog` owns explicit soft-archive confirmation.
- Public API: `ClientIntakeDialog({open,onOpenChange,client?,onSaved,onCloseAutoFocus?})`, `ArchiveClientDialog({open,onOpenChange,client,onArchived,onCloseAutoFocus?})`, and readonly `certifications`.
- Existing Portfolio `CreateProfileDialog` composes the same editor; parent wires edit/archive in the shared client header. No second client editor, app architecture, environment mapping or HTTP client was introduced.

## Contract and audit coverage

| Audit ID | Verified contract | Current implementation evidence |
| --- | --- | --- |
| CORE-012 | POST `/api/clients`, standard_user and above; authoritative billing slot check | Three-step client creation with real contract fields and backend rejection handling. Local browser create and 402 failure checked. |
| CORE-014 | GET then PUT `/api/clients/:id`; PUT requires user_admin and above | Company, contacts, business flags, government identifiers, SAM/LDA/EIN, canonical codes, organization identities/certifications, sectors, priorities, tracks, issue codes, engagement start and internal notes. Clear semantics and fresh dirty-field merge checked. |
| CORE-015 | DELETE `/api/clients/:id`, standard_user and above; soft archive through status=`archived` | Header action, explicit confirmation, role gating, error retention, matching identity/status receipt and navigation checked. |
| CORE-016 | POST `/api/clients/:id/logo/upload-url` -> `{url,fields,s3Key}` | MIME and size validation, HTTPS credential-free destination, signed form key binding, multipart upload checked. |
| CORE-017 | POST `/api/clients/:id/logo/confirm` -> requested client | Client-bound receipt, partial success disclosure, same-object confirmation retry and no duplicate profile creation checked. |

These are implemented frontend candidates, not live-accepted audit completions. Baseline audit files were not modified.

## Design evidence

Loaded `figma-design-to-code`; inspected high-fidelity context/screenshots for `411:44629`, `411:47482`, and actual editor frames `517:121532`, `517:121876`, `517:122239`. The audit's government-info reference is read-only, so actual current three-step editor context supplies field design. Company/sector desktop and dark phone screenshots were visually reviewed: dialog sizing, stepped navigation, two-column fields, compact selectors, tokens and persistent actions. All new branding is dynamic; the modal reference uses text close/chevrons and no new static imagery. Broader Figma acceptance and exact organization-picker expanded appearance remain root review items.

## Checks and evidence

- PASS: 16 meaningful intake unit tests (dirty sibling and per-business-flag preservation, explicit clears, canonical identifiers, date/priority/legacy validation, wrong-client and false-archive receipts, logo limits/key/transport/confirmation retry).
- PASS: 6 Playwright browser cases on isolated port 5193 using existing actual Portfolio/ClientFrame fixture composition. Covers three steps, validation, 402 failure, partial logo save/retry, fresh edit and focus return, 403 edit rejection, standard-user edit gating, false archive receipt and confirmed archive navigation.
- PASS: TypeScript; focused ESLint; Prettier; architecture guard (175 modules after parent header integration).
- NOT RUN here: Next production build/final-build browser gate (root owns this gate; separate build cache avoided during shared disk-pressure coordination), authenticated live browser/mutations/storage acceptance. All intercepted records and requests are synthetic.
- Initial browser validation failure identified an actual error-text/accessible-label defect; labels and descriptions were separated. Initial header test expected a hidden item while actual menu correctly provided a disabled item; assertion now verifies native disabled state. The latter failure report/trace is preserved under app `work/intake/header-initial-failure/` and `browser-header-initial-results.json`.
- Browser reports and screenshots: app `work/intake/browser-results.json`, `test-results/client-intake-*.png`; task outputs `evidence/client-intake-20261011/`.

## Remaining dependencies and limits

1. CORE-012 full Add profile path selector, LDA import, Meri intake orchestration and billing/checkout/request workflows are not part of this bounded pass. The verified backend's 402 response is displayed accurately; no billing numbers or successful checkout are fabricated.
2. CORE-014: fresh GET + dirty-key overlay preserves changes present at the read, including known and unknown business flags. The existing whole-object PUT has no CAS/version precondition: writes racing between read and PUT can still conflict. A targeted merge/optimistic concurrency backend contract requires owner coordination. No claim of race-free persistence.
3. CORE-016/017: actual signed-storage CORS, content validation and end-to-end authenticated mutation acceptance require designated matching test services/account. Local tests do not establish live provider acceptance.
4. Prospect Business Development IDs must not call the Client intake endpoint. The prospect-only form remains distinct; broader editable prospect registration requires its owning contract decision.
5. Scope is client records only. Existing backend permissions/tenant controls remain authoritative. No local storage persistence or fallback tenant/data was added.
