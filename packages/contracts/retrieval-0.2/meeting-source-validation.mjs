import { canonicalSha256 } from '../validate.mjs';
import { createHash } from 'node:crypto';
const fail = message => { throw new Error(message); };
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

/**
 * Meeting/calendar and debrief source transport contracts.
 *
 * Candidate-only structural validation for three still-unregistered operations:
 * `meeting.list_upcoming_meetings`, `meeting.query_debriefs`, `meeting.read_client_meetings`.
 * Behaviour was read from pinned frozen Git objects only; nothing here authenticates an actor,
 * resolves authorization, proves cursor authenticity, opens a source, or reads a customer record.
 * Pending status means none of these validators establish evidence or absence.
 */
export function createMeetingValidators({validateShape, assertSubject, assertWindow, assertSourceInventory, unique}) {
// External meeting DTOs accept inert JSON data, never coercion or accessors.
function assertMeetingData(value) {
  const seen = new Set(), pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (item === null || ['string', 'boolean'].includes(typeof item)) continue;
    if (typeof item === 'number' && Number.isFinite(item)) continue;
    if (typeof item !== 'object' || seen.has(item)) fail('Meeting DTO requires finite, acyclic JSON data');
    seen.add(item);
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== (Array.isArray(item) ? Array.prototype : Object.prototype) && prototype !== null) fail('Meeting DTO requires plain JSON objects');
    for (const name of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && name === 'length') continue;
      const property = Object.getOwnPropertyDescriptor(item, name);
      if (typeof name !== 'string' || !property.enumerable || !('value' in property)) fail('Meeting DTO accessor or hidden property');
      pending.push(property.value);
    }
  }
}

