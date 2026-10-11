import { canonicalSha256 } from '../validate.mjs';
import { createHash } from 'node:crypto';
const fail = message => { throw new Error(message); };
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

/**
 * Operational-read transport contracts for two still-unregistered operations:
 * `query_tasks` and `query_action_items`.
 *
 * Candidate-only structural validation. Behaviour was read from pinned frozen Git objects only
 * (`neo-capiro/capirov2@fd8765ec…`): `meri-tools.service.ts` handlers `queryTasks`/`queryActionItems`,
 * `meri-task-read.helpers.ts`, `meri-action-item-read.helpers.ts`, their proof files and the
 * `action-recommendation` owner DTO/service. Nothing here authenticates an actor, resolves
 * authorization, proves cursor authenticity, opens a source, reads a customer record or claims
 * freshness/history/absence. Pending status means none of these validators establish evidence or
 * negative absence.
 */
export function createOperationalReadValidators({validateShape, assertSubject, assertWindow, assertSourceInventory, unique}) {
const TASK_STATUS_SELECTORS = ['open', 'overdue', 'todo', 'in_progress', 'done', 'blocked', 'canceled'];
const ACTION_STATUSES = ['new', 'triaged', 'assigned', 'drafting', 'ready_for_review', 'sent_to_client', 'outreach_completed', 'monitoring', 'dismissed', 'archived'];
const ACTION_SORTS = ['deadline', 'priority'];
const TASK_LINKED_SOURCE_OWNER = 'meetings';
const ACTION_LINKED_SOURCE_OWNER = 'source_document';
const TASK_ORDER = 'owner-order-unconfirmed';
const ACTION_ORDER = {
  deadline: 'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed',
  priority: 'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed',
};
/**
 * The unscoped legacy client-less `query_action_items` branch
 * (`ActionRecommendationReadService.list`) is observed but NOT closed. Its authorization is
 * tenant/RLS-only (no client wall, no memory wall), it emits no coverage/absence disclosure and its
 * `total` is a tenant-wide count. Its page contract is therefore left pending; it is described here
 * as inert metadata only and has no validator.
 */
const OPERATIONAL_READ_PENDING_MODES = Object.freeze([
  Object.freeze({
    operationId: 'query_action_items',
    mode: 'unscoped_legacy_list',
    pending: true,
    observedPayload: Object.freeze(['tool', 'generatedAt', 'total', 'actions']),
    reason: 'Tenant-only legacy list with no declared client/memory authorization and no coverage, pagination or absence disclosure.',
    missingOwner: 'Future gateway/control authorization and coverage owner; the legacy list service is not a sufficient transport contract.',
  }),
]);

// External operational-read DTOs accept inert JSON data, never coercion or accessors.
function assertInertData(value) {
  const seen = new Set(), pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (item === null || ['string', 'boolean'].includes(typeof item)) continue;
    if (typeof item === 'number' && Number.isFinite(item)) continue;
    if (typeof item !== 'object' || seen.has(item)) fail('Operational-read DTO requires finite, acyclic JSON data');
    seen.add(item);
    const prototype = Object.getPrototypeOf(item);
    if (prototype !== (Array.isArray(item) ? Array.prototype : Object.prototype) && prototype !== null) fail('Operational-read DTO requires plain JSON objects');
    for (const name of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && name === 'length') continue;
      const property = Object.getOwnPropertyDescriptor(item, name);
      if (typeof name !== 'string' || !property.enumerable || !('value' in property)) fail('Operational-read DTO accessor or hidden property');
      pending.push(property.value);
    }
  }
}

