import { executionSchemaSources, executionSchemaDependencies } from './execution-schema-sources.mjs';
import { createExecutionToolValidators } from './execution-tool-validators.mjs';
import { createResearchPortfolioEvidenceValidators } from './research-portfolio-evidence-validation.mjs';
import { createClientKnowledgeSearchValidators } from './client-knowledge-search-validation.mjs';
import { createClientKnowledgeMondayValidators } from './client-knowledge-monday-validation.mjs';
import { createClientKnowledgeAttachmentValidators } from './client-knowledge-attachments-validation.mjs';
import { createClientKnowledgeMemoryValidators } from './client-knowledge-memory-validation.mjs';
import { createClientKnowledgeProfileValidators } from './client-knowledge-profile-validation.mjs';
import { createResearchLegalCandidatesValidators } from './research-legal-candidates-validation.mjs';
import { createPublicDomainQueryValidators } from './public-domain-query-validation.mjs';
import { createResearchLegalLegislationValidators } from './research-legal-legislation-validation.mjs';
import { createActionItemsCompleteValidators } from './action-items-complete-validation.mjs';
import { createResearchLegalNewsValidators } from './research-legal-news-validation.mjs';
import { createPublicDomainHearingsValidators } from './public-domain-hearings-validation.mjs';
import { createPublicDomainDatasetRegistry } from './public-domain-registry.mjs';
import { validateShape as validatePublicShape } from '../validate.mjs';
import { createOutreachQueryValidators } from './outreach-query-validation.mjs';
import { createProgramElementValidators } from './program-elements-validation.mjs';
import { createPublicWebValidators } from './public-web-validation.mjs';
import { createSamOpportunitiesValidators } from './sam-opportunities-validation.mjs';
import { createFloridaBudgetValidators } from './florida-budget-validation.mjs';
import { createStateStatusVotesValidators } from './state-status-votes-validation.mjs';
import { createRegulatoryDocketsValidators } from './regulatory-dockets-validation.mjs';
import { createTenantContactsValidators } from './tenant-contacts-validation.mjs';
import { createEntityCandidatesValidators } from './entity-candidates-validation.mjs';
import { createTrackedBillsValidators } from './tracked-bills-validation.mjs';
import { createIntelligenceSummaryValidators } from './intelligence-summary-validation.mjs';
import { createLegislativeDirectoryValidators } from './legislative-directory-validation.mjs';
import { createPeReferenceValidators } from './pe-references-validation.mjs';
import { createRuleStatusValidators } from './rule-status-validation.mjs';
import { createCertificationStatusValidators } from './certification-status-validation.mjs';
import { createStoredIntelligenceValidators } from './stored-intelligence-validation.mjs';
import { createDatasetMetadataValidators } from './dataset-metadata-validation.mjs';
import { createFacilityRepresentationValidators } from './facility-representation-validation.mjs';
import { createBillTextValidators } from './bill-text-validation.mjs';
import { createFederalLegislationValidators } from './federal-legislation-validation.mjs';
import { createAcquisitionPersonnelValidators } from './acquisition-personnel-validation.mjs';
import { createDisclosuresValidators } from './disclosures-validation.mjs';
import { createPublicReportsValidators } from './public-reports-validation.mjs';
import { createStateLegislationValidators } from './state-legislation-validation.mjs';
import { createFundingOpportunitiesValidators } from './funding-opportunities-validation.mjs';
import { createClientDocumentsValidators } from './client-documents-validation.mjs';
import { createPublicDataValidators } from './public-data-validation.mjs';
import { createDistrictNexusValidators } from './district-nexus-validation.mjs';
import { createOperationContracts } from './operation-contracts.mjs';
import { createCatalogValidators, CATALOG_OPERATION_BINDINGS } from './catalog-validation.mjs';
import { createMailValidators } from './mail-validation.mjs';
import { createMeetingValidators } from './meeting-source-validation.mjs';
import { createOperationalReadValidators } from './operational-reads-validation.mjs';
import { createFederalMarketValidators } from './federal-market-validation.mjs';
import { createDataSearchValidators } from './data-search-validation.mjs';
import { createMemoryProposalValidators } from './memory-proposals-validation.mjs';
import { createClientRegistryValidators } from './client-registry-validation.mjs';
import { createResearchPortfolioValidators } from './research-portfolio-validation.mjs';
import { createBusinessDevelopmentValidators } from './business-development-validation.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { canonicalSha256 } from '../validate.mjs';

