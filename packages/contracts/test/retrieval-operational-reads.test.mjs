import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../validate.mjs';
import {
  assertCatalog, assertSkillManifest, assertTaskReadInput, assertTaskReadPage,
  assertActionItemReadInput, assertActionItemClientScopedPage, OPERATIONAL_READ_PENDING_MODES,
} from '../retrieval-0.2/validate.mjs';

// Literal synthetic DATA only. No handlers, real identities, tasks, recommendations or source access.
const uuid = '11111111-1111-4111-8111-111111111111';
const clientId = 'client-synthetic';
const taskId = '22222222-2222-4222-8222-222222222222';
const actionId = '33333333-3333-4333-8333-333333333333';
const tenantId = 'synthetic';
const actorId = 'reader';
const nowMs = Date.parse('2026-01-02T00:00:00.000Z');
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

// Inspect the unchanged private schema while exercising the canonical composed validators.
const candidateSchema = JSON.parse(readFileSync(new URL('../retrieval-0.2/operational-reads.schema.json', import.meta.url)));

const binding = () => ({ tenantId, actorId, conversationId: uuid, runId: uuid, attemptId: uuid, workerId: uuid, writerFence: 1 });
const clientScope = { tenantId, kind: 'client', resourceId: clientId, policyRevision: 'policy-v1' };
const clientSubject = () => ({ kind: 'client', entityType: 'client', entityIds: [clientId], tenantId, actorId, authorizationDecisionId: uuid, policyRevision: 'policy-v1', scopes: [clientScope], rosterVersionId: null });
const portfolioSubject = () => ({ kind: 'portfolio', entityType: 'client', entityIds: [clientId], tenantId, actorId, authorizationDecisionId: uuid, policyRevision: 'policy-v1', scopes: [clientScope], rosterVersionId: 'synthetic-roster-v1' });
const sourceState = () => ({ sourceId: 'engagement_tasks', authority: 'authoritative', snapshotVersionId: null, adapterVersion: '0.2.0', status: 'partial', synchronizedAt: null, asOf: null, retrievedAt: '2026-01-02T00:00:05Z', freshness: 'unknown' });
const sourceStateFor = sourceId => ({ ...sourceState(), sourceId });
const coverageOf = (sourceId, returnedCount, truncated) => ({ sourcesRequested: [sourceId], sourcesChecked: [sourceId], sourcesUnavailable: [], enumeration: 'unknown', enumerableTotal: null, returnedCount, truncated, historySupport: 'bounded', limitations: ['Synthetic pending operational-read transport; snapshot and record immutability unknown.'] });
const envelopeFor = (kind, operation, subject, selection, sourceId, returnedCount, truncated, selectionKind) => ({
  kind, contractVersion: '0.2.0', operation: { id: operation, version: '0.2.0' },
  requestId: uuid, traceId: uuid, binding: binding(), subject: subject(),
  window: { basis: 'unbounded' }, argumentsSha256: canonicalSha256(selection), appliedFilters: [],
  generatedAt: '2026-01-02T00:00:05.000Z', sources: [sourceStateFor(sourceId)],
  coverage: coverageOf(sourceId, returnedCount, truncated), selection: selectionKind ?? selection,
  snapshotVersionId: null, continuation: { cursor: null, requiredReads: [], remainingSources: [] },
  evidenceReady: false, negativeAssertion: { kind: 'none' },
});