// Mirrors the frozen helper optionalText guard: non-empty after trimming, raw length bounded, stored trimmed.
function optionalText(input, key, max) {
  const value = input[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${key} is invalid`);
  return value.trim();
}
// Frozen readers store Date.prototype.toISOString(); the raw value must still be a full ISO instant.
function optionalInstant(input, key) {
  const value = optionalText(input, key, 80);
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) fail(`${key} must be an ISO timestamp`);
  return parsed.toISOString();
}
// Strict integer boundary: frozen clampInt / `?? fallback` coercions are observations, not adopted here.
function boundedInteger(input, key, fallback, minimum, maximum) {
  const value = input[key] === undefined || input[key] === null ? fallback : input[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) fail(`${key} must be an integer between ${minimum} and ${maximum}`);
  return value;
}
function assertKnownContext(options, allowed) {
  assertInertData(options);
  for (const key of Object.keys(options)) if (!allowed.includes(key)) fail('Unknown operational-read validation context field');
}

// Frozen `canonicalTask` content projection (key order is significant for the JSON digest).
function taskContentSha256(row) {
  return sha256(JSON.stringify({
    id: row.id, title: row.title, body: row.body, status: row.status, ownerUserId: row.ownerUserId,
    dueDate: row.dueDate, clientId: row.clientId, clientName: row.clientName, meetingId: row.meetingId,
    meetingTitle: row.meetingTitle, contactId: row.contactId, mailThreadId: row.mailThreadId,
    sourceType: row.sourceType, sourceId: row.sourceId, createdByUserId: row.createdByUserId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  }));
}
// Frozen `canonicalAction` content projection (key order is significant for the JSON digest).
function actionItemContentSha256(row) {
  return sha256(JSON.stringify({
    id: row.id, districtKey: row.districtKey, clientId: row.clientId, clientName: row.clientName,
    peCode: row.peCode, programId: row.programId, deltaId: row.deltaId, actionType: row.actionType,
    issueTitle: row.issueTitle, whatChanged: row.whatChanged, whyItMatters: row.whyItMatters,
    recommendedAction: row.recommendedAction, targetAudience: row.targetAudience,
    suggestedArtifactType: row.suggestedArtifactType, deadline: row.deadline, deadlineSource: row.deadlineSource,
    ownerUserId: row.ownerUserId, priority: row.priority, confidence: row.confidence,
    uncertainty: row.uncertainty, evidence: row.evidence, status: row.status,
    dismissalReason: row.dismissalReason, outcome: row.outcome, createdAt: row.createdAt,
    updatedAt: row.updatedAt, title: row.title, body: row.body,
  }));
}
function assertLinkedSources(sources, expectedOwner, currentClientId, message) {
  unique(sources.map(source => source.sourceRecordId), 'linked source identity');
  for (const source of sources) {
    if (source.owner !== expectedOwner) fail(`${message} linked-source owner mismatch`);
    if (source.currentClientId !== undefined && source.currentClientId !== currentClientId) fail(`${message} linked-source client mismatch`);
    if (!Number.isFinite(Date.parse(source.sourceVersion))) fail(`${message} linked-source version must be an instant`);
  }
}

function assertEnvelope(page, selection, kind, operation, scopeExpectation, options) {
  assertInertData(page); validateShape(kind, page);
  assertSubject(page.subject, page.binding); assertWindow(page.window);
  if (page.contractVersion !== '0.2.0' || page.operation.id !== operation || page.operation.version !== '0.2.0') fail('Operational-read operation substitution');
  if (page.binding.actorId !== options.actorId) fail('Operational-read trusted actor mismatch');
  if (canonicalSha256(page.selection) !== canonicalSha256(selection) || page.argumentsSha256 !== canonicalSha256(selection)) fail('Operational-read argument/selection binding mismatch');
  if (scopeExpectation === 'client') {
    if (page.subject.kind !== 'client' || page.subject.entityIds[0] !== selection.clientId) fail('Operational-read requested/resolved subject mismatch');
  } else if (page.subject.kind !== 'portfolio') fail('Authorized-scope operational read requires a portfolio subject');
  if (page.evidenceReady !== false || page.negativeAssertion.kind !== 'none') fail('Pending operational-read transport cannot assert evidence or absence');
  if (page.coverage.enumeration === 'complete' || page.coverage.enumerableTotal !== null) fail('Operational-read transport cannot claim complete enumeration or an enumerable total');
  if (page.coverage.historySupport === 'supported') fail('Operational-read transport cannot claim supported history');
  if (page.coverage.limitations.length === 0) fail('Operational-read transport requires explicit limitations');
  if (page.continuation.cursor !== null || page.continuation.remainingSources.length !== 0) fail('Operational-read transport cannot claim snapshot-safe continuation');
  for (const source of page.sources) {
    if (source.snapshotVersionId !== null) fail('Operational-read snapshot identity is unproven and must stay null');
    if (source.status === 'checked') fail('Unproven operational-read source cannot claim a checked source');
    if (source.freshness === 'fresh') fail('Operational-read freshness cannot be claimed fresh');
    if (source.asOf !== null || source.synchronizedAt !== null) fail('Operational-read source cannot claim sync timestamps');
  }
  const allowedFilters = ['clientId', 'taskId', 'ownerUserId', 'status', 'openOnly', 'dueBefore', 'limit', 'actionItemId', 'sort', 'page'];
  for (const filter of page.appliedFilters) {
    if (!allowedFilters.includes(filter.name)) fail('Unknown applied filter');
    if (Object.prototype.hasOwnProperty.call(selection, filter.name) && filter.valueSha256 !== canonicalSha256(selection[filter.name])) fail('Applied filter binding mismatch');
  }
  return assertSourceInventory(page);
}
function assertCursorDisclosure(cursor, applied) {
  if ((cursor !== null) !== applied) fail('Operational-read cursor application disclosure mismatch');
}

// ---------------------------------------------------------------- query_tasks
function assertTaskReadInput(input, options = {}) {
  assertKnownContext(options, ['nowMs', 'actorId']);
  assertInertData(input);
  // The frozen parser trims and case-folds task status before selecting its enum.
  // Validate that normalized value while retaining the raw-length check below.
  const normalized = typeof input.status === 'string'
    ? { ...input, status: input.status.trim().toLowerCase() }
    : input;
  validateShape('TaskReadInput', normalized);
  if (!Number.isSafeInteger(options.nowMs) || options.nowMs < 0) fail('Explicit trusted nowMs required');
  if (typeof options.actorId !== 'string' || !options.actorId) fail('Explicit trusted actorId required');
  const clientId = optionalText(input, 'clientId', 80);
  const taskId = optionalText(input, 'taskId', 80);
  if (input.assignedToMe !== undefined && typeof input.assignedToMe !== 'boolean') fail('assignedToMe must be a boolean');
  const ownerUserId = input.assignedToMe === true ? options.actorId : null;
  let status = optionalText(input, 'status', 30);
  if (status !== null) {
    status = status.toLowerCase();
    if (!TASK_STATUS_SELECTORS.includes(status)) fail(`status must be one of: ${TASK_STATUS_SELECTORS.join(', ')}`);
  }
  const openOnly = status === 'open' || status === 'overdue';
  let dueBefore = optionalInstant(input, 'dueBefore');
  const cursor = optionalText(input, 'cursor', 4096);
  // The frozen owner can recover the original overdue clock from its decoded
  // cursor. This pending transport does not authenticate or decode that cursor.
  if (status === 'overdue' && cursor !== null && dueBefore === null)
    fail('Overdue cursor requires the original explicit dueBefore until cursor authority is implemented');
  if (status === 'overdue' && dueBefore === null) dueBefore = new Date(options.nowMs).toISOString();
  return {
    selection: {
      clientId, taskId, ownerUserId, status, openOnly, dueBefore,
      limit: boundedInteger(input, 'limit', 25, 1, 50),
      offset: cursor === null ? 0 : null,
      cursorApplied: cursor !== null,
    },
    cursor,
  };
}
function assertTaskReadPage(page, input, options = {}) {
  const { selection, cursor } = assertTaskReadInput(input, options);
  assertEnvelope(page, selection, 'TaskReadPage', 'query_tasks', selection.clientId === null ? 'portfolio' : 'client', options);
  const { scope, pageCoverage: pc, tasks, coverage } = page;
  if (page.clientId !== selection.clientId) fail('Task client scope substitution');
  if (scope.kind !== (selection.clientId === null ? 'authorized_tasks' : 'client')) fail('Task scope kind substitution');
  if (scope.tenantId !== page.binding.tenantId || scope.actorUserId !== page.binding.actorId) fail('Task scope actor substitution');
  if (scope.ownerUserId !== selection.ownerUserId || scope.taskId !== selection.taskId || scope.status !== selection.status
    || scope.dueBefore !== selection.dueBefore || scope.limit !== selection.limit) fail('Task scope substitution');
  assertCursorDisclosure(cursor, scope.cursorApplied);
  if (scope.cursorApplied !== selection.cursorApplied) fail('Task cursor disclosure mismatch');
  if (!scope.cursorApplied && scope.offset !== 0) fail('Task scope offset substitution');
  if (page.order !== TASK_ORDER) fail('Task order disclosure mismatch');
  if (page.returned !== tasks.length || coverage.returnedCount !== tasks.length || tasks.length > selection.limit) fail('Task returned count mismatch');
  unique(tasks.map(task => task.id), 'task identity');
  const hasMore = scope.offset + page.returned < page.total;
  const paginationComplete = !hasMore;
  const complete = pc.sourceStatus === 'healthy' && !scope.cursorApplied && !hasMore && page.returned === page.total;
  for (const task of tasks) {
    if (selection.clientId !== null && task.clientId !== selection.clientId) fail('Task client substitution');
    if (selection.ownerUserId !== null && task.ownerUserId !== selection.ownerUserId) fail('Task owner substitution');
    if (selection.taskId !== null && task.id !== selection.taskId) fail('Task exact identity substitution');
    if (selection.clientId === null) {
      const overdue = task.dueDate !== null && Date.parse(task.dueDate) < options.nowMs && task.status !== 'done' && task.status !== 'canceled';
      if (typeof task.overdue !== 'boolean' || task.overdue !== overdue) fail('Task overdue derivation mismatch');
    } else if (task.overdue !== undefined) fail('Client-scoped task page cannot carry an unscoped overdue flag');
    if (task.nativeCompletion.completed !== (task.status === 'done')
      || task.nativeCompletion.evidence !== (task.status === 'done' ? 'native_task_status' : null)
      || task.nativeCompletion.establishesDeliveryOrAcceptance !== false) fail('Task native completion mismatch');
    const proof = task.sourceProof;
    if (proof.sourceRecordId !== task.id || proof.currentClientId !== task.clientId || proof.sourceVersion !== task.updatedAt) fail('Task source provenance mismatch');
    if (proof.contentSha256 !== taskContentSha256(task)) fail('Task source content hash mismatch');
    assertLinkedSources(proof.linkedSources, TASK_LINKED_SOURCE_OWNER, task.clientId, 'Task');
  }
  if (pc.complete !== complete || pc.partial !== !complete || pc.paginationComplete !== paginationComplete
    || pc.hasMore !== hasMore || ((pc.nextCursor !== null) !== hasMore) || pc.absenceSupported !== (complete && page.returned === 0)) fail('Task page coverage mismatch');
  if (coverage.truncated !== !complete) fail('Task truncation disclosure mismatch');
  if (complete && coverage.enumeration !== 'unknown') fail('Task completeness cannot upgrade source enumeration');
  if (page.continuation.requiredReads.length !== 0) fail('Task page requires no decisive read');
  return page;
}

// ---------------------------------------------------------------- query_action_items
function assertActionItemReadInput(input, options = {}) {
  assertKnownContext(options, ['actorId']);
  assertInertData(input); validateShape('ActionItemReadInput', input);
  const clientId = optionalText(input, 'clientId', 80);
  const status = optionalText(input, 'status', 40);
  if (status !== null && !ACTION_STATUSES.includes(status)) fail(`status must be one of: ${ACTION_STATUSES.join(', ')}`);
  const sortInput = optionalText(input, 'sort', 20);
  if (sortInput !== null && !ACTION_SORTS.includes(sortInput)) fail('sort must be deadline or priority');
  if (clientId === null) {
    // Frozen queryActionItems: exact identity or pagination without a client is refused outright.
    if (input.cursor !== undefined || input.actionItemId !== undefined) fail('clientId is required for exact action-item identity or pagination reads');
    return {
      mode: 'unscoped_legacy_pending',
      selection: { clientId: null, status, sort: sortInput ?? 'deadline', limit: boundedInteger(input, 'limit', 20, 1, 50) },
      cursor: null,
    };
  }
  const actionItemId = optionalText(input, 'actionItemId', 80);
  const cursor = optionalText(input, 'cursor', 4096);
  return {
    mode: 'client_scoped',
    selection: {
      clientId, actionItemId, status, sort: sortInput ?? 'deadline',
      page: cursor === null ? 1 : null,
      limit: boundedInteger(input, 'limit', 20, 1, 50),
      cursorApplied: cursor !== null,
    },
    cursor,
  };
}
function assertActionItemClientScopedPage(page, input, options = {}) {
  if (typeof options.actorId !== 'string' || !options.actorId) fail('Explicit trusted actorId required');
  const { mode, selection, cursor } = assertActionItemReadInput(input, options);
  if (mode !== 'client_scoped') fail('The unscoped legacy action-item list has no validated page contract');
  assertEnvelope(page, selection, 'ActionItemClientScopedPage', 'query_action_items', 'client', options);
  const { scope, pageCoverage: pc, actions, coverage } = page;
  if (page.clientId !== selection.clientId) fail('Action item client scope substitution');
  if (scope.actionItemId !== selection.actionItemId || scope.status !== selection.status
    || scope.sort !== selection.sort || scope.limit !== selection.limit) fail('Action item scope substitution');
  assertCursorDisclosure(cursor, scope.cursorApplied);
  if (scope.cursorApplied !== selection.cursorApplied) fail('Action item cursor disclosure mismatch');
  if (scope.cursorApplied ? (selection.page !== null || scope.page < 2) : (selection.page !== 1 || scope.page !== 1)) fail('Action item page substitution');
  if (page.order !== ACTION_ORDER[selection.sort]) fail('Action item order disclosure mismatch');
  if (page.returned !== actions.length || coverage.returnedCount !== actions.length || actions.length > selection.limit) fail('Action item returned count mismatch');
  if (selection.actionItemId !== null && actions.length > 1) fail('Action item exact identity returned more than one row');
  unique(actions.map(action => action.id), 'action-item identity');
  const hasMore = scope.page * scope.limit < page.total;
  const complete = pc.sourceStatus === 'healthy' && !scope.cursorApplied && !hasMore && page.returned === page.total;
  for (const action of actions) {
    if (action.clientId !== selection.clientId) fail('Action item client substitution');
    if (selection.actionItemId !== null && action.id !== selection.actionItemId) fail('Action item exact identity substitution');
    if (action.nativeCompletion.completed !== false
      || action.nativeCompletion.evidence !== (action.outcome !== null ? 'recommendation_outcome_only' : null)
      || action.nativeCompletion.establishesDeliveryOrAcceptance !== false) fail('Action item native completion mismatch');
    const proof = action.sourceProof;
    if (proof.sourceRecordId !== action.id || proof.currentClientId !== action.clientId || proof.sourceVersion !== action.updatedAt) fail('Action item source provenance mismatch');
    if (proof.contentSha256 !== actionItemContentSha256(action)) fail('Action item source content hash mismatch');
    assertLinkedSources(proof.linkedSources, ACTION_LINKED_SOURCE_OWNER, action.clientId, 'Action item');
    const linkedIds = new Set(proof.linkedSources.map(source => source.sourceRecordId));
    for (const ref of action.evidence) {
      if (ref.kind === 'source' && !linkedIds.has(ref.sourceDocumentId ?? '')) fail('Action item evidence source is not linked');
    }
  }
  if (pc.complete !== complete || pc.partial !== !complete || pc.paginationComplete !== !hasMore || pc.hasMore !== hasMore
    || ((pc.nextCursor !== null) !== hasMore) || pc.absenceSupported !== (complete && page.returned === 0)) fail('Action item page coverage mismatch');
  if (coverage.truncated !== !complete) fail('Action item truncation disclosure mismatch');
  if (complete && coverage.enumeration !== 'unknown') fail('Action item completeness cannot upgrade source enumeration');
  if (page.continuation.requiredReads.length !== 0) fail('Action item page requires no decisive read');
  return page;
}

return {assertTaskReadInput, assertTaskReadPage, assertActionItemReadInput, assertActionItemClientScopedPage, OPERATIONAL_READ_PENDING_MODES};
}
