import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../validate.mjs';
import {
  assertCatalog, assertSkillManifest, assertUpcomingMeetingsInput, assertUpcomingMeetingsPage,
  assertDebriefReadInput, assertDebriefSourcePage, assertClientMeetingReadInput,
  assertClientMeetingInventoryPage, assertClientMeetingSourceBodyPage,
} from '../retrieval-0.2/validate.mjs';

// Literal synthetic DATA only. No handlers, real identities, calendars or source access.
const uuid = '11111111-1111-4111-8111-111111111111';
const clientId = 'client-synthetic';
const meetingId = '22222222-2222-4222-8222-222222222222';
const noteId = '33333333-3333-4333-8333-333333333333';
const transcriptId = '44444444-4444-4444-8444-444444444444';
const nowMs = Date.parse('2026-01-02T00:00:00.000Z');
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

// Inspect the unchanged private schema while exercising the canonical composed validators.
const meetingSchema = JSON.parse(readFileSync(new URL('../retrieval-0.2/meeting-source.schema.json', import.meta.url)));

const binding = () => ({ tenantId: 'synthetic', actorId: 'reader', conversationId: uuid, runId: uuid, attemptId: uuid, workerId: uuid, writerFence: 1 });
const scope = (resourceId = clientId) => ({ tenantId: 'synthetic', kind: 'client', resourceId, policyRevision: 'policy-v1' });
const clientSubject = () => ({ kind: 'client', entityType: 'client', entityIds: [clientId], tenantId: 'synthetic', actorId: 'reader', authorizationDecisionId: uuid, policyRevision: 'policy-v1', scopes: [scope(clientId)], rosterVersionId: null });
const personalSubject = () => ({ kind: 'personal', entityType: 'user', entityIds: ['reader'], tenantId: 'synthetic', actorId: 'reader', authorizationDecisionId: uuid, policyRevision: 'policy-v1', scopes: [{ tenantId: 'synthetic', kind: 'private-user', resourceId: 'reader', policyRevision: 'policy-v1' }], rosterVersionId: null });
const sources = () => [{ sourceId: 'meeting', authority: 'authoritative', snapshotVersionId: null, adapterVersion: '0.2.0', status: 'partial', synchronizedAt: null, asOf: null, retrievedAt: '2026-01-01T00:00:00Z', freshness: 'unknown' }];
const coverage = (over = {}) => ({ sourcesRequested: ['meeting'], sourcesChecked: ['meeting'], sourcesUnavailable: [], enumeration: 'unknown', enumerableTotal: null, returnedCount: 0, truncated: true, historySupport: 'bounded', limitations: ['Synthetic pending meeting transport; snapshot and record immutability unknown.'], ...over });
const continuation = (requiredReads = []) => ({ cursor: null, requiredReads, remainingSources: [] });
const envelope = (kind, operation, selection, over) => ({
  kind, contractVersion: '0.2.0', operation: { id: operation, version: '0.2.0' },
  requestId: uuid, traceId: uuid, binding: binding(), subject: clientSubject(), window: { basis: 'unbounded' },
  argumentsSha256: canonicalSha256(over.selection ?? selection), appliedFilters: [], sources: sources(),
  coverage: coverage({ returnedCount: over.returnedCount ?? 0, truncated: over.truncated ?? true }),
  selection, continuation: continuation(over.requiredReads ?? []), evidenceReady: false, negativeAssertion: { kind: 'none' },
});

// ---------------------------------------------------------------- calendar inventory
const upcomingInput = (over = {}) => ({ ...over });
function upcomingPage(input = {}, over = {}) {
  const options = { nowMs };
  const selection = assertUpcomingMeetingsInput(input, options);
  const from = new Date(nowMs).toISOString();
  const to = new Date(nowMs + selection.withinDays * 86400000).toISOString();
  const page = {
    ...envelope('meeting-upcoming-page', 'meeting.list_upcoming_meetings', selection, { ...over, returnedCount: (over.meetings ?? []).length }),
    order: 'startsAt-asc_nulls-and-ties-unspecified', snapshotVersionId: null,
    calendarWindow: { from, to, withinDays: selection.withinDays }, meetings: over.meetings ?? [], count: (over.meetings ?? []).length,
  };
  page.coverage.truncated = page.meetings.length === selection.limit;
  if (input.clientId) page.subject = clientSubject(); else page.subject = personalSubject();
  return page;
}
const upcomingRow = over => ({ id: meetingId, subject: 'Synthetic review', startsAt: '2026-01-03T10:00:00.000Z', endsAt: '2026-01-03T11:00:00.000Z', location: null, isVirtual: true, joinLink: 'https://invalid.example/join', status: 'scheduled', isInternal: false, organizer: 'synthetic@example.invalid', client: { id: clientId, name: 'Synthetic Client' }, attendees: [{ name: 'Person', email: 'person@example.invalid', role: 'required', responseStatus: 'accepted' }], ...over });