// ---------------------------------------------------------------- query_tasks
function taskCanon(row) {
  return JSON.stringify({
    id: row.id, title: row.title, body: row.body, status: row.status, ownerUserId: row.ownerUserId,
    dueDate: row.dueDate, clientId: row.clientId, clientName: row.clientName, meetingId: row.meetingId,
    meetingTitle: row.meetingTitle, contactId: row.contactId, mailThreadId: row.mailThreadId,
    sourceType: row.sourceType, sourceId: row.sourceId, createdByUserId: row.createdByUserId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  });
}
function taskRow(over = {}) {
  const base = {
    id: taskId, title: 'Synthetic task', body: null, status: 'todo', ownerUserId: actorId,
    dueDate: '2026-01-05T00:00:00.000Z', clientId, clientName: 'Synthetic Client',
    meetingId: null, meetingTitle: null, contactId: null, mailThreadId: null,
    sourceType: 'manual', sourceId: null, createdByUserId: actorId,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z',
    recordKind: 'native_task', recommendation: false,
  };
  const row = { ...base, ...over };
  const done = row.status === 'done';
  row.nativeCompletion = {
    completed: done, evidence: done ? 'native_task_status' : null, establishesDeliveryOrAcceptance: false,
    note: done ? 'The native task is marked done, but this status alone does not prove delivery or client acceptance.' : 'The native task does not claim completion.',
  };
  row.sourceProof = { version: 1, owner: 'engagement_tasks', sourceRecordId: row.id, currentClientId: row.clientId, sourceVersion: row.updatedAt, contentSha256: sha256(taskCanon(row)), linkedSources: over.linkedSources ?? [] };
  delete row.linkedSources;
  return row;
}
function taskPage(input = {}, over = {}) {
  const { selection, cursor } = assertTaskReadInput(input, { nowMs, actorId });
  const rows = over.tasks ?? [taskRow()];
  const total = over.total ?? rows.length;
  const offset = over.offset ?? (selection.offset ?? 0);
  const hasMore = offset + rows.length < total;
  const sourceStatus = over.sourceStatus ?? 'healthy';
  const complete = sourceStatus === 'healthy' && !selection.cursorApplied && !hasMore && rows.length === total;
  const page = {
    ...envelopeFor('task-read-page', 'query_tasks', selection.clientId === null ? portfolioSubject : clientSubject, selection, 'engagement_tasks', rows.length, !complete),
    order: 'owner-order-unconfirmed', clientId: selection.clientId,
    scope: { kind: selection.clientId === null ? 'authorized_tasks' : 'client', tenantId, actorUserId: actorId, ownerUserId: selection.ownerUserId, taskId: selection.taskId, status: selection.status, dueBefore: selection.dueBefore, offset, limit: selection.limit, cursorApplied: selection.cursorApplied },
    total, returned: rows.length,
    tasks: selection.clientId === null
      ? rows.map(row => ({ ...row, overdue: over.overdue ?? (row.dueDate !== null && Date.parse(row.dueDate) < nowMs && row.status !== 'done' && row.status !== 'canceled') }))
      : rows,
    pageCoverage: { sourceStatus, sourceReason: over.sourceReason ?? (sourceStatus === 'healthy' ? null : 'owner_query_degraded'), complete, partial: !complete, paginationComplete: !hasMore, hasMore, nextCursor: hasMore ? `meri-task:${'A'.repeat(24)}` : null, totalIsExactForScope: true, absenceSupported: complete && rows.length === 0, note: complete ? 'All currently authorized native tasks matching the declared scope and filters were returned.' : 'This is an exact bounded page. Follow nextCursor before inferring that a tracked task is absent.' },
  };
  void cursor;
  return page;
}

test('task read materializes verified defaults without mutating strict input', () => {
  const value = {}, copy = structuredClone(value);
  assert.deepEqual(assertTaskReadInput(value, { nowMs, actorId }).selection, { clientId: null, taskId: null, ownerUserId: null, status: null, openOnly: false, dueBefore: null, limit: 25, offset: 0, cursorApplied: false });
  assert.deepEqual(value, copy);
  assert.deepEqual(assertTaskReadInput({ clientId, taskId, assignedToMe: true, limit: 50 }, { nowMs, actorId }).selection, { clientId, taskId, ownerUserId: actorId, status: null, openOnly: false, dueBefore: null, limit: 50, offset: 0, cursorApplied: false });
  const overdue = assertTaskReadInput({ status: 'OVERDUE' }, { nowMs, actorId }).selection;
  assert.equal(overdue.status, 'overdue');
  assert.equal(overdue.openOnly, true);
  assert.equal(overdue.dueBefore, new Date(nowMs).toISOString());
  const open = assertTaskReadInput({ status: 'open' }, { nowMs, actorId }).selection;
  assert.equal(open.openOnly, true);
  assert.equal(open.dueBefore, null);
});

