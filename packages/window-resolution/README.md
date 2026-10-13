# Trusted Meri window resolution

Internal server package. The authenticated control caller owns the reference time, fiscal configuration and source authorization. Resolving a window grants no source access.

```js
import { resolveWindow } from './packages/window-resolution/index.mjs';

const window = resolveWindow(
  { basis: 'calendar-week', offset: -1, timezone: 'America/New_York', weekStartsOn: 'monday' },
  { referenceAt: '2026-10-13T12:00:00Z' },
);
// 2026-10-05T04:00:00Z <= timestamp < 2026-10-12T04:00:00Z
```

Calendar requests use the local civil date at the trusted `referenceAt`, including current/previous week, month and year. Week policy is explicit. Calendar boundaries must have a unique local midnight to satisfy the unchanged canonical retrieval contract; missing/repeated midnight returns `unrepresentable_calendar_boundary`. A skipped date inside an interval is handled by upstream timezone arithmetic. Relative days are elapsed 24-hour durations, anchored at the request's exact UTC `anchorAt`. Explicit UTC timestamps are preserved byte-for-byte. Leap-second strings that cannot be represented by the canonical JavaScript timestamp checks are refused, rather than normalized to another instant. Results are detached and frozen; input objects are not changed. No ambient clock is read.

For fiscal requests, `fiscalCalendars` is an array of trusted canonical `NormalizedWindow` records with `basis: 'fiscal-year'`. A record contains the exact `calendarId`, `year`, `stage`, `revisionId`, `timezone`, `startInclusive` and `endExclusive`. One exact identity must match. Missing records return `fiscal_window_unavailable`; duplicate/conflicting records return `fiscal_window_conflict`. There is no inferred federal calendar, stage, revision or year rollover. The caller must separately establish current access to the versioned source evidence; this package does not authorize configuration or source access.

`WindowResolutionError.code` identifies invalid reference time, unsupported window timestamps, unavailable calendar boundary and missing/conflicting fiscal windows. Existing malformed request/configuration failures are raised by the canonical contract validator. `referenceAt` must be a valid representable UTC string, including for explicit/unbounded requests, so no hidden fallback can supply server context.

Install repository dependencies and this package's pinned dependencies, then run:

```sh
npm ci --ignore-scripts --prefix packages/window-resolution
npm test --prefix packages/window-resolution
```

Dependencies: [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill) 0.5.1 (ISC), locked transitive JSBI 4.3.2 (Apache-2.0). Licenses are retained in `third-party/`. Upstream APIs: [ZonedDateTime civil arithmetic and reject disambiguation](https://tc39.es/proposal-temporal/docs/zoneddatetime.html), [Instant elapsed duration arithmetic](https://tc39.es/proposal-temporal/docs/instant.html). The polyfill is imported as a module; no global prototype/global Temporal mutation is installed. Root package and public `@capiro/meri-contracts@0.1.2` remain unchanged.

Focused author checks: 35 tests pass. Initial 34-test run had 33 passes and one import-resource assertion failure (`test/initial-results.tap.gz`): importing canonical validation lazily initialized Node standard-stream PipeWrap handles. The test now initializes standard streams before its resource baseline and waits one event-loop turn before asserting no additional resources, no global Temporal, no stdout and clean bounded child exit (`test/repaired-results.tap`). A leap-second rejection regression was added after reviewing timestamp behavior. Source/local checks do not qualify live source access, native worker execution or whole R-03/RG-02 acceptance.

The unchanged legacy retrieval glob ran with 3,217 tests: 3,213 pass and four fail (`test/legacy-retrieval-results.tap.gz`). All four assert public package version `0.1.0` while this frozen PR59 base contains `0.1.2`: mail, meeting-source, memory-proposals and operational-reads public-export checks. No calendar implementation is imported by those legacy tests; their contracts/tests were not edited. The broad run's first truncated output was reproduced once with TAP capture to retain exact failure evidence; no further legacy repeats are needed.

The first package metadata query failed with `ENOENT ... mkdir '/home/agent/.npm/_cacache'` because the host's default cache path did not exist. It succeeded using the owned `/tmp/meri-calendar-npm-cache`; no permission escalation was needed. No provider/DB/cloud writes or private source content were used. Root independently reviews and integrates this package into request normalization.

Raw failed TAP output is retained byte-exact in deterministic gzip files; generated TAP whitespace failed the initial Git whitespace check, so compression preserves the original output while keeping the source diff clean.