export const contractVersion = '0.2.0';
const groups = ['common', 'catalog', 'retrieval', 'skill', 'mail', 'meeting-source', 'operational-reads', 'federal-market', 'data-search', 'memory-proposals', 'client-registry', 'research-portfolio', 'research-portfolio-evidence', 'business-development', 'funding-opportunities', 'client-documents', 'public-data', 'district-nexus', 'state-legislation', 'public-reports', 'disclosures', 'acquisition-personnel', 'federal-legislation', 'bill-text', 'legislative-directory', 'pe-references', 'rule-status', 'certification-status', 'stored-intelligence', 'dataset-metadata', 'facility-representation', 'state-status-votes', 'regulatory-dockets', 'tenant-contacts', 'entity-candidates', 'tracked-bills', 'intelligence-summary', 'public-web', 'sam-opportunities', 'florida-budget', 'outreach-query', 'program-elements', 'client-knowledge-search', 'client-knowledge-monday', 'client-knowledge-attachments', 'client-knowledge-memory', 'client-knowledge-profile', 'research-legal-candidates', 'public-domain-query', 'research-legal-legislation', 'action-items-complete', 'research-legal-news', 'public-domain-hearings', 'public-domain-hearing-records', ...executionSchemaSources.map(source => source.group)];
const schemaBytes = groups.map(group => readFileSync(new URL(
  executionSchemaSources.find(source => source.group === group)?.path ?? `./${group}.schema.json`, import.meta.url)));
const schemas = schemaBytes.map(raw => JSON.parse(raw));
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(JSON.parse(readFileSync(new URL('../meri.schema.json', import.meta.url))));
for (const path of executionSchemaDependencies) ajv.addSchema(JSON.parse(readFileSync(new URL(path, import.meta.url))));
for (const schema of schemas) ajv.addSchema(schema);
const validators = new Map(schemas.flatMap((schema,index) => (executionSchemaSources.find(source => source.group === groups[index])?.exposed ?? Object.keys(schema.$defs)).map(name =>
  [name, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })])));

export function validateShape(name, value) {
  const check = validators.get(name);
  if (!check) throw new Error(`Unknown R2 contract ${name}`);
  if (!check(value)) throw new Error(`${name}: ${ajv.errorsText(check.errors)}`);
  return value;
}
function executionShape(group,name,value) {
  const schema = schemas[groups.indexOf(group)], check = schema && ajv.getSchema(`${schema.$id}#/$defs/${name}`);
  if (!check || !check(value)) throw new Error(`Invalid private execution contract ${group}:${name}`);
  return value;
}
const executionToolValidators = createExecutionToolValidators({schemaShape:executionShape, validatePublicShape, canonicalSha256});
export const {artifactValidators,commandToolValidators} = executionToolValidators;
const fail = message => { throw new Error(message); };
const key = operation => `${operation.id}@${operation.version}`;
function unique(values, label) {
  if (new Set(values).size !== values.length) fail(`Duplicate ${label}`);
}
function sameSet(left, right) {
  return left.length === right.length && left.every(value => right.includes(value));
}