test('task read rejects coercion, extra authority, bounds, unknown status and missing trusted context', () => {
  for (const patch of [
    { limit: '25' }, { limit: null }, { limit: 0 }, { limit: 51 }, { limit: 1.5 },
    { clientId: 'x'.repeat(81) }, { taskId: 'x'.repeat(81) }, { clientId: '' },
    { status: 'archived' }, { status: 'pending' }, { assignedToMe: 'true' },
    { dueBefore: 'not-a-date' }, { dueBefore: 'x'.repeat(81) }, { cursor: 'x'.repeat(4097) },
    { subject: { kind: 'client', entityId: clientId } }, { tenantId: 'other' }, { openOnly: true },
  ]) assert.throws(() => assertTaskReadInput({ ...patch }, { nowMs, actorId }), undefined, JSON.stringify(patch));
  assert.throws(() => assertTaskReadInput({}, { actorId }), /nowMs/);
  assert.throws(() => assertTaskReadInput({}, { nowMs }), /actorId/);
  assert.throws(() => assertTaskReadInput({}, { nowMs, actorId, previousPage: null }), /context/);
  assert.throws(() => assertTaskReadInput({ status: 'overdue', cursor: 'opaque' }, { nowMs, actorId }), /original explicit dueBefore/);
  assert.equal(assertTaskReadInput({ status: 'overdue', dueBefore: '2026-01-02T00:00:00.000Z', cursor: 'opaque' }, { nowMs, actorId }).selection.cursorApplied, true);
});

test('client-scoped task page pins scope, identity, provenance and honest coverage', () => {
  const good = taskPage({ clientId });
  assertTaskReadPage(good, { clientId }, { nowMs, actorId });
  for (const [index, edit] of [
    page => { page.returned = 2; }, page => { page.coverage.returnedCount = 2; }, page => { page.total = 0; },
    page => { page.clientId = null; }, page => { page.scope.kind = 'authorized_tasks'; }, page => { page.scope.limit = 10; },
    page => { page.scope.ownerUserId = 'other'; }, page => { page.scope.taskId = taskId; }, page => { page.scope.cursorApplied = true; },
    page => { page.order = 'x'; }, page => { page.tasks[0].id = 'other'; }, page => { page.tasks[0].clientId = 'other'; },
    page => { page.tasks[0].ownerUserId = 'other'; }, page => { page.tasks[0].nativeCompletion.completed = true; },
    page => { page.tasks[0].nativeCompletion.evidence = 'native_task_status'; }, page => { page.tasks[0].sourceProof.contentSha256 = 'a'.repeat(64); },
    page => { page.tasks[0].sourceProof.currentClientId = 'other'; }, page => { page.tasks[0].sourceProof.sourceRecordId = 'other'; },
    page => { page.tasks.push(structuredClone(page.tasks[0])); }, page => { page.evidenceReady = true; },
    page => { page.negativeAssertion = { kind: 'absence' }; }, page => { page.coverage.enumeration = 'complete'; },
    page => { page.coverage.enumeration = 'partial'; }, page => { page.continuation.cursor = 'c'; }, page => { page.continuation.remainingSources = ['engagement_tasks']; },
    page => { page.sources[0].freshness = 'fresh'; }, page => { page.sources[0].status = 'checked'; },
    page => { page.sources[0].snapshotVersionId = 'v1'; }, page => { page.sources[0].asOf = '2026-01-01T00:00:00Z'; },
    page => { page.coverage.limitations = []; }, page => { page.pageCoverage.partial = true; },
    page => { page.pageCoverage.paginationComplete = false; }, page => { page.pageCoverage.hasMore = true; },
    page => { page.pageCoverage.nextCursor = `meri-task:${'B'.repeat(24)}`; }, page => { page.pageCoverage.absenceSupported = true; },
    page => { page.coverage.truncated = true; }, page => { page.pageCoverage.complete = false; }, page => { page.pageCoverage.sourceStatus = 'degraded'; },
  ].entries()) {
    const target = structuredClone(good);
    edit(target);
    assert.throws(() => assertTaskReadPage(target, { clientId }, { nowMs, actorId }), undefined, `task edit ${index}`);
  }
  const exact = taskPage({ clientId, taskId }, { tasks: [taskRow()] });
  assertTaskReadPage(exact, { clientId, taskId }, { nowMs, actorId });
  const mismatched = taskPage({ clientId, taskId }, { tasks: [taskRow({ id: 'other' })] });
  assert.throws(() => assertTaskReadPage(mismatched, { clientId, taskId }, { nowMs, actorId }), /identity/);
});

