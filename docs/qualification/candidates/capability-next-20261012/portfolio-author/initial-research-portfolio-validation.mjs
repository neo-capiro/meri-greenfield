// Private source-only Research Portfolio DTO boundary. No source access,
// authorization decisions, cursor signing, task lifecycle or import effects.
// Frozen DTOs and projections: capirov2 fd8765ec, recorded in the author report.
// The wrapper and binding/subject options are NEW Meri contracts, not legacy
// wire fields or evidence that current conversation/grant/wall checks occurred.
import { types } from 'node:util';

const fail = message => { throw new Error(message); };
const DETAIL = 'get_research_portfolio', CHANGES = 'get_research_portfolio_changes';

// Standalone family calls must be inert before Ajv reads values. Registered
// operations additionally use the canonical resolver's immutable JSON snapshot.
function data(value) {
  const active = new Set(), pending = [{value, depth: 0}];
  let nodes = 0, scheduled = 1, bytes = 0;
  while (pending.length) {
    const item = pending.pop();
    if (item.exit) { active.delete(item.value); continue; }
    const {value, depth} = item;
    if (++nodes > 100000 || depth > 64) fail('Portfolio JSON structure limit');
    if (value === null || ['string', 'boolean'].includes(typeof value) ||
        (typeof value === 'number' && Number.isFinite(value))) {
      bytes += typeof value === 'string' ? Buffer.byteLength(value) : 8;
    } else {
      if (!value || typeof value !== 'object' || types.isProxy(value) || active.has(value))
        fail('Portfolio requires inert JSON');
      const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
      if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null)
        fail('Portfolio requires plain JSON');
      const keys = Reflect.ownKeys(value), fields = Object.getOwnPropertyDescriptors(value);
      if (keys.length > 100000 || keys.some(key => typeof key !== 'string' ||
          !Object.hasOwn(fields[key], 'value') || (!fields[key].enumerable && !(array && key === 'length'))))
        fail('Portfolio accessor or hidden field');
      if (array && (keys.length !== fields.length.value + 1 ||
          keys.filter(key => key !== 'length').some((key, index) => key !== String(index))))
        fail('Portfolio sparse or extended array');
      scheduled += keys.length - (array ? 1 : 0);
      if (scheduled > 100000) fail('Portfolio JSON structure limit');
      active.add(value); pending.push({value, exit: true});
      for (const key of keys) if (!(array && key === 'length')) {
        bytes += Buffer.byteLength(key) + 4;
        pending.push({value: fields[key].value, depth: depth + 1});
      }
    }
    if (bytes > 16 * 1024 * 1024) fail('Portfolio JSON byte limit');
  }
}

function kind(operation) {
  if (operation === DETAIL) return 'Detail';
  if (operation === CHANGES) return 'Changes';
  fail('Unsupported Research Portfolio operation');
}

function unique(rows, key, label) {
  if (new Set(rows.map(row => row[key])).size !== rows.length) fail(`Duplicate portfolio ${label}`);
}

function times(row, keys) {
  for (const key of keys) if (row[key] !== null && !Number.isFinite(Date.parse(row[key])))
    fail('Portfolio timestamp must identify a finite instant');
}

function events(rows) {
  unique(rows, 'id', 'event');
  let previous = null;
  for (const event of rows) {
    times(event, ['occurredAt']);
    const instant = Date.parse(event.occurredAt);
    if (previous && (instant > previous.instant ||
        (instant === previous.instant && event.id >= previous.id)))
      fail('Portfolio events require descending time/id order');
    previous = {instant, id: event.id};
  }
}

export function createResearchPortfolioValidators({validateShape, assertSubject, canonicalSha256}) {
  function context(options) {
    data(options);
    validateShape('ResearchPortfolioContext', options);
    assertSubject(options.subject, options.binding);
    if (options.subject.kind !== 'entity' || options.subject.entityType !== 'research-portfolio' ||
        options.subject.entityIds.length !== 1 || options.subject.rosterVersionId !== null)
      fail('Current research-portfolio entity subject required');
    return {conversationId: options.binding.conversationId, portfolioId: options.subject.entityIds[0]};
  }

  function normalizeResearchPortfolioInput(operation, input, options = {}) {
    const type = kind(operation);
    data(input);
    const selected = context(options);
    validateShape(`ResearchPortfolio${type}Input`, input);
    if (input.conversationId !== undefined && input.conversationId !== selected.conversationId)
      fail('Portfolio conversation selector differs from current binding');
    if (type === 'Changes') {
      selected.cursor = input.cursor?.trim() || null;
      selected.limit = input.limit ?? 25;
    }
    validateShape(`ResearchPortfolio${type}Selection`, selected);
    return selected;
  }

  function assertResearchPortfolioReadResult(operation, page, input, options = {}) {
    const type = kind(operation), selected = normalizeResearchPortfolioInput(operation, input, options);
    data(page);
    validateShape(`ResearchPortfolio${type}Result`, page);
    assertSubject(page.subject, page.binding);
    if (canonicalSha256(page.binding) !== canonicalSha256(options.binding) ||
        canonicalSha256(page.subject) !== canonicalSha256(options.subject))
      fail('Portfolio result differs from current binding/subject');
    const result = page.data;
    if (type === 'Detail') {
      if (result.id !== selected.portfolioId) fail('Portfolio result identity differs from subject');
      if (result.memberCount !== result.members.length || result.clientLinkCount !== result.clientLinks.length)
        fail('Portfolio projected counts differ from returned members/visible links');
      unique(result.grants, 'id', 'grant'); unique(result.grants, 'principalUserId', 'grant principal');
      unique(result.clientLinks, 'id', 'client link'); unique(result.clientLinks, 'clientId', 'linked client');
      unique(result.members, 'id', 'member');
      const actorGrant = result.grants.find(row => row.principalUserId === options.subject.actorId);
      if (!actorGrant || actorGrant.role !== result.myRole)
        fail('Portfolio reported role differs from projected actor grant');
      times(result, ['archivedAt', 'createdAt', 'updatedAt']);
      for (const row of result.grants) times(row, ['createdAt', 'updatedAt']);
      for (const row of result.clientLinks) times(row, ['createdAt']);
      for (const row of result.members) times(row, ['resolvedAt', 'createdAt', 'updatedAt']);
      // Historical event revisions are deliberately not equated with current
      // detail revision; neither field authenticates the captured scope receipt.
      events(result.recentEvents);
    } else {
      if (result.items.length > selected.limit) fail('Portfolio changes exceed requested limit');
      events(result.items);
      if (result.nextCursor !== null && (!result.items.length ||
          result.nextCursor !== result.items.at(-1).id || result.nextCursor === selected.cursor))
        fail('Portfolio changes cursor must advance from the last returned event');
      for (const event of result.items) {
        if (event.id === selected.cursor) fail('Portfolio changes repeat the requested cursor event');
        if (event.state !== null) {
          if (event.state.eventId !== event.id || event.state.recipientUserId !== options.subject.actorId)
            fail('Portfolio change state belongs to another event/recipient');
          times(event.state, ['seenAt', 'acknowledgedAt', 'dismissedAt', 'updatedAt']);
        }
      }
    }
    // Shape/correlation validation makes no current grant, wall, completeness,
    // freshness, source-truth, cursor-authenticity or negative-assertion claim.
    return page;
  }

  return {normalizeResearchPortfolioInput, assertResearchPortfolioReadResult};
}
