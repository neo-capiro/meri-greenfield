/** Public synthetic source pages, never native mail data or live source credentials. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';

export const NOW = Date.parse('2026-10-13T12:00:00.000Z');
export const uuid = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
export const bodyText = `Preview excludes the decisive decision. ${'x'.repeat(2200)}\nThe committee approved the revised allocation. 😀`;
const clone = value => structuredClone(value);
const anchor = new Date(NOW - 1000).toISOString();
export const endpoints = Object.freeze({
  'mail.list_messages': 'https://canonical-mail.example.invalid/list',
  'mail.search_messages': 'https://canonical-mail.example.invalid/search',
  'mail.read_thread': 'https://canonical-mail.example.invalid/thread',
});
export function createMailFixture(id = 'mail.list_messages', {client = false} = {}) {
  const operation = {id, version: '0.2.0'}, contract = resolveOperationContract(operation);
  const state = {now: NOW, total: 2}, calls = [], wire = [], credentialCalls = [];
  const binding = {tenantId: 'synthetic-tenant', actorId: 'synthetic-user', conversationId: uuid('1'),
    runId: uuid('2'), attemptId: uuid('3'), workerId: uuid('4'), writerFence: 1};
  const mailboxId = uuid('a'), clientId = uuid('b');
  const mailboxScope = {tenantId: binding.tenantId, kind: 'mailbox', resourceId: mailboxId, policyRevision: 'synthetic-policy-1'};
  const scopes = client ? [mailboxScope, {tenantId: binding.tenantId, kind: 'client', resourceId: clientId,
    policyRevision: mailboxScope.policyRevision}] : [mailboxScope];
  const claims = {capabilityId: uuid('5'), issuer: 'synthetic-issuer', audience: 'meri-gateway', binding,
    actions: ['tool.read'], scopes, issuedAt: new Date(NOW-1000).toISOString(), expiresAt: new Date(NOW+10000).toISOString(),
    policyRevision: mailboxScope.policyRevision, budgets: {maxTurns: 5, maxRuntimeSeconds: 10, maxCostMicrousd: 1, maxOutputBytes: 1048576}};
  const subject = {kind: client ? 'client' : 'personal', entityType: client ? 'client' : 'user',
    entityIds: [client ? clientId : binding.actorId], tenantId: binding.tenantId, actorId: binding.actorId,
    authorizationDecisionId: uuid('6'), policyRevision: mailboxScope.policyRevision, scopes, rosterVersionId: null};
  const authority = {binding, claims, subject, policyRevision: mailboxScope.policyRevision, sourceIds: ['mail'], deadlineMs: NOW+10000};
  const requestedSubject = client ? {kind: 'client', entityId: clientId} : {kind: 'personal'};
  const args = id === 'mail.read_thread' ? {subject: requestedSubject, threadId: uuid('c'), limit: 1}
    : {subject: requestedSubject, limit: 1, ...(id === 'mail.search_messages' ? {query: '  revised allocation  '} : {})};
  const input = (request = args) => contract.normalizeInput(request, {nowMs: state.now}).input;
  function page(selection = input(), current = authority) {
    const base = {contractVersion: '0.2.0', operation: clone(operation), requestId: uuid('d'), traceId: uuid('e'), binding: clone(current.binding),
      subject: clone(current.subject), window: {basis: 'unbounded'}, argumentsSha256: canonicalSha256(selection), appliedFilters: [],
      sources: [{sourceId: 'mail', authority: 'authoritative', snapshotVersionId: null, adapterVersion: '0.2.0',
        status: 'partial', synchronizedAt: null, asOf: null, retrievedAt: anchor, freshness: 'unknown'}],
      selection: clone(selection), snapshotVersionId: null, evidenceReady: false, negativeAssertion: {kind: 'none'}};
    if (id === 'mail.read_thread') {
      const start = Math.min(selection.bodyOffset, bodyText.length), end = Math.min(bodyText.length, selection.bodyOffset+selection.maxCharacters);
      const message = {sourceId: 'mail', mailboxId, threadId: selection.threadId, messageId: selection.messageId ?? uuid('9'),
        recordVersionId: 'synthetic-message-v1', citationId: uuid('f'), contentSha256: createHash('sha256').update(bodyText).digest('hex'),
        scopes: clone(current.subject.scopes), removed: false, connectionStatus: 'disconnected', bodyCompleteness: 'full',
        readHandle: 'synthetic-authorized-mail-body', section: {start, endExclusive: end, totalCodeUnits: bodyText.length,
          unit: 'utf16-code-unit', text: bodyText.slice(start, end), hasMore: end < bodyText.length}};
      const messages = selection.messageOffset > 0 ? [] : [message];
      return {...base, kind: 'mail-thread-source-page', order: 'sentAt-asc_receivedAt-asc_createdAt-asc_nulls-and-ties-unspecified',
        messages, totalMessages: 1, hasMoreMessages: false, nextMessageOffset: null,
        nextBodyOffsets: messages.length && end < bodyText.length ? [{messageId: message.messageId, bodyOffset: end}] : [],
        coverage: {sourcesRequested: ['mail'], sourcesChecked: ['mail'], sourcesUnavailable: [], enumeration: 'unknown', enumerableTotal: 1,
          returnedCount: messages.length, truncated: messages.length > 0 && end < bodyText.length, historySupport: 'bounded',
          limitations: ['Synthetic bounded stored body; immutable snapshot unqualified.']},
        continuation: {cursor: null, requiredReads: messages.map(row => row.readHandle), remainingSources: []}};
    }
    const count = state.total === null ? 1 : Math.min(selection.limit, Math.max(0, state.total-selection.offset));
    const asOf = selection.asOf ?? anchor;
    const messages = Array.from({length: count}, (_, n) => {
      const ordinal = selection.offset+n, timestamp = new Date(Date.parse(asOf)-ordinal*1000).toISOString();
      return {sourceId: 'mail', mailboxId, threadId: uuid('c'), messageId: uuid(String(9-ordinal)), recordVersionId: null,
        citationId: null, scopes: clone(current.subject.scopes), removed: false, connectionStatus: 'disconnected',
        readHandle: `synthetic-preview-${ordinal}`, internetMessageId: `<synthetic-${ordinal}@example.invalid>`,
        clientId: client ? clientId : null, receivedAt: timestamp, sentAt: null, createdAt: timestamp, effectiveAt: timestamp,
        subjectText: 'Synthetic mail candidate', preview: {kind: 'incomplete-preview', text: 'Preview excludes the decisive decision.', fullSizeKnown: false},
        from: {email: null, name: null}, to: [], cc: [], toTruncated: false, ccTruncated: false};
    });
    const more = state.total === null ? null : selection.offset+count < state.total;
    return {...base, kind: 'mail-candidate-source-page', messages, filterSha256: canonicalSha256({...selection, offset: 0, asOf: null}),
      order: 'effectiveAt-desc-nullslast_messageId-desc', queryScope: {asOfInclusive: asOf, storedCreatedAtEndInclusive: asOf,
        effectiveStartInclusive: selection.withinDays === null ? null : new Date(Date.parse(asOf)-selection.withinDays*86400000).toISOString(),
        missingEffectiveDates: selection.withinDays === null ? 'included' : 'excluded'}, totalMatches: state.total, hasMore: more,
      nextOffset: more && count > 0 ? selection.offset+count : null,
      threadGroups: id === 'mail.list_messages' ? (count ? [{mailboxId, threadId: uuid('c'), messageIds: messages.map(row => row.messageId)}] : []) : null,
      returnedThreadGroupCount: id === 'mail.list_messages' ? (count ? 1 : 0) : null,
      coverage: {sourcesRequested: ['mail'], sourcesChecked: ['mail'], sourcesUnavailable: [], enumeration: 'unknown', enumerableTotal: state.total,
        returnedCount: count, truncated: more === true, historySupport: 'bounded', limitations: ['Synthetic incomplete previews; unknown immutable snapshot.']},
      continuation: {cursor: null, requiredReads: messages.map(row => row.readHandle), remainingSources: []}};
  }
  const credentials = pins => ({operation: clone(pins.operation), argumentsSha256: pins.argumentsSha256,
    metadata: clone(pins.metadata), requestSha256: pins.requestSha256,
    binding: clone(pins.binding), subject: clone(pins.subject), policyRevision: pins.policyRevision, sourceIds: clone(pins.sourceIds),
    bearerToken: 'SYNTHETIC_MAIL_TOKEN', serviceSecret: 'SYNTHETIC_SERVICE_SECRET', expiresAtMs: NOW+10000});
  const config = {endpoints, now: () => state.now, maxRequestMs: 1000, maxResponseBytes: 1048576,
    async getCredentials(pins) {calls.push('credentials'); credentialCalls.push(pins); return credentials(pins);},
    async fetchImpl(url, options) {calls.push('fetch'); wire.push({url, options});
      return new Response(JSON.stringify(page(JSON.parse(options.body).input)), {headers: {'content-type': 'application/json'}});}};
  const call = (request = args, current = authority) => ({input: input(request), request, authority: current,
    argumentsSha256: canonicalSha256(input(request))});
  return {operation, contract, state, calls, wire, credentialCalls, binding, subject, claims, authority, args, input, page,
    credentials, config, call, mailboxId, clientId, anchor};
}