test('authorized-tasks page derives overdue only when unscoped and never invents client scope', () => {
  const good = taskPage({}, { tasks: [taskRow({ clientId, dueDate: '2026-01-01T00:00:00.000Z' })] });
  assertTaskReadPage(good, {}, { nowMs, actorId });
  assert.equal(good.scope.kind, 'authorized_tasks');
  assert.equal(good.tasks[0].overdue, true);
  const tampered = taskPage({}, { tasks: [taskRow({ clientId, dueDate: '2026-01-01T00:00:00.000Z' })], overdue: false });
  assert.throws(() => assertTaskReadPage(tampered, {}, { nowMs, actorId }), /overdue/);
  const done = taskPage({}, { tasks: [taskRow({ clientId, status: 'done', dueDate: '2026-01-01T00:00:00.000Z' })] });
  assertTaskReadPage(done, {}, { nowMs, actorId });
  assert.equal(done.tasks[0].overdue, false);
  assert.equal(done.tasks[0].nativeCompletion.completed, true);
  const scoped = taskPage({ clientId });
  scoped.tasks[0].overdue = false;
  assert.throws(() => assertTaskReadPage(scoped, { clientId }, { nowMs, actorId }), /unscoped overdue/);
});

test('task pagination resumes only by a disclosed cursor and never claims complete absence', () => {
  const resumedInput = { clientId, cursor: `meri-task:${'C'.repeat(24)}` };
  const resumed = assertTaskReadInput(resumedInput, { nowMs, actorId }).selection;
  assert.equal(resumed.cursorApplied, true);
  assert.equal(resumed.offset, null);
  const page = taskPage(resumedInput, { tasks: [taskRow()], total: 3, offset: 1 });
  assertTaskReadPage(page, resumedInput, { nowMs, actorId });
  assert.equal(page.pageCoverage.hasMore, true);
  assert.equal(page.pageCoverage.paginationComplete, false);
  for (const edit of [target => { target.pageCoverage.paginationComplete = true; }, target => { target.pageCoverage.hasMore = false; }, target => { target.scope.cursorApplied = false; }]) {
    const target = structuredClone(page);
    edit(target);
    assert.throws(() => assertTaskReadPage(target, resumedInput, { nowMs, actorId }));
  }
  assert.throws(() => assertTaskReadPage(taskPage({ clientId }), { clientId, cursor: `meri-task:${'D'.repeat(24)}` }, { nowMs, actorId }), /binding/);
  const empty = taskPage({ clientId }, { tasks: [], total: 0 });
  assertTaskReadPage(empty, { clientId }, { nowMs, actorId });
  assert.equal(empty.pageCoverage.absenceSupported, true);
  assert.equal(empty.coverage.truncated, false);
  const lying = structuredClone(empty);
  lying.pageCoverage.absenceSupported = false;
  assert.throws(() => assertTaskReadPage(lying, { clientId }, { nowMs, actorId }), /coverage/);
});

