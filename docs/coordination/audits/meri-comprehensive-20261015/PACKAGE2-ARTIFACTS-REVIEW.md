# Repair package two: bounded DA-1–DA-4 re-review

15 October 2026, 20:55 UTC. Independent read-only source review and isolated synthetic tests. No repository implementation edits, source activation, cloud/provider calls, migrations, real database/bucket work, or deployment. The previously blocked P2b signed-download probes were not attempted. This report reviews only the original four data/artifact findings, not the entire package or other audit lanes.

## Pins and inclusion

- Integrated candidate and observed branch head: [`69040f9b4ab2d239bec1a057354d578d2bf24b1e`](https://github.com/neo-capiro/meri-greenfield/commit/69040f9b4ab2d239bec1a057354d578d2bf24b1e), `fable/repair-package-2-20261015`.
- Original reviewed base: `ba40647c5b6f1f81773869e41ce82c099d64d505`.
- DA-1/DA-4 lane included: [`59d8504b350869e2cf71ae437d4c054cdd3d3ec3`](https://github.com/neo-capiro/meri-greenfield/commit/59d8504b350869e2cf71ae437d4c054cdd3d3ec3).
- DA-2/DA-3 lane included: [`fb71cfc3741cb993c763fe016771baae93922540`](https://github.com/neo-capiro/meri-greenfield/commit/fb71cfc3741cb993c763fe016771baae93922540).
- Reviewed the [package report](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-REPAIR-PACKAGE-2-20261015.md), [retention lane report](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-DA-RETENTION-SAFETY-20261015.md), and [artifact lane report](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-DA-ARTIFACT-INTERNALS-20261015.md).

GitHub compares independently establish both lane tips as ancestors of the integrated candidate. Retention files are unchanged between its lane tip and the integrated tree; the DA-2/DA-3 executor, Python entry, presentation, layout and regression files are likewise unchanged from their artifact lane tip. All four repairs are included. The integrated candidate remains a candidate; this is not evidence that main or a deployment contains it.

## Scoped verdicts

| Finding | Verdict | Boundary |
| --- | --- | --- |
| DA-1: mixed-subject purge deletes bytes before invalid row target is rejected; effects remain only PLANNED | **ACCEPT source repair** | Subject mismatch blocks; whole-plan preflight precedes effects; durable UNKNOWN markers and recovery controls pass. Production purge and full restore remain unqualified. |
| DA-4: uncertain retention leases returned reusable | **ACCEPT source repair** | Commit uncertainty, rollback/unlock failure, deadline and late acquisition retire the lease. Injected-pool tests pass; no independent real-driver/network-fault qualification. |
| DA-2: retained PDF sent to DOCX parser | **ACCEPT wrong-parser prevention only; HOLD PDF revision capability** | Revision now refuses before any generator/converter. No PDF revision is produced. Required PDF revision remains open; this review does not approve deferral or narrow product scope. |
| DA-3: table/chart/image share coordinates and overlap | **ACCEPT deterministic frame-overlap repair** | Real PptxGenJS output passes all element-combination and dense-frame checks. Native rendering/text fit, Office openability and full document quality remain HOLD/unverified. |

No new blocker to these narrowly defined source-safety/frame fixes was found. Do not summarize the table as full artifact/retention acceptance or “all four capabilities complete.”

## DA-1 review

The canonical class-to-subject table is now [inventory.mjs L11–13](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/inventory.mjs#L11-L13). [purge.mjs L41–49](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/purge.mjs#L41-L49) retains foreign targets and adds ROW_TARGET_SUBJECT_MISMATCH rather than silently dropping them. A conversation carrying artifact-version rows is therefore BLOCKED until those obligations are resolved under the artifact's own authorized subject.

[L78–94](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/purge.mjs#L78-L94) resolves all keys, checks delete permission, and requires row-owner preflight before recording or deleting. The actual SQL owner reuses subject routing and validates relevant target values before acquiring a lease at [postgres-journal.mjs L97–105](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/postgres-journal.mjs#L97-L105).

[purge.mjs L95–127](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/purge.mjs#L95-L127) appends PURGE_UNKNOWN/EFFECTS_STARTED before effects and projects the in-flight step UNKNOWN. Outcomes are retained in the next projection/final record; thrown effects attempt an additional UNKNOWN ledger/projection record. Failure to append that final record does not erase the earlier uncertainty marker. Recovery re-verifies every target rather than trusting an incomplete success claim.

Five new [purge-safety tests](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/test/purge-safety.test.mjs) passed independently, including the original mixed-subject counterexample, rehashed PLANNED forgery, zero-effect preflight refusals, row-port lost-commit behavior, interrupted step/recovery and actual SQL-adapter routing without a connection. Eight existing planning/execution/recovery controls also passed. Storage, ledger and journal are synthetic; the process-loss control simulates a never-returning promise, not an actual process crash.

The lane's documented residual startup owner, authoritative ledger sink, complete data-class inventory and restored-backup qualification remain open. No purge activation is accepted.

## DA-4 review

[postgres-journal.mjs L18–42](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/postgres-journal.mjs#L18-L42) adopts bounded lease/statement waits, distinguishes RETENTION_COMMIT_UNKNOWN, avoids sending rollback after unknown commit or a stalled statement, bounds cleanup rollback, and passes an error to release for uncertain leases. Late acquisitions are retired on arrival. [L76–83](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/postgres-journal.mjs#L76-L83) requires confirmed advisory unlock before session reuse.

All six new [lease tests](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/retention/test/postgres-journal-lease.test.mjs) passed independently: clean reuse, lost COMMIT acknowledgement, failed/stalled rollback, stalled query/failed BEGIN, late lease, failed/false/stalled unlock and later-borrower isolation. These use the actual adapter over an injected pg-compatible pool.

The lane reports 7/7 real PostgreSQL tests on its already-running socket-only cluster, with wrapper-injected dropped replies. I read those added controls but did not rerun or independently qualify that cluster, its migrations, privileges, network failures or crash behavior. rows.present and ownerOf still use unbounded pool.query; the lane accurately identifies this separate remaining boundedness work. It does not negate the repaired uncertain-lease reuse defect.

## DA-2 review: refusal is not implementation of revision

[local-executor.mjs L13–16](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/local-executor.mjs#L13-L16) rejects any PDF request with a retained base using ARTIFACT_REVISION_UNSUPPORTED before allocating its temporary workspace. [entry.py L34–38](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/python/entry.py#L34-L38) rejects mismatched base formats or non-ZIP bytes for the ZIP-format owners before invoking their parser.

Four non-opt-in [PDF regression tests](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/test/pdf-revision-dispatch.test.mjs) passed independently. They verify structural PDF fixture offsets, zero interpreter/converter calls for revision, empty temporary root, actual Python format guards, genuine DOCX revision as a positive control, and local-service create→inspect→revise→repeat-refusal with unchanged parent bytes and no extra object writes. The PDF converter is synthetic; the DOCX generator/parser is real. This local artifact-service test is unrelated to the blocked signed-download/P2b route and does not exercise it.

Required remaining work: implement an explicitly defined PDF revision path, such as a hash-bound retained editable DOCX intermediate or reviewed full typed-spec re-render semantics with exact-parent lineage. Then qualify real create/revise/replay, native output, storage and product admission. The current change intentionally returns no revised PDF. The lane report's “DA-2: closed” must be read only as closure of the wrong-parser defect, not closure of required generation/revision functionality. There is no approved silent scope deferral here.

## DA-3 review

The isolated pure [slide-layout.mjs](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/slide-layout.mjs#L5-L56) assigns one cell per nonempty element using integer-EMU geometry. [presentation.mjs L15–23](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/presentation.mjs#L15-L23) consumes those boxes instead of independently placing elements at identical coordinates. The extraction is cohesive and keeps the entry point small.

Both [layout tests](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/artifacts/test/presentation-layout.test.mjs) passed independently using real PptxGenJS 4.0.1 through the executor and OOXML readback. Coverage includes all 16 combinations, deterministic repeated geometry, dense table/chart/bullet combinations, image aspect/size and empty bullets. These checks prove frame bounds/separation and table-grid arithmetic, not native text fitting.

Text sizing remains heuristic; arbitrarily long text and native row growth can exceed assigned cells. Native PowerPoint, independent visual inspection/rendering, renderer sandbox, benchmarks and product PPTX admission were not exercised here. The author reports a local LibreOffice raster review but retains explicit native/text-fit limits. Acceptance is limited to the original deterministic frame-overlap defect.

## Independent execution evidence and limits

Executed in an isolated temporary source tree fetched from the integrated pin, with canonical validators, not surrogate validators:

1. `node --test apps/control/retention/test/purge-safety.test.mjs apps/control/retention/test/postgres-journal-lease.test.mjs apps/control/retention/test/planning-execution-recovery.test.mjs` → **19 passed, 0 failed, 0 skipped**, exit 0.
2. `MERI_PPTXGENJS=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs node --test apps/artifacts/test/pdf-revision-dispatch.test.mjs apps/artifacts/test/presentation-layout.test.mjs` → **6 passed, 0 failed, 1 skipped**, exit 0. The skip is the explicit MERI_ARTIFACT_SOFFICE opt-in.

Environment: Node 24.19.0, preinstalled PptxGenJS 4.0.1, existing Python environment at the test's default path; reused already-materialized local dependencies Ajv 8.20.0, ajv-formats 3.0.1, canonicalize 5.1.0 without package installation. Initial test discovery failed because this deliberately partial fetched tree lacked operation-contracts.mjs. After fetching that unchanged canonical dependency from the same pin, the reruns above passed. Initial failures are retained and are not product test failures.

Evidence retained at `/tmp/meri-p2-data-review/retention-results.tap`, `artifact-results.tap`, `retention-setup-missing-module.tap`, and `artifact-setup-missing-module.tap`, alongside fetched source. Connector materialization may append a final blank line; no source logic or test assertion was changed. No full repository suite, baseline-revert proof, Docker/image, real PostgreSQL, S3, native Office/PDF renderer, SDK sandbox, provider, benchmark, migration or deployment check was run. Author-reported broader counts remain author-reported.

Cleanup verified: no owned meri-slide-layout/meri-pdf-revision temporary directories remained, and no generator processes running from this review tree remained. Only fetched source, reports and scrubbed test output are retained. No unrelated session or evidence was removed.
