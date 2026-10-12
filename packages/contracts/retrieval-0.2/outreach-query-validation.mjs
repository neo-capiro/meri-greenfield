// Complete stored outreach projections only. No source read, send, or authority owner.
import {snapshotOperationData} from './operation-contracts.mjs';
export const OUTREACH_QUERY_OPERATION_IDS = Object.freeze(['query_outreach']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = message => { throw new Error(message); };
function instant(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    fail('Outreach timestamp requires a finite canonical JSON instant');
}
function dates(row, names) {
  for (const name of names) if (row[name] !== null) instant(row[name]);
}
function optional(value, cap) { return typeof value === 'string' ? value.trim().slice(0, cap) || null : null; }
function limit(value) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.max(1, Math.min(50, Math.trunc(number))) : 20;
}
function sameId(left, right) {
  return left === right || typeof left === 'string' && typeof right === 'string' &&
    UUID.test(left) && UUID.test(right) && left.toLowerCase() === right.toLowerCase();
}
function related(id, row, label) {
  if (row !== null && !sameId(id, row.id)) fail(`Outreach ${label} relation differs from its scalar identity`);
}
function unique(rows, label) {
  if (new Set(rows.map(row => row.id.toLowerCase())).size !== rows.length) fail(`Duplicate outreach ${label}`);
}
function prep(row) { dates(row, ['sharedAt', 'createdAt', 'updatedAt']); }
function debrief(row) {
  dates(row, ['sharedAt', 'createdAt', 'updatedAt']);
  related(row.authorUserId, row.author, 'debrief author');
}
function meeting(row) {
  dates(row, ['startsAt', 'endsAt']);
  related(row.clientId, row.client, 'meeting client');
  unique(row.attendees, 'attendee');
  for (const item of row.preps) {
    prep(item);
    if (!sameId(item.meetingId, row.id)) fail('Outreach prep belongs to another meeting');
  }
  for (const item of row.debriefs) {
    debrief(item);
    if (!sameId(item.meetingId, row.id)) fail('Outreach debrief belongs to another meeting');
  }
  // Prep/debrief client IDs may retain a historical association. No equality to
  // the meeting's current client, or createdAt ordering from hidden fields.
}
function record(row) {
  dates(row, ['sentAt', 'openedInEmailAt', 'createdAt', 'updatedAt']);
  if (row.body.length > 2000 || row.body !== row.body.replace(/\s+/g, ' ').trim())
    fail('Outreach body exceeds normalized UTF-16 projection');
  related(row.clientId, row.client, 'record client');
  related(row.meetingId, row.meeting, 'record meeting');
  related(row.createdByUserId, row.createdBy, 'record creator');
  if (row.meeting !== null) meeting(row.meeting);
}
export function createOutreachQueryValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || schema?.$id !== 'urn:meri:retrieval:outreach-query:0.2.0' || !schema.$defs)
    fail('Outreach validator configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  function operation(id) {
    if (typeof id !== 'string' || !OUTREACH_QUERY_OPERATION_IDS.includes(id)) fail('Unknown outreach operation');
  }
  function outreachQueryInputDefinition(id) { operation(id); return 'OutreachQueryInput'; }
  function outreachQueryOutputDefinition(id) { operation(id); return 'OutreachQueryOutput'; }
  function validateOutreachQueryShape(name, value) {
    if (typeof name !== 'string' || !definitions.has(name)) fail('Unknown outreach definition');
    const data = snapshotOperationData(value);
    validateShape(name, data);
    if (['OutreachQueryInput', 'OutreachQueryExactInput', 'OutreachQueryListInput'].includes(name)) {
      if (typeof data.outreachId === 'string' && data.outreachId.length > 80 ||
          typeof data.status === 'string' && (data.status.length > 40 || data.status.trim() !== data.status))
        fail('Outreach normalized selector exceeds its UTF-16 projection');
    } else if (name === 'OutreachQueryContext' && data.clientResolution !== null) {
      if (data.clientResolution.reference.length > 80 ||
          data.clientResolution.reference.trim() !== data.clientResolution.reference)
        fail('Outreach resolution reference is not canonical');
    } else if (name === 'OutreachQueryInstant') instant(data);
    else if (name === 'OutreachQueryPrep') prep(data);
    else if (name === 'OutreachQueryDebrief') debrief(data);
    else if (name === 'OutreachQueryMeeting') meeting(data);
    else if (name === 'OutreachQueryRecord') record(data);
    else if (name === 'OutreachQueryCampaign') dates(data, ['sentAt', 'createdAt']);
    else if (['OutreachQueryOutput', 'OutreachQueryExactOutput', 'OutreachQueryListOutput'].includes(name)) {
      instant(data.generatedAt);
      if (Object.hasOwn(data, 'record')) record(data.record);
      else {
        unique(data.campaigns, 'campaign');
        if (data.total < data.campaigns.length) fail('Outreach campaign total precedes the returned slice');
        for (const item of data.campaigns) dates(item, ['sentAt', 'createdAt']);
      }
    }
    return data;
  }
  function normalizeOutreachQueryInput(id, request, options) {
    operation(id);
    const raw = validateOutreachQueryShape('OutreachQueryRequest', request);
    const context = validateOutreachQueryShape('OutreachQueryContext', options);
    const outreachId = optional(raw.outreachId, 80);
    let input;
    if (outreachId !== null) {
      if (context.clientResolution !== null) fail('Exact outreach selection suppresses client resolution');
      input = {outreachId};
    } else {
      const reference = optional(raw.clientId, 80)?.trim() || null;
      const resolution = context.clientResolution;
      let clientId = null;
      if (reference === null) {
        if (resolution !== null) fail('Absent outreach client selector cannot carry a resolution');
      } else {
        if (resolution === null || resolution.reference !== reference ||
            resolution.reference.trim() !== resolution.reference || resolution.reference.length > 80 ||
            UUID.test(reference) && !sameId(reference, resolution.clientId))
          fail('Outreach client differs from trusted resolution');
        clientId = resolution.clientId.toLowerCase();
      }
      input = {clientId, status: optional(raw.status, 40)?.trim() || null, limit: limit(raw.limit)};
    }
    validateShape('OutreachQueryInput', input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({})});
  }
  function assertOutreachQueryOutput(id, value, request, options) {
    const {input} = normalizeOutreachQueryInput(id, request, options);
    const page = validateOutreachQueryShape(outreachQueryOutputDefinition(id), value);
    if (Object.hasOwn(input, 'outreachId')) {
      if (!Object.hasOwn(page, 'record') || !sameId(page.record.id, input.outreachId))
        fail('Outreach exact record differs from selection');
    } else {
      if (!Object.hasOwn(page, 'campaigns') || page.campaigns.length !== Math.min(page.total, input.limit))
        fail('Outreach campaign slice differs from full fetched count');
      for (const item of page.campaigns) {
        if (input.clientId !== null && !sameId(item.clientId, input.clientId) ||
            input.status !== null && item.status !== input.status) fail('Outreach campaign filter substitution');
      }
    }
    // Server-owned resolution and observed records confer no current tenant,
    // creator/client-wall authorization, completeness, freshness or send right.
    return page;
  }
  return Object.freeze({outreachQuerySchemaId: schema.$id, OUTREACH_QUERY_OPERATION_IDS,
    outreachQueryInputDefinition, outreachQueryOutputDefinition, normalizeOutreachQueryInput,
    validateOutreachQueryShape, assertOutreachQueryOutput});
}
