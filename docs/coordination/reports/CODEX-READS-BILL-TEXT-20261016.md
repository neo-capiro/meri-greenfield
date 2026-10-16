# Bill-text source adapters and reviewed Core producer coverage

This independent candidate is based on `fb708d231c7273f86b1462c72a72e70ccc36a3d6`
(tree `bacbb5632fd4f324acc6f08456f6fe01a00b4859`). Tested source is
`674460a57ad8f334f1b6acacaea4702ea3130791`, tree
`6c7f3a1c7f6f19acb5a72211aee3a4d1ff003a8c`. Publication successors only add this
report. Independent source acceptance and combined integration remain pending.

## Implementation and boundaries

The implementation outline is recorded in the existing scope ledger's introduction.
Two existing typed producers are implemented: `search_congress_bills` and
`read_bill_text`, over fixed flat POST bodies to `/api/clio/tools/<exact-name>`.
Actual producer source is Core `b525032222515d636b0dae2d46e40c7c3d8b5528`, tree
`16723770a8e111fc66bcf70d36ff32ab71eb9928`. There is no generic tool selector.

`sources/bill-text/handler.mjs` reuses canonical receiving validators, the accepted
bounded retained HTTP transport and its pinned credential callback. Both genuine
native user JWT and internal-service-secret are required from CONTROL. The three
retained operations' delegated protocol is not extended. Missing credentials stay
UNAVAILABLE; no fallback, ambient origin or worker credential is introduced.

`dispatch/bill-text-context.mjs` binds the existing CONTROL-owned captured
`defaultCongress` option to current gateway authority. Missing context is unavailable.
SEARCH direct designations are transported as canonical bill IDs derived using that
captured Congress; incoming DTO validation still uses the original request/context.
This closes the concrete mismatch with Core's independent calendar default. READ
already uses canonical normalized bill IDs. Native Dates cross real JSON bytes;
frozen Unicode notes, cursor lineage, coverage and all false truth flags remain intact.
HTTP200 alone never means successful evidence; an unavailable current revision is
explicit UNAVAILABLE, and malformed results are withheld.

Gateway owners retain authorization, original cutoffs, reservation/settlement,
durable receipts, duplicate UNKNOWN and current release checks. New family registration
uses the existing single `meri_reads` server and canonical schema conversion. No
contract, lockfile, historical manifest, migration, credential or deployment changes.

## Source ledger and producer mapping

The existing ledger now records 23 general operations across 16 worker families:
21 selected source reads, one product-state read and one historical contract.
61 selected source reads still lack adapters; all 43 exclusions and 11 original
skill-backed source routes remain unchanged. Live availability remains 0.

