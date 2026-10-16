# Package-four qualification checkpoint

Source-only checkpoint. No product integration, frozen-pin change, SQL execution or release acceptance.

## Verified identities and approximate size

Package four: `eca78d458acb46cbfd54a94cf870841d999ef6b1`, tree `af0fa89750d9ffb8a58b66dfcb6f84cf4300fd49`, parent `753bd62124d6754442a55e81bbd94c03ed451584`. Local isolated branch: `dot/meri-package4-qualification-20261016`.

Audit: `f8d1816eda48347eeca4c0c25308870f2885c1f5`. Frontend: `2acbd89cf70a2d8bc70fa5be7059abb8d79ca6b2`, tree `c1d85ee1420413904de2ab8a27b771d07f5ddc14`, parent `ca66b0fdf60ddd92e7215bd81969d87bd81d1985`; stated base `c7e060007f5cd5a9b786442d0cc168a73c5565a8`. Both frontend commits were independently resolved with the GitHub Git-commit API; package-four branch and current main were also checked remotely. Main remains `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`.

Twenty backend abbreviated commit references in the handoff resolve to full commits; all fifteen relative document links exist at the exact source pin. Full resolutions, parents, ancestry and hashes are in the accompanying source inventory. AGENTS.md, implementation standards, package-four report, lane briefs, owner decisions, audit README/package-three review and the central allocation/conditional-custody records were read. No `.agents` directory exists here.

Approximate tracked code size, from exact Git blobs at package four, excluding all worktree edits:

| Category | Files | Nonblank physical lines |
| --- | ---: | ---: |
| Application/library | 656 | 40,216 |
| Tests/fixtures | 789 | 73,716 |
| Infrastructure/scripts/migrations | 165 | 18,630 |
| Total | 1,610 | 132,562 |

Includes comments in `.mjs`, `.ts`, `.py`, `.sh`, `.ps1`, `.sql`. Excludes docs/evidence, dependency/vendor/generated/output paths, locks, JSON/YAML/schema/config and generated declarations. This is an approximate code-size measure, not language-normalized `cloc`. Reproducible per-file inventory: `PINNED-SOURCE-COUNT.json` in this task workspace; no branch totals were summed.

## Ownership and integration map

| Owner thread | Exclusive implementation / shared seams |
| --- | --- |
| `01a14241-cbba-7531-9aba-71299cd430d7` startup/history | Conversations lifecycle/service, history modules/HTTP/postgres extension; product-access/http uncertainty; activity finally and bounded cleanup helper; runtime control/product-applications/prepared-candidate/native-authority identity-context; requested small http-server readiness extension. No prepared-run-bindings edits. |
| `01a14241-f378-7459-96a8-5523fdded0e1` reads A/B | Gateway general-reads family modules and lane integration; worker reads families/schema/results/server plus tests. No activity finally, runtime/options/config, preview persistence or migrations. |
| `01a14242-1d17-77a6-aad8-34c9c6ebe0c4` budget/planner | Proxy trusted product namespace and gateway budget admission/tenant integration; intent result-release and memory correct-replay repairs. Prepared-run-bindings model-grant seam is coordinated, not implicitly owned. Command executor left to artifact owner. Planner protocol/journal remains proposal. |
| `01a14242-7696-7215-9305-26284f9340e4` UI | Meri useLiveRun extraction/helper, dedicated tests and Meri docs. No Settings/shared registry/architecture policy mutation. |
| `01a14248-3e19-713a-9cc0-a13e3242e0d4` artifact safety | Retention write/watermark/reconciliation; browser page-context/permission generation; pre-claim filing preparation; preview claim/publication custody. Qualification transferred these provisional claims with zero source edits. Requested narrow document preview-route and runtime artifacts/application plumbing must be coordinated with startup's runtime composition. |
| This qualification lane | Pin/proof custody, migration proposal, deferred-suite inventory, integration accounting. No feature implementation. |

Parent explicitly accepted product-effect uncertainty commit `b93abfddfbf0c0fe908820825fbf889b6fd78ba3` and cleanup `8cd11310d375694a8ee883849305e7ebc55594d6` source-only. Custody verified the direct chain `eca78d45` → `b93abfdd` → `8cd11310`, trees `59b22fbbfe7b6607a19e92a9edcbd18b53c5a7e0` and `0187177f99279738e86d80ee898c8aeb0d118ead`, and exactly the three-file/separate four-file deltas; integration is separately recorded after this documentation checkpoint. UI owner reports pushed `36974aa470d9e1ae5b6cd89c16b8e19dc77e2b6e` (tree `3c3f376739ce903359dca1e2adec605d88c874ae`), source-identical to independently source-accepted `92ae83cdbf165f36a77280d061b23b329f1b90ca`; this checkpoint has not integrated it. No blind merges or acceptance carry from other lanes.

## Candidate and actual checks

Candidate f remains frozen at `3215210633f64dcb4c8d98aa1c7e17af658c512511bc4f7bdf3df4f8a4085017`. Candidate g is `b74243e64a2a6d031434315cd7e4699ecc151f6ba2ca13959c04c31a75edfcd6`; h is `79a5f7fc5254c0152c0119264d653cdb5b561f27ded91d379569d00ba73a5c1e`. The predecessor chain and all 45 h rows match exact source; g differs only at runtime/control and runtime/config. Their old/new hashes are recorded per row in the inventory. Frozen f differs from current source at seven rows, not merely the two g-to-h rows. All historical manifests and proof inputs remain byte-identical.

Two sequential short synthetic built-in checks ran on Windows Node `v24.19.0`, each below one second, without dependencies, browser, database or provider:

