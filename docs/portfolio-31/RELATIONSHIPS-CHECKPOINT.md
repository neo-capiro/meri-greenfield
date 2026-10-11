# Organization Relationships checkpoint

## Implementation outline (before changes)

Base `f0fbc06abc404af61ed6f072561cfb62e3cbb3bb`, branch `codex/portfolio-relationships-20261011`, isolated checkout `C:\dev\meri-portfolio-relationships-261011`.

Shared policy reread/fetched: local `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; origin/main `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; local map date `2026-09-30T00:21:48.2698715Z`. Repository AGENTS, implementation standards and portfolio AGENTS read. Explicit human frontend repository instruction supersedes the older ops application placement. Next 16.4 installed useRouter/useSearchParams guides read.

- Organization contact API module owns scoped reads/writes and validated receipts through the existing HTTP client. Canonical Person/input/hierarchy contracts remain unchanged; no competing contact service or backend implementation.
- Existing queries/mutations own React Query caching. Successful verified writes invalidate the client roster. Pending client writes refuse duplicates across contact/hierarchy controls. No write retries are automatic.
- ContactForm owns field validation/focus and draft input. ContactDrawer owns scroll/fixed actions, nested confirmation, failure and pending presentation, and composes existing ContactMail/QuickLog/HierarchyEditor unchanged.
- OrganizationRelationships retains query-string deep links, organization chart and roster; identity uses the shared hook and current standard_user/user_admin/capiro_admin rule. Server retains authorization. Government dispatch and its modules remain unchanged.
- Figma 411:51458 (contact details/message history/fixed footer) and 411:50673 (organization chart) inspected with high-fidelity context and screenshots. Legacy backend comment node907:2919 is absent in current Figma and is not an implementation reference.
- Verify API scope/identity/receipt refusal, form retention, pending duplicate refusal, create/edit/remove, keyboard/discard behavior, hierarchy and email/note integration through focused unit and isolated loopback browser checks. No live/provider/customer writes, installs, full Next build or new shared configuration.

## Verified source contracts

Current capirov2 ClientPeopleController/Service: GET/POST `/api/clients/:clientId/people`, PATCH/DELETE `.../:id`, PATCH `.../:id/hierarchy`. Minimum role standard_user; server binds tenant and client. Create/update/hierarchy return ClientPerson; delete returns `{deleted:true}`. Separate hierarchy mutation preserves automatic/manual title inference. No optimistic version, create idempotency or source-history endpoint exists; frontend cannot claim those semantics. Notes are saved contact text; QuickLog is a separate existing person-linked activity workflow.

## Validation / integration status

First source pass: 29/29 focused API/permission tests pass; application TypeScript check passes with installed dependency/type resolver and incremental writes disabled. Focused ESLint passes (the isolated checkout has no installed React package; existing plugin emits its detection warning). Changed source/test files are Prettier formatted and diff check is clean. Early setup failures were transient resolver issues (Geist has no root export, Vitest require-entry selection, Next Link and React type resolution); scratch resolvers were corrected without installs or source workarounds. They remain recorded in task evidence.

Contact writes now validate client/person association and saved field or placement receipts; delete requires `deleted:true`. All writes use the canonical core API and have no automatic retry. A client-scoped mutation key refuses simultaneous writes before a second request. The drawer preserves failed inputs, refuses close during pending contact/hierarchy writes, confirms discard/removal, and has the inspected 640px desktop / viewport-width mobile scroll body and fixed footer. Read-only/unknown roles cannot submit; backend remains the authority. An ambiguous create failure disables another create in that draft and asks the user to inspect the refreshed roster, because the current backend has no create idempotency contract.

## Final focused acceptance

All final checks used Node `v24.19.0` at `C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`; the bare shell Node is older and was not used. Dependencies were resolved read-only from `C:\dev\meri-greenfield-portfolio-31\apps\portfolio-web\node_modules`; no installation, copying, full Next build or global PATH change occurred.

| Check                             | Result                            | Scope                                                                                                                                                  |
| --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contact API/permission unit tests | PASS, 29/29, exit 0               | Scoped route/receipt checks, invalid IDs, foreign/duplicate roster, saved values, hierarchy/reset, delete acknowledgement, role rules and HTTP refusal |
| Application TypeScript            | PASS, exit 0                      | All application TS/TSX and tests, canonical tsconfig with transient installed dependency resolver; incremental output disabled                         |
| Scoped ESLint                     | PASS, exit 0                      | Allocated source and focused tests; existing React version detection warning remains visible                                                           |
| Architecture                      | PASS, 213 modules, exit 0         | Canonical architecture script with only its TypeScript import resolved to the installed runtime                                                        |
| Browser                           | PASS, 13/13, exit 0, zero retries | Existing component fixture runner, Chromium on loopback port 5197; synthetic HTTP intercepts only                                                      |
| Formatting/diff                   | PASS, exit 0                      | Allocated source, tests and this checkpoint                                                                                                            |

