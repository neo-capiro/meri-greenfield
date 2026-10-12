# Florida budget source contract author receipt — 2026-10-12

The complete selected `get_florida_budget_project` projection is implemented in a private, inactive family. Final source is `dabe2b50d94f0b12ef983292a1c18e1ef35d4675`, based on `c1c9bfde7dd466a0474589a224a99b44277adbc9`. Author focused tests pass **30/30**; the offline preservation audit passes **114/114**, including all **6,528** original files unchanged. This is ready for independent source acceptance, not connected execution or runtime acceptance.

The only source additions are `florida-budget.schema.json`, `florida-budget-validation.mjs`, and `retrieval-florida-budget.test.mjs` under the existing private contracts directories. No catalog, loader, public contract, source adapter, handler, lockfile, or runtime file changed. The canonical 139-capability inventory and availability ledger are unchanged by this unregistered family.

## Interface and projection boundary

`createFloridaBudgetValidators({validateShape,schema})` exposes schema ID `urn:meri:retrieval:florida-budget:0.2.0`, the one operation ID, `inputDefinition(id)`, `outputDefinition(id)`, `normalizeInput(id,request,context)`, `assertResult(id,value,request,context)`, and `classifyResult(id,value)`.

The catalog definition is **FloridaBudgetInput**, the normalized selection. Normalization separately admits **FloridaBudgetRequest**, applies the established defaults, and returns `{input,metadata}`. It does not require callers to populate normalized fields. The output definition is **FloridaBudgetOutput**. `assertResult` returns its detached validated JSON snapshot; classification is only a shape classification and cannot substitute for request/context admission. The canonical resolver owns the retained original request and selection digest. Root will namespace this family's generic methods during shared integration.

Required private context is `['asOf','effectiveScope','clientResolution']`. It is closed and cannot be supplied through model arguments:

- `asOf` is a finite canonical ISO instant matching `generatedAt` only. It establishes neither stored-data freshness nor clock provenance.
- `effectiveScope` carries the existing FL/session/folder/client projection. It is not actor, tenant, membership, client-wall, or folder authorization.
- `clientResolution` is null without a normalized explicit client reference, otherwise exactly `{selector,clientId}`. It binds the wrapper's trimmed, 80-UTF-16-unit reference to a trusted resolved client UUID. UUID selectors preserve case-insensitive identity after the resolver's second trim; named selectors retain an explicit resolution fact. Explicit resolved clients must match the effective scope, while absent/empty/blank selectors may derive a client from the selected folder. No resolver or lookup executes here.

The original two-key context proposal and direct-client assumption are preserved in `outline.json`; source tracing and reviewer feedback established name resolution before the folder scope, and root expressly approved the third context key. The final definition decision is also recorded there. Future SDK/model raw-request schema exposure remains unqualified.

## Source semantics retained

The result preserves projects **100**, recent amounts **4 per project**, documents **101**, amount history **501**, and events **101**. Project pagination alone governs `nextOffset`. The document array is the selected 15-column projection, not the full document row. Projects retain nullable agency, raw JSON identities/relations/evidence, and tracking join values. Events retain raw columns plus joined document title/source/stage/fiscal year. Recent and full amount observations remain opaque inert JSON; no money, award, currency, or legislative status meaning is invented from them.

Fiscal years follow `20xx-xx`, without consecutive-year inference. Project selection, session/fiscal document filters, event project/fiscal filters, displayed-project recent observations, and tracking joins are correlated. No-folder tracking is false/null; a saved row requires a retained version, and signed versions remain allowed. Document/event observed timestamps descend, with ties permitted and no invented collation order. All raw text IDs, URLs, hashes, publication text, stages, roles, and chambers retain their established storage types.

Separate SQL windows can race: amount history is not fiscal/session filtered; recent amounts use the document session but not its fiscal year; events need not join a document present in the capped document array. Cross-array observation equality and global completeness are deliberately not inferred. Empty windows, `nextOffset:null`, and stored `complete` values are not authoritative absence or complete-corpus evidence.