```text
node --max-old-space-size=192 --test --test-concurrency=1 --test-timeout=15000 scripts/qualification/assembled-image/source-proof.test.mjs
node --max-old-space-size=192 --test --test-concurrency=1 --test-timeout=15000 scripts/qualification/assembled-image/frozen-candidate.test.mjs
```

Results: source proof **5/5**, frozen-candidate **4/7**, zero skips/cancellations. The three failures are COPY current bytes, excluded/different COPY rows, and static-versus-frozen selection. They remain unresolved source-policy mismatches; no repin was made. Raw outputs retained. No test process remains.

**h remains HOLD.** Matching bytes is not behavioral acceptance. Parent confirmed synthetic retention restore-then-write disclosure, stale browser overlap/pending approval, pre-claim filing effects, and preview publication uncertainty; dedicated repairs and exact independent reviews are pending.

Historical runtime aggregate **234/241** remains owner evidence, not a fresh run. Keep all seven failures open: Docker-filtered closure (1), issuance claim/issuer missing task socket (2), actual-runner ambient-credential refusals (3), bootstrap-file root refusal (1). These are distinct observed errors, not a blanket claim of environmental innocence. Historical dependent artifact failures and native/runtime limits also remain.

## Deferred checks and bounded slot request

Shipping thread `01a1383e-0c6b-778e-8893-2359c0da802e` grants no Meri compiler/browser/DB/npm slot yet. Existing Windows native-PG ACL guard failure remains STOPPED; no relocation, ACL bypass, cloud writes or product DB. No heavyweight stage launched here.

Compiler commands proposed sequentially at the exact candidate selected for qualification:

```text
node --max-old-space-size=1536 apps/runtime/node_modules/typescript/bin/tsc --noEmit -p apps/runtime/tsconfig.json
node --max-old-space-size=1536 apps/control/conversations/node_modules/typescript/bin/tsc --noEmit -p apps/control/conversations/tsconfig.json
```

One process, 2 GiB reservation plus 1 GiB fresh commit margin; maximum 300 seconds per command, 30-second owned-child cleanup; no ports. Conversations includes worker/options and its read/intent imports. Worker package has no standalone typecheck script. Dependencies are absent; separately grant sequential unchanged-lock `npm ci --ignore-scripts --no-audit --no-fund` for root/runtime/conversations/worker before compiler qualification (512 MiB heap, 1 GiB total reservation, 300 seconds per install, zero lifecycle scripts). No borrowed unverified modules or unlocked install.

Existing real-engine source inventory:

| File | Static cases | Real versus synthetic / blocker |
| --- | ---: | --- |
| retention/test/postgres-journal-pg.test.mjs | 8 | Real PostgreSQL, synthetic subjects/objects/bucket; task-owned Unix-socket-only PG16 and existing migrations required. File truncates fixture tables: never point at a product DB. |
| product-persistence/test/postgres-stores.test.mjs | 2 | One static DDL case plus one opt-in real-engine case; proposed memory/settings DDL not allocated/applied. `MERI_PRODUCT_PG_SOCKET`, database and user must name only the approved fixture. |
| runtime/native-authority/test/recovered-controller-pg.test.mjs | 2 | Real PG canonical admission; scripted ECS/remote responses. No real AWS/SDK/provider acceptance. |
| runtime/native-authority/test/ecs-recovery-pg.test.mjs | 1 | Real PG/local supervisor; scripted ECS wire. |

Future exact test argv is `node --max-old-space-size=512 --experimental-test-module-mocks --test --test-concurrency=1 --test-timeout=120000 <one exact file above>`, with `MERI_REVIEW_SOURCE_ROOT` set to this reviewed checkout and only fixture selectors set. Proposed total reservation 1.5 GiB plus 1 GiB fresh margin; PG shared_buffers=64MiB, work_mem=4MiB, maintenance_work_mem=16MiB, max_connections=12, max_parallel_workers=0; pools at most six; suites sequential. Per-file lifecycle 180 seconds plus 30-second cleanup, whole fixture at most 15 minutes. Dedicated cluster data/socket identity and owned postmaster/child/port cleanup must be approved before any start. Existing provisioner starts two clusters with max_connections=100; do not run it as this bounded profile or imply Windows supports its Unix-socket assumptions.

No existing real-engine command is available for three claimed handoff targets: intent journal has only a store port, preview has only a local store, and schedule occurrence DDL/owner tests use scripted SQL. Retention postgres-watermark has three injected-pool tests, not a real-engine suite. Schedule-lifecycle-postgres has ten scripted tests, not real PostgreSQL. These require adapters/DDL and new real-engine qualification before they can become runnable; never count renamed synthetic checks as real tests.

UI owner's exact separate slot request is committed at `docs/meri-figma-34-20261015/UI-QUALIFICATION-REQUEST-20261016.md` on `36974aa4`: dependency install, registered test inventory, unit/lint, 17 Meri/Settings specs and separate full semantic production build. Historical host-case count 22 versus static 19 is unresolved until actual test registration; expected 133 is not a run result. Browser identity remains installed Windows Chrome155, not Linux149. No heavy UI result is imported here.

## Remaining coordination

One collision-checked proposed migration record accompanies this report. Parent approval is required before source allocation; all SQL remains untouched. The conditional conversation0012 custody hold is preserved. Planner application receipt/publication protocol, canonical current result-release authority, source history/citation wire, browser consume/prompt and PDF/preview contracts remain exact proposals, not frozen edits.

Direct messages to parent `01a0ff18-26cd-7609-beba-87726d0300c6` returned `thread not found`, including one attempt using its reported durable host. Peer messaging works; platform final delivery is the parent notification route. This is an endpoint blocker, not an action denial. First deliverables are complete locally; integration and heavyweight qualification remain pending explicit owner review/resource decisions.
