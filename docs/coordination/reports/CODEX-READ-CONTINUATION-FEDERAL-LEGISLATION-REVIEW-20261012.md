# Independent federal legislation review

**ACCEPT_SOURCE** for `b6d446a488e81f838f41095028f714b215d070de`
(tree `6ff3e81a9a843343e70f2475745342659a5e565a`), with metadata-only author
head `d9fbf8bd2c76d6b1804b83b7adbaff6efbac994d`
(tree `767afcc88d5b2c08308c9b8cb23d74a5dd675434`). Native execution,
source connectivity and runtime acceptance remain **HOLD / UNRUN**.

Base is `bcf36777b6f3fab94bec144c129e9143c18c8857`. Dedicated worktree
`/workspace/meri-federal-legislation-review-20261012`, branch
`review/meri-federal-legislation-20261012`. Review paths alone were authored here;
the exact author source/evidence were merged for replay. No production repair,
private source execution or publication was performed by this reviewer.

## Scope and independent source trace

Reviewed the private `get_bill_status` and `search_floor_votes` schema/factory,
their new focused tests and the root-allocated `congressional-identity.mjs` shared
selector. The real second bill-text caller justifies that helper allocation;
this verdict covers its primitive selector contract, not that other family's
implementation. The factory reuses canonical inert `snapshotOperationData` and
has no source query, ambient calendar, member resolver or authorization engine.
Root owns canonical registration and unavailable descriptors.