test('upcoming calendar inventory materializes verified defaults without mutating strict input', () => {
  const value = upcomingInput(), copy = structuredClone(value);
  assert.deepEqual(assertUpcomingMeetingsInput(value, { nowMs }), { clientId: null, limit: 10, withinDays: 30 });
  assert.deepEqual(value, copy);
  assert.deepEqual(assertUpcomingMeetingsInput({ clientId, limit: 25, withinDays: 365 }, { nowMs }), { clientId, limit: 25, withinDays: 365 });
});
test('upcoming calendar inventory rejects coercion, extra authority, bounds and missing trusted clock', () => {
  for (const patch of [{ limit: '10' }, { limit: null }, { limit: 0 }, { limit: 26 }, { withinDays: 0 }, { withinDays: 366 }, { withinDays: 1.5 }, { clientId: 'x'.repeat(37) }, { cursor: 'invented' }, { subject: { kind: 'client', entityId: clientId } }, { tenantId: 'other' }]) {
    assert.throws(() => assertUpcomingMeetingsInput({ ...upcomingInput(), ...patch }, { nowMs }));
  }
  assert.throws(() => assertUpcomingMeetingsInput(upcomingInput()), /nowMs/);
  assert.throws(() => assertUpcomingMeetingsInput(upcomingInput(), { nowMs, previousPage: null }), /context/);
});
test('bounded calendar page counts returned rows and never claims whole history', () => {
  assertUpcomingMeetingsPage(upcomingPage(), upcomingInput(), { nowMs });
  assertUpcomingMeetingsPage(upcomingPage({ clientId, limit: 1, withinDays: 30 }, { meetings: [upcomingRow()] }), { clientId, limit: 1, withinDays: 30 }, { nowMs });
  for (const edit of [
    p => { p.count = 2; }, p => { p.coverage.returnedCount = 2; }, p => { p.calendarWindow.to = new Date(nowMs + 31 * 86400000).toISOString(); },
    p => { p.calendarWindow.from = new Date(nowMs + 7200000).toISOString(); }, p => { p.calendarWindow.withinDays = 31; },
    p => { p.meetings[0].startsAt = '2026-03-01T00:00:00.000Z'; }, p => { p.meetings[0].id = meetingId; p.meetings.push(structuredClone(p.meetings[0])); },
    p => { p.meetings = []; p.count = 0; p.coverage.returnedCount = 0; p.coverage.truncated = false; p.coverage.enumeration = 'partial'; }, p => { p.evidenceReady = true; }, p => { p.negativeAssertion = { kind: 'absence' }; },
  ]) {
    const good = upcomingPage({ limit: 1, withinDays: 30 }, { meetings: [upcomingRow()] }), target = { ...good, coverage: structuredClone(good.coverage), meetings: good.meetings.map(row => structuredClone(row)), calendarWindow: { ...good.calendarWindow } };
    edit(target); assert.throws(() => assertUpcomingMeetingsPage(target, { limit: 1, withinDays: 30 }, { nowMs }));
  }
  const exact = upcomingPage({ limit: 1, withinDays: 30 }, { meetings: [upcomingRow()] });
  exact.coverage.truncated = false; assert.throws(() => assertUpcomingMeetingsPage(exact, { limit: 1, withinDays: 30 }, { nowMs }), /truncation/);
  const empty = upcomingPage(); empty.coverage.enumeration = 'partial'; assert.throws(() => assertUpcomingMeetingsPage(empty, upcomingInput(), { nowMs }), /Empty calendar/);
});