// ---------------------------------------------------------------- query_action_items
function actionCanon(row) {
  return JSON.stringify({
    id: row.id, districtKey: row.districtKey, clientId: row.clientId, clientName: row.clientName,
    peCode: row.peCode, programId: row.programId, deltaId: row.deltaId, actionType: row.actionType,
    issueTitle: row.issueTitle, whatChanged: row.whatChanged, whyItMatters: row.whyItMatters,
    recommendedAction: row.recommendedAction, targetAudience: row.targetAudience,
    suggestedArtifactType: row.suggestedArtifactType, deadline: row.deadline, deadlineSource: row.deadlineSource,
    ownerUserId: row.ownerUserId, priority: row.priority, confidence: row.confidence,
    uncertainty: row.uncertainty, evidence: row.evidence, status: row.status,
    dismissalReason: row.dismissalReason, outcome: row.outcome, createdAt: row.createdAt,
    updatedAt: row.updatedAt, title: row.title, body: row.body,
  });
}
function actionRow(over = {}) {
  const base = {
    id: actionId, districtKey: null, clientId, clientName: 'Synthetic Client', peCode: null, programId: null,
    deltaId: null, actionType: 'protect_funding', issueTitle: 'Synthetic issue', whatChanged: 'Synthetic change',
    whyItMatters: 'Synthetic relevance', recommendedAction: 'Synthetic action', targetAudience: [], suggestedArtifactType: null,
    deadline: null, deadlineSource: null, ownerUserId: actorId, priority: 1, confidence: {}, uncertainty: null,
    evidence: [], status: 'new', dismissalReason: null, outcome: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z',
    title: 'Synthetic issue', body: 'Synthetic action', recordKind: 'action_recommendation', recommendation: true, acceptedAsTask: false,
  };
  const row = { ...base, ...over };
  row.nativeCompletion = {
    completed: false, evidence: row.outcome !== null ? 'recommendation_outcome_only' : null, establishesDeliveryOrAcceptance: false,
    note: 'A recommendation, workflow status, or outcome is not an accepted or completed native task.',
  };
  row.sourceProof = { version: 1, owner: 'action_recommendation', sourceRecordId: row.id, currentClientId: row.clientId, sourceVersion: row.updatedAt, contentSha256: sha256(actionCanon(row)), linkedSources: over.linkedSources ?? [] };
  delete row.linkedSources;
  return row;
}
function actionPage(input, over = {}) {
  const { selection } = assertActionItemReadInput(input);
  const rows = over.actions ?? [actionRow()];
  const page = over.page ?? selection.page ?? 1;
  const total = over.total ?? rows.length;
  const hasMore = page * selection.limit < total;
  const sourceStatus = over.sourceStatus ?? 'healthy';
  const complete = sourceStatus === 'healthy' && !selection.cursorApplied && !hasMore && rows.length === total;
  return {
    ...envelopeFor('action-item-client-scoped-page', 'query_action_items', clientSubject, selection, 'action_recommendation', rows.length, !complete),
    order: selection.sort === 'priority' ? 'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed' : 'deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed',
    clientId: selection.clientId,
    scope: { actionItemId: selection.actionItemId, status: selection.status, sort: selection.sort, page, limit: selection.limit, cursorApplied: selection.cursorApplied },
    total, returned: rows.length, actions: rows,
    pageCoverage: { sourceStatus, sourceReason: over.sourceReason ?? (sourceStatus === 'healthy' ? null : 'action_item_source_changed_during_read'), complete, partial: !complete, paginationComplete: !hasMore, hasMore, nextCursor: hasMore ? `meri-action-item:${'A'.repeat(24)}` : null, totalIsExactForScope: true, absenceSupported: complete && rows.length === 0, note: complete ? 'All currently authorized action recommendations in the declared client scope were returned.' : 'This is an exact bounded page. Follow nextCursor before inferring that a recommendation is absent.' },
  };
}

test('action-item read keeps the client-scoped exact read distinct from the pending unscoped list', () => {
  const scoped = assertActionItemReadInput({ clientId }, {});
  assert.equal(scoped.mode, 'client_scoped');
  assert.deepEqual(scoped.selection, { clientId, actionItemId: null, status: null, sort: 'deadline', page: 1, limit: 20, cursorApplied: false });
  const unscoped = assertActionItemReadInput({}, {});
  assert.equal(unscoped.mode, 'unscoped_legacy_pending');
  assert.deepEqual(unscoped.selection, { clientId: null, status: null, sort: 'deadline', limit: 20 });
  assert.throws(() => assertActionItemReadInput({ actionItemId: actionId }, {}), /clientId/);
  assert.throws(() => assertActionItemReadInput({ cursor: 'c' }, {}), /clientId/);
  assert.throws(() => assertActionItemReadInput({ clientId, limit: '20' }, {}), undefined);
  assert.throws(() => assertActionItemReadInput({ clientId, status: 'unknown' }, {}), /status/);
  assert.throws(() => assertActionItemReadInput({ clientId, sort: 'bogus' }, {}), /sort/);
  assert.throws(() => assertActionItemReadInput({ clientId, actionItemId: 'x'.repeat(81) }, {}), undefined);
  assert.equal(OPERATIONAL_READ_PENDING_MODES.length, 1);
  assert.equal(OPERATIONAL_READ_PENDING_MODES[0].pending, true);
  assert.equal(OPERATIONAL_READ_PENDING_MODES[0].operationId, 'query_action_items');
  assert.equal(OPERATIONAL_READ_PENDING_MODES[0].mode, 'unscoped_legacy_list');
  assert.throws(() => assertActionItemClientScopedPage(actionPage({ clientId }), {}, { actorId }), /no validated page contract/);
});

