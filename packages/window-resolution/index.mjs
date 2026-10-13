import { Temporal } from '@js-temporal/polyfill';
import { assertWindow, assertWindowResolution } from '../contracts/retrieval-0.2/validate.mjs';

export class WindowResolutionError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'WindowResolutionError';
    this.code = code;
  }
}

function trustedReference(referenceAt) {
  try {
    if (typeof referenceAt !== 'string' || !referenceAt.endsWith('Z') || !Number.isFinite(Date.parse(referenceAt))) {
      throw new TypeError('Representable UTC string required');
    }
    return Temporal.Instant.from(referenceAt);
  } catch (cause) {
    throw new WindowResolutionError('invalid_reference_time', 'A trusted UTC referenceAt is required', cause);
  }
}

function windowInstant(stamp) {
  try {
    if (!Number.isFinite(Date.parse(stamp))) throw new TypeError('Unrepresentable timestamp');
    return Temporal.Instant.from(stamp);
  } catch (cause) {
    throw new WindowResolutionError('invalid_window_time', 'Window timestamps must be representable UTC instants', cause);
  }
}

function calendarBoundary(date, timezone) {
  try {
    return Temporal.ZonedDateTime.from({
      timeZone: timezone, year: date.year, month: date.month, day: date.day,
      hour: 0, minute: 0, second: 0,
    }, { disambiguation: 'reject', overflow: 'reject' }).toInstant().toString();
  } catch (cause) {
    // The canonical calendar contract requires local midnight, so neither an
    // offset guess nor a shift to the first available time satisfies it.
    throw new WindowResolutionError('unrepresentable_calendar_boundary',
      `Calendar boundary ${date.toString()} has no unique local midnight in ${timezone}`, cause);
  }
}

function calendarWindow(request, reference) {
  const current = reference.toZonedDateTimeISO(request.timezone).toPlainDate();
  let start, end;
  if (request.basis === 'calendar-week') {
    const firstDay = request.weekStartsOn === 'monday' ? 1 : 7;
    start = current.subtract({ days: (current.dayOfWeek - firstDay + 7) % 7 })
      .add({ weeks: request.offset });
    end = start.add({ weeks: 1 });
  } else if (request.basis === 'calendar-month') {
    start = current.with({ day: 1 }).add({ months: request.offset });
    end = start.add({ months: 1 });
  } else {
    start = current.with({ month: 1, day: 1 }).add({ years: request.offset });
    end = start.add({ years: 1 });
  }
  return {
    basis: request.basis,
    startInclusive: calendarBoundary(start, request.timezone),
    endExclusive: calendarBoundary(end, request.timezone),
    timezone: request.timezone,
    weekStartsOn: request.basis === 'calendar-week' ? request.weekStartsOn : null,
  };
}

function fiscalWindow(request, fiscalCalendars) {
  if (!Array.isArray(fiscalCalendars)) throw new TypeError('fiscalCalendars must be an array of canonical fiscal-year windows');
  const identity = ['calendarId', 'year', 'stage', 'revisionId', 'timezone'];
  const matches = [];
  for (const candidate of fiscalCalendars) {
    assertWindow(candidate);
    if (candidate.basis !== 'fiscal-year') throw new TypeError('fiscalCalendars contains a non-fiscal window');
    windowInstant(candidate.startInclusive);
    windowInstant(candidate.endExclusive);
    if (identity.every(field => candidate[field] === request[field])) matches.push(candidate);
  }
  if (matches.length === 0) {
    throw new WindowResolutionError('fiscal_window_unavailable', 'No exact trusted fiscal calendar, year, stage, revision and timezone match');
  }
  if (matches.length !== 1) {
    throw new WindowResolutionError('fiscal_window_conflict', 'Multiple trusted windows match the requested fiscal identity');
  }
  return { ...matches[0] };
}

/** Resolve a request using trusted server context; never reads an ambient clock. */
export function resolveWindow(request, { referenceAt, fiscalCalendars = [] } = {}) {
  assertWindow(request, { requested: true });
  const reference = trustedReference(referenceAt);
  let normalized;
  switch (request.basis) {
    case 'calendar-week':
    case 'calendar-month':
    case 'calendar-year':
      normalized = calendarWindow(request, reference);
      break;
    case 'relative-duration':
      normalized = {
        basis: request.basis,
        startInclusive: windowInstant(request.anchorAt).subtract({ hours: request.days * 24 }).toString(),
        endExclusive: request.anchorAt,
        timezone: request.timezone,
        weekStartsOn: null,
      };
      break;
    case 'explicit':
      windowInstant(request.startInclusive);
      windowInstant(request.endExclusive);
      normalized = {
        basis: request.basis,
        startInclusive: request.startInclusive,
        endExclusive: request.endExclusive,
        timezone: request.timezone,
        weekStartsOn: null,
      };
      break;
    case 'fiscal-year':
      normalized = fiscalWindow(request, fiscalCalendars);
      break;
    case 'unbounded':
      normalized = { basis: 'unbounded' };
      break;
  }
  return Object.freeze(assertWindowResolution(request, normalized));
}