// ---------------------------------------------------------------- debriefs
const debriefRow = (body, over = {}) => ({
  id: noteId, meetingId, clientId, meeting: { id: meetingId, clientId, subject: 'Synthetic review', startsAt: '2026-01-03T10:00:00.000Z' },
  body, status: 'approved', authorUserId: 'reader', author: { id: 'reader', email: 'synthetic@example.invalid', firstName: null, lastName: null },
  createdAt: '2026-01-03T12:00:00.000Z', updatedAt: '2026-01-03T13:00:00.000Z',
  bodyCoverage: { characterStart: 0, characterEnd: body.length, totalCharacters: body.length, complete: true, pageComplete: true, truncated: false, nextCursor: null, note: 'This is the complete exact debrief body.' },
  provenance: { sourceTable: 'meeting_debriefs', sourceRecordId: noteId, sourceVersion: '2026-01-03T13:00:00.000Z', parentMeetingId: meetingId, currentClientId: clientId, bodySha256: sha256(body), returnedBodySha256: sha256(body) },
  ...over,
});
function debriefPage(input, over = {}) {
  const { selection } = assertDebriefReadInput(input);
  const { rows = [debriefRow('complete debrief body')], pageCoverage: pc = {}, coverage: cov = {}, requiredReads = [] } = over;
  const bodyCoverageComplete = rows.every(row => row.bodyCoverage.complete);
  const exact = selection.debriefId !== null;
  const nextCursor = exact ? (rows[0]?.bodyCoverage.nextCursor ?? null) : (pc.nextCursor ?? null);
  const paginationComplete = exact ? true : nextCursor === null;
  const sourceStatus = pc.sourceStatus ?? 'healthy';
  const complete = sourceStatus === 'healthy' && !pc.cursorApplied && paginationComplete && bodyCoverageComplete;
  return {
    ...envelope('debrief-source-page', 'meeting.query_debriefs', selection, { returnedCount: rows.length, truncated: cov.truncated ?? !complete }),
    order: 'createdAt-asc_id-asc_cursor-key-owner-unconfirmed', snapshotVersionId: null,
    scope: { debriefId: selection.debriefId, from: selection.from, to: selection.to, timeField: 'meeting.startsAt', statusEligibility: 'approved_only', characterOffset: exact ? selection.characterOffset : null, characterLimit: selection.characterLimit, listLimit: selection.limit, cursorApplied: pc.cursorApplied ?? false },
    pageCoverage: { sourceStatus, sourceReason: pc.sourceReason ?? (sourceStatus === 'healthy' ? null : 'owner_query_degraded'), pageComplete: sourceStatus === 'healthy', complete, partial: !complete, paginationComplete, bodyCoverageComplete, truncated: nextCursor !== null || !bodyCoverageComplete || sourceStatus !== 'healthy', nextCursor, totalIsReturnedPageOnly: true, appliesTo: 'approved_only_eligible_debriefs', note: 'Synthetic pending debrief transport page.' },
    total: rows.length, returned: rows.length, debriefs: rows,
    continuation: continuation(requiredReads.length ? requiredReads : rows.filter(row => !row.bodyCoverage.complete).map(row => row.bodyCoverage.nextCursor).filter(value => value !== null)),
    ...(cov.overrides ?? {}),
  };
}