export function assertWindow(window, { requested = false } = {}) {
  validateShape(requested ? 'WindowRequest' : 'NormalizedWindow', window);
  if (window.basis === 'unbounded') return window;
  try { new Intl.DateTimeFormat('en-US', { timeZone: window.timezone }); }
  catch { fail('Unknown timezone'); }
  if ('startInclusive' in window && Date.parse(window.startInclusive) >= Date.parse(window.endExclusive)) fail('Window bounds must increase');
  if (!requested && 'weekStartsOn' in window && ((window.basis === 'calendar-week') !== (window.weekStartsOn !== null))) fail('Week policy mismatch');
  if (!requested && window.basis.startsWith('calendar-')) {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: window.timezone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
    const local = stamp => Object.fromEntries(formatter.formatToParts(new Date(stamp)).map(part => [part.type, part.value]));
    const start = local(window.startInclusive), end = local(window.endExclusive);
    if ([start, end].some(part => +part.hour !== 0 || +part.minute !== 0 || +part.second !== 0) || [window.startInclusive, window.endExclusive].some(stamp => new Date(stamp).getUTCMilliseconds() !== 0)) fail('Calendar boundaries require local midnight');
    const ordinal = part => Date.UTC(+part.year, +part.month - 1, +part.day);
    if (window.basis === 'calendar-week' && (start.weekday.toLowerCase() !== window.weekStartsOn || end.weekday !== start.weekday || ordinal(end) - ordinal(start) !== 7 * 86400000)) fail('Invalid calendar week');
    if (window.basis === 'calendar-month' && (+start.day !== 1 || +end.day !== 1 || +end.year * 12 + +end.month !== +start.year * 12 + +start.month + 1)) fail('Invalid calendar month');
    if (window.basis === 'calendar-year' && (+start.month !== 1 || +start.day !== 1 || +end.month !== 1 || +end.day !== 1 || +end.year !== +start.year + 1)) fail('Invalid calendar year');
  }
  return window;
}

export function assertWindowResolution(requested, normalized) {
  assertWindow(requested, { requested: true }); assertWindow(normalized);
  if (requested.basis !== normalized.basis || requested.timezone !== normalized.timezone) fail('Window basis/timezone substitution');
  if (requested.basis === 'explicit' && (requested.startInclusive !== normalized.startInclusive || requested.endExclusive !== normalized.endExclusive)) fail('Explicit window substitution');
  if (requested.basis === 'relative-duration' && (normalized.endExclusive !== requested.anchorAt || Date.parse(normalized.endExclusive) - Date.parse(normalized.startInclusive) !== requested.days * 86400000)) fail('Relative duration substitution');
  if (requested.basis === 'calendar-week' && requested.weekStartsOn !== normalized.weekStartsOn) fail('Week policy substitution');
  if (requested.basis === 'fiscal-year' && ['year', 'calendarId', 'stage', 'revisionId'].some(field => requested[field] !== normalized[field])) fail('Fiscal basis substitution');
  return normalized;
}

export function assertSubject(subject, binding = null) {
  validateShape('ResolvedSubject', subject);
  unique(subject.entityIds, 'subject entity');
  if (subject.scopes.some(scope => scope.tenantId !== subject.tenantId || scope.policyRevision !== subject.policyRevision)) fail('Subject lineage mismatch');
  if (binding && (subject.tenantId !== binding.tenantId || subject.actorId !== binding.actorId)) fail('Subject binding mismatch');
  if (subject.kind === 'portfolio') {
    if (subject.entityType !== 'client' || subject.rosterVersionId === null) fail('Portfolio requires a versioned authorized client roster');
  } else if (subject.entityIds.length !== 1 || subject.rosterVersionId !== null) fail('Single subject identity mismatch');
  if (subject.kind === 'client' && subject.entityType !== 'client') fail('Client subject mismatch');
  if (subject.kind === 'personal' && (subject.entityType !== 'user' || subject.entityIds[0] !== subject.actorId)) fail('Personal subject mismatch');
  return subject;
}

