import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolveWindow, WindowResolutionError } from '../index.mjs';

const context = { referenceAt: '2026-10-13T12:00:00Z' };
const week = (offset = 0, weekStartsOn = 'monday', timezone = 'America/New_York') =>
  ({ basis: 'calendar-week', offset, timezone, weekStartsOn });
const expected = (request, startInclusive, endExclusive) => ({
  basis: request.basis, startInclusive, endExclusive, timezone: request.timezone,
  weekStartsOn: request.basis === 'calendar-week' ? request.weekStartsOn : null,
});

for (const [name, request, referenceAt, start, end] of [
  ['current Monday week', week(), '2026-10-13T12:00:00Z', '2026-10-12T04:00:00Z', '2026-10-19T04:00:00Z'],
  ['previous Monday week', week(-1), '2026-10-13T12:00:00Z', '2026-10-05T04:00:00Z', '2026-10-12T04:00:00Z'],
  ['current Sunday week', week(0, 'sunday'), '2026-10-13T12:00:00Z', '2026-10-11T04:00:00Z', '2026-10-18T04:00:00Z'],
  ['Sunday belongs to the previous Monday week', week(), '2026-10-12T03:59:59Z', '2026-10-05T04:00:00Z', '2026-10-12T04:00:00Z'],
  ['exact Monday boundary belongs to the current week', week(), '2026-10-12T04:00:00Z', '2026-10-12T04:00:00Z', '2026-10-19T04:00:00Z'],
  ['spring DST week has 167 elapsed hours', week(), '2026-03-08T07:30:00Z', '2026-03-02T05:00:00Z', '2026-03-09T04:00:00Z'],
  ['fall DST week has 169 elapsed hours', week(), '2026-11-01T06:30:00Z', '2026-10-26T04:00:00Z', '2026-11-02T05:00:00Z'],
  ['month is based on local date before UTC rollover', { basis: 'calendar-month', offset: 0, timezone: 'America/Los_Angeles' }, '2026-01-01T02:00:00Z', '2025-12-01T08:00:00Z', '2026-01-01T08:00:00Z'],
  ['previous month across year rollover', { basis: 'calendar-month', offset: -1, timezone: 'Etc/UTC' }, '2026-01-15T12:00:00Z', '2025-12-01T00:00:00Z', '2026-01-01T00:00:00Z'],
  ['leap February', { basis: 'calendar-month', offset: -1, timezone: 'Etc/UTC' }, '2024-03-31T12:00:00Z', '2024-02-01T00:00:00Z', '2024-03-01T00:00:00Z'],
  ['current year uses local year', { basis: 'calendar-year', offset: 0, timezone: 'Pacific/Kiritimati' }, '2025-12-31T12:00:00Z', '2025-12-31T10:00:00Z', '2026-12-31T10:00:00Z'],
  ['previous year includes leap day', { basis: 'calendar-year', offset: -1, timezone: 'Etc/UTC' }, '2025-10-13T12:00:00Z', '2024-01-01T00:00:00Z', '2025-01-01T00:00:00Z'],
  ['half-hour DST transition', week(0, 'monday', 'Australia/Lord_Howe'), '2026-10-04T04:00:00Z', '2026-09-27T13:30:00Z', '2026-10-04T13:00:00Z'],
  ['skipped civil date inside a week', week(0, 'monday', 'Pacific/Apia'), '2011-12-29T12:00:00Z', '2011-12-26T10:00:00Z', '2012-01-01T10:00:00Z'],
]) {
  test(name, () => assert.deepEqual(resolveWindow(request, { referenceAt }), expected(request, start, end)));
}

test('repeated fall hour is unambiguous when the trusted reference is an instant', () => {
  assert.deepEqual(resolveWindow(week(), { referenceAt: '2026-11-01T05:30:00Z' }),
    resolveWindow(week(), { referenceAt: '2026-11-01T06:30:00Z' }));
});