test('client-scoped action-item page pins scope, order, identity and provenance', () => {
  const good = actionPage({ clientId });
  assertActionItemClientScopedPage(good, { clientId }, { actorId });
  assert.throws(() => assertActionItemClientScopedPage(good, { clientId }), /trusted actorId/);
  assert.throws(() => assertActionItemClientScopedPage(good, { clientId }, { actorId: 'other' }), /trusted actor mismatch/);
  for (const [index, edit] of [
    page => { page.clientId = 'other'; }, page => { page.scope.limit = 10; }, page => { page.scope.actionItemId = actionId; },
    page => { page.scope.status = 'monitoring'; }, page => { page.scope.sort = 'priority'; }, page => { page.order = 'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed'; },
    page => { page.returned = 2; }, page => { page.coverage.returnedCount = 2; },
    page => { page.actions[0].clientId = 'other'; }, page => { page.actions[0].nativeCompletion.completed = true; },
    page => { page.actions[0].sourceProof.sourceVersion = '2026-02-01T00:00:00.000Z'; },
    page => { page.actions[0].sourceProof.contentSha256 = 'a'.repeat(64); }, page => { page.actions[0].sourceProof.currentClientId = 'other'; },
    page => { page.actions[0].outcome = 'closed'; }, page => { page.actions[0].evidence = [{ kind: 'source', sourceDocumentId: uuid }]; },
    page => { page.actions.push(structuredClone(page.actions[0])); }, page => { page.sources[0].status = 'checked'; },
    page => { page.coverage.truncated = true; }, page => { page.pageCoverage.partial = true; },
  ].entries()) {
    const target = structuredClone(good);
    edit(target);
    assert.throws(() => assertActionItemClientScopedPage(target, { clientId }, { actorId }), undefined, `action edit ${index}`);
  }
  const priority = actionPage({ clientId, sort: 'priority' });
  assertActionItemClientScopedPage(priority, { clientId, sort: 'priority' }, { actorId });
  assert.equal(priority.order, 'priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed');
  const exact = actionPage({ clientId, actionItemId: actionId }, { actions: [actionRow()] });
  assertActionItemClientScopedPage(exact, { clientId, actionItemId: actionId }, { actorId });
  const duplicate = actionPage({ clientId, actionItemId: actionId }, { actions: [actionRow(), actionRow({ id: taskId })] });
  assert.throws(() => assertActionItemClientScopedPage(duplicate, { clientId, actionItemId: actionId }, { actorId }), /exact identity/);
});

test('action-item page resumes page >= 2 only with a cursor and binds linked evidence', () => {
  const resumedInput = { clientId, cursor: `meri-action-item:${'C'.repeat(24)}` };
  const selection = assertActionItemReadInput(resumedInput, {}).selection;
  assert.equal(selection.cursorApplied, true);
  assert.equal(selection.page, null);
  const page = actionPage(resumedInput, { page: 2, total: 5 });
  assertActionItemClientScopedPage(page, resumedInput, { actorId });
  const badPage = structuredClone(page);
  badPage.scope.page = 1;
  assert.throws(() => assertActionItemClientScopedPage(badPage, resumedInput, { actorId }), /page substitution/);
  assert.throws(() => assertActionItemClientScopedPage(actionPage({ clientId }), resumedInput, { actorId }), /binding/);
  const linked = actionRow({ evidence: [{ kind: 'source', sourceDocumentId: 'doc-1' }], linkedSources: [{ owner: 'source_document', sourceRecordId: 'doc-1', sourceVersion: '2026-01-01T10:00:00.000Z', contentSha256: 'b'.repeat(64) }] });
  const linkedPage = actionPage({ clientId }, { actions: [linked] });
  assertActionItemClientScopedPage(linkedPage, { clientId }, { actorId });
  const unlinked = structuredClone(linkedPage);
  unlinked.actions[0].evidence[0].sourceDocumentId = 'doc-2';
  unlinked.actions[0].sourceProof.contentSha256 = sha256(actionCanon(unlinked.actions[0]));
  assert.throws(() => assertActionItemClientScopedPage(unlinked, { clientId }, { actorId }), /not linked/);
});