export const {assertCatalog} = createCatalogValidators({validateShape, schemaRecords:
  groups.map((group, index) => ({group, schema: schemas[index],
    sha256: createHash('sha256').update(schemaBytes[index]).digest('hex')}))});

// Shared declarations only; this does not decide current source authorization.
function assertSourceInventory(envelope) {
  const { coverage: c, continuation: next, sources } = envelope;
  const requested = c.sourcesRequested;
  unique(sources.map(source => source.sourceId), 'source metadata');
  if (!sameSet(sources.map(source => source.sourceId), requested)) fail('Source inventory mismatch');
  const checked = sources.filter(source => ['checked', 'partial'].includes(source.status)).map(source => source.sourceId);
  const unavailable = sources.filter(source => ['unavailable', 'denied'].includes(source.status)).map(source => source.sourceId);
  if (!sameSet(c.sourcesChecked, checked) || !sameSet(c.sourcesUnavailable, unavailable)) fail('Source coverage mismatch');
  if (next.remainingSources.some(id => !requested.includes(id))) fail('Unknown remaining source');
  if (sources.some(source => source.status === 'checked' && source.snapshotVersionId === null)) fail('Checked source requires snapshot identity');
  if (sources.some(source => source.freshness === 'fresh' && (source.asOf === null || source.synchronizedAt === null))) fail('Freshness requires timestamps');
  if (sources.some(source => [source.asOf, source.synchronizedAt].some(stamp => stamp !== null && Date.parse(stamp) > Date.parse(source.retrievedAt)))) fail('Impossible source timestamps');
  return { checked, requested };
}

export function assertEvidence(envelope) {
  validateShape('EvidenceEnvelope', envelope);
  assertSubject(envelope.subject, envelope.binding); assertWindow(envelope.window);
  const { coverage: c, continuation: next, sources, data } = envelope;
  const reasons = { complete: ['OK'], partial: ['PARTIAL_COVERAGE', 'STALE_SOURCE'], empty: ['NO_MATCH'], unavailable: ['SOURCE_UNAVAILABLE', 'TIMEOUT'], denied: ['ACCESS_DENIED'], error: ['INVALID_ARGUMENTS', 'AMBIGUOUS_SUBJECT', 'TIMEOUT', 'INDETERMINATE', 'INTERNAL_ERROR'] };
  if (!reasons[envelope.status].includes(envelope.reasonCode) || (envelope.retryable && !['SOURCE_UNAVAILABLE', 'TIMEOUT'].includes(envelope.reasonCode))) fail('Outcome/retry taxonomy mismatch');
  const { checked, requested } = assertSourceInventory(envelope);
  const incomplete = c.truncated || next.cursor !== null || next.remainingSources.length > 0 || c.historySupport !== 'supported' || sources.some(source => source.status !== 'checked');
  if (c.enumeration === 'complete' && incomplete) fail('Incomplete enumeration');
  if (envelope.status === 'complete' && (c.enumeration !== 'complete' || sources.some(source => source.freshness !== 'fresh') || next.requiredReads.length > 0)) fail('Incomplete response cannot claim complete');
  if (['denied', 'error', 'unavailable'].includes(envelope.status)) {
    if (data !== null || c.returnedCount !== 0 || c.enumerableTotal !== null || envelope.negativeAssertion.kind !== 'none') fail('Failure outcome contains result or negative assertion');
  } else {
    if (data === null) fail('Successful response requires typed data');
    const legal = { 'candidate-search': ['candidates'], exact: ['count', 'status', 'history', 'comparison'], 'source-read': ['source-read'] };
    if (!legal[envelope.method].includes(data.kind)) fail('Method and typed result mismatch');
    const records = data.records ?? [];
    const returned = data.kind === 'count' ? 1 : records.length;
    if (c.returnedCount !== returned) fail('Returned count mismatch');
    if (envelope.method === 'exact' && sources.some(source => source.authority !== 'authoritative')) fail('Exact result requires authoritative sources');
    if (data.kind === 'count' && (c.enumerableTotal !== data.value || c.enumeration !== 'complete' || sources.some(source => source.authority !== 'authoritative'))) fail('Exact count requires complete authoritative enumeration');
    if (data.kind === 'history' && c.enumeration === 'complete' && c.enumerableTotal !== records.length) fail('Complete history requires exact enumerable total');
    if (envelope.method === 'candidate-search' && c.enumerableTotal !== null) fail('Candidate search cannot invent total');
    if (envelope.method === 'source-read' && records.some(record => record.content.kind !== 'full-read')) fail('Source read requires full material content');
    // Citations/content cannot manufacture another immutable record version.
    unique(records.map(record => JSON.stringify([record.sourceId, record.recordId, record.recordVersionId])), 'evidence record-version identity');
    for (const record of records) {
      if (!checked.includes(record.sourceId)) fail('Evidence source is not eligible');
      if (!requested.includes(record.sourceId) || record.scopes.some(scope => !envelope.subject.scopes.some(parent => canonicalSha256(parent) === canonicalSha256(scope)))) fail('Evidence lineage mismatch');
      if (record.content.kind === 'snippet' && !next.requiredReads.includes(record.content.readHandle)) fail('Snippet requires decisive follow-up');
    }
    if (data.kind === 'comparison' && (data.left.stage !== data.right.stage || data.left.unit !== data.right.unit || data.left.versionId !== data.right.versionId)) fail('Incompatible comparison basis');
    if (envelope.status === 'empty' && (['status', 'comparison'].includes(data.kind) || (data.kind === 'count' ? data.value !== 0 : records.length !== 0))) fail('Nonempty empty outcome');
  }
  if (envelope.negativeAssertion.kind === 'absence') {
    if (envelope.method !== 'exact' || !['count', 'history'].includes(data?.kind) || envelope.status !== 'empty' || c.enumeration !== 'complete' || c.enumerableTotal !== 0 || incomplete || next.requiredReads.length || !sameSet(envelope.negativeAssertion.sourceIds, requested) || sources.some(source => source.authority !== 'authoritative' || source.freshness !== 'fresh')) fail('Unsupported absence assertion');
  }
  return envelope;
}