Criteria were committed before candidate acceptance. Six relevant private blobs
were independently hashed at `fd8765ec01d292013758606204f2c9d886cd31c1`; all are
unchanged at observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`.
`reference-identities.json` records paths, blobs, byte counts and SHA256 values.
The service, shared definitions, Prisma models, existing bill-status tests,
controller and roles guard establish the request/projection/entry boundaries.
Only source metadata and derived new contract behavior are retained; private
bodies were neither imported, executed nor copied into the packet.

The review confirms the following limits and distinctions:

- Bill invalid-request, unavailable and available branches retain distinct owner,
  identity, refusal and warning fields. Stored `congress` is a separate column
  from the selected bill ID; the producer does not prove those values agree.
- Explicit trusted positive-Int32 `defaultCongress` is required. The original
  calendar helper uses local `getFullYear`; source adapter derivation remains
  unqualified. Canonical/explicit-Congress selectors take precedence. Canonical
  IDs retain leading zeroes, while designation numbers normalize them. There is
  no ambient calendar fallback or model-supplied authority field.
- Bill windows are 15 recent actions, 15 bill floor votes and 3 votes per linked
  rule, descending by their stored timestamps with ties allowed. Governing-rule
  votes remain separate from bill votes and never recompute status. The new
  10,000 array and string transport ceilings are admission bounds, not observed
  producer query limits or completeness claims.
- Signed stored Int values, nulls and opaque JSON party totals are retained;
  tally sums, result, status or source truth are not inferred. SQL date-only
  latest action requires midnight UTC serialization; general timestamps retain
  time. Projection validation does not authenticate freshness.
- Floor returned count equals the bounded returned rows, not a global total.
  Invalid bill/chamber selectors become absent filters as in the pinned source.
  Truthy numeric conversion and explicitly narrower Int32/type admission are
  documented. No JavaScript substring test replaces source query semantics.
- No-match, ambiguous and resolved member branches remain distinct. Canonical
  identity matches are enforced where supplied; name resolution is not recreated.
  Several Bioguide/LIS position rows may be returned. Empty nested positions for
  a resolved-member vote are withheld as a fail-closed correlation, not claimed
  impossible under native relation-read races.
- The stored methods are global reads with no per-row tenant proof. Legacy entry
  roles do not supply Meri authority. Current actor/tenant/source entitlement,
  source query identity, calendar/member resolution, budgets, cancellation and
  release checks remain qualified adapter/gateway obligations.

## Preserved failures and narrow repair

Original independent controls produced **20 PASS / 3 FAIL**. Two synthetic
fixtures used generic notes instead of exact contract refusal/warning strings.
The third imposed unsupported bill-ID/stored-Congress equality. Those original
assertions and raw outputs remain in the criteria/control ancestry. Corrections
preserve missing/wrong-note and actual selected-identity negatives. The expanded
characterization then passed **25/25**. These are reviewer assumption corrections,
not source fixes or concealed passing negatives.

Further private metadata inspection found a genuine candidate gap: the pinned
status label helper tests membership with `in` on an ordinary object, so inherited
names such as `constructor` yield an omitted wire label. The candidate's own-key
fallback invented a string label. The independent negative produced **25 PASS /
1 FAIL**; `prototype-label-source/**`, its hashes and raw streams preserve that
exact new-Meri source. The author's own new control also failed **33/34** before
the narrow guard. The repair refuses inherited Object.prototype names after
inert string validation. It preserves null, empty and ordinary unknown labels,
and does not patch or execute Capiro. Missing-label projections remain refused.

`reviewer-assumption-correction.md` also preserves the initial metadata-declaration
search mistake and the earlier overbroad unknown-string examples. No private
source body appeared in the failed metadata lookup diagnostic.

## Exact checks and cleanup

- `exact-source-tests.json`: **61/61 PASS**, comprising unchanged final
  **27 independent** and **34 author** groups. It replays the exact accepted
  source, including hostile data/operation/context admission, branch and selector
  substitution, all bounded projections, ambiguity/member attribution, dates,
  ordering, nulls, opaque JSON, label refusal and shared helper primitive controls.
- `audit.json`: **78/78 PASS**. All **5,620** base files are byte-identical in
  author source, author closeout and reviewer integration. This preserves public
  contracts, all existing tests, catalog/ledger, runtime files, locks and migrations.
  The four allocated source/test files have identical bytes across exact commits
  and the replay tree. The author closeout changes only its report/evidence.
- Source whitespace passes. Raw stdout/stderr hashes and negative preimage hashes
  verify; all captured stderr streams are empty. The scoped raw evidence attributes
  preserve failed assertion bytes without whitespace rewriting.
- Owned groups **169606**, **170374**, **171126**, **173072** and **173742** were
  physically absent after their Linux subreaper captures, with no timeout or kill
  required. No other owner's process was touched. This proves only cleanup of
  these local source-check groups, not native task teardown.

Exact replay commands, from this worktree:

```sh
node --test packages/contracts/test/retrieval-federal-legislation.test.mjs packages/contracts/test/retrieval-federal-legislation-independent.test.mjs
python3 docs/qualification/candidates/read-continuation-20261012/federal-legislation-review/audit.py b6d446a488e81f838f41095028f714b215d070de d9fbf8bd2c76d6b1804b83b7adbaff6efbac994d
```

The committed capture wrapper supplies isolated process groups, raw streams and
cleanup receipts for those commands. Its evidence labels are write-once; use new
labels for any authorized rerun. Earlier prefreeze tests explicitly selected the
author worktree via `MERI_FEDERAL_REVIEW_SOURCE_ROOT`; exact replay uses local
committed source with no override.

## Remaining gates and integration handoff

This accepts a private pure source family and selector helper. It enables no
source, descriptor or runtime; no SQL, service, provider, native fixture, database,
frontend, cloud, dependency installation or paid action ran. Source authenticity,
current authority, production transport wiring and G1 native gates remain open.
Inventory accounting and separate bill-text review belong to root integration.

Preserve reviewer-only commits in order: `df23226d9a59403034fc17064f87322c9b337b33`,
`b93a54237d4233ea70d7f6d4b8aeff29ae560110`,
`76fdbcfd722211d415aafffcbfbb87446d9a6102`,
`24840eb344037220f327ad1e38544f3e3322cfbb`, then the final review closeout commit.
Do not cherry-pick review merge commits `74efa850` / `59b50f39`; root integrates
accepted author source separately. `review-manifest.json` hashes the final owned
test/report/evidence and excludes itself to avoid a circular hash.
