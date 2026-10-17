# State, tracked-bill and hearing completion accounting

Preparation outline: retain PR119 tree `b1f79a9832393053c2db64cc9437bad8d59fc8e4` as the exact before-source checkpoint. Root owns curated adapter metadata and source/integration/SDK freeze. This lane owns only `scripts/scope-ledger/source-exposure.test.mjs`, the two generated current-exposure ledger files and this report. Prepare focused guards now; do not refresh generated output or run the final suite until root explicitly freezes source/SDK.

The intended delta is exactly four partial reads becoming complete: `get_state_bill_status`, `search_state_floor_votes`, `search_tracked_bills`, `search_committee_hearings`. Expected accounting is **68 complete + 4 partial + 10 absent = 82**, leaving **14 incomplete reads in 10 families**, split **9 skill-declared / 5 undeclared**. Expected SDK registration is **70 operations / 40 families**, with **43 passive constructors**, 43 exclusions and **live 0**. The mail constructor is existing canonical composition and does not add selected reads.

Preserve the prior semantic-KB projection at its historical 64/8/10 and 66/37 expectations. The funding projection is based on the current snapshot and must follow the new current counts. Add a separate PR119 four-operation projection proving all other rows and every unaffected row field remain identical. Guard complete family registration, optional state/hearing versus required tracked-client policy, measured canonical source helpers, native check-ref/per-call original-proof composition and explicit canonical mail construction. Preserve historical eight ledger fields and serialization, Markdown outside current exposure, old handoffs, funding reports/metadata and all four published KB reports/metadata. Use only targeted refresh/check-exposure and the focused source-exposure suite after GO; retain initial failures before repair.

## Accepted freeze and current accounting

Root subsequently confirmed final source, native private-proof owner, SDK policy and canonical composition freeze and explicitly authorized the targeted refresh. This lane changed no curated adapter metadata, source/SDK policy, reconciliation algorithm or renderer. Root's metadata promotes exactly the four operations above; its legal wording correction changes no legal coverage state.

| Measure | Published PR119 | Current generated source |
| --- | --- | --- |
| Selected source reads | 82 | 82 |
| Complete / partial / absent | 64 / 8 / 10 | **68 / 4 / 10** |
| Incomplete reads / families | 18 / 13 | **14 / 10** |
| Incomplete skill-declared / undeclared | 11 / 7 | **9 / 5** |
| SDK operations / families | 66 / 37 | **70 / 40** |
| Passive canonical constructors | 42 | **43** |
| Exclusions | 43 | 43 |
| Qualified/live claimed | 0 | **0** |

SDK accounting remains distinct: 68 selected source operations, one read-only product-state operation and one historical operation sum to 70 OperationRefs. Three newly exposed families are state status/votes (optional client scope), tracked bills (required client scope) and committee hearings (optional client scope). All four source operations are complete and registered with no artificial operation subset. The mail family already contributed its three SDK operations; its new explicit constructor composes the existing canonical handler/HTTP adapter and does not add selected reads or new endpoints.

Four partial operations remain across three families: legal legislation/reference (two), legal news (one), and outreach query (one). Ten absent operations remain across seven other families: business-development evidence (one), certification status (one), program elements (three), federal grants/awards (two), research legal candidates (one), rule status (one), and SAM opportunities (one). Research portfolio, portfolio changes and Florida budget project reads remain complete and SDK-exposed as source only. All 43 exclusions, 63 historical native producer mappings, current original-skill boundaries and old product/historical accounting remain intact.

Funding metadata is deep-equal to published PR118 tree `a1c0ca277a0eda6ac2a29622c21cc38829990e0b`, including its Core `51c157444ac43035eeb489ff46aee5a4e89ba3ac` / tree `54af881dddef397db0ff215d6eb2a72d74c0d1bd` dependency and qualification boundary. Semantic KB metadata is deep-equal to PR119 tree `b1f79a9832393053c2db64cc9437bad8d59fc8e4`, including Core `59efe08f2f3429918758eef30539e9dde4dbb868` / tree `c2babd8e0d386b1c9f18ed32ebcd4472d5ebf486` and its actual native build/origin/configuration qualification caveat. No qualification issuer or compatibility inference was invented.

## Focused verification and preserved evidence

After the freeze, one targeted `--refresh-exposure` succeeded. The first focused `scripts/scope-ledger/source-exposure.test.mjs` run passed **32/33**. Its sole failure was the prior source-declaration guard requiring quoted operation IDs: the complete state source uses exact unquoted fixed-route keys, and the old partial subset's quoted IDs were correctly removed. The guard now accepts either a quoted operation ID or the exact unquoted `<id>:'/api/clio/tools/<id>'` declaration. It still binds the operation and canonical route; a generic mention does not pass. No source/metadata changed to repair this test. No check was removed, skipped or relaxed into unconditional acceptance.

The repaired focused suite passed **33/33**, followed by `--check-exposure` exit 0 (`Scope ledger is up to date`). Node 24 used the existing overlay with `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=20000`. No broad inventory/parser suite was run or weakened. Raw console and executable/argv/time/exit metadata are retained under `docs/coordination/reports/read-completion-next-20261017/`:

- `ledger-refresh-initial.{txt,json}` — successful targeted refresh.
- `ledger-tests-initial.{txt,json}` — retained 32/33 first outcome.
- `ledger-tests-final.{txt,json}` — 33/33 final outcome.
- `ledger-check-final.{txt,json}` — successful scoped drift check.

The 29 existing checks remain, with current expectations updated where appropriate. Four new checks prove: an explicit immutable PR119 four-read projection, every other row and unaffected promoted-row field deep-equal, and all count deltas exact; complete registration/client policies and native selector-helper ownership; all 43 canonical constructor IDs, passive mail composition and actual measured helper bytes without credential/HTTP effects; and named tracked/hearing execution requiring per-call ownership while retaining the exact original request/proof and forwarding only its admitted UUID. The native reference reader's fixed `/api/clio/clients/check-ref` and `{ref}` wire grammar remain source-owned. Synthetic execution establishes neither native installation nor current authorization qualification.

Historical preservation checks retain all eight JSON fields and serialization (`capabilities`, `ownerDirection`, `coverageOrigin`, `provenance`, `counts`, `gates`, `excludedReferences`, `ownershipGraph`), Markdown outside current exposure, historical coverage CSV/inventory and both old PR110 handoff snapshots. All four published funding reports and all four published KB reports are byte-identical to their accepted trees. The historical semantic-KB projection still expects **64 / 8 / 10, SDK66 /37**, while the separate current-snapshot funding projection expects **68 /4 /10, SDK70 /40**. The distinct historical and current checkpoints are not rewritten into one chronology.

## Frozen accounting files

| File | SHA256 |
| --- | --- |
| `scripts/scope-ledger/source-exposure.test.mjs` | `4384d5f37ffd11b1cb86eb11fc454ebf40df0710eb1b4a64ebf0a29af3991e9f` |
| `docs/coordination/ledgers/scope-ledger.json` | `47a55897d30823fbf34f55651900785018dd59538a10d5d86ff9f4dadd6cbaff` |
| `docs/coordination/ledgers/MERI-FINAL-SCOPE-LEDGER-20261015.md` | `b2e23f0ee627bbeca49e499693977b7d677c07bddc520afe7eec39f63ddd9258` |

Owned-file whitespace passed. Accounting is frozen for independent review. Full source/integration acceptance, current installation qualification and draft publication remain parent-owned. No dependency installation, build, Core/public-contract/lock/startup edit, credential creation, live provider/database/AWS call, staging or commit occurred in this lane.
