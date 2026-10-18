# Attached-offset independent reference review

Exact reviewed source: `f101c5072ad637af2bdb8850a9b58a466f677d59` (root reports published `b3611559` has the same production bytes; that object is not available locally for independent comparison). Production module SHA-256 `49712cef83a0ce6fd6c97fab8916165341444c3da4845b434be059cf97c8b3e6`. Node v24.19.0. No shared/source edits by reviewer.

Native reference is an actual fresh UTC process using `Date.parse(originalRawInput)`. Public results use the actual normalizer/schema/registry, separately in UTC, America/Toronto and Asia/Tokyo with NODE_TEST_CONTEXT removed. Each host: 84 assertions, 60 pass, 24 fail (12 attached-plus variants × asOf/filter). All minus/date/invalid controls pass before correction.

| Input | Native UTC reference | Current public asOf (same across 3 hosts) |
|---|---|---|
| `12:30 Jan 1 2020+0530` | `2020-01-01T07:00:00.000Z` | `2020-01-01T12:30:00.000Z` |
| `12:30 Jan 1 2020+05:30` | `2020-01-01T07:00:00.000Z` | `2020-01-01T12:30:00.000Z` |
| `12:30 Jan 1 2020+5:3` | `2020-01-01T07:27:00.000Z` | `2020-01-01T12:30:00.000Z` |
| `12:30 Jan 1+0530 2020` | `2020-01-01T07:00:00.000Z` | `2020-01-01T12:30:00.000Z` |
| `12:30 Jan 1 2020+0530 (PST)` | `2020-01-01T07:00:00.000Z` | `2020-01-01T12:30:00.000Z` |
| `12:30 Jan 1 2020(foo)+0530` | `2020-01-01T07:00:00.000Z` | `2020-01-01T07:00:00.000Z` |
| `12:30 Jan 1 2020-0530` | `2020-01-01T12:30:00.000Z` | `2020-01-01T12:30:00.000Z` |
| `12:30 Jan 1 2020-05:30` | `invalid / reject` | `reject` |
| `12:30 Jan 1 2020--0530` | `2020-01-01T18:00:00.000Z` | `2020-01-01T18:00:00.000Z` |
| `12:30 Jan-1-2020` | `2020-01-01T12:30:00.000Z` | `2020-01-01T12:30:00.000Z` |
| `12:30 2020-01-01` | `2020-01-01T12:30:00.000Z` | `2020-01-01T12:30:00.000Z` |
| `12:30 Jan 1-0530 2020` | `0530-01-01T12:30:00.000Z` | `0530-01-01T12:30:00.000Z` |

The narrow correction is asymmetric: after a recognized native clock, detect `+` followed by a digit without requiring a preceding token boundary; retain the existing boundary for `-`. Suggested existing-expression replacement: `/\+\d|(?:^|[^A-Za-z0-9])-\d/`.

Reason: native parsing accepts an attached plus as an offset, while a single minus attached to the year can remain date syntax/ignored date suffix. Do not remove the boundary from both signs. The native raw-input validity guard remains responsible for accepted spellings, comments and repeated-sign forms; e.g. double-minus after the year is unexpectedly valid in the native reference and must not be rejected by a new manual grammar.

Complete 42-case reference: `cases.json`; source `reference-cases.mjs`; UTC source receipt `reference-UTC.json`; actual public normalizer script `public-probe.mjs`; before logs `public-before-{UTC,America-Toronto,Asia-Tokyo}.log`.

Exact commands:

```sh
env -u NODE_TEST_CONTEXT TZ=UTC node /tmp/meri-date-attached-offset-review/reference-cases.mjs /tmp/meri-date-attached-offset-review/cases.json
env -u NODE_TEST_CONTEXT TZ=UTC node /tmp/meri-date-attached-offset-review/public-probe.mjs <integration-worktree>
env -u NODE_TEST_CONTEXT TZ=America/Toronto node /tmp/meri-date-attached-offset-review/public-probe.mjs <integration-worktree>
env -u NODE_TEST_CONTEXT TZ=Asia/Tokyo node /tmp/meri-date-attached-offset-review/public-probe.mjs <integration-worktree>
```

Independent review APPROVED the root-owned two-file diff: one sign-asymmetric expression with explanatory comments, exact user-case assertions on asOf and date filter paths, attached-minus date controls, and 48 additional native-reference cases (900→948). Raw-input validity, comment handling and all existing guards remain unchanged.

After production SHA-256 `0f45c40554f489c8993c71d23e297bd6fe3ab35c5e3166eee928e8c02dd576e2`: all **84/84 public assertions pass independently in each of UTC, America/Toronto and Asia/Tokyo**. Direct fresh marker-free selected TAP processes also each actually execute **2 tests, 2 pass, 0 fail, 0 skipped**, including 948 native UTC reference cases. No source edits by reviewer. After logs are `public-after-{UTC,America-Toronto,Asia-Tokyo}.log` and `selected-after-{UTC,America-Toronto,Asia-Tokyo}.tap`; exact commands, hashes and pins are in `review-evidence.json`.

This finite table is regression evidence, not a claim to exhaust the native legacy date grammar.
