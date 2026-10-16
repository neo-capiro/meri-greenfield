# Package-four reviewed integration candidate

**SOURCE-ONLY PARTIAL CANDIDATE; overall source composition, candidate-h, image and live release remain HOLD.** This is not a main merge or runtime qualification.

## Current scoped integration, 2026-10-16 02:15 UTC

Source snapshot **`c7f5e35b60289dcd24799ba2361b47d523c0f5cb`**, tree **`e043ea8ddbcb7dee90d5f478c6fd57532ce3eabe`**, adds only five parent-accepted scopes to the earlier published `75f3767555f7b973ee5a0c76987fefb0ff07c112` candidate. Exactly **30 source/test paths** were selected; every integrated Git blob equals the exact reviewed source. This uses explicit path selection with predecessor-blob checks, not whole lane merges. The initial receipt below remains historical.

| Accepted scope | Exact reviewed source | Integrated commit |
| --- | --- | --- |
| browser generation fencing | `769848f13da1eb3fa94532d252c1f6d380123e89` | `4043a1dc6ecee06e47e26e9273bcc19125922df3` |
| filing effect custody | `805e55a6727e5f7ab131d85dc78809fd74ea94c3` | `662bfd26468dc3ff53a57f4b834ee9114f92c262` |
| source-local preview custody | `d56f07f9b0e5e198ea470db50cd19ac68acf2ebd` | `11f6ed6aa008bf66b102559e90efa144617e69d1` |
| reserved watermark table shape only | `338a04ec82626382045f8b944a4b7ed4dd48ab27` | `4b36a9e91d7b2c90fc2158fdb840249763231a77` |
| CORE-1 intent result release | `89aaff209217bc86e49c866c57d83a2f6bd6590a` | `c7f5e35b60289dcd24799ba2361b47d523c0f5cb` |

CORE-1 uses the reviewed `89aaff20` source paths, including its unchanged closed failure-code enum dependency; it excludes the proposed PostgreSQL adapter and SQL. The `0013` scope contains only the accepted table shape and its static SQL-text assertion. **No held retention behavior** from `5e035b34`, `338a04ec` or `c5ebb14f` was brought in. Preview0003 `eb52ed44` remains separate and unreviewed; browser/filing/source-local preview acceptance does not activate a live adapter or resolve restore custody.

Current validation: **6/6 passed**, 67.8448ms, Windows Node v24.19.0, heap128MiB, test isolation none, one process: five existing built-in source-proof checks plus one static SQL-text check. No database/parser/runtime/browser/compiler/provider ran; no test peak is claimed. The fresh physical-memory probe observed 11,566,657,536 bytes free; CIM commit data was unavailable and was not bypassed. Exact argv, raw TAP SHA256, 30 blob pairs and all five commit/tree pins are in `../audits/meri-package4-qualification-20261016/scoped-integration-custody.json` and `scoped-integration-proof.tap`. Dependency-bearing author suites and parent independent 73/73 artifact checks are reused as attributed evidence, not reported as new integration runs.

**Zero changed hashed proof rows.** Frozen f/g/h and all historical manifest bytes, image recipe, packages and locks are unchanged. h remains HOLD; the same seven historical runtime failures and three frozen-selector failures remain explicit. No selector repin, SQL execution, main merge or live release occurred.

Remaining source gates: exact review of retention `c5ebb14f`, memory scope successor `260de18f`, corrected history `5abfa653` and the subsequent public export/artifact; real membership owner and durable model issuance/startup composition; preview restore evidence and allocation lookup before activation. The parent accepted the separate model record and released intent/preview source DDL; central record `0b0b7abd536a27a74e3b1077ae71eed6e0ba275b` reserves conversation0015 `model_run_issuances` and records these changes. The later decisions supersede the initial proposal/placement statuses below; the earlier source inventory/evidence is preserved.

READS latest exact focused stage at `5eec8597`: 97/98 passed, primary1/cleanup0, no timeout, observed peak212,303,872B; its new output-accounting negative failed and is under investigation. Its first empty-log attempt stays UNCERTAIN. No old development pass is promoted to current qualification. Shared proportional light-check policy reached startup/artifact/budget/reads; UI delivery failed with AbsolutePathBuf and needs the parent relay. Heavy stages stay with Shipping and one integrated release checkpoint.

## Initial integration receipt at 75f37675 (historical)