const mailValidators = createMailValidators({validateShape, assertSubject, assertWindow, assertSourceInventory, unique});
export const {assertMailThreadInput, assertMailThreadSourcePage, assertMailListInput, assertMailSearchInput, assertMailCandidateSourcePage} = mailValidators;

const meetingValidators = createMeetingValidators({validateShape, assertSubject, assertWindow, assertSourceInventory, unique});
export const {
  assertUpcomingMeetingsInput, assertUpcomingMeetingsPage, assertDebriefReadInput, assertDebriefSourcePage,
  assertClientMeetingReadInput, assertClientMeetingInventoryPage, assertClientMeetingSourceBodyPage,
} = meetingValidators;

const operationalReadValidators = createOperationalReadValidators({validateShape, assertSubject, assertWindow, assertSourceInventory, unique});
export const {
  assertTaskReadInput, assertTaskReadPage, assertActionItemReadInput, assertActionItemClientScopedPage,
  OPERATIONAL_READ_PENDING_MODES,
} = operationalReadValidators;

const federalMarketValidators = createFederalMarketValidators({
  validateShape, schema: schemas[groups.indexOf('federal-market')],
});
export const {
  federalMarketSchemaId, FEDERAL_MARKET_OPERATION_IDS, federalMarketInputDefinition,
  validateFederalMarketShape, normalizeFederalMarketInput,
} = federalMarketValidators;