test('operational-read DTO accessors, cycles and non-finite values refuse before executing getters', () => {
  let calls = 0;
  const input = { clientId };
  Object.defineProperty(input, 'limit', { enumerable: true, get() { calls++; return 25; } });
  assert.throws(() => assertTaskReadInput(input, { nowMs, actorId }), /accessor/);
  assert.throws(() => assertActionItemReadInput(input, {}), /accessor/);
  assert.equal(calls, 0);
  const cyclic = { clientId };
  cyclic.extra = cyclic;
  assert.throws(() => assertTaskReadInput(cyclic, { nowMs, actorId }), /acyclic/);
  assert.throws(() => assertTaskReadInput({ limit: Infinity }, { nowMs, actorId }));
  const page = taskPage({ clientId });
  Object.defineProperty(page.scope, 'limit', { enumerable: true, get() { calls++; return 25; } });
  assert.throws(() => assertTaskReadPage(page, { clientId }, { nowMs, actorId }), /accessor/);
  assert.equal(calls, 0);
});

test('shared collaborators are delegated, not re-implemented, and still have teeth', () => {
  const good = taskPage({ clientId });
  const forged = structuredClone(good);
  forged.subject.entityIds = [uuid];
  assert.throws(() => assertTaskReadPage(forged, { clientId }, { nowMs, actorId }), /subject/);
  const leaked = structuredClone(good);
  leaked.binding.actorId = 'other';
  assert.throws(() => assertTaskReadPage(leaked, { clientId }, { nowMs, actorId }), /binding|actor/);
  const mismatched = structuredClone(good);
  mismatched.coverage.sourcesChecked = [];
  assert.throws(() => assertTaskReadPage(mismatched, { clientId }, { nowMs, actorId }), /Source coverage/);
  const otherActor = taskPage({ clientId });
  otherActor.scope.actorUserId = 'other';
  assert.throws(() => assertTaskReadPage(otherActor, { clientId }, { nowMs, actorId }), /actor/);
});

test('task pages enforce canonical single-subject and authorized-roster identities', () => {
  const scoped = taskPage({ clientId });
  for (const subject of [
    { ...scoped.subject, entityIds: [clientId, 'other-client'] },
    { ...scoped.subject, rosterVersionId: 'invented-roster' },
  ]) {
    const changed = structuredClone(scoped);
    changed.subject = subject;
    assert.throws(() => assertTaskReadPage(changed, { clientId }, { nowMs, actorId }), /Single subject identity mismatch/);
  }
  const authorized = taskPage({});
  assertTaskReadPage(authorized, {}, { nowMs, actorId });
  for (const patch of [{ rosterVersionId: null }, { entityType: 'person' }]) {
    const changed = structuredClone(authorized);
    Object.assign(changed.subject, patch);
    assert.throws(() => assertTaskReadPage(changed, {}, { nowMs, actorId }), /Portfolio requires a versioned authorized client roster/);
  }
});

test('task pages enforce canonical timezone and calendar-month boundaries', () => {
  const page = taskPage({ clientId });
  page.window = {
    basis: 'calendar-month', startInclusive: '2026-01-01T00:00:00Z', endExclusive: '2026-02-01T00:00:00Z',
    timezone: 'UTC', weekStartsOn: null,
  };
  assertTaskReadPage(page, { clientId }, { nowMs, actorId });
  for (const [patch, error] of [
    [{ timezone: 'Mars/Olympus' }, /Unknown timezone/],
    [{ startInclusive: '2026-01-01T00:00:00.001Z' }, /local midnight/],
    [{ endExclusive: '2026-03-01T00:00:00Z' }, /Invalid calendar month/],
    [{ weekStartsOn: 'monday' }, /Week policy mismatch/],
  ]) {
    const changed = structuredClone(page);
    Object.assign(changed.window, patch);
    assert.throws(() => assertTaskReadPage(changed, { clientId }, { nowMs, actorId }), error);
  }
});

