import { canonicalSha256 } from '../validate.mjs';
const fail = message => { throw new Error(message); };

export function createMailValidators({validateShape, assertSubject, assertWindow, assertSourceInventory, unique}) {
// New external mail DTOs accept inert JSON data, never coercion or accessors.
function assertMailData(value) {
  const seen = new Set(), pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (item === null || ['string', 'boolean'].includes(typeof item)) continue;
    if (typeof item === 'number' && Number.isFinite(item)) continue;
    if (typeof item !== 'object' || seen.has(item)) fail('Mail DTO requires finite, acyclic JSON data');
    seen.add(item);
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== (Array.isArray(item) ? Array.prototype : Object.prototype) && prototype !== null) fail('Mail DTO requires plain JSON objects');
    for (const name of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && name === 'length') continue;
      const property = Object.getOwnPropertyDescriptor(item, name);
      if (typeof name !== 'string' || !property.enumerable || !('value' in property)) fail('Mail DTO accessor or hidden property');
      pending.push(property.value);
    }
  }
}

function assertMailThreadInput(input) {
  assertMailData(input); validateShape('MailThreadInput', input);
  const normalized = { ...input, messageId: input.messageId ?? null, messageOffset: input.messageOffset ?? 0,
    bodyOffset: input.bodyOffset ?? 0, limit: input.limit ?? 3, maxCharacters: input.maxCharacters ?? 2000 };
  if (normalized.bodyOffset > 0 && normalized.messageId === null) fail('Body continuation requires exact messageId');
  return normalized;
}