const dataSearchValidators = createDataSearchValidators({
  validateShape, schema: schemas[groups.indexOf('data-search')],
});
export const {
  DATA_SEARCH_OPERATION_ID, DATA_SEARCH_DOMAINS, DATA_SEARCH_QUERY_CLASSES,
  RETRIEVAL_QUERY_CLASSES, DATA_SEARCH_UNSELECTABLE_QUERY_CLASSES, DATA_SEARCH_DEFAULTS,
  DATA_SEARCH_STRICTER_THAN_FROZEN, RESULT_UNPROVEN_RELATIONS, DATA_SEARCH_FROZEN_BOUNDARY_NOTES,
  dataSearchSchemaId, validateDataSearchShape, normalizeDataSearchInput, assertDataSearchResult,
} = dataSearchValidators;

const memoryProposalValidators = createMemoryProposalValidators({validateShape, assertSubject, unique});
export const {normalizeMemoryProposalInput, assertMemoryProposalReadResult} = memoryProposalValidators;

const clientRegistryValidators = createClientRegistryValidators({validateShape});
export const {normalizeClientRegistryInput, assertClientRegistryResult} = clientRegistryValidators;

const researchPortfolioEvidenceValidators = createResearchPortfolioEvidenceValidators({validateShape, assertSubject, canonicalSha256});
export const {normalizeResearchPortfolioEvidenceInput, assertResearchPortfolioEvidenceOutput} = researchPortfolioEvidenceValidators;
const researchPortfolioValidators = createResearchPortfolioValidators({validateShape, assertSubject, canonicalSha256});
export const {normalizeResearchPortfolioInput, assertResearchPortfolioReadResult} = researchPortfolioValidators;

const businessDevelopmentValidators = createBusinessDevelopmentValidators({
  validateShape, schema: schemas[groups.indexOf('business-development')],
});
export const {businessDevelopmentSchemaId, BUSINESS_DEVELOPMENT_OPERATION_IDS,
  businessDevelopmentInputDefinition, businessDevelopmentOutputDefinition,
  normalizeBusinessDevelopmentInput, validateBusinessDevelopmentShape, assertBusinessDevelopmentOutput} = businessDevelopmentValidators;

const fundingOpportunitiesValidators = createFundingOpportunitiesValidators({validateShape, schema: schemas[groups.indexOf('funding-opportunities')]});
const clientDocumentsValidators = createClientDocumentsValidators({validateShape, assertSubject, canonicalSha256});
const publicDataValidators = createPublicDataValidators({validateShape, schema: schemas[groups.indexOf('public-data')]});
const districtNexusValidators = createDistrictNexusValidators({validateShape, assertSubject, canonicalSha256});

const stateLegislationValidators = createStateLegislationValidators({validateShape, schema: schemas[groups.indexOf('state-legislation')]});

const publicReportsValidators = createPublicReportsValidators({validateShape, schema: schemas[groups.indexOf('public-reports')]});

const disclosuresValidators = createDisclosuresValidators({validateShape});
const acquisitionPersonnelValidators = createAcquisitionPersonnelValidators({validateShape, schema: schemas[groups.indexOf('acquisition-personnel')]});
const federalLegislationValidators = createFederalLegislationValidators({validateShape, schema: schemas[groups.indexOf('federal-legislation')]});

const billTextValidators = createBillTextValidators({validateShape, schema: schemas[groups.indexOf('bill-text')]});

const legislativeDirectoryValidators = createLegislativeDirectoryValidators({validateShape, schema: schemas[groups.indexOf('legislative-directory')]});
const peReferenceValidators = createPeReferenceValidators({validateShape, schema: schemas[groups.indexOf('pe-references')]});
const ruleStatusValidators = createRuleStatusValidators({validateShape, schema: schemas[groups.indexOf('rule-status')]});
const certificationStatusValidators = createCertificationStatusValidators({validateShape, schema: schemas[groups.indexOf('certification-status')]});
const storedIntelligenceValidators = createStoredIntelligenceValidators({validateShape, schema: schemas[groups.indexOf('stored-intelligence')]});
const datasetMetadataValidators = createDatasetMetadataValidators({validateShape, schema: schemas[groups.indexOf('dataset-metadata')]});
const facilityRepresentationValidators = createFacilityRepresentationValidators({validateShape, assertSubject, canonicalSha256});

