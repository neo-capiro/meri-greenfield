# Query date offset correction — 2026-10-18

> Later attached-plus correction: [exact `12:30 Jan 1 2020+0530` follow-up](integration-evidence-20261018/attached-date-offset/README.md). The earlier900-case result here did not cover this form; it now has an exact three-timezone regression and an expanded948-case reference matrix.

The PR186 queryDate implementation incorrectly replaced valid explicit offsets when a meridiem preceded the offset or a year followed it. Both independently reported cases now preserve the native instant, **2020-01-01T17:30:00.000Z**, in public as-of selectors and date filters on UTC, America/Toronto and Asia/Tokyo:

| Accepted input | PR186 `4d821476` | Corrected result |
| --- | --- | --- |
| `January 1, 2020 12:30 PM -0500` | `2020-01-01T12:30:00.000Z` | `2020-01-01T17:30:00.000Z` |
| `Jan 1 12:30:00 -0500 2020` | `2020-01-01T12:30:00.000Z` | `2020-01-01T17:30:00.000Z` |

Corrected source: published **`3e0dbe243f734602ad9df0264939d3b8cd4fea9a`**, equivalent reviewed local **`497b5358a7f64da312e52400fa7d1770535fc28e`**, complete tree **`1bffb4eb1efd7361f870931f4e7702a37bcd6490`**. Connected publication recreates commit metadata; the complete tree was verified identical. This source commit is directly above published PR186 `4d82147624cba329ffc5ade1bb027838a4e37474`, with only the two allocated validator/test paths changed. The source correction is consolidated from the final reviewed diff; intermediate failed review candidates are evidence, not individually published source checkpoints.

The correction keeps `Date.parse(raw)` as the validity and explicit-instant authority. Detection recognizes accepted signed offset tokens after the clock, including meridiem/year/punctuation placement and native legacy offset spellings. It accounts for native named-zone token order, digit-adjacent zone words and comment separators, and recognizes admitted signed-six-digit local ISO years. Unzoned inputs retain the UTC contract; invalid inputs still refuse. No parser package, dependency, wire version or unrelated PR186 repair changed.

## Corrected verification gap

The old three-timezone child check inherited `NODE_TEST_CONTEXT` from its parent runner. Node warned that recursive test files were being skipped and exited zero without executing the intended child checks. The earlier 4,391-test standard result is preserved as a real outer-suite result, but the earlier 132-case three-host claim did not establish child execution and is superseded here. This was a test harness defect; it must not be treated as a passing control.

The new child environment removes only that marker. Every timezone child must report **exactly two tests executed, two passes and zero failures**. Independent direct fresh-child runs verified those counts and zero skips in each timezone. These checks include **900 native UTC-parser reference tuples**, plus explicit user cases, signed-year, named-prefix, token-boundary, punctuation, nested/unclosed-comment and invalid-input controls.

At exact local `497b5358`, independent public normalizer probes pass **104/104 assertions per timezone**, covering both public as-of and date-filter inputs. The focused query suite passes **27/27**; the owner query/gateway group passes **47/47**. Counts overlap and are not additive. Before the fix, the expanded meaningful regression group reproduced **24 passed / 3 failed**; both reported examples returned the wrong instant in selectors and filters on all three hosts. Failed intermediate offset/year/named-zone/comment controls and the initial dependency-resolution failure are preserved in the [scrubbed evidence manifest](query-date-offset-evidence-20261018/evidence-manifest.json).

Environment: Node **v24.19.0**, npm **11.9.0**, `NODE_OPTIONS` unset. Exact matching locked contracts dependencies were reused; no lockfile changed. The direct review additionally removes `NODE_TEST_CONTEXT` before child execution.

```sh
env -u NODE_OPTIONS TZ=America/Toronto node --test packages/contracts/test/retrieval-public-domain-query.test.mjs apps/gateway/sources/public-domain-query/test/handler.test.mjs apps/gateway/sources/public-domain-query/test/native-result.test.mjs
# Run once for each TZ: UTC, America/Toronto, Asia/Tokyo
env -u NODE_OPTIONS -u NODE_TEST_CONTEXT TZ=UTC node --test --test-reporter=tap --test-name-pattern='^(trusted default as-of is distinct from explicit date and generatedAt|legacy explicit query dates preserve the native UTC parser reference)$' packages/contracts/test/retrieval-public-domain-query.test.mjs
```

[Detailed owner review, pins, commands and before/after logs](query-date-offset-evidence-20261018/REVIEW.json). The independent public probe is retained alongside its full failed and passing outputs; its checkout argument replaces the displayed `<workspace>` placeholder. Evidence digests cover published scrubbed bytes. Source whitespace passes.

This urgent two-file correction does not re-run or replace the whole integration qualification. The integration owner is receiving the corrected source alongside PR181/183/185 and document dependencies, then runs the combined checks on the stabilized candidate. Core/source handoff, actual native startup, private owner transport and final image/live acceptance remain separately held. No merge, deployment, migration, credentials, AWS mutation or paid model/provider call occurred. PR175 remains unchanged.