test('a non-existent midnight boundary is refused without shifting the week', () => {
  assert.throws(() => resolveWindow(week(0, 'sunday', 'America/Sao_Paulo'), {
    referenceAt: '2018-11-05T12:00:00Z',
  }), error => error instanceof WindowResolutionError && error.code === 'unrepresentable_calendar_boundary');
});

test('an ambiguous midnight boundary is refused without selecting an offset', () => {
  assert.throws(() => resolveWindow({ basis: 'calendar-month', offset: 0, timezone: 'America/Havana' }, {
    referenceAt: '2020-11-15T12:00:00Z',
  }), error => error instanceof WindowResolutionError && error.code === 'unrepresentable_calendar_boundary');
});

test('relative days stay elapsed 24-hour durations through DST', () => {
  const request = { basis: 'relative-duration', days: 7, anchorAt: '2026-03-09T03:30:00.125Z', timezone: 'America/New_York' };
  assert.deepEqual(resolveWindow(request, context), expected(request, '2026-03-02T03:30:00.125Z', request.anchorAt));
});

test('explicit timestamps are preserved byte-exact, without calendar reinterpretation', () => {
  const request = { basis: 'explicit', startInclusive: '2026-01-01T00:00:00.000Z', endExclusive: '2026-02-01T00:00:00.000Z', timezone: 'America/New_York' };
  assert.deepEqual(resolveWindow(request, context), expected(request, request.startInclusive, request.endExclusive));
});

test('unbounded is explicit and immutable', () => {
  const request = { basis: 'unbounded' };
  const result = resolveWindow(request, context);
  assert.deepEqual(result, request);
  assert.notEqual(result, request);
  assert.ok(Object.isFrozen(result));
});

const fiscal = {
  basis: 'fiscal-year', year: 2027, calendarId: 'us-federal', stage: 'requested', revisionId: 'fy27-request-v1',
  timezone: 'America/New_York', startInclusive: '2026-10-01T04:00:00Z', endExclusive: '2027-10-01T04:00:00Z',
};
const fiscalRequest = Object.fromEntries(Object.entries(fiscal).filter(([key]) => !['startInclusive', 'endExclusive'].includes(key)));

test('fiscal identity preserves exact year, calendar, stage, revision and bounds', () => {
  const otherStage = { ...fiscal, stage: 'authorized', revisionId: 'fy27-law-v1' };
  const otherVersion = { ...fiscal, revisionId: 'fy27-request-v2' };
  const result = resolveWindow(fiscalRequest, { ...context, fiscalCalendars: [otherStage, fiscal, otherVersion] });
  assert.deepEqual(result, fiscal);
  assert.notEqual(result, fiscal);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(fiscalRequest, { basis: 'fiscal-year', year: 2027, calendarId: 'us-federal', stage: 'requested', revisionId: 'fy27-request-v1', timezone: 'America/New_York' });
});

for (const [field, value] of [
  ['year', 2028], ['calendarId', 'state-florida'], ['stage', 'actual'], ['revisionId', 'latest'], ['timezone', 'Etc/UTC'],
]) {
  test(`fiscal ${field} substitution is unavailable, never inferred`, () => {
    assert.throws(() => resolveWindow({ ...fiscalRequest, [field]: value }, { ...context, fiscalCalendars: [fiscal] }),
      error => error.code === 'fiscal_window_unavailable');
  });
}

test('missing fiscal configuration is disclosed as unavailable', () => {
  assert.throws(() => resolveWindow(fiscalRequest, context), error => error.code === 'fiscal_window_unavailable');
});

test('duplicate fiscal records are refused even with equal bounds', () => {
  assert.throws(() => resolveWindow(fiscalRequest, { ...context, fiscalCalendars: [fiscal, { ...fiscal }] }),
    error => error.code === 'fiscal_window_conflict');
});