const stateStatusVotesValidators = createStateStatusVotesValidators({validateShape, schema: schemas[groups.indexOf('state-status-votes')]});
const regulatoryDocketsValidators = createRegulatoryDocketsValidators({validateShape, schema: schemas[groups.indexOf('regulatory-dockets')]});
const tenantContactsValidators = createTenantContactsValidators({validateShape});
const entityCandidatesValidators = createEntityCandidatesValidators({validateShape, schema: schemas[groups.indexOf('entity-candidates')]});
const trackedBillsValidators = createTrackedBillsValidators({validateShape, assertSubject, canonicalSha256});
const intelligenceSummaryValidators = createIntelligenceSummaryValidators({validateShape, schema: schemas[groups.indexOf('intelligence-summary')]});

const publicWebValidators = createPublicWebValidators({validateShape, schema: schemas[groups.indexOf('public-web')]});
const samOpportunitiesValidators = createSamOpportunitiesValidators({validateShape, schema: schemas[groups.indexOf('sam-opportunities')]});
const floridaBudgetValidators = createFloridaBudgetValidators({validateShape, schema: schemas[groups.indexOf('florida-budget')]});

const outreachQueryValidators = createOutreachQueryValidators({validateShape, schema: schemas[groups.indexOf('outreach-query')]});
const programElementValidators = createProgramElementValidators({validateShape, schema: schemas[groups.indexOf('program-elements')]});

export const publicDomainDatasetRegistry = createPublicDomainDatasetRegistry({canonicalSha256, validateMetadata: validateShape});
const clientKnowledgeSearchValidators = createClientKnowledgeSearchValidators({validateShape, schema: schemas[groups.indexOf('client-knowledge-search')]});
const clientKnowledgeMondayValidators = createClientKnowledgeMondayValidators({validateShape, schema: schemas[groups.indexOf('client-knowledge-monday')]});
const clientKnowledgeAttachmentValidators = createClientKnowledgeAttachmentValidators({validateShape, schema: schemas[groups.indexOf('client-knowledge-attachments')]});
const clientKnowledgeMemoryValidators = createClientKnowledgeMemoryValidators({validateShape, schema: schemas[groups.indexOf('client-knowledge-memory')]});
const clientKnowledgeProfileValidators = createClientKnowledgeProfileValidators({validateShape, schema: schemas[groups.indexOf('client-knowledge-profile')]});
const researchLegalCandidatesValidators = createResearchLegalCandidatesValidators({validateShape, schema: schemas[groups.indexOf('research-legal-candidates')]});
const publicDomainQueryValidators = createPublicDomainQueryValidators({validateShape, schema: schemas[groups.indexOf('public-domain-query')], canonicalSha256, datasetRegistry: publicDomainDatasetRegistry});
const researchLegalLegislationValidators = createResearchLegalLegislationValidators({validateShape, schema: schemas[groups.indexOf('research-legal-legislation')]});
const actionItemsCompleteValidators = createActionItemsCompleteValidators({validateShape, validatePublicShape, canonicalSha256, assertActionItemReadInput, assertActionItemClientScopedPage});
const researchLegalNewsValidators = createResearchLegalNewsValidators({validateShape, schema: schemas[groups.indexOf('research-legal-news')]});
const publicDomainHearingsValidators = createPublicDomainHearingsValidators({validateShape, schema: schemas[groups.indexOf('public-domain-hearings')]});