function assertMailThreadSourcePage(page, input) {
  const normalized = assertMailThreadInput(input);
  assertMailData(page); validateShape('MailThreadSourcePage', page);
  assertSubject(page.subject, page.binding); assertWindow(page.window);
  const { checked } = assertSourceInventory(page);
  const { coverage, selection, messages, continuation } = page;
  if (canonicalSha256(selection) !== canonicalSha256(normalized) || page.argumentsSha256 !== canonicalSha256(normalized)) fail('Mail argument/selection binding mismatch');
  if (page.subject.kind !== normalized.subject.kind || (normalized.subject.kind === 'client' && page.subject.entityIds[0] !== normalized.subject.entityId)) fail('Mail requested/resolved subject mismatch');
  if (coverage.enumeration === 'complete' || continuation.cursor !== null) fail('Mail transport cannot claim complete or snapshot-safe continuation');
  if (coverage.returnedCount !== messages.length || messages.length > normalized.limit) fail('Mail returned message count mismatch');
  if (page.snapshotVersionId === null && coverage.enumeration !== 'unknown') fail('Unknown snapshot requires unknown enumeration');
  if (page.totalMessages === null) {
    if (page.hasMoreMessages !== null || page.nextMessageOffset !== null || coverage.enumerableTotal !== null) fail('Unknown mail total cannot imply continuation or total');
  } else {
    const expected = Math.min(normalized.limit, Math.max(0, page.totalMessages - normalized.messageOffset));
    const more = normalized.messageOffset + messages.length < page.totalMessages;
    if (messages.length !== expected || page.hasMoreMessages !== more || page.nextMessageOffset !== (more ? normalized.messageOffset + messages.length : null) || coverage.enumerableTotal !== page.totalMessages) fail('Mail message continuation mismatch');
    if (normalized.messageId !== null && page.totalMessages > 1) fail('Exact message selection cannot count whole thread');
  }
  unique(messages.map(message => JSON.stringify([message.sourceId, message.mailboxId, message.threadId, message.messageId])), 'mail message identity');
  unique(messages.map(message => message.readHandle), 'mail read handle');
  if (new Set(messages.map(message => message.mailboxId)).size > 1) fail('Mail thread cannot substitute another mailbox');
  const bodies = [];
  for (const message of messages) {
    if (!checked.includes(message.sourceId)) fail('Mail source is not eligible');
    if (message.threadId !== normalized.threadId || (normalized.messageId !== null && message.messageId !== normalized.messageId)) fail('Mail thread/message selection mismatch');
    if (message.scopes.some(scope => !page.subject.scopes.some(parent => canonicalSha256(parent) === canonicalSha256(scope)))) fail('Mail scope lineage mismatch');
    if (!message.scopes.some(scope => scope.kind === 'mailbox' && scope.resourceId === message.mailboxId)) fail('Mail mailbox scope mismatch');
    if (!continuation.requiredReads.includes(message.readHandle)) fail('Mail transport requires unresolved decisive read');
    if (message.recordVersionId === null && coverage.enumeration !== 'unknown') fail('Unknown record version requires unknown enumeration');
    const source = page.sources.find(row => row.sourceId === message.sourceId);
    if (source.authority !== 'authoritative') fail('Stored mail body requires authoritative source');
    if (page.snapshotVersionId !== null && source.snapshotVersionId !== page.snapshotVersionId) fail('Mail snapshot lineage mismatch');
    const section = message.section, length = section.text?.length;
    if (section.endExclusive < section.start || section.endExclusive - section.start > normalized.maxCharacters || (section.text !== null && length !== section.endExclusive - section.start)) fail('Mail UTF-16 section length mismatch');
    if (section.text === null && (!['missing', 'unknown'].includes(message.bodyCompleteness) || section.totalCodeUnits !== null || section.start !== section.endExclusive)) fail('Missing mail text cannot claim material or known size');
    if (message.bodyCompleteness === 'missing' && section.text !== null) fail('Missing mail body cannot contain text');
    if (section.totalCodeUnits === null) {
      if (section.start !== normalized.bodyOffset || section.hasMore !== null) fail('Unknown body size cannot claim completion');
    } else {
      const start = Math.min(normalized.bodyOffset, section.totalCodeUnits);
      const end = Math.min(section.totalCodeUnits, normalized.bodyOffset + normalized.maxCharacters);
      if (section.start !== start || section.endExclusive !== end || section.hasMore !== (end < section.totalCodeUnits)) fail('Mail body continuation mismatch');
    }
    if (section.hasMore === true) bodies.push({ messageId: message.messageId, bodyOffset: section.endExclusive });
  }
  if (canonicalSha256(page.nextBodyOffsets) !== canonicalSha256(bodies)) fail('Mail body continuation inventory mismatch');
  if ((bodies.length || page.hasMoreMessages === true) && !coverage.truncated) fail('Incomplete mail sections require truncation disclosure');
  return page;
}


