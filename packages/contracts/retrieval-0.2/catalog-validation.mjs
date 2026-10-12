// Canonical private operation/schema bindings and catalog consistency only.
// No handler loading, authorization, discovery, source connection or import IO.
const fail = message => { throw new Error(message); };
const key = operation => `${operation.id}@${operation.version}`;
function unique(values, label) {
  if (new Set(values).size !== values.length) fail(`Duplicate ${label}`);
}

const clock = (context, names) => Object.fromEntries(names.filter(name => Object.hasOwn(context, name)).map(name => [name, context[name]]));
const selected = result => ({input: result.selection, metadata: {cursor: result.cursor}});
const searched = result => ({input: result.input, metadata: {clientScope: result.clientScope, retrievalRequest: result.retrievalRequest}});
const federal = result => ({input: result.query, metadata: {queryScope: result.queryScope, clientScope: result.clientScope}});

export const CATALOG_OPERATION_BINDINGS = Object.freeze([
  Object.freeze({id: 'lookup_client_registry', nativeId: 'lookup_client_registry', group: 'client-registry', input: 'ClientRegistryInput', output: 'ClientRegistryResult', version: '0.2.0',
    normalize: (v, request) => ({input: v.normalizeClientRegistryInput(request)}),
    outputAssert: (v, page, request) => {v.normalizeClientRegistryInput(request); return v.assertClientRegistryResult(page);}}),
  Object.freeze({id: 'mail.read_thread', nativeId: 'get_email_thread', group: 'mail', input: 'MailThreadInput', output: 'MailThreadSourcePage', version: '0.2.0',
    normalize: (v, request, context, binding) => ({input: v.assertMailThreadInput(request)}),
    outputAssert: (v, page, request, context, binding) => v.assertMailThreadSourcePage(page, request)}),
  Object.freeze({id: 'mail.list_messages', nativeId: 'list_emails', group: 'mail', input: 'MailListInput', output: 'MailCandidateSourcePage', version: '0.2.0',
    dispatchProfile: 'mail-candidates/1',
    normalize: (v, request, context, binding) => ({input: v.assertMailListInput(request, clock(context, ['nowMs']))}),
    outputAssert: (v, page, request, context, binding) => v.assertMailCandidateSourcePage(page, request, binding.id, clock(context, ['nowMs', 'previousPage']))}),
  Object.freeze({id: 'mail.search_messages', nativeId: 'search_emails', group: 'mail', input: 'MailSearchInput', output: 'MailCandidateSourcePage', version: '0.2.0',
    dispatchProfile: 'mail-candidates/1',
    normalize: (v, request, context, binding) => ({input: v.assertMailSearchInput(request, clock(context, ['nowMs']))}),
    outputAssert: (v, page, request, context, binding) => v.assertMailCandidateSourcePage(page, request, binding.id, clock(context, ['nowMs', 'previousPage']))}),
  Object.freeze({id: 'meeting.list_upcoming_meetings', nativeId: 'list_upcoming_meetings', group: 'meeting-source', input: 'MeetingUpcomingInput', output: 'MeetingUpcomingPage', version: '0.2.0',
    normalize: (v, request, context, binding) => ({input: v.assertUpcomingMeetingsInput(request, clock(context, ['nowMs']))}),
    outputAssert: (v, page, request, context, binding) => v.assertUpcomingMeetingsPage(page, request, clock(context, ['nowMs']))}),
  Object.freeze({id: 'meeting.read_client_meetings', nativeId: 'read_client_meetings', group: 'meeting-source', input: 'ClientMeetingReadInput', output: 'ClientMeetingReadPage', version: '0.2.0',
    normalize: (v, request, context, binding) => selected(v.assertClientMeetingReadInput(request)),
    outputAssert: (v, page, request, context, binding) => v.assertClientMeetingReadInput(request).selection.sourceId === undefined ? v.assertClientMeetingInventoryPage(page, request) : v.assertClientMeetingSourceBodyPage(page, request)}),
  Object.freeze({id: 'meeting.query_debriefs', nativeId: 'query_debriefs', group: 'meeting-source', input: 'DebriefReadInput', output: 'DebriefSourcePage', version: '0.2.0',
    normalize: (v, request, context, binding) => selected(v.assertDebriefReadInput(request)),
    outputAssert: (v, page, request, context, binding) => v.assertDebriefSourcePage(page, request)}),
  Object.freeze({id: 'query_tasks', nativeId: 'query_tasks', group: 'operational-reads', input: 'TaskReadInput', output: 'TaskReadPage', version: '0.2.0',
    normalize: (v, request, context, binding) => selected(v.assertTaskReadInput(request, clock(context, ['nowMs', 'actorId']))),
    outputAssert: (v, page, request, context, binding) => v.assertTaskReadPage(page, request, clock(context, ['nowMs', 'actorId']))}),
  Object.freeze({id: 'search_capiro_data', nativeId: 'search_capiro_data', group: 'data-search', input: 'DataSearchInput', output: 'SearchCapiroDataResult', version: '0.2.0',
    normalize: (v, request, context, binding) => searched(v.normalizeDataSearchInput(request)),
    outputAssert: (v, page, request, context, binding) => v.assertDataSearchResult(page)}),
  Object.freeze({id: 'search_federal_contract_awards', nativeId: 'search_federal_contract_awards', group: 'federal-market', input: 'SearchFederalContractAwardsInput', output: 'SearchFederalContractAwardsOutput', version: '0.2.0',
    normalize: (v, request, context, binding) => federal(v.normalizeFederalMarketInput(binding.id, request)),
    outputAssert: (v, page, request, context, binding) => v.validateFederalMarketShape(binding.output, page)}),
  Object.freeze({id: 'search_federal_subawards', nativeId: 'search_federal_subawards', group: 'federal-market', input: 'SearchFederalSubawardsInput', output: 'SearchFederalSubawardsOutput', version: '0.2.0',
    normalize: (v, request, context, binding) => federal(v.normalizeFederalMarketInput(binding.id, request)),
    outputAssert: (v, page, request, context, binding) => v.validateFederalMarketShape(binding.output, page)}),
  Object.freeze({id: 'search_contract_vehicles', nativeId: 'search_contract_vehicles', group: 'federal-market', input: 'SearchContractVehiclesInput', output: 'SearchContractVehiclesOutput', version: '0.2.0',
    normalize: (v, request, context, binding) => federal(v.normalizeFederalMarketInput(binding.id, request)),
    outputAssert: (v, page, request, context, binding) => v.validateFederalMarketShape(binding.output, page)}),
  Object.freeze({id: 'search_procurement_forecasts', nativeId: 'search_procurement_forecasts', group: 'federal-market', input: 'SearchProcurementForecastsInput', output: 'SearchProcurementForecastsOutput', version: '0.2.0',
    normalize: (v, request, context, binding) => federal(v.normalizeFederalMarketInput(binding.id, request)),
    outputAssert: (v, page, request, context, binding) => v.validateFederalMarketShape(binding.output, page)}),
  Object.freeze({id: 'get_district_federal_market', nativeId: 'get_district_federal_market', group: 'federal-market', input: 'GetDistrictFederalMarketInput', output: 'GetDistrictFederalMarketOutput', version: '0.2.0',
    normalize: (v, request, context, binding) => federal(v.normalizeFederalMarketInput(binding.id, request)),
    outputAssert: (v, page, request, context, binding) => v.validateFederalMarketShape(binding.output, page)}),
  Object.freeze({id: 'memory.list_own_proposals', nativeId: 'list_memory_proposals', group: 'memory-proposals', input: 'MemoryProposalInput', output: 'MemoryProposalReadResult', version: '0.2.0',
    dispatchProfile: 'memory-proposals/1',
    contextKeys: Object.freeze(['subject', 'previous']),
    normalize: (v, request, context, binding) => ({input: v.normalizeMemoryProposalInput(request, context)}),
    outputAssert: (v, page, request, context, binding) => v.assertMemoryProposalReadResult(page, request, clock(context, binding.contextKeys))}),
  Object.freeze({id: 'query_action_items', nativeId: 'query_action_items', nativeCoverage: 'partial', group: 'operational-reads', input: 'ActionItemReadInput', output: 'ActionItemClientScopedPage', version: '0.2.0',
    normalize: (v, request, context, binding) => {
      if (typeof context.actorId !== 'string' || !context.actorId) fail('Explicit trusted actorId required');
      const result = v.assertActionItemReadInput(request, clock(context, ['actorId']));
      if (result.mode !== 'client_scoped') fail('Unscoped action-item mode remains unqualified');
      return selected(result);
    },
    outputAssert: (v, page, request, context, binding) => v.assertActionItemClientScopedPage(page, request, clock(context, ['actorId']))}),
]);