export function assertSkillManifest(manifest, catalog) {
  validateShape('SkillManifest', manifest); assertCatalog(catalog);
  unique(manifest.requiredSources.map(source => `${source.sourceId}:${source.purpose}`), 'required skill source');
  unique(manifest.allowedOperations.map(key), 'allowed skill operation');
  const operations = manifest.allowedOperations.map(reference => catalog.operations.find(operation => key(operation.operation) === key(reference)));
  if (operations.some(operation => !operation || operation.availability !== 'enabled')) fail('Skill requires unavailable operation');
  for (const required of manifest.requiredSources) {
    if (!operations.some(operation => operation.sourceRequirements.some(source => canonicalSha256(source) === canonicalSha256(required)))) fail('Skill required source has no legal operation');
  }
  return manifest;
}

export function assertSkillPin(pin, manifest, catalog) {
  validateShape('PinnedSkill', pin); assertSkillManifest(manifest, catalog);
  assertSubject(pin.subject); assertWindow(pin.window);
  if (pin.skillId !== manifest.skillId || pin.skillVersion !== manifest.skillVersion || pin.manifestSha256 !== canonicalSha256(manifest) || pin.catalogSha256 !== canonicalSha256(catalog)) fail('Immutable skill/catalog pin mismatch');
  if (!manifest.subjectKinds.includes(pin.subject.kind) || !manifest.windowBases.includes(pin.window.basis)) fail('Skill subject/window mismatch');
  return pin;
}

export function assertSkillContinuity(previous, next) {
  validateShape('PinnedSkill', previous); validateShape('PinnedSkill', next);
  assertSubject(previous.subject); assertSubject(next.subject); assertWindow(previous.window); assertWindow(next.window);
  if (previous.subject.tenantId !== next.subject.tenantId || previous.subject.actorId !== next.subject.actorId) fail('Skill lifecycle stable identity mismatch');
  for (const field of ['skillId', 'skillVersion', 'manifestSha256', 'catalogSha256']) {
    if (previous[field] !== next[field]) fail('Skill lifecycle requires explicit reviewed migration or reselection');
  }
  return next;
}

// Structural and consistency checks only: never authenticate, authorize,
// resolve an entity/timezone boundary, load handlers, or enable source access.

// Fixed source catalog snapshot; no operation handler is loaded or enabled.
const sourceCatalog = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url)));
export const {resolveOperationContract} = createOperationContracts({catalog: sourceCatalog,
  bindings: CATALOG_OPERATION_BINDINGS, assertCatalog, canonicalSha256,
  validators: Object.freeze({...mailValidators, ...meetingValidators, ...operationalReadValidators,
    ...federalMarketValidators, ...dataSearchValidators, ...memoryProposalValidators, ...clientRegistryValidators,
    ...executionToolValidators, ...researchPortfolioEvidenceValidators, ...researchPortfolioValidators, ...businessDevelopmentValidators,
    ...fundingOpportunitiesValidators, ...clientDocumentsValidators, ...publicDataValidators, ...districtNexusValidators, ...stateLegislationValidators, ...publicReportsValidators,
    ...disclosuresValidators, ...acquisitionPersonnelValidators, ...federalLegislationValidators, ...billTextValidators,
    ...legislativeDirectoryValidators, ...peReferenceValidators, ...ruleStatusValidators, ...certificationStatusValidators, ...storedIntelligenceValidators, ...datasetMetadataValidators, ...facilityRepresentationValidators,
    ...stateStatusVotesValidators, ...regulatoryDocketsValidators, ...tenantContactsValidators, ...entityCandidatesValidators, ...trackedBillsValidators, ...intelligenceSummaryValidators,
    ...publicWebValidators, ...samOpportunitiesValidators, floridaBudgetValidators,
    ...outreachQueryValidators, ...programElementValidators,
    clientKnowledgeSearchValidators, clientKnowledgeMondayValidators, clientKnowledgeAttachmentValidators, clientKnowledgeMemoryValidators, clientKnowledgeProfileValidators, ...researchLegalCandidatesValidators, ...publicDomainQueryValidators, ...researchLegalLegislationValidators, ...actionItemsCompleteValidators, ...researchLegalNewsValidators, ...publicDomainHearingsValidators})});
