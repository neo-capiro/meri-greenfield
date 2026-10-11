# CSV import, focus tags and profile JSON

## Source and ownership

- Isolated frontend checkout `C:\dev\meri-portfolio-profile-tools-20261011`, branch `codex/portfolio-profile-tools-20261011`, starting root integration `bc9cff8ac0d76738975a5ef5eca88c421cce35f1`. Prior `576d199` and its evidence remain untouched.
- Shared policy freshly fetched/read at `b32b4803933760dc0a93fffdcd8fba30a89c3aac` (clean, three local commits ahead of fetched `b2b0ce8c2bf03817b81e671d968b7892985b8d06`). Read BOOTSTRAP, AGENTS and local machine map; frontend repository/app instructions and implementation standards apply.
- Fresh frontend remote `77a423f0f5ec1b4c3f8a2a0fbab8a8209abf9fd2`; backend origin/main `fd8765ec01d292013758606204f2c9d886cd31c1`. Inspected backend files in the separate backend checkout; relevant client/intelligence controller/service files have no difference from origin/main.
- Owned new intake CSV, client-profile tags/export modules, focused tests and this checkpoint only. Root owns route/menu/Overview composition, canonical shared contracts/configuration and baseline implementation workbook.
- Public interfaces: `CsvImportDialog({open,onOpenChange,onBack?,onImported?,onCloseAutoFocus?})`, `FocusTags({clientId})`, `ClientProfileExport({clientId,open,onOpenChange,onCloseAutoFocus?})`. Imports through each new folder's `public.ts`. No new dependency, framework, backend or shared contract.

## Current design and audit traceability

| Audit ID | Verified current design / contract | Qualification |
| --- | --- | --- |
| CORE-018 | Historical row has no Figma reference. Fresh context and screenshot for current chooser `411:44629` show Manual entry, Search LDA, Create with Meri, Add prospect; no CSV choice. `ClientsController:352` and `ClientsService:1261` implement typed-row bulk import. | CSV parser/mapping/review/result component exists behind an explicit public interface; **uncomposed** pending product placement. No added chooser item. |
| CORE-024 | Fresh Overview `411:47010`, exact Focus row `411:47039` and `+ Add` `411:47047` inspected using required Figma design-to-code skill. Geist 11px eyebrow, 12px tags, 6px gap, 8px radius and dashed Add retained. PUT client requires user_admin or capiro_admin. | Fresh-read merge preserves unrelated intake fields; exact client/tenant/tags receipt required. Whole-intake replacement remains versionless; this is not an atomic tag operation. |
| CORE-025 | Historical row references Overview `411:47010`; no standalone export state in that frame. Revalidated legacy composition of GET client plus GET intelligence/client-profile. Root owns existing profile-actions placement. | JSON review/download preserves source values and attribution. Explicit reviewed partial download only for non-authentication intelligence failure. No PDF/export-pack endpoint invented. |

Original read-only audit JSON and row evidence remain unchanged. Current fixture text, names, metrics and prices have not been used as production data. Current Figma Overview screenshot is retained in the task's isolated work evidence.

## Contract and failure semantics

### CSV

- POST `core/clients/bulk-import` accepts 1–500 `CreateClientDto` rows, role standard_user and above, tenant bound by authenticated context. CSV is parsed locally with strict quotes/column widths, BOM and embedded-newline support, physical source lines and a 1 MiB local bound. Unsupported columns require explicit Skip; name mapping and every mapped row must validate before dispatch.
- This UI exposes only verified persisted common profile fields. Although CreateClientDto permits government identifiers, the bulk service does not persist several of those top-level keys; no misleading government-ID mappings are offered.
- Controller nested validation may reject the whole payload before the service. Service sequentially saves valid rows, reports zero-based `errors[].row`, returns `{created,total,errors,items:[{id,name}]}`. Receipt must account for every requested row and preserve successful input order/names, with unique returned IDs and failed row indices.
- Duplicate/name/slot decisions remain server-owned. No atomicity, locked slot budget, per-row tenant receipt or idempotent recovery is claimed. Post-loop queries can fail after inserts; unknown/network/5xx/malformed receipt freezes automatic resend. Users inspect Portfolio before a separate new attempt. Successful partial results retain original errors and created-client links; no implicit failed-row retry.
- Import starts existing asynchronous entity resolution and government-ID enrichment, as disclosed before submission. No live import performed.

