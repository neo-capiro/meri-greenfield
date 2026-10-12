// New private shape boundary, independently written from frozen behavioral
// metadata. No source adapter, cursor service, current authorization or approved
// memory facts. Actual admin approval versus legacy prose remains unresolved.
import { types } from 'node:util';

const fail = message => { throw new Error(message); };

// This family's small inert DTO admission precedes Ajv and property reads.
// Existing canonical admission is private to registered operations; this family
// is intentionally unregistered. No generic shared framework is introduced.
function assertData(value) {
  const seen = new Set(), pending = [{value, depth: 0}];
  let nodes = 0, bytes = 0;
  while (pending.length) {
    const {value: item, depth} = pending.pop();
    if (++nodes > 512 || depth > 12) fail('Proposal DTO structure limit');
    if (item === null || ['string', 'boolean'].includes(typeof item) ||
        (typeof item === 'number' && Number.isFinite(item))) {
      bytes += typeof item === 'string' ? Buffer.byteLength(item) : 8;
      if (bytes > 262144) fail('Proposal DTO byte limit');
      continue;
    }
    if (!item || typeof item !== 'object' || types.isProxy(item) || seen.has(item))
      fail('Proposal DTO requires inert acyclic JSON');
    seen.add(item);
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null)
      fail('Proposal DTO requires plain JSON');
    const keys = Reflect.ownKeys(item), properties = Object.getOwnPropertyDescriptors(item);
    if (keys.length > 512 || keys.some(key => typeof key !== 'string' ||
        !Object.hasOwn(properties[key], 'value') || (!properties[key].enumerable && !(array && key === 'length'))))
      fail('Proposal DTO accessor/hidden field');
    if (array && (keys.length !== properties.length.value + 1 ||
        keys.filter(key => key !== 'length').some((key, index) => key !== String(index))))
      fail('Proposal DTO sparse or extended array');
    for (const key of keys) if (!(array && key === 'length')) {
      bytes += Buffer.byteLength(key);
      pending.push({value: properties[key].value, depth: depth + 1});
    }
  }
}

export function createMemoryProposalValidators({validateShape, assertSubject, unique}) {
  function context(options) {
    assertData(options);
    if (!options || Array.isArray(options) || typeof options !== 'object' ||
        Object.keys(options).some(key => !['subject', 'previous'].includes(key)) || !options.subject)
      fail('Trusted proposal subject required; unknown context refused');
    assertSubject(options.subject);
    if (!['personal', 'client'].includes(options.subject.kind)) fail('Proposal queue requires own personal or selected client subject');
    return options.subject;
  }

  function selection(input, subject) {
    validateShape('MemoryProposalInput', input);
    const currentClient = subject.kind === 'client' ? subject.entityIds[0] : null;
    if (input.clientId != null && input.clientId !== currentClient) fail('Proposal client selector disagrees with trusted subject');
    const result = {clientId: currentClient, cursor: input.cursor ?? null, limit: input.limit ?? 5};
    validateShape('MemoryProposalSelection', result);
    if (result.cursor !== null && result.cursor.length > 2048) fail('Proposal cursor UTF-16 bound');
    return result;
  }

  function result(page, requested, subject) {
    validateShape('MemoryProposalReadResult', page);
    if (page.scope.tenantId !== subject.tenantId || page.scope.userId !== subject.actorId ||
        page.scope.clientId !== requested.clientId) fail('Proposal result current actor/client binding mismatch');
    if (page.candidates.length > requested.limit) fail('Proposal page exceeds requested limit');
    if (page.nextCursor !== null && (page.nextCursor === requested.cursor || page.candidates.length === 0))
      fail('Proposal continuation requires progress');
    if (page.nextCursor !== null && page.nextCursor.length > 2048) fail('Proposal next cursor UTF-16 bound');
    unique(page.candidates.map(row => row.id.toLowerCase()), 'proposal identity');
    let previous = null;
    for (const row of page.candidates) {
      if ((row.scope === 'client') !== (row.clientId !== null)) fail('Proposal scope/client mismatch');
      if (requested.clientId !== null && row.clientId !== null && row.clientId !== requested.clientId)
        fail('Proposal row belongs to another selected client');
      if ((row.title?.length ?? 0) > 200 || (row.proposedText?.length ?? 0) > 2000)
        fail('Proposal content UTF-16 bound');
      if (row.restricted && (row.title !== null || row.proposedText !== null || row.contentTruncated))
        fail('Restricted proposal must disclose no content');
      if (previous && (Date.parse(row.createdAt) > Date.parse(previous.createdAt) ||
          (Date.parse(row.createdAt) === Date.parse(previous.createdAt) && row.id.toLowerCase() >= previous.id.toLowerCase())))
        fail('Proposal page requires descending createdAt/id order');
      previous = row;
    }
    if (page.coverage.firstPage !== (requested.cursor === null)) fail('Proposal first-page disclosure mismatch');
    if (!page.enabled) {
      if (page.candidates.length || page.nextCursor !== null || page.coverage.complete ||
          page.coverage.reason !== 'review_disabled') fail('Disabled proposal queue cannot claim records or completeness');
      return {kind: 'unavailable', claimsAreApprovedFacts: false, evidenceReady: false, negativeAssertion: 'none'};
    }
    const complete = requested.cursor === null && page.nextCursor === null &&
      page.candidates.every(row => !row.restricted && !row.contentTruncated && row.proposedText !== null);
    if (page.coverage.complete !== complete || page.coverage.reason !== (complete
        ? 'own_pending_proposals_complete' : 'unread_pages_restricted_or_truncated_content'))
      fail('Proposal scoped producer coverage mismatch');
    return {kind: complete ? (page.candidates.length ? 'complete' : 'empty') : 'partial',
      claimsAreApprovedFacts: false, evidenceReady: false, negativeAssertion: 'none'};
  }

  function normalizeMemoryProposalInput(input, options = {}) {
    assertData(input);
    const subject = context(options), requested = selection(input, subject);
    if (requested.cursor !== null) {
      const previous = options.previous;
      if (!previous || Array.isArray(previous) || typeof previous !== 'object' ||
          Object.keys(previous).sort().join(',') !== 'page,request') fail('Retained previous request/page required');
      const prior = selection(previous.request, subject);
      result(previous.page, prior, subject);
      if (!previous.page.enabled || previous.page.nextCursor === null ||
          previous.page.nextCursor !== requested.cursor || prior.limit !== requested.limit ||
          previous.page.nextCursor === prior.cursor) fail('Proposal continuation substituted/stalled');
    } else if (options.previous !== undefined) fail('Unexpected proposal continuation context');
    return requested;
  }

  function assertMemoryProposalReadResult(page, input, options = {}) {
    assertData(page);
    const requested = normalizeMemoryProposalInput(input, options);
    const classified = result(page, requested, options.subject);
    if (options.previous && page.candidates.length) {
      const last = options.previous.page.candidates.at(-1), first = page.candidates[0];
      if (Date.parse(first.createdAt) > Date.parse(last.createdAt) ||
          (Date.parse(first.createdAt) === Date.parse(last.createdAt) && first.id.toLowerCase() >= last.id.toLowerCase()))
        fail('Proposal continuation order failed to advance');
    }
    return classified;
  }

  return {normalizeMemoryProposalInput, assertMemoryProposalReadResult};
}