test('operational source observations retain their pending timestamp boundary', () => {
  for (const timestamp of ['asOf', 'synchronizedAt']) {
    const page = taskPage({ clientId });
    page.sources[0][timestamp] = '2027-01-01T00:00:00Z';
    // Pending transports forbid every claimed sync timestamp before the shared
    // source chronology check; registration must not weaken that domain rule.
    assert.throws(() => assertTaskReadPage(page, { clientId }, { nowMs, actorId }), /cannot claim sync timestamps/);
  }
});

// ---------------------------------------------------------------- boundary and public-distribution guards
test('operational-read schema objects stay closed and package public exports stay 0.1 only', () => {
  const walk = node => { if (!node || typeof node !== 'object') return; if (node.type === 'object') assert.equal(node.additionalProperties, false); for (const child of Object.values(node)) if (child && typeof child === 'object') walk(child); };
  walk(candidateSchema);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.version, '0.1.0');
  assert(!JSON.stringify(pkg.exports).includes('retrieval-0.2'));
  assert(!pkg.files.includes('retrieval-0.2'));
});
test('private task and partial action registration keep native action items unmapped and expose no live handler or skill', () => {
  const catalog = JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json', import.meta.url)));
  assertCatalog(catalog);
  const task = catalog.operations.find(operation => operation.operation.id === 'query_tasks');
  assert.ok(task); assert.equal(task.handler, null); assert.equal(task.availability, 'unimplemented');
  assert.equal(task.qualification, 'pending'); assert.equal(task.operation.version, '0.2.0');
  assert.deepEqual(catalog.originals.find(row => row.id === 'query_tasks').replacement, { id: 'query_tasks', version: '0.2.0' });
  const actionItems = catalog.originals.find(row => row.id === 'query_action_items');
  assert.equal(actionItems.state, 'pending'); assert.equal(actionItems.replacement, null);
  assert.ok(catalog.operations.some(operation => operation.operation.id === 'query_action_items'));
  assert.deepEqual(catalog.operations.find(operation => operation.operation.id === 'query_action_items').aliases, []);
  for (const id of ['operational-reads.task-read', 'operational-reads.action-item-read']) {
    assert(!catalog.operations.some(operation => operation.operation.id === id || operation.aliases.includes(id)));
  }
  for (const operation of catalog.operations) { assert.equal(operation.handler, null); assert.equal(operation.availability, 'unimplemented'); }
  const manifest = { contractVersion: '0.2.0', skillId: 'quick_skill.meeting_prep', skillVersion: '1.0.0', prose: { id: 'urn:meri:synthetic:operational-reads', sha256: 'a'.repeat(64) }, requiredSources: [{ sourceId: 'engagement_tasks', authority: 'authoritative', purpose: 'evidence' }], allowedOperations: [{ id: 'query_tasks', version: '0.2.0' }], subjectKinds: ['client'], windowBases: ['unbounded'], completion: { requireAllSources: true, allowDisclosedPartial: true, negativeClaims: 'complete-covered-only', rubric: [{ id: 'read', requirement: 'Read authorized operational tasks', evidenceRequired: true }] }, approval: { mutations: 'separate-immutable-proposal', autoCreateTasks: false }, budgets: { maxTurns: 4, maxToolCalls: 4, maxRecoveryAttempts: 1, maxRuntimeSeconds: 30, maxCostMicroUSD: 1000, maxOutputBytes: 10000 }, versionPolicy: { existingRuns: 'pin-immutable', resume: 'exact-or-explicit-migration', fork: 'preserve-unless-explicit-reselection' } };
  assert.throws(() => assertSkillManifest(manifest, catalog), /unavailable/);
});
