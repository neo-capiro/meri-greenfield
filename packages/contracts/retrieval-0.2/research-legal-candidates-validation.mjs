// Pure projected candidate boundary. Current tenant, ownership, mail removal,
// client visibility and directory-note access stay with the gateway/source owner.
import {snapshotOperationData} from './operation-contracts.mjs';
import {assertPublicDataInstant} from './public-data-deadlines.mjs';

const ID = 'search_research_sources';
const URN = 'urn:meri:retrieval:research-legal-candidates:0.2.0';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = message => { throw new Error(message); };
export const RESEARCH_LEGAL_CANDIDATES_OPERATION_IDS = Object.freeze([ID]);
const kinds = Object.freeze(['client','meeting','mail_thread','mail_message','clio_note','directory_contact_note']);
const sameUuid = (left,right) => typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();

export function createResearchLegalCandidatesValidators({validateShape,schema}) {
  if (typeof validateShape !== 'function' || schema?.$id !== URN || !schema.$defs)
    fail('Research candidate validator configuration');
  const definitions = new Set(Object.keys(schema.$defs));
  const operation = id => { if (id !== ID) fail('Unknown research candidate operation'); };
  function researchLegalCandidatesInputDefinition(id) { operation(id); return 'ResearchLegalCandidatesInput'; }
  function researchLegalCandidatesOutputDefinition(id) { operation(id); return 'ResearchLegalCandidatesOutput'; }
  function validateResearchLegalCandidatesShape(name,value) {
    if (typeof name !== 'string' || !definitions.has(name)) fail('Unknown research candidate definition');
    const data = snapshotOperationData(value); validateShape(name,data); return data;
  }
  function normalizeResearchLegalCandidatesInput(id,request,options) {
    operation(id);
    const raw = validateResearchLegalCandidatesShape('ResearchLegalCandidatesRequest',request);
    const context = validateResearchLegalCandidatesShape('ResearchLegalCandidatesContext',options);
    const query = raw.query.trim().slice(0,240);
    // ensureClientVisible trims the wrapper's capped reference again. A name is
    // never treated as an identity, and an explicit UUID cannot be rebound.
    const reference = raw.clientId?.trim().slice(0,80).trim() || null;
    const resolved = context.clientResolution;
    let clientId = null;
    if (reference === null) {
      if (resolved !== null) fail('Absent research client cannot carry a resolution');
    } else {
      if (resolved === null || resolved.reference !== reference ||
          UUID.test(reference) && !sameUuid(reference,resolved.clientId))
        fail('Research client differs from trusted resolution');
      clientId = resolved.clientId.toLowerCase();
    }
    const numeric = typeof raw.limit === 'number' ? raw.limit : typeof raw.limit === 'string' ? Number(raw.limit) : NaN;
    const limit = Number.isFinite(numeric) ? Math.max(1,Math.min(25,Math.trunc(numeric))) : 8;
    const input = {query,clientId,limit}; validateShape('ResearchLegalCandidatesInput',input);
    return Object.freeze({input:Object.freeze(input),metadata:Object.freeze({
      sourceConnected:false,producerQualified:false,authorizationEstablished:false,
      absenceEvidence:false,complete:false,coverage:'six capped candidate branches; tenant directory notes remain unscoped by client',
    })});
  }
  function assertResearchLegalCandidatesOutput(id,value,request,options) {
    const {input} = normalizeResearchLegalCandidatesInput(id,request,options);
    const page = validateResearchLegalCandidatesShape(researchLegalCandidatesOutputDefinition(id),value);
    assertPublicDataInstant(page.generatedAt);
    if (page.query !== input.query || page.results.length > input.limit * 3)
      fail('Research candidate query or final window mismatch');
    const seen = new Set(), counts = new Map();
    let previous = null;
    for (const row of page.results) {
      const key = `${row.type}:${row.id.toLowerCase()}`;
      if (seen.has(key)) fail('Duplicate research candidate within one source family');
      seen.add(key); counts.set(row.type,(counts.get(row.type) ?? 0)+1);
      if (counts.get(row.type) > input.limit) fail('Research source branch exceeds its fetched window');
      if (row.snippet.length > 360 || row.snippet !== row.snippet.replace(/\s+/g,' ').trim())
        fail('Research candidate snippet exceeds its normalized UTF-16 projection');
      if (row.type === 'client' && !sameUuid(row.id,row.clientId)) fail('Research client identity mismatch');
      if (row.type !== 'directory_contact_note' && input.clientId !== null && !sameUuid(row.clientId,input.clientId))
        fail('Research candidate differs from resolved client filter');
      if (row.occurredAt !== null) assertPublicDataInstant(row.occurredAt);
      const time = row.occurredAt === null ? 0 : Date.parse(row.occurredAt), rank = kinds.indexOf(row.type);
      if (previous && (time > previous.time || time === previous.time && rank < previous.rank))
        fail('Research candidates must retain descending time and stable source-family ties');
      previous = {time,rank};
    }
    // Hidden source text may match when no projected field does. No match,
    // current-rights, source freshness, corpus total or absence proof is inferred.
    return page;
  }
  return Object.freeze({researchLegalCandidatesSchemaId:URN,RESEARCH_LEGAL_CANDIDATES_OPERATION_IDS,
    researchLegalCandidatesInputDefinition,researchLegalCandidatesOutputDefinition,
    normalizeResearchLegalCandidatesInput,validateResearchLegalCandidatesShape,assertResearchLegalCandidatesOutput});
}