test('conflicting fiscal bounds for one identity are refused', () => {
  assert.throws(() => resolveWindow(fiscalRequest, { ...context, fiscalCalendars: [fiscal, { ...fiscal, endExclusive: '2027-09-01T04:00:00Z' }] }),
    error => error.code === 'fiscal_window_conflict');
});

test('malformed trusted fiscal configuration cannot supply a window', () => {
  assert.throws(() => resolveWindow(fiscalRequest, { ...context, fiscalCalendars: {} }), /must be an array/);
  assert.throws(() => resolveWindow(fiscalRequest, { ...context, fiscalCalendars: [{ basis: 'unbounded' }] }), /non-fiscal/);
  assert.throws(() => resolveWindow(fiscalRequest, { ...context, fiscalCalendars: [{ ...fiscal, endExclusive: fiscal.startInclusive }] }), /increase/);
  assert.throws(() => resolveWindow(fiscalRequest, { ...context, fiscalCalendars: [{ ...fiscal, claimedAuthority: true }] }), /NormalizedWindow/);
});

test('referenceAt is required, UTC and valid; ambient time cannot substitute', () => {
  for (const referenceAt of [undefined, null, new Date(), '2026-10-13T12:00:00-04:00', 'yesterday', '2026-02-30T12:00:00Z', '2026-12-31T23:59:60Z']) {
    assert.throws(() => resolveWindow(week(), { referenceAt }), error => error.code === 'invalid_reference_time');
  }
  assert.throws(() => resolveWindow({ basis: 'unbounded' }), error => error.code === 'invalid_reference_time');
});

test('leap-second timestamps are refused rather than normalized to a different instant', () => {
  const request = { basis: 'explicit', startInclusive: '2026-12-31T23:59:60Z', endExclusive: '2027-01-02T00:00:00Z', timezone: 'Etc/UTC' };
  assert.throws(() => resolveWindow(request, context), error => error.code === 'invalid_window_time');
  assert.throws(() => resolveWindow(fiscalRequest, { ...context, fiscalCalendars: [{ ...fiscal, startInclusive: '2026-12-31T23:59:60Z' }] }),
    error => error.code === 'invalid_window_time');
});

test('invalid timezone, offsets, policy, duration and free-form fields are rejected by canonical contracts', () => {
  for (const request of [
    { ...week(), timezone: 'Mars/Olympus' }, { ...week(), offset: 1 }, { ...week(), weekStartsOn: 'tuesday' },
    { ...week(), referenceAt: '2026-01-01T00:00:00Z' },
    { basis: 'relative-duration', days: 0, anchorAt: context.referenceAt, timezone: 'Etc/UTC' },
    { basis: 'relative-duration', days: 3661, anchorAt: context.referenceAt, timezone: 'Etc/UTC' },
    { basis: 'explicit', startInclusive: context.referenceAt, endExclusive: context.referenceAt, timezone: 'Etc/UTC' },
    { basis: 'unbounded', timezone: 'Etc/UTC' },
  ]) assert.throws(() => resolveWindow(request, context));
});

test('resolution leaves request and trusted configuration untouched and returns a frozen object', () => {
  const request = Object.freeze(week());
  assert.ok(Object.isFrozen(resolveWindow(request, Object.freeze(context))));
  assert.equal(request.offset, 0);
  const trusted = Object.freeze([Object.freeze({ ...fiscal })]);
  assert.deepEqual(resolveWindow(Object.freeze(fiscalRequest), { ...context, fiscalCalendars: trusted }), fiscal);
});

test('package import creates no timers, connections, global Temporal or output', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    "void process.stdout; void process.stderr; const before = process.getActiveResourcesInfo(); await import('./index.mjs'); await new Promise(resolve => setImmediate(resolve)); if ('Temporal' in globalThis) throw new Error('global mutation'); if (JSON.stringify(before) !== JSON.stringify(process.getActiveResourcesInfo())) throw new Error('new active resource');"],
  { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});