All original 63 missing operations across 33 families now have exact producer/context
evidence pointers. [Sanitized Core publication](https://github.com/neo-capiro/capiro-backend/blob/384325afaaf7ad34aeb9ff9b2f183d667ee17343/docs/retained-read-producer-mapping-20261016/MAPPING-HANDOFF-v2.json)
is pinned at `384325afaaf7ad34aeb9ff9b2f183d667ee17343`, tree
`06f3be30d464e261214bd08d9123ede13e2c4b7d`. Its index SHA256 is
`c6ebaf2987015db466e88b9d4c550ab77878582ab7142ab256d298ae16ed0def`;
publication review SHA256 is
`ceb7df958e5eb2f9971af7bd8ac093d6785d18543f5611d5149ebc1b8c4fb3ab`.
The derivative explicitly preserves original local v2 `5a498e4c...` provenance;
the prematurely sealed original is not reused. Four published scoped Git blobs and
every operation/family/context/pointer correlation were checked before adoption.
The compact ledger metadata stores pointers and constraints, not copied implementation.

Source evidence does not establish receiving compatibility or effect-free execution.
Acquisition list/detail both audit-write and gate PII on actual current Core role.
State designation fallback may perform live provider/quota/upsert effects. Global
query auditing, live certification/public-web calls, funding/SAM clock divergence and
unproven client walls remain explicit constraints. No policy suppression was invented.

## Focused verification

Final 41/41 PASS: 24 adapter/durable gateway cases, two actual worker Zod canonical
schema conversions, and 15 source-ledger correlation/regeneration controls. HTTP and
SQL are synthetic; actual canonical validators, transport parsing, gateway owners,
schema converter and generator execute. No SDK/model/native/provider/DB/compiler
execution occurred. Broader changed family suites and real compiler checks remain
with the integrated release checkpoint.

```text
node --max-old-space-size=128 --test --test-isolation=none --test-concurrency=1 --test-reporter=tap apps/gateway/sources/bill-text/test/handler.test.mjs apps/worker/conversation/reads/test/bill-text.test.mjs scripts/scope-ledger/source-exposure.test.mjs
```

Saved supervisor enforced 120s hard wall, one process and no isolation children.
Fresh commit headroom was 3,175,424,000B; duration 1531.2464ms; observed peak working set
122,114,048B is a sample, not a guarantee. PID 34404 ended; primary 0 / cleanup 0; no owned
process remains. TAP SHA256:
`3470ac84bd5c21ee4ff359d67caaff55022e9bfe577ad2282824a70a31900adc`.
Execution receipt and original TAP are retained outside Git as
`read-bill-final-test-674460a5.{stdout,stderr,execution.json}`.

Failures remain preserved: first `3e6e1cd0`15/24, primary 1 / cleanup 0 (eight fixture
configuration failures and one audience classification failure); corrected `83fbf3c3`
24/24. Source ledger `7160b717`14/15, primary 1 / cleanup 0 exposed single-item array
serialization; corrected `db479ba7`15/15. The final41-case run also verifies the
subsequent sanitized publication and canonical LF source bytes. No failure was erased
or replaced by a pass claim. Scope refreshes exited0 with cleanup0.

## Proof-row custody

Historical manifests remain byte-identical. Candidate h still has six mismatched
rows and 39 equal rows; this batch changes none of its 45 rows. Those existing six
mismatches remain HOLD. Source delta evidence records all 14 modified existing path
with old/new Git blob and SHA256, plus all candidate comparisons, in
`READS-BILL-TEXT-PROOF-DELTA-v2.json`; SHA256 `fd58f80b499cac77fcc49fcbcf4cc4f8e944e609ca85197b3db67f9d1a355e09`; its earlier version is preserved.

The common measured `general-reads/integration.mjs` changes from SHA256
`998f9be19192d404592374930e5102cc3c3861666a7a067c93d86e184ca1e0a9` to
`3e2de817cce3c4d5146a1f5f86c0856614f3a9c0817539cbd70a3d02a405031e`.
All 14 preceding family handler-source identities therefore change; existing
installation receipts cannot qualify these bytes. Bill-text is the 15th adapter
module. The canonical audit CSV remains SHA256
`42dc47fb19a326bb2ed0b45c03f293ea27478a004e29916741aabeecb38977a1`.

## Parallel allocations and remaining gates

Both allocations start from Meri `fb708d231c7273f86b1462c72a72e70ccc36a3d6` and
read actual Core `b525032222515d636b0dae2d46e40c7c3d8b5528` through the published map.

- Public reports: exclusive `apps/gateway/sources/public-reports/**` and
  `apps/gateway/general-reads/families/public-reports.mjs`; three fixed native POST
  producers `search_cbo_cost_estimates`, `search_gao_reports`, `search_crs_reports`.
  Compare frozen receiving fields first; preserve raw JSON DTO and pagination.
- Acquisition: exclusive `apps/gateway/sources/acquisition-personnel/**` and
  `apps/gateway/general-reads/families/acquisition-personnel.mjs`; finite POST wrappers
  `search_acquisition_personnel` and `get_acquisition_person`. Preserve native DTO,
  audit effects, actual current `ctx.role` PII gate and supersession policy. Missing
  genuine role/context or credential owner remains unavailable.

READS integration owner retains all shared registration, dispatch context/result/tool
seams, worker family map, shared fixtures/counts, adapter inventory and ledger edits.
Workers return new module exports, exact context needs and reviewed small pins; they
do not edit shared files or frozen contracts. No additional session was created here.

Actual availability still requires genuine CONTROL native credential ownership and
principal relation, captured context, strict native authentication qualification,
current exact installation/discovery receipts, task transport and reviewed integration.
No credentials/material, native calls, migrations, deployment or activation is requested
or inferred. No new endpoint or migration contract is needed for these two producers.
