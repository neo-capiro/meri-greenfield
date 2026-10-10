import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { canonicalSha256 } from '../validate.mjs';

export const contractVersion = '0.2.0';
const groups = ['common', 'catalog', 'retrieval', 'skill'];
const schemas = groups.map(group => JSON.parse(readFileSync(new URL(`./${group}.schema.json`, import.meta.url))));
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(JSON.parse(readFileSync(new URL('../meri.schema.json', import.meta.url))));
for (const schema of schemas) ajv.addSchema(schema);
const validators = new Map(schemas.flatMap(schema => Object.keys(schema.$defs).map(name =>
  [name, ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` })])));

export function validateShape(name, value) {
  const check = validators.get(name);
  if (!check) throw new Error(`Unknown R2 contract ${name}`);
  if (!check(value)) throw new Error(`${name}: ${ajv.errorsText(check.errors)}`);
  return value;
}
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

export function assertCatalog(catalog) {
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
  return catalog;
}

export function assertEvidence(envelope) {
  validateShape('EvidenceEnvelope', envelope);
  assertSubject(envelope.subject, envelope.binding); assertWindow(envelope.window);
  const { coverage: c, continuation: next, sources, data } = envelope;
  const reasons = { complete: ['OK'], partial: ['PARTIAL_COVERAGE', 'STALE_SOURCE'], empty: ['NO_MATCH'], unavailable: ['SOURCE_UNAVAILABLE', 'TIMEOUT'], denied: ['ACCESS_DENIED'], error: ['INVALID_ARGUMENTS', 'AMBIGUOUS_SUBJECT', 'TIMEOUT', 'INDETERMINATE', 'INTERNAL_ERROR'] };
  if (!reasons[envelope.status].includes(envelope.reasonCode) || (envelope.retryable && !['SOURCE_UNAVAILABLE', 'TIMEOUT'].includes(envelope.reasonCode))) fail('Outcome/retry taxonomy mismatch');
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