## Exact custody and selected integration

Base package-four `eca78d458acb46cbfd54a94cf870841d999ef6b1`; published documentation checkpoint `acc9bc88368869d2d06f7fb78c30911b13982087` (tree `dde4c00791ed02bc03adb03416304609a124680c`). Dedicated branch: `dot/meri-reviewed-integration-20261016`.

Only these two parent-accepted exact source commits were selected, with `cherry-pick -x`:

| Finding | Reviewed original | Original tree | Integrated commit |
| --- | --- | --- | --- |
| CORE-2 product-effect uncertainty | b93abfddfbf0c0fe908820825fbf889b6fd78ba3 | 59b22fbbfe7b6607a19e92a9edcbd18b53c5a7e0 | 3699c331 (full value in custody JSON) |
| CORE-3 bounded independent cleanup | 8cd11310d375694a8ee883849305e7ebc55594d6 | 0187177f99279738e86d80ee898c8aeb0d118ead | 105f0cef8c65d83350cf7afa482d9f836909b361 |

Verified direct original chain: `eca78d45` → `b93abfdd` → `8cd11310`, with exactly two commits. CORE-2 changes HTTP, its regression file and report; CORE-3 changes activity, new cleanup module, its regression file and report. Combined delta is exactly seven paths, 168 insertions and 9 deletions. Every integrated path's Git blob equals the accepted original at `8cd11310`; there are no manual source resolutions. Source snapshot before this integration receipt is `105f0cef8c65d83350cf7afa482d9f836909b361`, tree `330614749db464d55dea561d88d7a76577f7a3ba`.

No unaccepted startup/history, reads, budgets, intents, memory, retention, browser, filing, preview or frontend source was merged. No protected contract, lockfile, migration, image recipe, historical manifest or frozen candidate selector changed. The ordinary activity's cleanup changed outside the 45-row proof scope; matching that proof does not attest every integrated path.

Parent source acceptance for CORE-2 is also documented in the published core review at `2e8419a0766476b41e63a03364f21cad3c65eee4`; CORE-3 acceptance arrived subsequently as a separate exact-pin direction. Author 13/13 and 26/26 synthetic controls and respective reverted-fix results remain author evidence. This integration lane did not rerun their dependency-bearing suites under the held resource queue.

## Validation actually performed

On Windows Node v24.19.0:

```text
node --max-old-space-size=128 --test --test-isolation=none --test-concurrency=1 --test-timeout=15000 scripts/qualification/assembled-image/source-proof.test.mjs
```

**5/5 pass, zero failed/skipped/cancelled, 44.5403ms reported test duration.** Built-in modules only, one Node process, no test-file isolation children, no network/provider/browser/PG/compiler. Raw captured output accompanies this receipt. Exact source-path blob comparison passed; protected-path diff is empty.

The earlier checkpoint's two proof commands used Node's default test isolation (one transient file child per sequential command). They were not child-free; no peak-memory measurement is claimed. All completed and no test process remains. Shipping received this correction. Fresh compiler/DB suites remain UNRUN without a slot and dependency/fixture capability; the earlier frozen-candidate 4/7 and runtime 234/241 history remains explicit, without a blanket environmental classification.

Candidate h remains `79a5f7fc5254c0152c0119264d653cdb5b561f27ded91d379569d00ba73a5c1e` **HOLD**. Frozen f remains `3215210633f64dcb4c8d98aa1c7e17af658c512511bc4f7bdf3df4f8a4085017`; the same three selector failures remain unresolved. No successor manifest was created or silently repinned.

## Full proposal and HOLD carry-forward

Canonical independent reports, preserved at exact publication `2e8419a0766476b41e63a03364f21cad3c65eee4`:

- `docs/coordination/audits/meri-comprehensive-20261015/PACKAGE4-CORE-REVIEW-20261016.md`.
- `docs/coordination/audits/meri-comprehensive-20261015/PACKAGE4-ARTIFACTS-REVIEW-20261016.md`.

Only CORE-2 and CORE-3 have the exact scoped closures above. Remaining findings and decisions:

