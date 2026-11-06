// Private stored-source projections; gateway/source owners retain all authority.
import {snapshotOperationData} from './operation-contracts.mjs';
import {assertPublicDataInstant, assertPublicGrantDates, assertPublicAwardDates} from './public-data-deadlines.mjs';

const fail = message => { throw new Error(message); };
const families = Object.freeze({query_economic_data: 'PublicEconomic', search_federal_grants: 'PublicGrant', search_federal_awards: 'PublicAward'});
export const PUBLIC_DATA_OPERATION_IDS = Object.freeze(Object.keys(families));
/** Core's `federal_grant.status` is free text whose ingestion writes these four lowercase values (Tango
 * P/F/C/A -> posted/forecasted/closed/archived) and whose typed read matches it by exact equality
 * (`where.status = status` after a trim). The gateway deliberately sends the caller's ORIGINAL request bytes,
 * bound to the request hash and the evidence-mode observation, so nothing here may rewrite them: a spelling
 * outside the stored domain is refused before dispatch instead of being answered as an empty page, and a
 * value inside it is carried unchanged. Case-insensitive acceptance would need the receiving owner to
 * normalize the selector; it is not simulated locally. */
const GRANT_STATUSES = Object.freeze(['posted', 'forecasted', 'closed', 'archived']);
const text = (value, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const limit = value => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numeric) ? Math.min(50, Math.max(1, Math.trunc(numeric))) : 20;
};

