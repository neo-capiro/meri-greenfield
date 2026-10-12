// Managed-source projections only; no MCP client, retrieval or access decision.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail = message => { throw new Error(message); };
const operation = 'read_monday_client_boards';
const optional = (value, cap) => typeof value === 'string' ? value.trim().slice(0, cap) || null : null;
export function createClientKnowledgeMondayValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Monday contract configuration');
  function requireOperation(id) { if (id !== operation) fail('Unknown Monday operation'); }
  const inputDefinition = id => { requireOperation(id); return 'ClientKnowledgeMondayInput'; };
  const outputDefinition = id => { requireOperation(id); return 'ClientKnowledgeMondayOutput'; };
  function normalizeInput(id, request, context = {}) {
    requireOperation(id);
    const raw = snapshotOperationData(request), ctx = snapshotOperationData(context);
    validateShape('ClientKnowledgeMondayRequest', raw); validateShape('ClientKnowledgeMondayContext', ctx);
    const parsed = typeof raw.pageSize === 'number' ? raw.pageSize : typeof raw.pageSize === 'string' ? Number(raw.pageSize) : NaN;
    const pageSize = raw.pageSize === undefined ? null : Math.min(100, Math.max(1, Number.isFinite(parsed) ? Math.trunc(parsed) : 100));
    const input = {clientId: optional(raw.clientId, 80), boardContext: optional(raw.boardContext, 2000),
      cursor: optional(raw.cursor, 512), pageSize, requireComplete: pageSize === null && !optional(raw.cursor, 512)};
    validateShape(inputDefinition(id), input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze({sourceConnected: false,
      authoritative: false, currentPolicyQualified: false, absenceEvidence: false,
      pagination: input.requireComplete ? 'requested-complete' : 'explicit-page'})});
  }
  function assertResult(id, value, request, context = {}) {
    const {input} = normalizeInput(id, request, context), page = snapshotOperationData(value);
    validateShape(outputDefinition(id), page);
    if (page.clientId !== input.clientId || page.currentStatus !== (page.coverage.sources[0]?.sourceStatus ?? 'unavailable'))
      fail('Monday wrapper identity/status substitution');
    if (page.coverage.requestedDomains.length !== 1 || page.coverage.requestedDomains[0] !== 'monday' ||
        page.coverage.sources.some(source => source.domain !== 'monday')) fail('Monday coverage domain substitution');
    if (input.pageSize !== null && page.records.length > input.pageSize) fail('Monday explicit page size exceeded');
    const ids = new Set();
    for (const row of page.records) {
      const p = row.payload, o = p.origin, provenance = row.provenance;
      if (p.clientId !== input.clientId || row.recordId !== `${o.boardId}:${o.itemId}` || ids.has(row.recordId)) fail('Monday record identity substitution');
      ids.add(row.recordId);
      if (provenance.boardId !== o.boardId || provenance.itemId !== o.itemId || provenance.parentItemId !== o.parentItemId ||
          (o.itemType === 'subitem') !== (typeof o.parentItemId === 'string' && !!o.parentItemId)) fail('Monday origin mismatch');
      if (p.status !== null && (!p.status || p.status.trim() !== p.status)) fail('Monday status normalization mismatch');
      if (p.url !== null && !/^https:\/\/[a-z0-9-]+\.monday\.com\//i.test(p.url)) fail('Monday URL projection mismatch');
    }
    // Provider fields/columns are inert JSON, not a reconstructed provider API.
    // Coverage is reported source metadata. Wall checks, source rescan/snapshot,
    // external-tool schema, actor binding and budget/deadline require execution.
    return page;
  }
  return Object.freeze({schemaId: schema.$id, operationIds: Object.freeze([operation]), inputDefinition, outputDefinition, normalizeInput, assertResult});
}