Browser assertions cover deep links and retained query scope; search empty state; native name validation; create/edit failure and draft retention; foreign save receipt refusal; roster refresh after verified save; pending duplicate refusal and close refusal; dirty discard/cancel and keyboard focus restoration; explicit delete confirmation and `deleted:true` refusal; ambiguous create completion without blind resubmission; read-only, identity-pending and stale-identity error gates; wrong-client roster refusal and shared session-expiry recovery; hierarchy writes separated from contact fields; person-linked QuickLog failures; existing email refusal without false success; and accessible client-filtered mail history with reply action. Email and QuickLog implementations were composed unchanged, and all sends in the browser test were intercepted synthetic requests.

Identity permissions now require successful, settled, error-free identity state in the organization page, drawer and mutation. Stale cached role data cannot enable writes while identity is pending/refetching or after an authorization failure. Inputs remain visible and retain their draft values.

## Visual comparison and evidence

Actual current Figma context/screenshots were compared with the final rendered drawer. The drawer is 640px at 1440px desktop, viewport width at 390px mobile, has a fixed header/subtitle and action footer, and scrolls its content without moving the save action. Labels use 12px and values 13px, desktop email/phone form a two-column grid and mobile stacks them. The final browser check verifies the actual light/dark computed backgrounds, loaded Geist fixture font, bounds and fixed action position; screenshots were visually inspected. Final evidence is under the parent task output directory `outputs/evidence/portfolio-relationships/`.

This is a focused drawer/layout comparison, not a full-screen pixel-parity assertion. Existing shell/chart presentation, ContactMail action placement, separate hierarchy save/reset actions and QuickLog remain unchanged. Those actions preserve independently saved backend semantics. Production dynamic contacts and empty history differ from illustrative Figma fixtures. No visual baseline was regenerated.

Preserved initial evidence includes the unit resolver setup failure, TypeScript resolver setup failure, the initial 9-case browser report, and the first 12-case browser run (11 passed; the hierarchy test used a label locator which did not match the rendered native select). The final case uses the actual accessible combobox role/name without weakening its assertions. Early visual screenshots did not establish dark/font acceptance: final checks use `prefers-color-scheme`, assert the computed color, and assert successful Geist loading. Scratch-only resolver/font routing fixes introduced no production source workarounds. See packaged results for exact artifact names and digests.

## Audit traceability

| Original audit ID      | Evidence in this slice                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENG-org_read           | Validated scoped roster and existing chart composition; foreign/duplicate records refuse rendering                                                      |
| ENG-org_create         | Verified create receipt, validation, pending refusal and failure/unknown-completion retention                                                           |
| ENG-org_edit           | Scoped update, returned association/values checked, rejected receipt retains draft                                                                      |
| ENG-org_hierarchy      | Existing placement/reset contract retained; focused unit receipts and browser pending/save checks                                                       |
| ENG-org_drawer         | Fixed/scroll responsive drawer, edit/remove/discard/keyboard paths, existing Mail/Note composition                                                      |
| ENG-email_history      | Existing client/recipient-filtered history and permitted full-thread/reply action exercised with synthetic responses; provider delivery not established |
| ENG-org_chart_search   | Search empty state and existing query-state composition checked                                                                                         |
| ENG-org_chart_viewport | Existing pan/zoom/Fit implementation preserved; no new viewport acceptance claim                                                                        |
| ENG-org_chart_review   | Existing title/hierarchy review composition preserved; not a new backend/source-history contract                                                        |

These are implementation/validation qualifiers, not changes to the immutable baseline or a declaration that every listed row is complete. Root owns the aggregate matrix/workbook and integration status.

## Remaining integration prerequisites

- **BLOCKED / backend contract:** ClientPeople has no create idempotency key/recovery receipt and no optimistic update version. Unknown create completion is held safely in the draft and requires inspecting the refreshed roster; contact edits do not claim protection from independent concurrent writers. Backend owner must define those guarantees if required.
- **NOT RUN / integrated browser:** This branch's browser checks use the existing component fixture entry, not signed-in Next/Clerk, deployed API authorization, real provider delivery or a hosted preview. Root owns the final Next build, shared regression and authenticated application acceptance.
- **Parent-produced live API evidence:** Root reported passing canonical contact create/edit/hierarchy/list/delete/empty checks in `capiro-internal` with `neo@capiro.ai` on newly created task-owned client `02d1b2fd-a684-4edc-a64a-a4248763cdd7`; that fixture was archived and absent from active results on read-back. Evidence is `outputs/evidence/portfolio-integration-20261011/live-owned-fixture-results.json`. This supports live API integration separately from this subagent's synthetic browser results; no provider sends/charges were made.
- **Shared feature ownership:** Government, actual email/QuickLog modules and their public contracts were not edited. Existing provider errors/refusals remain visible. Root/shared feature owners retain responsibility for provider-connected success receipts and their separate acceptance gates.

No merge, push, deployment, access-boundary change, live write or provider call was performed by this slice. Portfolio and G1 completion are not claimed.