Intentional typed admission narrows legacy object/array/boolean coercions to nullable string selectors and number/string/null offsets. Existing query slicing at 200 UTF-16 units, client trim/slice80, folder bound100, offset fallback/nonnegative clamp and integer ceiling10,000 remain. The frozen fiscal default is `2026-27`; no ambient clock is read. Observation timestamps use a finite canonical `toISOString()` wire policy. The bounded canonical inert JSON helper is reused unchanged; opaque JSON does not permit getters, proxies, cycles, sparse arrays, or executable values.

## References, failures, and checks

`reference-identities.json` independently records **11** complete source/schema/policy blob pairs at frozen `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`, with exact locators, byte counts, SHA-256, and Git blob IDs. All pairs are unchanged. These cover the wrapper/client resolver, controller/guards, evidence projection and scope, client wall, feature/membership, folder ownership, fiscal/tracking DDL, shared types, and Client UUID storage. Only identities and derived facts are retained; no private source bodies, query implementations, or services were copied or executed.

All failure receipts and preimages remain in ancestry and the author evidence directory:

| Capture | Source or correction | Actual result |
| --- | --- | --- |
| `focused-initial` | `86e3ce0`; test binding accidentally forwarded undeclared context.request | 26 pass / 1 fail |
| `focused-binding-repair` | `b32c64b`; fixture filters only declared context keys | 27 pass |
| `client-cutoff-before` | `5691a6a`; appended UUID cutoff counterexample | 0 pass / 1 fail |
| `focused-client-repair` | `bbc823e`; second-trim UUID identity guard | 28 pass |
| `output-alias-before` | `9ba91b4`; root-identified original-output alias counterexample | 0 pass / 1 fail |
| `focused-output-repair` | `3532908`; return validated detached page | 29 pass |
| `focused-definition-alignment` | `dabe2b5`; normalized catalog definition and appended regression | 30 pass |

The output repair deliberately corrects the earlier positive identity assertion to deep equality plus distinct identity. The definition assertion deliberately changes Request to Input. The audit reconstructs the original test prefix after exactly those two assertion corrections and the test-binding fixture correction; both failure counterexamples remain unchanged. The earlier 95-check audit at `bbc823e` is retained separately and does not attest to the final source.

Each focused capture records exact command, source commit/diff, helper hash, raw stream hashes, elapsed time, exit, and cleanup. Every owned group was absent afterward; none required a kill or timed out. Only the seven small, already-installed contract dependencies were copied; byte equality with the untouched donor is audited. No install or lifecycle script ran. A missing-file read-only diagnostic and its capture limitation are retained in `failure-notes.json`. Full staged whitespace checking failed on two whitespace-only lines in preserved failed Node assertion output (`output-alias-before.stdout.bin`); those raw bytes remain unchanged. Authored-text whitespace checking excludes only raw `.bin` streams and passes.

Reproduce the final focused check with the retained subreaper helper and a **new** label. Reproduce the offline audit with `python -I -B -S docs/qualification/candidates/read-continuation-20261012/florida-budget-author/audit.py --packet`. Do not overwrite preserved receipts. No broad/public tests were run in this lane; integration owns those checks. Independent reviewer reported 60/60 focused controls and preservation checks against exact final source; its separate receipt is the acceptance authority.

## Remaining gates

Current actor/tenant identity, feature and membership checks, folder visibility, current client resolution and walls, guarded source transport, source/DB access, observation clock provenance, and failure propagation remain execution prerequisites. The projection contract cannot prove any of them happened. Existing wrapper/guard/visibility errors remain errors; no new successful refusal envelope or approval semantics were invented. Source connectivity and handlers remain unavailable. SQL, provider, native, runtime, cloud, model, customer-data, and frontend actions were neither attempted nor qualified.