### Focus tags

- GET fresh `core/clients/:id`, then PUT only `{intakeData:{...latestIntake,tags:[...existingTags,newTag]}}`; preserves unrelated exact intake values. Existing `portfolio`, `tags` and `sectors` supply visible focus chips. Malformed existing tags and duplicate visible tags refuse dispatch.
- Before each boundary, require current successful idle noninvalidated error-free identity, nonempty initiating user/tenant, administrator role and current editor lifetime. Wrong client/tenant/archived receipt or wrong tags is failure. Unknown post-dispatch result freezes resend across close/reopen while this controlled component remains mounted.
- **Residual contract:** concurrent writes between GET and PUT can overwrite sibling intake changes. Minimal followup is a tenant/client-scoped targeted tags append endpoint with server-side merge, duplicate validation and a version/CAS receipt if stronger concurrency guarantees are required. No backend changes made here.

### Export

- GET client must match initiating tenant/client and not be archived. GET `core/intelligence/client-profile/:id` must match exact client ID; JSON shape and source wrapper are validated. Saved extensible JSON and source financial values are retained without frontend calculations or confidence inference.
- Authentication/authorization failures and wrong-profile intelligence produce no export, including no partial export. Non-authentication intelligence failure yields an explicitly incomplete reviewed snapshot with missing-source/error status. File download only after explicit review and a final current-actor/lifetime check. Blob URL is always revoked.
- Current legacy intelligence GET uses tenant context and does not accept caller userId; it can include fuzzy/unconfirmed source attribution. Export preserves those source semantics and does not claim confirmed evidence, complete private memory, or an ethical-wall-aware export pack. Canonical service owner must resolve any required finer access policy; the frontend cannot strengthen server visibility by labeling it.

## Qualification checkpoint

- Explicit bundled Node `24.19.0`; readonly node_modules junction, no install or shared dependency/cache modification.
- Initial focused unit run: 20 PASS. Initial typecheck failed on test mock typing and JSON pipe typing; these failures were corrected in owned source/tests, with no assertion weakened.
- Final owned source: 20/20 focused unit tests, typecheck, scoped lint, scoped Prettier and architecture (334 modules) PASS, explicit bundled Node 24.19.0. No assertions weakened.
- Isolated intercepted browser: 14/14 PASS on port 5194 using the canonical ClientFrame and NEW test-only ProfileToolsHarness. Test-only entry/server/config are ignored under app `work/`; Vite cache is owned there and does not modify the borrowed dependencies. Product Overview/profile-actions composition and live authenticated acceptance remain separate root gates. CSV is uncomposed in product routes.
- Browser coverage includes successful fresh tag merge/cache refresh; role refusal; invalidated identity and closed held preflight with zero PUT; uncertain PUT and CSV import frozen across close/reopen; complete reviewed JSON download with exact synthetic source values; explicit partial source failure; 401 session-expiry recovery and 403 refusal; wrong-profile source refusal; strict malformed CSV refusal; exact partial receipt/source line/client link; mobile dark export/CSV containment. Loaded Geist test font and exact 6px Focus gap are asserted.
- First browser run 13 PASS / 1 FAIL is retained (JSON, PNG, error context, trace). The failed assertion expected a local dialog alert after 401; actual canonical provider correctly replaced the app with `Your session expired`. The corrected test asserts that heading, `/sign-in` recovery link, and absence of download. Subsequent 14 PASS run and final 14 PASS after copy/font/mobile qualification are recorded separately.
- Inspected final desktop Focus chips, export review, partial CSV receipt, and mobile dark export/CSV screenshots. Current Figma provides the Focus row and method chooser, with no standalone CSV/export dialog: these dialogs reuse the canonical shared primitive rather than claiming an unsupported exact overlay match.
- No full build, live reads/writes, import, source provider call or customer data download was performed by this subtask. Every download and screenshot is synthetic. No product CSV placement or backend privacy/concurrency gap is marked complete.