function operationKind(operation) {
  if (!['mail.list_messages','mail.search_messages'].includes(operation)) fail('Fixed mail candidate operation required');
  return operation === 'mail.list_messages' ? 'List' : 'Search';
}
function trustedNow(options) {
  assertMailData(options);
  if (Object.keys(options).some(k=>!['nowMs','previousPage'].includes(k))) fail('Unknown mail validation context field');
  if (!Number.isSafeInteger(options.nowMs) || options.nowMs < 0) fail('Explicit trusted nowMs required');
  return options.nowMs;
}
function normalizeCandidateInput(input, operation, options = {}, selection = false) {
  const kind = operationKind(operation);
  assertMailData(input); validateShape(`Mail${kind}${selection ? 'Selection' : 'Input'}`, input);
  const normalized = {...input,folder:input.folder ?? 'all',withinDays:input.withinDays ?? null,
    limit:input.limit ?? (kind === 'List' ? 15 : 20),offset:input.offset ?? 0,asOf:input.asOf ?? null};
  if (kind === 'Search') {
    for (const field of ['query','from','participant']) {
      normalized[field] = (input[field] ?? '').trim();
      if (normalized[field].length > 200) fail('Mail search term exceeds 200 UTF-16 safety units');
    }
    if (!normalized.query && !normalized.from && !normalized.participant && normalized.withinDays === null && normalized.folder === 'all') fail('Unrestricted mail search requires a filter');
  }
  if (normalized.offset > 0 && normalized.asOf === null) fail('Mail continuation requires explicit asOf');
  if (normalized.asOf !== null && Date.parse(normalized.asOf) > trustedNow(options) + 1000) fail('Mail asOf exceeds trusted clock allowance');
  return normalized;
}
function assertMailListInput(input, options = {}) { return normalizeCandidateInput(input,'mail.list_messages',options); }
function assertMailSearchInput(input, options = {}) { return normalizeCandidateInput(input,'mail.search_messages',options); }
function filterDigest(selection) {
  return canonicalSha256({...selection,offset:0,asOf:null});
}
function assertMailCandidateSourcePage(page, input, operation, options = {}) {
  const now = trustedNow(options), kind = operationKind(operation);
  const selection = normalizeCandidateInput(input,operation,options);
  assertMailData(page); validateShape('MailCandidateSourcePage',page);
  if (page.operation.id !== operation || page.operation.version !== '0.2.0') fail('Mail operation substitution');
  validateShape(`Mail${kind}Selection`,page.selection);
  if (canonicalSha256(page.selection) !== canonicalSha256(selection) || page.argumentsSha256 !== canonicalSha256(selection) || page.filterSha256 !== filterDigest(selection)) fail('Mail candidate argument/filter binding mismatch');
  assertSubject(page.subject,page.binding); assertWindow(page.window);
  if (page.subject.kind !== selection.subject.kind || (selection.subject.kind === 'client' && page.subject.entityIds[0] !== selection.subject.entityId)) fail('Mail candidate subject substitution');
  const {checked} = assertSourceInventory(page), {queryScope:q,coverage:c,continuation:next,messages} = page;
  const anchor=Date.parse(q.asOfInclusive);
  if (anchor > now + 1000 || q.storedCreatedAtEndInclusive !== q.asOfInclusive || (selection.asOf !== null && q.asOfInclusive !== selection.asOf)) fail('Mail query anchor substitution');
  const start = selection.withinDays === null ? null : new Date(anchor - selection.withinDays * 86400000).toISOString();
  if ((start === null ? q.effectiveStartInclusive !== null : Date.parse(q.effectiveStartInclusive) !== Date.parse(start)) || q.missingEffectiveDates !== (start === null ? 'included' : 'excluded')) fail('Mail inclusive query start mismatch');
  // This is deliberately separate from page.window's exclusive requester bounds.
  if (selection.offset > 0) {
    const previous=options.previousPage;
    assertMailData(previous);validateShape('MailCandidateSourcePage',previous);
    validateShape(`Mail${kind}Selection`,previous.selection);
    const priorOffset=previous.selection.offset+previous.messages.length;
    if (previous.totalMatches===null || previous.messages.length!==Math.min(previous.selection.limit,Math.max(0,previous.totalMatches-previous.selection.offset)) || priorOffset>=previous.totalMatches || previous.coverage.returnedCount!==previous.messages.length || previous.coverage.enumerableTotal!==previous.totalMatches || previous.coverage.enumeration!=='unknown' || previous.coverage.truncated!==true || previous.continuation.cursor!==null || canonicalSha256(previous.queryScope)!==canonicalSha256(q) || (previous.selection.asOf!==null && previous.selection.asOf!==q.asOfInclusive)) fail('Mail prior-page pagination/anchor inconsistency');
    if (previous.operation.id !== operation || previous.totalMatches===null || previous.hasMore!==true || previous.messages.length===0 || previous.nextOffset!==priorOffset || priorOffset>10000 || previous.nextOffset !== selection.offset || previous.queryScope.asOfInclusive !== q.asOfInclusive || previous.filterSha256 !== page.filterSha256 || filterDigest(previous.selection) !== page.filterSha256 || previous.argumentsSha256!==canonicalSha256(previous.selection) || canonicalSha256(previous.binding)!==canonicalSha256(page.binding) || canonicalSha256(previous.subject)!==canonicalSha256(page.subject) || canonicalSha256(previous.window)!==canonicalSha256(page.window)) fail('Mail retained continuation binding mismatch');
  } else if (options.previousPage !== undefined) fail('Unexpected prior page for first offset');
  if (c.enumeration !== 'unknown' || next.cursor !== null || c.returnedCount !== messages.length || messages.length > selection.limit) fail('Mail candidate incomplete coverage/count mismatch');
  if (page.totalMatches === null) {
    if (page.hasMore !== null || page.nextOffset !== null || c.enumerableTotal !== null) fail('Unknown stored total cannot imply pagination');
  } else {
    const count=Math.min(selection.limit,Math.max(0,page.totalMatches-selection.offset));
    const more=selection.offset+messages.length<page.totalMatches;
    const offset=selection.offset+messages.length;
    if (messages.length!==count || page.hasMore!==more || page.nextOffset!==(more && messages.length>0 && offset<=10000 ? offset : null) || c.enumerableTotal!==page.totalMatches) fail('Mail deduplicated message pagination mismatch');
  }
  if (page.hasMore === true && !c.truncated) fail('Mail continuation needs truncation disclosure');
  unique(messages.map(r=>JSON.stringify([r.mailboxId,r.internetMessageId !== null && r.internetMessageId !== '' ? r.internetMessageId : r.messageId])),'mail deduplication identity');
  unique(messages.map(r=>JSON.stringify([r.mailboxId,r.messageId])),'mail candidate identity');
  unique(messages.map(r=>r.readHandle),'mail candidate read handle');
  let prior=null;
  const groups=[];
  for (const message of messages) {
    if (!checked.includes(message.sourceId)) fail('Mail candidate source not eligible');
    const source=page.sources.find(r=>r.sourceId===message.sourceId);
    if (source.authority!=='authoritative' || source.snapshotVersionId!==null) fail('Mail candidate unknown stored version/source mismatch');
    if (message.scopes.some(s=>!page.subject.scopes.some(parent=>canonicalSha256(s)===canonicalSha256(parent))) || !message.scopes.some(s=>s.kind==='mailbox' && s.resourceId===message.mailboxId)) fail('Mail candidate scope lineage mismatch');
    if (!next.requiredReads.includes(message.readHandle)) fail('Mail preview requires decisive read');
    if (selection.subject.kind==='client' && message.clientId!==selection.subject.entityId) fail('Mail candidate client selection mismatch');
    const effective=message.receivedAt ?? message.sentAt;
    if (message.effectiveAt!==effective || Date.parse(message.createdAt)>anchor || (effective!==null && Date.parse(effective)>anchor) || (start!==null && (effective===null || Date.parse(effective)<Date.parse(start)))) fail('Mail candidate inclusive timestamp eligibility mismatch');
    if (message.preview.text!==null && Buffer.byteLength(message.preview.text,'utf8')>65536) fail('Mail preview protocol byte safety cap');
    if (prior) {
      const before=prior.effectiveAt===null ? -Infinity : Date.parse(prior.effectiveAt), after=effective===null ? -Infinity : Date.parse(effective);
      if (after>before || (after===before && message.messageId>prior.messageId)) fail('Mail candidate order mismatch');
    }
    prior=message;
    let group=groups.find(g=>g.mailboxId===message.mailboxId && g.threadId===message.threadId);
    if (!group) {group={mailboxId:message.mailboxId,threadId:message.threadId,messageIds:[]};groups.push(group);}
    group.messageIds.push(message.messageId);
  }
  if (kind==='List' ? canonicalSha256(page.threadGroups)!==canonicalSha256(groups) || page.returnedThreadGroupCount!==groups.length : page.threadGroups!==null || page.returnedThreadGroupCount!==null) fail('Mail page-only thread groups mismatch');
  return page;
}
return {assertMailThreadInput,assertMailThreadSourcePage,assertMailListInput,assertMailSearchInput,assertMailCandidateSourcePage};
}
