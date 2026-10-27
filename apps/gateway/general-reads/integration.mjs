import * as watchState from './families/watch-state.mjs';
import * as legislativeComparisons from './families/legislative-comparisons.mjs';
import * as legiwatchRelevance from './families/legiwatch-relevance.mjs';
import * as legiwatchReview from './families/legiwatch-review.mjs';
/** Finite existing typed family constructors. Transport and identity ports come from control; no ambient credentials or import-time I/O. */
import {ownFields,frozenData} from '../sources/source-admission.mjs';
import {deny} from '../dispatch/operation-result.mjs';
import {assertFamilyHandlerSet} from './registration.mjs';
import {NATIVE_READ_FAMILIES} from '../sources/retained-reads/native-families.mjs';
import * as f0 from './families/meeting-source.mjs';
import * as f1 from './families/action-items-complete.mjs';
import * as f2 from './families/operational-reads.mjs';
import * as f3 from './families/tenant-contacts.mjs';
import * as f4 from './families/entity-candidates.mjs';
import * as f5 from './families/client-knowledge-profile.mjs';
import * as f6 from './families/client-documents.mjs';
import * as f7 from './families/client-knowledge-memory.mjs';
import * as f8 from './families/client-knowledge-monday.mjs';
import * as f9 from './families/dataset-metadata.mjs';
import * as f10 from './families/memory-proposals.mjs';
import * as f11 from './families/research-portfolio-evidence.mjs';
import * as f12 from './families/research-portfolio.mjs';
import * as f13 from './families/florida-budget.mjs';
import * as f14 from './families/bill-text.mjs';
import * as f15 from './families/public-reports.mjs';
import * as f16 from './families/acquisition-personnel.mjs';
import * as f17 from './families/disclosures.mjs';
import * as f18 from './families/legislative-directory.mjs';
import * as f19 from './families/pe-references.mjs';
import * as f20 from './families/federal-legislation.mjs';
import * as f21 from './families/state-legislation.mjs';
import * as f22 from './families/stored-intelligence.mjs';
import * as f23 from './families/regulatory-dockets.mjs';
import * as f24 from './families/intelligence-summary.mjs';
import * as f25 from './families/public-web.mjs';
import * as f26 from './families/data-search.mjs';
import * as f27 from './families/public-domain-query.mjs';
import * as f28 from './families/facility-representation.mjs';
import * as f29 from './families/district-nexus.mjs';
import * as f30 from './families/client-registry.mjs';
import * as f31 from './families/federal-market.mjs';
import * as f32 from './families/public-data.mjs';
import * as f33 from './families/client-knowledge-search.mjs';
import * as f34 from './families/state-status-votes.mjs';
import * as f35 from './families/tracked-bills.mjs';
import * as f36 from './families/public-domain-hearings.mjs';
import * as f37 from './families/research-legal-legislation.mjs';
import * as f38 from './families/research-legal-news.mjs';
import * as f39 from './families/outreach-query.mjs';
import * as f40 from './families/business-development.mjs';
import * as f41 from './families/funding-opportunities.mjs';
import * as f42 from './families/mail.mjs';
import * as f43 from './families/program-elements.mjs';
import * as f44 from './families/research-legal-candidates.mjs';
import * as f45 from './families/certification-status.mjs';
import * as f46 from './families/rule-status.mjs';
import * as f47 from './families/sam-opportunities.mjs';
import * as f48 from './families/connected-apps.mjs';
import * as f49 from './families/teams-channels.mjs';
import * as researchSharing from './families/research-portfolio-sharing.mjs';
import * as researchWorkflow from './families/research-portfolio-workflow.mjs';
import * as capiroData from './families/capiro-data.mjs';
import * as savedRecordValidators from './families/saved-records.mjs';
import * as strategySavedValidators from './families/strategy-saved-records.mjs';
const modules=[watchState,legiwatchRelevance,legislativeComparisons,legiwatchReview,researchSharing,researchWorkflow,strategySavedValidators,savedRecordValidators,capiroData,f49,f48,f0,f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f21,f22,f23,f24,f25,f26,f27,f28,f29,f30,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40,f41,f42,f43,f44,f45,f46,f47];
const byFamily=new Map(modules.map(f=>[f.id,f]));
export const GENERAL_READ_ADAPTER_FAMILIES=Object.freeze(modules.map(f=>f.id));
const TRANSPORT_FIELDS=['origin','endpoints','getCredentials','getEligibilityCredentials','credentialsForCall','authorizeResultForCall','delegatedTransport','readSource','fetchImpl','maxRequestMs','maxResponseBytes','readMemoryEligibility','registry'];
function constructFamilyHandlers(configuration,allowed=GENERAL_READ_ADAPTER_FAMILIES){
 const {families,now,newId}=ownFields(configuration,['families','now','newId']);
 if(typeof now!=='function'||typeof newId!=='function')deny('GATEWAY_CONFIGURATION');
 const configured=ownFields(families,[],allowed),rows=[];
 for(const [id,transport] of Object.entries(configured)){
  const family=byFamily.get(id),usesIds=['action-items-complete','operational-reads'].includes(id);
  const values=assertFamilyHandlerSet(id,family.createHandlers({...ownFields(transport,[],TRANSPORT_FIELDS),now,...(usesIds?{newId}:{})}));
  rows.push(...values.map(value=>({...value,family:id})));
 }
 return {ids:Object.keys(configured),rows};
}
/** Ordinary typed source registration. Source/image qualification runs at build and release, not on every data read. */
export function prepareGeneralReadFamilyHandlers(configuration){
 const {familyIds}=ownFields(configuration,['familyIds']),ids=frozenData(familyIds);
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!byFamily.has(id)))deny('GATEWAY_CONFIGURATION');
 return Object.freeze({create(configuration){return handlerMap(constructFamilyHandlers(configuration,ids).rows);}});
}
function handlerMap(rows){
 const handlers=new Map();
 for(const {operation,execute} of rows){const key=`${operation.id}@${operation.version}`;if(handlers.has(key))deny('GATEWAY_CONFIGURATION');handlers.set(key,Object.freeze({execute}));}
 return handlers;
}
export function createGeneralReadFamilyHandlers(configuration){return handlerMap(constructFamilyHandlers(configuration).rows);}