test('debrief list and exact-body modes keep distinct normalized selections and defaults', () => {
  const list = assertDebriefReadInput({ clientId });
  assert.deepEqual(list.selection, { clientId, debriefId: null, from: null, to: null, limit: 25, characterLimit: 1500 });
  assert.equal(list.cursor, null);
  const exact = assertDebriefReadInput({ clientId, debriefId: noteId });
  assert.deepEqual(exact.selection, { clientId, debriefId: noteId, from: null, to: null, limit: 25, characterOffset: 0, characterLimit: 5000 });
  const windowed = assertDebriefReadInput({ clientId, from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z', cursor: 'debrief:opaque' });
  assert.deepEqual([windowed.selection.from, windowed.selection.to, windowed.cursor], ['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', 'debrief:opaque']);
});
test('debrief inputs refuse missing client, foreign fields, mode confusion and cursor substitution', () => {
  for (const patch of [{}, { clientId: null }, { clientId: '   ' }, { clientId: 'x'.repeat(81) }, { clientId, characterOffset: 0 }, { clientId, cursor: 'debrief:opaque', characterOffset: 0 }, { clientId, limit: '25' }, { clientId, limit: 26 }, { clientId, characterLimit: 6001 }, { clientId, debriefId: noteId, characterOffset: -1 }, { clientId, from: 'not-a-time' }, { clientId, from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' }, { clientId, actorId: 'foreign' }]) {
    assert.throws(() => assertDebriefReadInput(patch));
  }
});
test('debrief exact body windows, hashes and decisive reads stay exact', () => {
  const input = { clientId, debriefId: noteId };
  assertDebriefSourcePage(debriefPage(input), input);
  const partial = debriefRow('abcd', { bodyCoverage: { characterStart: 0, characterEnd: 4, totalCharacters: 10, complete: false, pageComplete: true, truncated: true, nextCursor: 'debrief:cursor-1', note: 'Exact source window, not the complete body.' } });
  partial.provenance.returnedBodySha256 = sha256('abcd'); partial.provenance.bodySha256 = sha256('abcdefghij');
  const page = debriefPage({ clientId, debriefId: noteId, characterLimit: 4 }, { rows: [partial], requiredReads: ['debrief:cursor-1'], coverageOverrides: true });
  assertDebriefSourcePage(page, { clientId, debriefId: noteId, characterLimit: 4 });
  assert.equal(page.pageCoverage.nextCursor, 'debrief:cursor-1');
  for (const edit of [
    p => { p.debriefs[0].provenance.returnedBodySha256 = sha256('wrong'); },
    p => { p.debriefs[0].bodyCoverage.characterEnd = 5; },
    p => { p.debriefs[0].bodyCoverage.complete = true; },
    p => { p.scope.characterOffset = 3; },
    p => { p.debriefs[0].id = uuid; },
    p => { p.selection.debriefId = uuid; },
    p => { p.argumentsSha256 = 'a'.repeat(64); },
    p => { p.continuation.requiredReads = []; },
    p => { p.pageCoverage.nextCursor = null; },
    p => { p.pageCoverage.complete = true; },
    p => { p.subject.scopes[0].policyRevision = 'old'; },
  ]) {
    const page = debriefPage({ clientId, debriefId: noteId, characterLimit: 4 }, { rows: [structuredClone(partial)], requiredReads: ['debrief:cursor-1'] });
    edit(page); assert.throws(() => assertDebriefSourcePage(page, { clientId, debriefId: noteId, characterLimit: 4 }));
  }
});
test('debrief list pages cannot claim complete history without a completed body pass', () => {
  const input = { clientId };
  assertDebriefSourcePage(debriefPage(input), input);
  const truncated = debriefRow('abcd', { bodyCoverage: { characterStart: 0, characterEnd: 4, totalCharacters: 10, complete: false, pageComplete: true, truncated: true, nextCursor: 'debrief:cursor-2', note: 'Exact source window, not the complete body.' } });
  truncated.provenance.returnedBodySha256 = sha256('abcd'); truncated.provenance.bodySha256 = sha256('abcdefghij');
  const limited = { clientId, characterLimit: 4 };
  const page = debriefPage(limited, { rows: [truncated], pageCoverage: { nextCursor: 'debrief:cursor-2' } });
  assertDebriefSourcePage(page, limited);
  assert.equal(page.pageCoverage.paginationComplete, false);
  assert.equal(page.pageCoverage.truncated, true);
  for (const edit of [
    p => { p.debriefs[0].bodyCoverage.characterStart = 0; p.debriefs[0].bodyCoverage.characterEnd = 10; p.debriefs[0].bodyCoverage.truncated = false; p.debriefs[0].bodyCoverage.nextCursor = null; p.pageCoverage.nextCursor = null; p.pageCoverage.paginationComplete = true; },
    p => { p.pageCoverage.paginationComplete = true; },
    p => { p.debriefs.push(structuredClone(p.debriefs[0])); },
    p => { p.debriefs[0].createdAt = '2026-01-01T00:00:00.000Z'; p.debriefs.push({ ...structuredClone(p.debriefs[0]), id: uuid, createdAt: '2025-12-31T00:00:00.000Z' }); p.total = 2; p.returned = 2; p.coverage.returnedCount = 2; },
  ]) {
    const page = debriefPage(limited, { rows: [structuredClone(truncated)], pageCoverage: { nextCursor: 'debrief:cursor-2' } });
    edit(page); assert.throws(() => assertDebriefSourcePage(page, limited));
  }
});

// ---------------------------------------------------------------- meeting inventory and exact source body
const meetingRow = over => ({
  id: meetingId, clientId, subject: 'Synthetic review', startsAt: '2026-01-03T10:00:00.000Z', endsAt: '2026-01-03T11:00:00.000Z', status: 'scheduled', updatedAt: '2026-01-03T09:00:00.000Z',
  sources: [
    { sourceKind: 'note', sourceId: noteId, sourceVersion: '2026-01-03T13:00:00.000Z', meetingId, clientId, lifecycleStatus: 'approved', availability: 'available', availabilityReason: null, contentHash: sha256('note body'), createdAt: '2026-01-03T12:00:00.000Z', updatedAt: '2026-01-03T13:00:00.000Z' },
    { sourceKind: 'transcript', sourceId: transcriptId, sourceVersion: sha256('transcript body'), meetingId, clientId, lifecycleStatus: 'ready', availability: 'available', availabilityReason: null, contentHash: sha256('transcript body'), createdAt: '2026-01-03T12:30:00.000Z', updatedAt: '2026-01-03T12:30:00.000Z' },
  ],
  sourceAvailability: { notes: 'available', transcript: 'available', transcriptReason: null },
  ...over,
});
function inventoryPage(input, over = {}) {
  const { selection } = assertClientMeetingReadInput(input);
  const rows = over.rows ?? [meetingRow()];
  const omittedMeetings = over.omittedMeetings ?? 0;
  const nextCursor = over.nextCursor ?? null;
  const sourceInventoryComplete = omittedMeetings === 0 && rows.every(row => row.sources.every(source => source.availability !== 'restricted'));
  const meetingPaginationComplete = nextCursor === null;
  const truncated = !meetingPaginationComplete || rows.length > 0 || omittedMeetings > 0 || !sourceInventoryComplete;
  return {
    ...envelope('meeting-inventory-page', 'meeting.read_client_meetings', selection, { returnedCount: rows.length, truncated }),
    scope: { meetingId: selection.meetingId, sourceKind: null, sourceId: null, from: selection.from, to: selection.to, cursorApplied: over.cursorApplied ?? false, limit: selection.limit },
    order: 'startsAt-asc_id-asc_cursor-key-owner-unconfirmed', snapshotVersionId: null, returned: rows.length, meetings: rows,
    pageCoverage: { sourceStatus: sourceInventoryComplete ? 'healthy' : 'degraded', pageComplete: sourceInventoryComplete, meetingPaginationComplete, sourceInventoryComplete, sourceBodyCoverageComplete: rows.length === 0 && omittedMeetings === 0, complete: !(over.cursorApplied ?? false) && meetingPaginationComplete && rows.length === 0 && sourceInventoryComplete, partial: truncated, truncated, omittedMeetings, nextCursor, note: 'Synthetic pending meeting inventory page.' },
  };
}
const fullBody = 'note body';
function sourceBodyPage(input, over = {}) {
  const { selection } = assertClientMeetingReadInput(input);
  const body = over.body ?? fullBody, start = over.start ?? selection.characterOffset;
  const end = over.end ?? Math.min(body.length, start + selection.characterLimit);
  const slice = body.slice(start, end), truncated = end < body.length;
  const bc = { characterStart: start, characterEnd: end, totalCharacters: body.length, complete: start === 0 && end === body.length, pageComplete: true, truncated, nextCursor: truncated ? 'client-meetings:cursor-1' : null };
  return {
    ...envelope('meeting-source-body-page', 'meeting.read_client_meetings', selection, { returnedCount: 1, truncated, requiredReads: bc.nextCursor === null ? [] : [bc.nextCursor] }),
    scope: { meetingId: selection.meetingId, sourceKind: selection.sourceKind, sourceId: selection.sourceId, from: null, to: null, cursorApplied: over.cursorApplied ?? false, characterOffset: start, characterLimit: selection.characterLimit },
    snapshotVersionId: null, returned: 1,
    pageCoverage: { sourceStatus: 'healthy', pageComplete: true, meetingPaginationComplete: true, sourceInventoryComplete: true, sourceBodyCoverageComplete: bc.complete, complete: bc.complete, partial: !bc.complete, truncated, nextCursor: bc.nextCursor, note: 'Synthetic pending exact meeting source page.' },
    meeting: { id: meetingId, clientId, subject: 'Synthetic review', startsAt: '2026-01-03T10:00:00.000Z', endsAt: '2026-01-03T11:00:00.000Z', status: 'scheduled', updatedAt: '2026-01-03T09:00:00.000Z', sourceAvailability: { notes: 'available', transcript: 'available', transcriptReason: null } },
    source: {
      sourceKind: selection.sourceKind, sourceId: selection.sourceId, sourceVersion: '2026-01-03T13:00:00.000Z', meetingId, clientId, lifecycleStatus: 'approved', availability: 'available', availabilityReason: null,
      contentHash: sha256(body), createdAt: '2026-01-03T12:00:00.000Z', updatedAt: '2026-01-03T13:00:00.000Z', body: slice, bodyCoverage: bc,
      provenance: { owner: selection.sourceKind === 'note' ? 'meeting_notes' : 'engagement_attachment_storage', sourceKind: selection.sourceKind, sourceId: selection.sourceId, sourceVersion: '2026-01-03T13:00:00.000Z', meetingId, currentClientId: clientId, bodySha256: sha256(body), returnedBodySha256: sha256(slice), encoding: 'utf8', sourceByteLength: Buffer.byteLength(body, 'utf8'), returnedByteLength: Buffer.byteLength(slice, 'utf8') },
    },
  };
}

test('meeting reads keep inventory and exact-source-body modes separate', () => {
  assert.deepEqual(assertClientMeetingReadInput({ clientId }).selection, { clientId, meetingId: null, from: null, to: null, limit: 25 });
  assert.deepEqual(assertClientMeetingReadInput({ clientId, meetingId }).selection, { clientId, meetingId, from: null, to: null, limit: 25 });
  assert.deepEqual(assertClientMeetingReadInput({ clientId, meetingId, sourceKind: 'note', sourceId: noteId }).selection, { clientId, meetingId, sourceKind: 'note', sourceId: noteId, characterOffset: 0, characterLimit: 5000 });
  assert.equal(assertClientMeetingReadInput({ clientId, from: '2026-01-01T00:00:00Z' }).selection.from, '2026-01-01T00:00:00.000Z');
});
test('meeting inputs refuse missing/foreign client scope and mode substitution', () => {
  for (const patch of [{}, { clientId: null }, { clientId: 'x'.repeat(81) }, { clientId, sourceId: noteId }, { clientId, sourceKind: 'note' }, { clientId, sourceKind: 'note', sourceId: noteId }, { clientId, sourceKind: 'notes', sourceId: noteId, meetingId }, { clientId, meetingId, from: '2026-01-01T00:00:00Z' }, { clientId, meetingId, to: '2026-01-01T00:00:00Z' }, { clientId, characterOffset: 0 }, { clientId, limit: 26 }, { clientId, characterLimit: 0 }, { clientId, meetingId, sourceKind: 'note', sourceId: noteId, cursor: 'x', characterOffset: 0 }, { clientId, clientId: clientId, tenantId: 'other' }]) {
    assert.throws(() => assertClientMeetingReadInput(patch));
  }
});
test('meeting inventory discloses restricted, omitted and paginated coverage', () => {
  const input = { clientId };
  assertClientMeetingInventoryPage(inventoryPage(input), input);
  const restricted = meetingRow({ sources: [meetingRow().sources[0] = { ...meetingRow().sources[0], availability: 'restricted', availabilityReason: 'meeting_entry_acl_denied' }], sourceAvailability: { notes: 'partial', transcript: 'unavailable', transcriptReason: 'calendar_event_without_persisted_transcript' } });
  const restrictedPage = inventoryPage(input, { rows: [restricted] });
  assert.equal(restrictedPage.pageCoverage.sourceInventoryComplete, false);
  assert.equal(restrictedPage.pageCoverage.sourceStatus, 'degraded');
  assertClientMeetingInventoryPage(restrictedPage, input);
  const exactPage = inventoryPage({ clientId, meetingId }, { rows: [meetingRow()] });
  assertClientMeetingInventoryPage(exactPage, { clientId, meetingId });
  for (const edit of [
    p => { p.meetings[0].sourceAvailability.notes = 'partial'; }, p => { p.meetings[0].sourceAvailability.transcript = 'unavailable'; },
    p => { p.meetings[0].sources.reverse(); }, p => { p.pageCoverage.omittedMeetings = 1; }, p => { p.pageCoverage.sourceInventoryComplete = false; },
    p => { p.pageCoverage.meetingPaginationComplete = false; }, p => { p.pageCoverage.nextCursor = 'client-meetings:cursor-1'; },
    p => { p.coverage.enumeration = 'complete'; }, p => { p.coverage.enumerableTotal = 1; }, p => { p.coverage.historySupport = 'supported'; },
    p => { p.sources[0].freshness = 'fresh'; }, p => { p.sources[0].snapshotVersionId = 'snapshot-a'; }, p => { p.sources[0].status = 'checked'; },
    p => { p.coverage.limitations = []; }, p => { p.continuation.requiredReads = ['x']; }, p => { p.snapshotVersionId = 'asOf-is-not-a-snapshot'; },
  ]) {
    const page = inventoryPage(input); edit(page); assert.throws(() => assertClientMeetingInventoryPage(page, input));
  }
  const exactLimit = inventoryPage({ clientId, meetingId }, { rows: [meetingRow(), meetingRow({ id: uuid })] });
  assert.throws(() => assertClientMeetingInventoryPage(exactLimit, { clientId, meetingId }));
  const foreign = inventoryPage(input); foreign.meetings[0].clientId = uuid; assert.throws(() => assertClientMeetingInventoryPage(foreign, input), /client substitution/);
});
test('exact meeting source bodies bind hash, byte and window provenance', () => {
  const input = { clientId, meetingId, sourceKind: 'note', sourceId: noteId };
  assertClientMeetingSourceBodyPage(sourceBodyPage(input), input);
  const partial = sourceBodyPage({ clientId, meetingId, sourceKind: 'transcript', sourceId: transcriptId, characterLimit: 4 }, { body: 'abcdefghij' });
  assertClientMeetingSourceBodyPage(partial, { clientId, meetingId, sourceKind: 'transcript', sourceId: transcriptId, characterLimit: 4 });
  assert.equal(partial.source.body, 'abcd'); assert.equal(partial.source.provenance.owner, 'engagement_attachment_storage');
  assert.equal(partial.continuation.requiredReads.length, 1);
  for (const edit of [
    p => { p.source.provenance.returnedBodySha256 = sha256(p.source.body + '!'); }, p => { p.source.contentHash = sha256('other'); },
    p => { p.source.bodyCoverage.characterEnd = 5; }, p => { p.source.bodyCoverage.complete = true; }, p => { p.source.bodyCoverage.nextCursor = null; },
    p => { p.source.availability = 'restricted'; }, p => { p.source.provenance.owner = 'meeting_notes'; },
    p => { p.meeting.id = uuid; }, p => { p.scope.sourceId = uuid; }, p => { p.returned = 2; }, p => { p.coverage.returnedCount = 2; },
    p => { p.pageCoverage.truncated = false; }, p => { p.continuation.requiredReads = []; },
    p => { p.continuation.cursor = 'client-meetings:cursor-1'; }, p => { p.scope.cursorApplied = true; },
    p => { p.source.provenance.sourceByteLength = 0; },
  ]) {
    const base = { clientId, meetingId, sourceKind: 'transcript', sourceId: transcriptId, characterLimit: 4 };
    const page = sourceBodyPage(base, { body: 'abcdefghij' }); edit(page);
    assert.throws(() => assertClientMeetingSourceBodyPage(page, base));
  }
});
test('cursor reuse is disclosed but never authenticated by this pending contract', () => {
  const input = { clientId, meetingId, sourceKind: 'note', sourceId: noteId, cursor: 'client-meetings:opaque' };
  assertClientMeetingSourceBodyPage(sourceBodyPage(input, { cursorApplied: true, start: 2 }), input);
  const undisclosed = sourceBodyPage(input, { start: 2 });
  assert.throws(() => assertClientMeetingSourceBodyPage(undisclosed, input), /cursor/);
  // The cursor is opaque to this contract: an unauthenticated or forged cursor string is not
  // verifiable here, so only the resumed window and the disclosure flag are pinned.
  const forged = { ...input, cursor: 'not-the-frozen-cursor-format' };
  const resumed = sourceBodyPage(forged, { cursorApplied: true, start: 2 });
  assertClientMeetingSourceBodyPage(resumed, forged);
  assert.equal(resumed.scope.cursorApplied, true);
  assert.equal(resumed.scope.characterOffset, 2);
  assert.equal(resumed.continuation.cursor, null);
});
test('meeting external DTO accessors, cycles and non-finite values refuse before executing getters', () => {
  let calls = 0;
  const input = { clientId };
  Object.defineProperty(input, 'limit', { enumerable: true, get() { calls++; return 25; } });
  assert.throws(() => assertClientMeetingReadInput(input), /accessor/);
  assert.equal(calls, 0);
  const cyclic = { clientId }; cyclic.extra = cyclic;
  assert.throws(() => assertDebriefReadInput(cyclic), /acyclic/);
  assert.throws(() => assertUpcomingMeetingsInput({ limit: Infinity }, { nowMs }));
  const page = inventoryPage({ clientId });
  Object.defineProperty(page.scope, 'limit', { enumerable: true, get() { calls++; return 25; } });
  assert.throws(() => assertClientMeetingInventoryPage(page, { clientId }), /accessor/);
  assert.equal(calls, 0);
});
test('shared collaborators are delegated, not re-implemented, and still have teeth', () => {
  const page = inventoryPage({ clientId });
  const forged = structuredClone(page); forged.subject.entityIds = [uuid];
  assert.throws(() => assertClientMeetingInventoryPage(forged, { clientId }), /subject/);
  const unauthoritative = structuredClone(page); unauthoritative.sources[0].authority = 'derived';
  assertClientMeetingInventoryPage(unauthoritative, { clientId });
  const mismatched = structuredClone(page); mismatched.coverage.sourcesChecked = [];
  assert.throws(() => assertClientMeetingInventoryPage(mismatched, { clientId }), /Source coverage/);
  const leaked = structuredClone(page); leaked.binding.actorId = 'other';
  assert.throws(() => assertClientMeetingInventoryPage(leaked, { clientId }), /binding/);
});

test('meeting pages enforce canonical single-subject cardinality and roster rules', () => {
  const page = inventoryPage({ clientId });
  assertClientMeetingInventoryPage(page, { clientId });
  for (const subject of [
    { ...page.subject, entityIds: [clientId, 'other-client'] },
    { ...page.subject, rosterVersionId: 'invented-roster' },
  ]) {
    const changed = structuredClone(page);
    changed.subject = subject;
    assert.throws(() => assertClientMeetingInventoryPage(changed, { clientId }), /Single subject identity mismatch/);
  }
});

test('meeting pages enforce canonical timezone and calendar-week boundaries', () => {
  const page = inventoryPage({ clientId });
  page.window = {
    basis: 'calendar-week', startInclusive: '2026-03-02T05:00:00Z', endExclusive: '2026-03-09T04:00:00Z',
    timezone: 'America/New_York', weekStartsOn: 'monday',
  };
  assertClientMeetingInventoryPage(page, { clientId });
  for (const [patch, error] of [
    [{ timezone: 'Mars/Olympus' }, /Unknown timezone/],
    [{ startInclusive: '2026-03-02T06:00:00Z' }, /local midnight/],
    [{ endExclusive: '2026-03-10T04:00:00Z' }, /Invalid calendar week/],
    [{ weekStartsOn: null }, /Week policy mismatch/],
  ]) {
    const changed = structuredClone(page);
    Object.assign(changed.window, patch);
    assert.throws(() => assertClientMeetingInventoryPage(changed, { clientId }), error);
  }
});

test('meeting source observations retain their pending timestamp boundary', () => {
  for (const timestamp of ['asOf', 'synchronizedAt']) {
    const page = inventoryPage({ clientId });
    page.sources[0][timestamp] = '2027-01-01T00:00:00Z';
    // Pending transports forbid every claimed sync timestamp before the shared
    // source chronology check; registration must not weaken that domain rule.
    assert.throws(() => assertClientMeetingInventoryPage(page, { clientId }), /cannot claim sync timestamps/);
  }
});

// ---------------------------------------------------------------- boundary and public-distribution guards
test('meeting schema objects stay closed and package public exports stay 0.1 only', () => {
  const walk = node => { if (!node || typeof node !== 'object') return; if (node.type === 'object') assert.equal(node.additionalProperties, false); for (const child of Object.values(node)) if (child && typeof child === 'object') walk(child); };
  walk(meetingSchema);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.version, '0.1.0');
  assert(!JSON.stringify(pkg.exports).includes('retrieval-0.2'));
  assert(!pkg.files.includes('retrieval-0.2'));
});
test('no catalog operation, descriptor or skill exposes the pending meeting source contract', () => {
  const catalog = JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json', import.meta.url)));
  assertCatalog(catalog);
  for (const id of ['meeting.list_upcoming_meetings', 'meeting.query_debriefs', 'meeting.read_client_meetings', 'list_upcoming_meetings', 'query_debriefs', 'read_client_meetings']) {
    assert(!catalog.operations.some(operation => operation.operation.id === id || operation.aliases.includes(id)));
  }
  for (const operation of catalog.operations) { assert.equal(operation.handler, null); assert.equal(operation.availability, 'unimplemented'); }
  const manifest = { contractVersion: '0.2.0', skillId: 'quick_skill.meeting_prep', skillVersion: '1.0.0', prose: { id: 'urn:meri:synthetic:meeting', sha256: 'a'.repeat(64) }, requiredSources: [{ sourceId: 'meeting', authority: 'authoritative', purpose: 'evidence' }], allowedOperations: [{ id: 'meeting.read_client_meetings', version: '0.2.0' }], subjectKinds: ['client'], windowBases: ['unbounded'], completion: { requireAllSources: true, allowDisclosedPartial: true, negativeClaims: 'complete-covered-only', rubric: [{ id: 'read', requirement: 'Read authorized meeting sources', evidenceRequired: true }] }, approval: { mutations: 'separate-immutable-proposal', autoCreateTasks: false }, budgets: { maxTurns: 4, maxToolCalls: 4, maxRecoveryAttempts: 1, maxRuntimeSeconds: 30, maxCostMicroUSD: 1000, maxOutputBytes: 10000 }, versionPolicy: { existingRuns: 'pin-immutable', resume: 'exact-or-explicit-migration', fork: 'preserve-unless-explicit-reselection' } };
  assert.throws(() => assertSkillManifest(manifest, catalog), /unavailable/);
});