export function createCatalogValidators({validateShape, schemaRecords}) {
  const records = new Map(schemaRecords.map(record => [record.group, record]));
  const bindings = new Map(CATALOG_OPERATION_BINDINGS.map(binding => [binding.id, binding]));
  for (const binding of CATALOG_OPERATION_BINDINGS) {
    const record = records.get(binding.group);
    if (!record || !Object.hasOwn(record.schema.$defs, binding.input) ||
        !Object.hasOwn(record.schema.$defs, binding.output)) fail('Registered catalog schema definition missing');
  }

function assertCatalog(catalog) {
  validateShape('Catalog', catalog);
  unique(catalog.originals.map(row => row.id), 'native capability');
  const selected = catalog.originals.filter(row => row.disposition === 'selected');
  if (selected.length !== 96 || catalog.originals.length - selected.length !== 43) fail('D012 disposition mismatch');
  const operations = new Map();
  const aliases = new Map();
  for (const operation of catalog.operations) {
    const id = key(operation.operation);
    if (operations.has(id)) fail('Duplicate operation version');
    if (['query_data', 'query_sql', 'execute_sql', 'raw_sql'].includes(operation.operation.id)) fail('Unrestricted query operation forbidden');
    if (operation.availability === 'enabled' && (operation.qualification !== 'qualified' || operation.handler === null)) fail('Unavailable handler cannot be exposed');
    const binding = bindings.get(operation.operation.id);
    if (binding) {
      if (operation.operation.version !== binding.version) fail('Operation version binding mismatch');
      const record = records.get(binding.group);
      if (['inputSchema', 'outputSchema'].some((field, index) =>
        operation[field].id !== `${record.schema.$id}#/$defs/${[binding.input, binding.output][index]}` ||
        operation[field].sha256 !== record.sha256)) fail('Catalog schema byte pin mismatch');
    }
    if (operation.sideEffect === 'none' ? operation.approvalBoundary !== 'none' : operation.approvalBoundary === 'none') fail('Side-effect approval mismatch');
    if (operation.handler && (operation.handler.module.split('/').some(part => !part || part === '.' || part === '..') || !/^[a-zA-Z0-9_./-]+$/.test(operation.handler.module))) fail('Invalid handler metadata path');
    unique(operation.sourceRequirements.map(row => `${row.sourceId}:${row.purpose}`), 'operation source purpose');
    operations.set(id, operation);
    for (const alias of operation.aliases) {
      if (aliases.has(alias)) fail('Ambiguous alias');
      aliases.set(alias, id);
    }
  }
  for (const operation of catalog.operations) {
    if (operation.replacement && !operations.has(key(operation.replacement))) fail('Unavailable replacement operation');
    const visited = new Set([key(operation.operation)]);
    let replacement = operation.replacement;
    while (replacement) {
      if (visited.has(key(replacement))) fail('Cyclic operation replacement');
      const target = operations.get(key(replacement));
      if (!target) fail('Unavailable replacement operation');
      visited.add(key(replacement)); replacement = target.replacement;
    }
  }
  for (const [alias, target] of aliases) if (catalog.operations.some(operation => operation.operation.id === alias && key(operation.operation) !== target)) fail('Alias shadows canonical operation');
  for (const original of catalog.originals) {
    if ((original.state === 'mapped') !== (original.replacement !== null)) fail('Incomplete preservation mapping');
    if (original.replacement && !operations.has(key(original.replacement))) fail('Missing mapped operation');
    if (aliases.has(original.id) && (original.replacement === null || aliases.get(original.id) !== key(original.replacement))) fail('Alias contradicts preservation mapping');
  }
  if (catalog.catalogId === 'meri.retrieval') {
    if (operations.size !== bindings.size || catalog.operations.some(row => !bindings.has(row.operation.id)))
      fail('Concrete catalog requires the complete registered operation set');
    for (const binding of CATALOG_OPERATION_BINDINGS) {
      const operation = operations.get(key({id: binding.id, version: binding.version}));
      const original = catalog.originals.find(row => row.id === binding.nativeId);
      if (!operation || !original) fail('Registered preservation mapping mismatch');
      if (binding.nativeCoverage === 'partial') {
        if (original.state !== 'pending' || original.replacement !== null || operation.aliases.length !== 0)
          fail('Partial native coverage cannot claim a replacement or compatibility alias');
      } else if (original.state !== 'mapped' ||
          key(original.replacement ?? {}) !== key(operation.operation)) fail('Registered preservation mapping mismatch');
      if (operation.handler !== null || operation.availability !== 'unimplemented' ||
          operation.qualification !== 'pending' || operation.retry.maxRetries !== 0 ||
          operation.retry.retryableCodes.length !== 0) fail('Pending catalog cannot expose an executable handler');
    }
  }
  return catalog;
}


  return Object.freeze({assertCatalog});
}