| Area | Preserved outstanding work |
| --- | --- |
| CORE-1 | Fresh and retained intent-result release with canonical current authorization, client/policy intersection and original expiry. New resultRelease seam is a proposal, not composition acceptance. |
| CORE-4 / R4-DOC-1 | Filing registration beneath durable claim/accounting/current effect authority; duplicate/concurrent/lost-ACK/revocation and UNKNOWN custody. |
| CORE-5 | Memory correction replay before mutable target eligibility, with current visibility. Core submit/status dedup contract and actual owner remain prerequisites. |
| R4-RET-1 | Restore-before-write/read and atomic watermark completeness guard. Dedicated source repair remains under review. |
| R4-BRW-1 | Invalidate first/pending approvals on overlap/navigation; immediate generation check and competing-call fencing; live gate remains held. |
| R4-DOC-2 | Preview claim before rendering/allocation/write, concurrent/lost-ACK recovery, durable orphan identity/custody and retention coverage. |
| P-INT-1–4 | Prepare-only results/errors, availability, default-off flag, exact prompt and eight-call ceiling, plus current-release contract. |
| P-INT-5–7 | Schedule-list read placement; trusted durable schedule proposal context; per-action task.update/memory.propose/artifact.file metadata; reconcile stale personal-memory proposal wording with governed producer. |
| P-INT-8–9 / M1 | Durable scoped proposal/draft discovery and approval UI; authenticated task-bound transport/startup; real intent journal adapter/schema, immutable claims/state invariants, retention mappings. |
| Memory/settings M1–M6 | Namespace migrations; simultaneous first-save conflict semantics (source-derived concern, not engine reproduction); Core submit/status/read_target/find_by_key and exact dedup; current membership/platform limits; persisted settings consumed by issuance; public shapes and product/operational-read composition; pending-only personal source and committed-memory browsing/notifications. |
| Retention | Watermark and row-delete amendments; exact completion/next-run/selected-output/receipt keys; tombstones/order; write-once sink and prepared-candidate binding. Add local intent/memory/settings, preview records/objects/orphans to explicit subject/scope/key inventory. External memoryProposals does not cover local tables. Purge stays off. |
| Documents P1–P7 | PDF MIME/public routes and ArtifactPreview/immutable previewStatus contracts; durable preview/retention; renderer admission owner and product switch; optional object index; preview budget; governed attachment broker; signed-preview authenticated target claim. |
| Browser A1–A6 | Canonical atomic approval consume/current approver/revocation; idempotent artifact ingest/provenance; trusted run-bound host runtime/restore/egress/process cleanup; exact prompt, policy tightening and status publication. |
| Schedules | P-R4-1 occurrences; P-R4-2 proven no-effect reconciliation; P-R4-3 actual-job overlap/cancel/cost/runtime/retry/destination and admission contract; P-R4-4 current authority and immutable instructions. Worker placement Q-X2 remains unapproved/unregistered. |
| Budgets / Planner | Preserve authored product-budget0002 and uncertainty liabilities; canonical product proxy/per-run grants with revocation/settlement; current result/publication/application receipts and immutable association. No invented Core endpoint or reuse of held0012. |
| Dependency/image evidence | Approved minimal package-four lock deltas are source-accepted, despite the historical report's inaccurate blanket no-lock-change statement. This lane edits no lock. Omit-dev Docker recipe decision, worker-provenance refresh and host jszip resolutions remain separate. |
| Runtime/frontend | Actual startup/current owners, authorized history/reconnect, durable read/citation wire, exact reviewed L3 exports; UI source candidate remains isolated, full registered suite/build/SSR/accessibility/Windows-versus-Linux limits remain. |
| Release | Real PG/Temporal/S3/KMS/SDK/provider/browser/renderer/native quality, non-root/isolation/egress, exact image build/provenance/scan and deployment gates remain open. P2b stopped review stays stopped. |

The ten-path migration proposal published in the checkpoint remains **PROPOSED**, including conversation0013/0014, separate intents/memory/settings0001, artifacts0003, schedules0002 and the three per-family receipt-retention0002 paths. Conversation0012 conditional custody authoring hold is preserved. Parent approval, a fresh collision check and required identity/design agreements must precede any authoring. No migration executed.

## Current resource and delivery status

Shipping remains the sole local heavy-test coordinator. UI install-only relay failed before confirmed delivery with `AbsolutePathBuf deserialized without a base path`; Shipping was told, and consumption is not assumed. Reads' exact 97-case/128MiB-heap single-process/120-second request was relayed; dependency/compiler/database/browser stages remain held. No new local sessions were created by this lane. No AWS, paid build, real provider, credential, product DB or cloud write occurred.