export function createPublicDataValidators({validateShape, schema}) {
  if (typeof validateShape !== 'function' || !schema?.$defs) fail('Public-data validator configuration');
  const definition = (id, kind) => {
    if (typeof id !== 'string' || !Object.hasOwn(families, id)) fail('Unknown public-data operation');
    return `${families[id]}${kind}`;
  };
  function policy(id, options) {
    const context = snapshotOperationData(options);
    if (id === 'query_economic_data') {
      if (!context || Array.isArray(context) || typeof context !== 'object' || Object.keys(context).length)
        fail('Economic read has no caller policy context');
      return null;
    }
    validateShape('PublicDataPolicyContext', context);
    return context.evidenceAccuracyMode;
  }
  function normalizePublicDataInput(id, request, options = {}) {
    const raw = snapshotOperationData(request);
    validateShape(definition(id, 'Request'), raw);
    const mode = policy(id, options), input = {limit: limit(raw.limit)};
    const lengths = id === 'query_economic_data'
      ? {state: 2, district: 10, seriesId: 60, query: 240}
      : id === 'search_federal_grants' ? {query: 240, agency: 240, status: 30} : {query: 240, agency: 240, peCode: 16};
    for (const [key, max] of Object.entries(lengths)) {
      const value = text(raw[key], max); if (value !== null) input[key] = ['state', 'peCode'].includes(key) ? value.toUpperCase() : value;
    }
    if (id === 'search_federal_grants' && input.status !== undefined && !GRANT_STATUSES.includes(input.status))
      fail('Unknown stored grant status');
    if (id === 'query_economic_data') {
      const source = text(raw.source, 20) ?? 'census';
      input.source = ['census', 'bls', 'bea'].includes(source.toLowerCase()) ? source.toLowerCase() : source;
      const dataset = text(raw.datasetName, 60) ?? text(raw.dataset, 60);
      if (dataset !== null) input.datasetName = dataset;
      if (raw.year !== undefined && raw.year !== null && !(typeof raw.year === 'string' && !raw.year.trim())) {
        const year = Number(raw.year);
        if (!Number.isInteger(year) || year < -2147483648 || year > 2147483647) fail('Invalid stored economic year selector');
        input.year = year;
      }
      // A selector from another source must not silently turn into an unfiltered
      // success. Defaults and blank aliases retain their existing meaning.
      const unsupported = input.source === 'census' ? ['seriesId','query','datasetName','year']
        : input.source === 'bls' ? ['state','district','datasetName']
        : input.source === 'bea' ? ['district','seriesId'] : [];
      if (unsupported.some(key => input[key] !== undefined)) fail('Economic selector is not supported by this source');
      if (input.source === 'bea' && input.state !== undefined) {
        input.datasetName ??= 'Regional';
        if (input.datasetName !== 'Regional') fail('BEA state selection requires the Regional dataset');
      }
    } else if (id === 'search_federal_awards') {
      const page = raw.page ?? 1;
      if (typeof page === 'string' && !/^[1-9]\d*$/.test(page)) fail('Invalid award page');
      input.page = Number(page);
    }
    validateShape(definition(id, 'Input'), input);
    return Object.freeze({input: Object.freeze(input), metadata: Object.freeze(mode === null ? {} : {evidenceAccuracyMode: mode})});
  }
  function economic(page, input) {
    if (!['census', 'bls', 'bea'].includes(input.source)) {
      if (!Object.hasOwn(page, 'error') || Object.hasOwn(page, 'data')) fail('Unsupported economic source is not an empty success');
      return;
    }
    if (page.source !== input.source || Object.hasOwn(page, 'error')) fail('Economic source substitution');
    if (page.data.length > input.limit) fail('Economic result exceeds requested window');
    if (['bls','bea'].includes(input.source) &&
        (Object.hasOwn(page, 'appliedYear') !== (input.year !== undefined) || page.appliedYear !== input.year))
      fail('Economic applied year substitution');
    if (input.source === 'bea' &&
        (Object.hasOwn(page, 'appliedState') !== (input.state !== undefined) || page.appliedState !== input.state))
      fail('BEA applied state substitution');
    assertPublicDataInstant(page.generatedAt);
    for (const row of page.data) {
      if (page.source === 'census' && ((input.state && row.state !== input.state) || (input.district && row.district !== input.district)))
        fail('Census exact selector substitution');
      if (page.source === 'bls' && input.seriesId && row.seriesId !== input.seriesId) fail('BLS exact series substitution');
      if (page.source === 'bls' && input.year !== undefined &&
          (!row.recentDataPoints.length || row.recentDataPoints.some(point => point.year !== input.year)))
        fail('BLS observation year substitution');
      if (page.source === 'bea') {
        if ((input.datasetName && row.datasetName !== input.datasetName) || (input.year !== undefined && row.year !== input.year))
          fail('BEA exact selector substitution');
        if (input.state !== undefined && (row.state !== input.state || !/^[0-9]{2}000$/u.test(row.geoFips ?? '')))
          fail('BEA state aggregate substitution');
        if (row.description.length > 240) fail('BEA description exceeds UTF-16 window');
      }
    }
  }
  function grants(page, input, mode) {
    if (page.data.length > input.limit) fail('Grant result exceeds requested window');
    if (page.data.some(row => row.title.length > 240 || (input.status && row.syncedStatus !== input.status)))
      fail('Grant title bound or exact stored status mismatch');
    assertPublicGrantDates(page, mode);
  }
  function awards(page, input, mode) {
    if (page.page !== input.page || page.pageSize !== input.limit || page.data.length > input.limit)
      fail('Award page lineage mismatch');
    const more = page.page * page.pageSize < page.total, capped = more && page.page === 10000;
    if (page.hasMore !== more || page.paginationLimitReached !== capped || page.nextPage !== (more && !capped ? page.page + 1 : null))
      fail('Award continuation or terminal bound mismatch');
    for (const row of page.data) {
      if (row.description.length > 240 || (input.peCode && row.peCode !== input.peCode))
        fail('Award description bound or exact PE mismatch');
      assertPublicAwardDates(row, mode);
    }
  }
  const assertions = {query_economic_data: economic, search_federal_grants: grants, search_federal_awards: awards};
  function assertPublicDataOutput(id, value, request, options = {}) {
    const {input, metadata} = normalizePublicDataInput(id, request, options), page = snapshotOperationData(value);
    validateShape(definition(id, 'Output'), page);
    if (!Object.hasOwn(page, 'error')) assertPublicDataInstant(page.generatedAt);
    assertions[id](page, input, metadata.evidenceAccuracyMode);
    return page;
  }
  function validatePublicDataShape(name, value) {
    if (typeof name !== 'string' || !Object.hasOwn(schema.$defs, name)) fail('Unknown public-data shape');
    const data = snapshotOperationData(value); validateShape(name, data); return data;
  }
  return Object.freeze({normalizePublicDataInput, assertPublicDataOutput, validatePublicDataShape,
    publicDataInputDefinition: id => definition(id, 'Input'), publicDataOutputDefinition: id => definition(id, 'Output')});
}