// Mirrors the frozen optionalText guard: non-empty after trimming, raw length bounded, stored trimmed.
function optionalText(input, key, max) {
  const value = input[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${key} is invalid`);
  return value.trim();
}
function requiredText(input, key, max) {
  const value = optionalText(input, key, max);
  if (!value) fail(`${key} is required`);
  return value;
}
// Frozen scopeFor stores Date.prototype.toISOString(); the raw value must still be a full ISO instant.
function optionalInstant(input, key) {
  const value = optionalText(input, key, 80);
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) fail(`${key} must be an ISO timestamp`);
  return parsed.toISOString();
}
// Strict integer boundary: the frozen clampInt/`?? fallback` coercions are observations, not adopted here.
function boundedInteger(input, key, fallback, minimum, maximum) {
  const value = input[key] === undefined ? fallback : input[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) fail(`${key} must be an integer between ${minimum} and ${maximum}`);
  return value;
}

function assertEnvelope(page, input, selection, kind, operation) {
  assertMeetingData(page); validateShape(kind, page);
  assertSubject(page.subject, page.binding); assertWindow(page.window);
  if (page.contractVersion !== '0.2.0' || page.operation.id !== operation || page.operation.version !== '0.2.0') fail('Meeting operation substitution');
  if (canonicalSha256(page.selection) !== canonicalSha256(selection) || page.argumentsSha256 !== canonicalSha256(selection)) fail('Meeting argument/selection binding mismatch');
  // Client-scoped reads bind the resolved client subject; the personal calendar inventory does not.
  if (selection.clientId !== null && (page.subject.kind !== 'client' || page.subject.entityIds[0] !== selection.clientId)) fail('Meeting requested/resolved subject mismatch');
  if (page.evidenceReady !== false || page.negativeAssertion.kind !== 'none') fail('Pending meeting transport cannot assert evidence or absence');
  if (page.coverage.enumeration === 'complete' || page.coverage.enumerableTotal !== null) fail('Meeting transport cannot claim complete enumeration or an enumerable total');
  if (page.coverage.historySupport === 'supported') fail('Meeting transport cannot claim supported history');
  if (page.coverage.limitations.length === 0) fail('Meeting transport requires explicit limitations');
  if (page.continuation.cursor !== null || page.continuation.remainingSources.length !== 0) fail('Meeting transport cannot claim snapshot-safe continuation');
  for (const source of page.sources) {
    if (source.snapshotVersionId !== null) fail('Meeting snapshot identity is unproven and must stay null');
    if (source.status === 'checked') fail('Unproven meeting snapshot cannot claim a checked source');
    if (source.freshness === 'fresh') fail('Meeting freshness cannot be claimed fresh');
    if (source.asOf !== null || source.synchronizedAt !== null) fail('Meeting source cannot claim sync timestamps');
  }
  return assertSourceInventory(page);
}
function assertOptionalCursor(cursor, applied) {
  if ((cursor !== null) !== applied) fail('Meeting cursor application disclosure mismatch');
}

// ---------------------------------------------------------------- calendar inventory
function assertUpcomingMeetingsInput(input, options = {}) {
  assertMeetingData(input); assertMeetingData(options); validateShape('MeetingUpcomingInput', input);
  if (Object.keys(options).some(key => key !== 'nowMs')) fail('Unknown meeting validation context field');
  if (!Number.isSafeInteger(options.nowMs) || options.nowMs < 0) fail('Explicit trusted nowMs required');
  const selection = {
    clientId: optionalText(input, 'clientId', 36),
    limit: boundedInteger(input, 'limit', 10, 1, 25),
    withinDays: boundedInteger(input, 'withinDays', 30, 1, 365),
  };
  return selection;
}
function assertUpcomingMeetingsPage(page, input, options = {}) {
  const selection = assertUpcomingMeetingsInput(input, options);
  const now = options.nowMs;
  assertEnvelope(page, input, selection, 'MeetingUpcomingPage', 'meeting.list_upcoming_meetings');
  const { meetings, coverage, calendarWindow } = page;
  if (page.count !== meetings.length || coverage.returnedCount !== meetings.length || meetings.length > selection.limit) fail('Meeting returned count mismatch');
  if (calendarWindow.withinDays !== selection.withinDays) fail('Meeting withinDays substitution');
  const from = Date.parse(calendarWindow.from), to = Date.parse(calendarWindow.to);
  if ((to - from) !== selection.withinDays * 86400000) fail('Meeting calendar window arithmetic mismatch');
  if (from > now + 1000 || from < now - 3600000) fail('Meeting calendar window origin exceeds the trusted clock allowance');
  unique(meetings.map(meeting => meeting.id), 'meeting identity');
  let prior = null;
  for (const meeting of meetings) {
    const startsAt = Date.parse(meeting.startsAt);
    if (typeof meeting.startsAt !== 'string' || !Number.isFinite(startsAt)) fail('Upcoming meeting requires a start instant');
    if (startsAt < from || startsAt >= to) fail('Upcoming meeting is outside the declared calendar window');
    if (prior !== null && startsAt < prior) fail('Upcoming meeting order mismatch');
    prior = startsAt;
  }
  if (coverage.truncated !== (meetings.length === selection.limit)) fail('Upcoming meeting truncation disclosure mismatch');
  if (meetings.length === 0 && coverage.enumeration !== 'unknown') fail('Empty calendar page cannot claim partial enumeration');
  return page;
}

// ---------------------------------------------------------------- debrief list / exact body
function assertDebriefReadInput(input) {
  assertMeetingData(input); validateShape('DebriefReadInput', input);
  const clientId = requiredText(input, 'clientId', 80);
  const debriefId = optionalText(input, 'debriefId', 80);
  const from = optionalInstant(input, 'from');
  const to = optionalInstant(input, 'to');
  if (from && to && from > to) fail('from must not be later than to');
  const limit = boundedInteger(input, 'limit', 25, 1, 25);
  const characterLimit = boundedInteger(input, 'characterLimit', debriefId ? 5000 : 1500, 1, 6000);
  if (!debriefId && input.characterOffset !== undefined) fail('characterOffset requires debriefId');
  const characterOffset = boundedInteger(input, 'characterOffset', 0, 0, Number.MAX_SAFE_INTEGER);
  const cursor = optionalText(input, 'cursor', 4096);
  if (cursor !== null && input.characterOffset !== undefined) fail('Use cursor or characterOffset, not both');
  const selection = debriefId
    ? { clientId, debriefId, from, to, limit, characterOffset, characterLimit }
    : { clientId, debriefId: null, from, to, limit, characterLimit };
  return { selection, cursor };
}
function assertDebriefSourcePage(page, input) {
  const { selection, cursor } = assertDebriefReadInput(input);
  assertMeetingData(page); validateShape('DebriefSourcePage', page);
  assertEnvelope(page, input, selection, 'DebriefSourcePage', 'meeting.query_debriefs');
  const exact = selection.debriefId !== null, { scope, pageCoverage: pc, debriefs, coverage } = page;
  if (scope.debriefId !== selection.debriefId || scope.from !== selection.from || scope.to !== selection.to
    || scope.listLimit !== selection.limit || scope.characterLimit !== selection.characterLimit) fail('Debrief scope substitution');
  assertOptionalCursor(cursor, scope.cursorApplied);
  // A body cursor carries the effective offset; without one the declared offset must be reproduced exactly.
  if (!scope.cursorApplied && scope.characterOffset !== (exact ? selection.characterOffset : null)) fail('Debrief scope offset substitution');
  if (page.total !== debriefs.length || page.returned !== debriefs.length || coverage.returnedCount !== debriefs.length || debriefs.length > (exact ? 1 : selection.limit)) fail('Debrief returned count mismatch');
  unique(debriefs.map(debrief => debrief.id), 'debrief identity');
  let priorCreated = null, priorId = null;
  const incomplete = [];
  for (const debrief of debriefs) {
    const { bodyCoverage: bc, provenance: p } = debrief;
    if (exact && debrief.id !== selection.debriefId) fail('Debrief exact identity substitution');
    if (debrief.clientId !== selection.clientId || p.currentClientId !== debrief.clientId || debrief.meetingId !== debrief.meeting.id || p.parentMeetingId !== debrief.meetingId || p.sourceRecordId !== debrief.id || p.sourceVersion !== debrief.updatedAt) fail('Debrief provenance mismatch');
    if (bc.characterStart !== (exact ? scope.characterOffset : 0) || bc.characterEnd < bc.characterStart || bc.characterEnd > bc.totalCharacters) fail('Debrief body window mismatch');
    if (bc.characterEnd !== Math.min(bc.totalCharacters, bc.characterStart + selection.characterLimit)) fail('Debrief character limit mismatch');
    if (bc.totalCharacters < debrief.body.length || bc.characterEnd - bc.characterStart !== debrief.body.length) fail('Debrief UTF-16 body length mismatch');
    if (bc.complete !== (bc.characterStart === 0 && bc.characterEnd === bc.totalCharacters) || bc.truncated !== (bc.characterEnd < bc.totalCharacters) || ((bc.nextCursor !== null) !== bc.truncated)) fail('Debrief body completeness mismatch');
    if (sha256(debrief.body) !== p.returnedBodySha256 || (bc.complete && p.bodySha256 !== p.returnedBodySha256)) fail('Debrief body hash mismatch');
    if (bc.nextCursor !== null && bc.nextCursor.length > 4096) fail('Debrief cursor exceeds its bound');
    if (!bc.complete) incomplete.push(bc.nextCursor === null ? 'window-resumed' : bc.nextCursor);
    if (!exact) {
      const created = Date.parse(debrief.createdAt);
      if (priorCreated !== null && (created < priorCreated || (created === priorCreated && debrief.id < priorId))) fail('Debrief list order mismatch');
      priorCreated = created; priorId = debrief.id;
    }
  }
  const bodyCoverageComplete = debriefs.every(debrief => debrief.bodyCoverage.complete);
  const paginationComplete = exact ? true : pc.nextCursor === null;
  if (exact ? pc.nextCursor !== (debriefs[0]?.bodyCoverage.nextCursor ?? null) : pc.nextCursor !== null && paginationComplete) fail('Debrief pagination cursor mismatch');
  const complete = pc.sourceStatus === 'healthy' && !scope.cursorApplied && paginationComplete && bodyCoverageComplete;
  if (pc.pageComplete !== (pc.sourceStatus === 'healthy') || pc.paginationComplete !== paginationComplete
    || pc.bodyCoverageComplete !== bodyCoverageComplete || pc.complete !== complete || pc.partial !== !complete
    || pc.truncated !== (pc.nextCursor !== null || !bodyCoverageComplete || pc.sourceStatus !== 'healthy')) fail('Debrief page coverage mismatch');
  if (coverage.truncated !== true && pc.truncated !== false) fail('Debrief truncation disclosure mismatch');
  if (pc.nextCursor !== null && coverage.truncated !== true) fail('Debrief continuation requires truncation disclosure');
  if (pc.complete && coverage.enumeration !== 'unknown') fail('Debrief completeness cannot upgrade source enumeration');
  const required = incomplete.filter(value => value !== 'window-resumed');
  if (page.continuation.requiredReads.length !== incomplete.length || required.some(value => !page.continuation.requiredReads.includes(value))) fail('Debrief unresolved decisive read mismatch');
  return page;
}

// ---------------------------------------------------------------- meeting inventory / exact source body
function assertClientMeetingReadInput(input) {
  assertMeetingData(input); validateShape('ClientMeetingReadInput', input);
  const clientId = requiredText(input, 'clientId', 80);
  const meetingId = optionalText(input, 'meetingId', 80);
  const sourceId = optionalText(input, 'sourceId', 80);
  const sourceKind = optionalText(input, 'sourceKind', 20);
  if (sourceKind && !['note', 'transcript'].includes(sourceKind)) fail('sourceKind must be note or transcript');
  if (Boolean(sourceId) !== Boolean(sourceKind) || (sourceId && !meetingId)) fail('sourceId and sourceKind require each other and meetingId');
  const from = optionalInstant(input, 'from');
  const to = optionalInstant(input, 'to');
  if (from && to && from > to) fail('from must not be later than to');
  if (meetingId && (from || to)) fail('from and to apply only to meeting-list reads');
  const limit = boundedInteger(input, 'limit', 25, 1, 25);
  const characterLimit = boundedInteger(input, 'characterLimit', 5000, 1, 6000);
  if (!sourceId && input.characterOffset !== undefined) fail('characterOffset requires an exact sourceId');
  const characterOffset = boundedInteger(input, 'characterOffset', 0, 0, Number.MAX_SAFE_INTEGER);
  const cursor = optionalText(input, 'cursor', 8192);
  if (cursor !== null && input.characterOffset !== undefined) fail('Use cursor or characterOffset, not both');
  const selection = sourceId
    ? { clientId, meetingId, sourceKind, sourceId, characterOffset, characterLimit }
    : meetingId
      ? { clientId, meetingId, from: null, to: null, limit }
      : { clientId, meetingId: null, from, to, limit };
  return { selection, cursor };
}
function assertClientMeetingInventoryPage(page, input) {
  const { selection, cursor } = assertClientMeetingReadInput(input);
  assertMeetingData(page); validateShape('ClientMeetingInventoryPage', page);
  assertEnvelope(page, input, selection, 'ClientMeetingInventoryPage', 'meeting.read_client_meetings');
  const { scope, coverage, pageCoverage: pc, meetings } = page;
  if (scope.meetingId !== selection.meetingId || scope.from !== selection.from || scope.to !== selection.to || scope.limit !== selection.limit) fail('Meeting scope substitution');
  assertOptionalCursor(cursor, scope.cursorApplied);
  if (page.returned !== meetings.length || coverage.returnedCount !== meetings.length) fail('Meeting inventory returned count mismatch');
  if (selection.meetingId === null ? meetings.length > selection.limit : meetings.length !== 1) fail('Meeting inventory page size mismatch');
  unique(meetings.map(meeting => meeting.id), 'meeting identity');
  let priorStarts = null, priorId = null;
  for (const meeting of meetings) {
    if (meeting.clientId !== selection.clientId) fail('Meeting client substitution');
    if (selection.meetingId !== null && meeting.id !== selection.meetingId) fail('Meeting exact identity substitution');
    const starts = Date.parse(meeting.startsAt);
    if (priorStarts !== null && (starts < priorStarts || (starts === priorStarts && meeting.id < priorId))) fail('Meeting inventory order mismatch');
    priorStarts = starts; priorId = meeting.id;
    const noteSources = meeting.sources.filter(source => source.sourceKind === 'note');
    const transcriptSources = meeting.sources.filter(source => source.sourceKind === 'transcript');
    unique(meeting.sources.map(source => `${source.sourceKind}:${source.sourceId}`), 'meeting source identity');
    for (const source of meeting.sources) {
      if (source.meetingId !== meeting.id || source.clientId !== meeting.clientId || source.lifecycleStatus.length === 0) fail('Meeting source parent mismatch');
      if (source.availability === 'available' ? source.availabilityReason !== null : source.availabilityReason === null) fail('Meeting source availability reason mismatch');
      if (source.sourceKind === 'note' && source.availability === 'unavailable') fail('Persisted note sources are never unavailable');
    }
    const sorted = [...meeting.sources].sort((left, right) => left.sourceKind.localeCompare(right.sourceKind) || left.sourceId.localeCompare(right.sourceId));
    if (canonicalSha256(sorted) !== canonicalSha256(meeting.sources)) fail('Meeting source order mismatch');
    const notesRestricted = noteSources.some(source => source.availability !== 'available');
    const transcriptAvailable = transcriptSources.some(source => source.availability === 'available');
    const availability = meeting.sourceAvailability;
    if (availability.notes !== (noteSources.length === 0 ? 'empty' : notesRestricted ? 'partial' : 'available')
      || availability.transcript !== (transcriptAvailable ? 'available' : 'unavailable')
      || availability.transcriptReason !== (transcriptAvailable ? null : transcriptSources.length > 0 ? 'persisted_transcript_unavailable' : 'calendar_event_without_persisted_transcript')) fail('Meeting source availability mismatch');
  }
  const sourceInventoryComplete = pc.omittedMeetings === 0 && meetings.every(meeting => meeting.sources.every(source => source.availability !== 'restricted'));
  const meetingPaginationComplete = pc.nextCursor === null;
  const truncated = !meetingPaginationComplete || meetings.length > 0 || pc.omittedMeetings > 0 || !sourceInventoryComplete;
  if (pc.sourceInventoryComplete !== sourceInventoryComplete || pc.pageComplete !== sourceInventoryComplete
    || pc.meetingPaginationComplete !== meetingPaginationComplete || pc.sourceBodyCoverageComplete !== (meetings.length === 0 && pc.omittedMeetings === 0)
    || pc.complete !== (!scope.cursorApplied && meetingPaginationComplete && meetings.length === 0 && sourceInventoryComplete)
    || pc.partial !== truncated || pc.truncated !== truncated
    || pc.sourceStatus !== (sourceInventoryComplete ? 'healthy' : 'degraded')) fail('Meeting inventory page coverage mismatch');
  if (coverage.truncated !== truncated) fail('Meeting inventory truncation disclosure mismatch');
  if (pc.omittedMeetings > selection.limit) fail('Meeting omitted count bound mismatch');
  if (page.continuation.requiredReads.length !== 0) fail('Meeting inventory page requires no decisive read');
  return page;
}
function assertClientMeetingSourceBodyPage(page, input) {
  const { selection, cursor } = assertClientMeetingReadInput(input);
  assertMeetingData(page); validateShape('ClientMeetingSourceBodyPage', page);
  assertEnvelope(page, input, selection, 'ClientMeetingSourceBodyPage', 'meeting.read_client_meetings');
  const { scope, coverage, pageCoverage: pc, meeting, source } = page;
  if (scope.meetingId !== selection.meetingId || scope.sourceKind !== selection.sourceKind || scope.sourceId !== selection.sourceId
    || scope.characterLimit !== selection.characterLimit) fail('Meeting source scope substitution');
  assertOptionalCursor(cursor, scope.cursorApplied);
  if (!scope.cursorApplied && scope.characterOffset !== selection.characterOffset) fail('Meeting source scope offset substitution');
  const bc = source.bodyCoverage, p = source.provenance;
  if (meeting.id !== selection.meetingId || meeting.clientId !== selection.clientId) fail('Meeting body page parent substitution');
  if (source.sourceKind !== selection.sourceKind || source.sourceId !== selection.sourceId || source.meetingId !== selection.meetingId
    || source.clientId !== selection.clientId || p.currentClientId !== selection.clientId || p.sourceKind !== source.sourceKind
    || p.sourceId !== source.sourceId || p.meetingId !== source.meetingId || p.sourceVersion !== source.sourceVersion) fail('Meeting source provenance mismatch');
  if (p.owner !== (selection.sourceKind === 'note' ? 'meeting_notes' : 'engagement_attachment_storage')) fail('Meeting source owner mismatch');
  if (source.contentHash !== p.bodySha256) fail('Meeting source full-body hash mismatch');
  if (bc.characterStart !== scope.characterOffset || bc.characterEnd < bc.characterStart || bc.characterEnd > bc.totalCharacters) fail('Meeting body window mismatch');
  if (bc.characterEnd !== Math.min(bc.totalCharacters, bc.characterStart + selection.characterLimit)) fail('Meeting character limit mismatch');
  if (bc.totalCharacters < source.body.length || bc.characterEnd - bc.characterStart !== source.body.length) fail('Meeting UTF-16 body length mismatch');
  if (bc.complete !== (bc.characterStart === 0 && bc.characterEnd === bc.totalCharacters) || bc.truncated !== (bc.characterEnd < bc.totalCharacters) || ((bc.nextCursor !== null) !== bc.truncated)) fail('Meeting body completeness mismatch');
  if (sha256(source.body) !== p.returnedBodySha256 || (bc.complete && p.bodySha256 !== p.returnedBodySha256)) fail('Meeting returned body hash mismatch');
  if (p.sourceByteLength < p.returnedByteLength || (bc.complete && p.sourceByteLength !== p.returnedByteLength)) fail('Meeting source byte length mismatch');
  if (pc.sourceBodyCoverageComplete !== bc.complete || pc.complete !== bc.complete
    || pc.partial !== !bc.complete || pc.truncated !== bc.truncated || pc.nextCursor !== bc.nextCursor) fail('Meeting source body page coverage mismatch');
  if (coverage.truncated !== bc.truncated) fail('Meeting source body truncation disclosure mismatch');
  if (coverage.returnedCount !== 1) fail('Meeting source body returned count mismatch');
  const required = bc.truncated ? [bc.nextCursor] : [];
  if (canonicalSha256(page.continuation.requiredReads) !== canonicalSha256(required)) fail('Meeting source body decisive read mismatch');
  return page;
}
return {assertUpcomingMeetingsInput, assertUpcomingMeetingsPage, assertDebriefReadInput, assertDebriefSourcePage, assertClientMeetingReadInput, assertClientMeetingInventoryPage, assertClientMeetingSourceBodyPage};
}
