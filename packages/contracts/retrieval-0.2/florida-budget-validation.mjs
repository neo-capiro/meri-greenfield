// Private source-only Florida fiscal read projection. Current membership, folder,
// client wall, feature and source checks remain gateway/adapter responsibilities.
import { snapshotOperationData } from './operation-contracts.mjs';

const ID = 'get_florida_budget_project';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = message => { throw new Error(message); };
const unique = (rows, label) => {
  if (new Set(rows.map(row => row.id)).size !== rows.length) fail(`Duplicate Florida budget ${label}`);
};
function instant(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value)
    fail('Florida budget timestamp requires a finite canonical ISO instant');
  return parsed;
}
function newestFirst(rows) {
  let previous = Infinity;
  for (const row of rows) {
    const parsed = instant(row.observed_at);
    if (parsed > previous) fail('Florida budget observations are not newest first');
    previous = parsed;
  }
}

export function createFloridaBudgetValidators({ validateShape, schema }) {
  if (typeof validateShape !== 'function' || schema?.$id !== 'urn:meri:retrieval:florida-budget:0.2.0')
    fail('Florida budget validator configuration');
  const operationIds = Object.freeze([ID]);
  const operation = id => { if (id !== ID) fail('Unknown Florida budget operation'); };
  // Canonical catalog binds the normalized selection. Retained raw requests still
  // enter selection(), which admits FloridaBudgetRequest before applying defaults.
  const inputDefinition = id => { operation(id); return 'FloridaBudgetInput'; };
  const outputDefinition = id => { operation(id); return 'FloridaBudgetOutput'; };

  function selection(id, request, context) {
    operation(id);
    // One canonical inert JSON boundary; no property read before admission.
    const raw = snapshotOperationData(request), options = snapshotOperationData(context);
    validateShape('FloridaBudgetRequest', raw);
    validateShape('FloridaBudgetContext', options);
    instant(options.asOf);
    if (raw.folderId !== null && raw.folderId !== undefined && raw.folderId.length > 100)
      fail('Florida budget folder selector exceeds 100 UTF-16 units');
    const input = {
      q: (raw.q ?? '').slice(0, 200), fiscalYear: raw.fiscalYear ?? '2026-27',
      projectId: raw.projectId ?? '', offset: Math.max(0, Number(raw.offset) || 0),
      sessionKey: raw.sessionKey ?? '', folderId: raw.folderId || null,
      clientId: raw.clientId?.trim().slice(0, 80) || null,
    };
    validateShape('FloridaBudgetInput', input);
    const reference = input.clientId, resolution = options.clientResolution;
    if (reference === null) {
      if (resolution !== null) fail('Florida budget absent client selector cannot carry a resolution');
    } else {
      if (resolution === null || resolution.selector !== reference ||
          (UUID.test(reference.trim()) && reference.trim().toLowerCase() !== resolution.clientId.toLowerCase()))
        fail('Florida budget client reference differs from trusted resolution');
      input.clientId = resolution.clientId;
    }
    const scope = options.effectiveScope;
    if (scope.sessionKey !== input.sessionKey || scope.folderId !== input.folderId ||
        (input.clientId !== null && scope.clientId !== input.clientId) ||
        (input.folderId === null && scope.clientId !== input.clientId))
      fail('Florida budget effective scope differs from selected session/folder/client');
    return { input, options };
  }

  function normalizeInput(id, request, context) {
    const { input, options } = selection(id, request, context);
    return Object.freeze({ input: Object.freeze(input), metadata: Object.freeze({
      effectiveScope: Object.freeze(options.effectiveScope), asOf: options.asOf,
      clientResolution: options.clientResolution === null ? null : Object.freeze(options.clientResolution),
      sourceConnected: false, authorizationEstablished: false, absenceEvidence: false,
      projection: 'selected-publisher-evidence',
    }) });
  }

  function assertResult(id, value, request, context) {
    const { input, options } = selection(id, request, context);
    const page = snapshotOperationData(value);
    validateShape('FloridaBudgetOutput', page);
    instant(page.generatedAt);
    if (page.generatedAt !== options.asOf) fail('Florida budget observation clock substitution');
    const result = page.result;
    if (['jurisdiction', 'sessionKey', 'folderId', 'clientId'].some(key =>
      result.scope[key] !== options.effectiveScope[key])) fail('Florida budget output scope substitution');
    if (result.fiscalYear !== input.fiscalYear) fail('Florida budget fiscal year substitution');
    if (result.nextOffset !== null &&
        (result.projects.length !== 100 || result.nextOffset !== input.offset + 100))
      fail('Florida budget project continuation mismatch');
    unique(result.projects, 'project'); unique(result.documents, 'document');
    unique(result.amounts, 'amount'); unique(result.events, 'event');
    unique(result.projects.flatMap(project => project.recentAmounts), 'recent amount across projects');
    if (input.projectId && input.offset > 0 && result.projects.length)
      fail('Florida budget exact project lies before the requested offset');
    for (const project of result.projects) {
      if (project.fiscal_year !== input.fiscalYear || (input.projectId && project.id !== input.projectId))
        fail('Florida budget project selector substitution');
      if ((project.tracking_version === null && project.saved) ||
          (input.folderId === null && (project.saved || project.tracking_version !== null)))
        fail('Florida budget tracking requires a selected folder and retained tracking row');
      unique(project.recentAmounts, 'recent amount');
      if (project.recentAmounts.some(amount => amount.project_id !== project.id))
        fail('Florida budget recent amount belongs to another project');
    }
    if (!input.projectId && result.amounts.length) fail('Florida budget amount history requires a selected project');
    for (const document of result.documents) {
      if (document.fiscal_year !== input.fiscalYear ||
          (input.sessionKey && document.session_key !== input.sessionKey))
        fail('Florida budget document fiscal/session substitution');
    }
    for (const event of result.events) {
      if (event.fiscal_year !== input.fiscalYear || (input.projectId && event.project_id !== input.projectId))
        fail('Florida budget event fiscal/project substitution');
    }
    newestFirst(result.documents); newestFirst(result.events);
    // No cross-array equality: independently read windows can legitimately differ.
    // Opaque JSON observations are not validated as invented money/award DTOs.
    return page;
  }

  function classifyResult(id, value) {
    operation(id);
    const page = snapshotOperationData(value); validateShape('FloridaBudgetOutput', page);
    return Object.freeze({ status: 'data', reasonCode: 'OK', retryable: false,
      authoritative: false, absenceEvidence: false });
  }
  return Object.freeze({ schemaId: schema.$id, operationIds, inputDefinition, outputDefinition,
    normalizeInput, assertResult, classifyResult });
}
