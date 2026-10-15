# Repair package 2: bounded integration review

Reviewed 15 October 2026. Exact branch head: [`fable/repair-package-2-20261015 @ 69040f9b4ab2d239bec1a057354d578d2bf24b1e`](https://github.com/neo-capiro/meri-greenfield/commit/69040f9b4ab2d239bec1a057354d578d2bf24b1e).

## Verdict

- **ACCEPT, scoped integration/provenance:** the eight advertised lane tips are ancestors of this exact head. The previously accepted L5/SEC-REL-01 and P2a readiness/plugin repairs are preserved. Candidate-e's static source proof independently passes **5/5** against verified GitHub bytes.
- **No new P2b synchronization acceptance.** Its prior independent review stopped on a service safety error. This review inspected the new candidate's source, ancestry, scripts and reported evidence only; it neither retried that blocked probe nor substituted another route. The synchronization claim remains independently unverified.
- **HOLD, aggregate package and live qualification:** this is not a full semantic re-review of the other lanes, an all-green clean-checkout run, a contract freeze, or image/release admission. Existing granular source acceptances remain intact. Reported owner decisions do not themselves grant authority; four feature deferrals still require Neo's explicit confirmation.

The package itself labels all new candidates HOLD and distinguishes unrun live gates: [package report lines 3–24](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-REPAIR-PACKAGE-2-20261015.md#L3-L24), [lines 52–63](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-REPAIR-PACKAGE-2-20261015.md#L52-L63).

## 1. Ancestry and preservation

GitHub comparisons independently returned `ahead`, zero behind, and a merge base equal to each lane's full tip:

| Included lane | Exact ancestor | Commits ahead at integrated head |
|---|---|---:|
| P2a readiness/plugin | `743ae3700751e25947702ce5672b0978c27cc23a` | 53 |
| L1 pause/checkpoint | `3dceab531ed5cbc59289122f04eb1500064e8b38` | 54 |
| L5 cancellation / SEC-REL-01 proxy | `0d88e209dc811fc417b7bdec4327174a6582f876` | 57 |
| P2b download synchronization | `246667a964f0776451c5e100a3e39ce4812cf476` | 53 |
| DA-1 / DA-4 retention | `59d8504b350869e2cf71ae437d4c054cdd3d3ec3` | 65 |
| DA-2 / DA-3 artifact internals | `fb71cfc3741cb993c763fe016771baae93922540` | 66 |
| Scope ledger | `9fce47df989e6e0e2ba356df72462e1d70d489cb` | 60 |
| P2c structure/policy | `ac08174070971880c6ebef8fc34b6f9262ba738f` | 55 |

[Advertised lane mapping](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-REPAIR-PACKAGE-2-20261015.md#L9-L18) agrees with the resolved ancestors. This proves inclusion, not semantic correctness of every lane.

All 13 files changed by the accepted P2a successor have no subsequent differences at package head. Nine core files were additionally compared byte-for-byte with prior verified review snapshots: readiness, startup observation, skill-plugin, hooks, temporal-worker, config, broker-cleanup tests, prepared-temporal tests, and proxy ingress. All match.

Thus the prior source conclusions carry forward:
- L5: unsupported non-prepared worker mode fails startup; supported prepared dispatch exits retain bounded original-task cleanup.
- SEC-REL-01: the exact pinned inference route/query is admitted; broader query/path variants remain rejected.
- P2a: contradictory readiness observations and plugin-path aliases are handled by the accepted repairs. T1–T4 contract freeze and real SDK host readiness remain pending.

The prior inherited receipt-hardening caveat remains nonblocking: cleanup currently trusts the returned execution ID after assignment; a wrong-ID injected-port result can redirect cleanup. The trusted prepared owner binds its receipt to the original execution key and was not shown capable of generating that mismatch. No reachable deployed defect is established here. Any future validation of an untrusted receipt should keep the explicit original execution key authoritative.

## 2. Independent proof and exact hashes

I fetched and verified 71 materialized source/evidence blobs against their GitHub blob SHA-1, preserving historical manifest bytes exactly, then ran only the read-only static source-proof suite with Node **v24.19.0**. Result: **5 passed, 0 failed, 0 skipped**. Three additional helper/test files were later materialized and separately matched to their GitHub blob hashes; they were not executed.

The source test explicitly selects candidate e at [line 11](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/scripts/qualification/assembled-image/source-proof.test.mjs#L8-L29). Its assertions cover the preserved candidate chain, 45 historical proof paths, current file hashes, changed-row reasons, 16 exact test allowlist entries, and unchanged recipe/helper requirements: [lines 32–73](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/scripts/qualification/assembled-image/source-proof.test.mjs#L32-L73).

| File / evidence | SHA-256 |
|---|---|
| `candidate-manifest-fable-20261015e.json` | `41814143b72e4288f83bf3137b4cfcd7f14c9a93df467772b3685b0f1b35c341` |
| Preserved candidate d | `28b38f7e1ca05aca80f2f45f69c8ea21b7b1341ffdb252bf004f764975e555f5` |
| Historical `source-manifest.json` | `d7f743dcf6b0514310ccf5b2b7bdcf2a5ed40d4359caac3d78add7310c74587f` |
| `source-proof.test.mjs` | `cea0ed59b36db71977673f4726975e625e293e1a4bd6f2605f139024bfd36044` |
| `apps/runtime/Dockerfile` | `8d4ac642bee442691b2857c58ae89cc84c16f52e054386c0ecb7ab9a0ead7e69` |
| Independent `source-proof-result.txt` | `823e60df9287a7798165caaff38b4f667a92a6d45eb7cdb34692ca40be74b75f` |
| Independent 71-file `verified-files.json` | `25fecb13a5c3549d0b79f55fd6a0c4d505b54d38d82d484750a3dd8eaef8cfad` |

Candidate e has 17 changes relative to the historical manifest and 28 unchanged rows. Relative to d, exactly one proof-file hash changes: `apps/control/conversations/postgres-store.mjs`, from `831d870e797796840ce855d5d2adaae48efb74bdbdecb2f105943462d99590fa` to `e3568dd6ce0f8afafaee43a61f5e66ecda368f7f4dbebf26f9ead21674bfe920`; the changed-row record retains d's prior hash.

**Proof limit:** [candidate e lines 3–19](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/scripts/qualification/assembled-image/candidate-manifest-fable-20261015e.json#L3-L19) retain `CANDIDATE_HOLD_SOURCE_REVIEW`, null `sourceHead` / `publicationSource`, and explicitly withhold image acceptance. Its inherited pickup head is `7fbf232425fbcb9172e03e561720722154b9efbf`. The 45 historical paths are a bounded subset, not an integrated-tree closure seal. A successful static proof cannot certify runtime behavior, all added modules, Docker COPY behavior, scanning or admission.

## 3. Combined test setup and reproducibility

The [integrated report](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-REPAIR-PACKAGE-2-20261015.md#L26-L48) reports Node v24.21.0 with `MERI_REVIEW_SOURCE_ROOT` set:

| Suite | Author-reported result; not rerun here |
|---|---|
| Worker conversation + browser + continuation + skills | 236/236 |
| Structure + graders | 26/26 |
| Synthetic control hold composition/failure | 13/13 |
| Runtime artifacts | 26/26 |
| Link mount + broker cleanup + Temporal authorization + prepared Temporal | 24/24 |
| Gateway tenant budget | 15 pass, 1 skip |
| Retention aggregate | 26/26 |
| Artifacts DA-2/DA-3 | 6 pass, 1 skip |
| Source proof + scope ledger + general-read inventory | 31/31 |
| Proxy ingress | 25/25 |
| Full runtime | 189/196 |
| Full control conversations | 188/195 |

The retention lane separately identifies 26 non-PG passes and 7 real-PostgreSQL passes under task-owned socket-only conditions; the package's shorthand retention row should not be interpreted as this reviewer rerunning PostgreSQL. [Lane evidence](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-DA-RETENTION-SAFETY-20261015.md#L64-L91).

### Scripts and module mocks

[Runtime package line 11](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/runtime/package.json#L7-L26) now enables `--experimental-test-module-mocks`, necessary for the mocked composition tests. Its glob covers `test/*.test.mjs` and `telemetry/test/*.test.mjs`; it does not encompass the separately reported artifact/worker/browser/continuation/skills suites. Root/worker scripts likewise do not constitute one universal package-2 acceptance command. The 24 focused cases span four six-case files; this is synthetic composition evidence, not Temporal/ECS execution.

Exact focused-test hashes:
- `download-links-mount.test.mjs`: `03e1c1140e18e9ab99528909585ff94238498bbb28167b0b687bf5aeecb2280f`
- `broker-cleanup.test.mjs`: `709e4ed2f86e07927415979af38bb7514e6675aca5266e9fbe3ab4abed7781f1`
- `temporal-authorization.test.mjs`: `f04b50229e280ac216d21fe82080b97a45e3f9fda6279f0ce58858d67450745a`
- `prepared-temporal.test.mjs`: `268de545811af6b2e89b04e6f1ae76f4e6493cc7e7d3dbb3b7f8b912052453cc`
- Runtime `package.json`: `3d87081f3986c9af9568fb717b850edfa2bd26781443bf4f6186c65ab70395fa`

The artifact-mount test now allocates a distinct temporary evidence directory rather than overwriting historical exclusive-write receipts. This is source-inspected hygiene only; no previously blocked P2b probe was run.

### Source-root requirement

[First-run test line 3](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/runtime/test/first-run-mount.test.mjs#L1-L12) imports the [product fixture](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/gateway/budget/product-scripted-fixture.mjs#L1-L5), which imports the historical harness. The [harness lines 5–12](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs#L5-L12) assert `MERI_REVIEW_SOURCE_ROOT` and dynamically load product modules/catalog from that path. It must point to the exact reviewed integrated checkout; merely setting it does not prove which source was executed. Harness SHA-256: `de2589e662788859c97fd54afd37730309e90db3ed8ad067711348baf68a741a`. The static source-proof test instead derives its own root from its file path.

### Dependency qualification

`prepared-candidate.mjs` directly imports S3 at [line 3](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/runtime/prepared-candidate.mjs#L1-L5), but [runtime dependencies](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/runtime/package.json#L14-L26) omit `@aws-sdk/client-s3`. The author reports two full-runtime failures on a clean package installation, with 30/30 passing only when a stale root-hoisted installation is present. The storage package declares the exact version **3.1141.0**. This is a concrete **clean-checkout/test reproducibility and undeclared cross-package dependency issue**, with a proposed dependency-boundary correction still pending.

It is **not evidence that the Docker image lacks S3**: [Dockerfile lines 17–24](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/runtime/Dockerfile#L17-L24) install the storage dependencies and explicitly symlink S3 into root resolution. [Lines 5–10](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/runtime/Dockerfile#L5-L10) install root/worker dependencies without omitting dev dependencies. Thus root saxes 6.0.0 and transitive xmlchars 2.2.0 have a source-level installation path. Actual image closure remains unqualified; no build was performed. The remaining reported runtime failures concern Docker availability, ambient AWS credentials and root-user guards. Neither those environmental explanations nor stale-hoist passes establish an all-green reproducible package.

## 4. Included repair claims versus remaining audit work

This section maps the lane reports; it does not independently close DA findings or reopen unrelated audit areas.

- **DA-1 / DA-4:** the included lane reports subject-aware row preflight, pre-effects/per-step UNKNOWN recording, and bounded PostgreSQL lease handling with conservative uncertain-commit custody. Its [remaining scope](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-DA-RETENTION-SAFETY-20261015.md#L86-L102) still includes an authoritative durable ledger/startup recovery owner, serving fence/recovered watermark, complete retained-class/backup restore coverage, and real S3 deletion. Live purge remains inactive.
- **DA-2:** included repair makes unsupported PDF revision fail closed before conversion. Actual PDF revision is still not supplied; retained DOCX-intermediate binding or typed-spec re-render lineage must be chosen before admission. [Open design](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-DA-ARTIFACT-INTERNALS-20261015.md#L89-L97).
- **DA-3:** included repair provides deterministic non-overlapping PPTX geometry and image fitting. It does not establish arbitrary text fit/native Office rendering. Dense content and the separately reported LibreOffice cleanup failure remain unqualified. [Limits](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-DA-ARTIFACT-INTERNALS-20261015.md#L80-L103).
- **L1/P2c:** present by exact ancestry; their semantic acceptance belongs to their focused reviews. Contract proposals remain open.
- **L2/L3/L4/L6 and other release/integration gaps:** the included-lane list provides no basis to close prepared continuation/approval composition, history, crash/next-prompt recovery, schedules, end-to-end budget/proxy enforcement, or release/CI/observability gates.
- **Scope ledger:** 96 included capabilities, 43 excluded tools and 14 skills are scope counts, not qualified end-to-end coverage. The ledger's audit tables are a historical-base snapshot and still describe old L5/query/DA findings. Reconcile those rows against exact successor reviews rather than treating the stale table as evidence that accepted repairs vanished, or treating the author's integrated report as global audit closure.

No real SDK sandbox, CLI/provider, Chromium/egress, native Office/PDF, migration/privilege isolation, Temporal replay, ECS termination bound, Docker build/scan/admission or deployment was verified in this review.

## 5. Decisions remain proposals until confirmed

[Owner report lines 3–17](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-OWNER-DECISIONS-20261015.md#L3-L17) explicitly says it records a reported message and grants no deployment/activation/live-gate authority. It asks for explicit confirmation of four deferrals: device/browser bridge, live browser takeover, full in-browser Office editing, and authenticated third-party website workflows.

D015 exists as [proposed text at lines 27–31](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-OWNER-DECISIONS-20261015.md#L27-L31). At this exact head, `docs/coordination/DECISIONS.md` (Git blob `fd58ed15daa8d3a093893e49e901f28570c91f51`) contains no D015 entry. The initial browser destination list is also still open. These documents do not independently prove Neo's confirmation or authorize changes. Telemetry T1–T4, L1 failure semantics, browser approval-port binding, download linearization/optional epoch, candidate freeze and dependency classification remain explicitly proposed decisions.

## Evidence and independence

Local review evidence: `/workspace/shared/package2-integration-review/`, including `ancestry.json`, `github-files.json`, `verified-files.json`, `accepted-repair-preservation.json`, exact source snapshots and `source-proof-result.txt`.

Prior bounded reviews carried forward: `/workspace/shared/review-a2-cancel-proxy.md` and `/workspace/shared/review-p2a-readiness-successor.md`. Their prior tests were not rerun as new package-wide evidence. This assignment added only static source-proof execution and read-only provenance/source inspection. No implementation, deployment, database mutation, real provider request, or user-computer action occurred.

