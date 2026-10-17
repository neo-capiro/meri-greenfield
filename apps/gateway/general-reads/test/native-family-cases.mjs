/** Synthetic current-context/credential receipts and native HTTP JSON only; no Core qualification. */
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../sources/bill-text/test/fixture.mjs';
import {nativeResult,noEstimate} from '../../sources/public-reports/test/fixture.mjs';
import {acquisitionFixture,personId} from '../../sources/acquisition-personnel/test/fixtures.mjs';
import {setup as disclosuresFixture} from '../../sources/disclosures/test/fixture.mjs';
import {directoryCase,requests as directoryRequests} from '../../sources/legislative-directory/test/fixture.mjs';
import {storedCase as peCase} from '../../sources/pe-references/test/fixture.mjs';
import {storedCase as federalCase} from '../../sources/federal-legislation/test/fixture.mjs';
import {storedCase as stateCase} from '../../sources/state-legislation/test/fixture.mjs';
import {storedCase as intelligenceCase} from '../../sources/stored-intelligence/test/fixture.mjs';
import {storedCase as docketCase} from '../../sources/regulatory-dockets/test/fixture.mjs';
import {storedCase as summaryCase} from '../../sources/intelligence-summary/test/fixture.mjs';
import {storedCase as webCase,ids as webIds} from '../../sources/public-web/test/fixture.mjs';
import {storedCase as dataCase,ids as dataIds} from '../../sources/data-search/test/fixture.mjs';
import {storedCase as queryCase,id as queryId} from '../../sources/public-domain-query/test/fixture.mjs';
import {storedCase as facilityCase,id as facilityId} from '../../sources/facility-representation/test/fixture.mjs';
import {storedCase as districtCase,ids as districtIds} from '../../sources/district-nexus/test/fixture.mjs';
import {storedCase as registryCase,id as registryId} from '../../sources/client-registry/test/fixture.mjs';
import {storedCase as marketCase,ids as marketIds} from '../../sources/federal-market/test/fixture.mjs';
import {storedCase as economicCase,id as economicId} from '../../sources/public-data/test/fixture.mjs';
import {storedCase as graphCase,id as graphId} from '../../sources/client-knowledge-search/test/fixture.mjs';
import {storedCase as statusCase,ids as statusIds} from '../../sources/state-status-votes/test/fixture.mjs';
import {storedCase as trackedCase,id as trackedId} from '../../sources/tracked-bills/test/fixture.mjs';
import {storedCase as hearingsCase,id as hearingsId} from '../../sources/public-domain-hearings/test/fixture.mjs';
import {storedCase as legalCase,ids as legalIds} from '../../sources/research-legal-legislation/test/fixture.mjs';
import {storedCase as newsCase,ids as newsIds} from '../../sources/research-legal-news/test/fixture.mjs';
import {storedCase as outreachCase,ids as outreachIds} from '../../sources/outreach-query/test/fixture.mjs';

export const DISCLOSURE_FAMILY_CASES=Object.freeze(['search_lda_filings','search_sec_filings','search_fara_registrations'].map(id=>['disclosures',id]));
export const GOVERNED_NEXT_FAMILY_CASES=Object.freeze([
 ...webIds.map(id=>['public-web',id]),...dataIds.map(id=>['data-search',id]),['public-domain-query',queryId],
 ['facility-representation',facilityId],...districtIds.map(id=>['district-nexus',id]),['client-registry',registryId],
 ...marketIds.map(id=>['federal-market',id]),
]);
export const SOURCE_SLICE_CASES=Object.freeze([
 ['public-data',economicId],['client-knowledge-search',graphId],...statusIds.map(id=>['state-status-votes',id]),
 ['tracked-bills',trackedId],['public-domain-hearings',hearingsId],...legalIds.map(id=>['research-legal-legislation',id]),...newsIds.map(id=>['research-legal-news',id]),
 ...outreachIds.map(id=>['outreach-query',id]),
]);

export const NATIVE_FAMILY_CASES=Object.freeze([
 ['public-reports','search_cbo_cost_estimates'],['public-reports','search_gao_reports'],['public-reports','search_crs_reports'],
 ['acquisition-personnel','search_acquisition_personnel'],['acquisition-personnel','get_acquisition_person'],
 ['legislative-directory','get_committee_roster'],['legislative-directory','list_members'],
 ['pe-references','get_pe_bills'],['pe-references','get_pe_contractors'],['pe-references','get_pe_report_language'],
 ['federal-legislation','get_bill_status'],['federal-legislation','search_floor_votes'],
 ['state-legislation','search_state_bills'],['state-legislation','get_state_legislator'],
 ['stored-intelligence','search_intel_articles'],['regulatory-dockets','query_regulatory_dockets'],['intelligence-summary','query_intelligence'],
 ...GOVERNED_NEXT_FAMILY_CASES,
 ...SOURCE_SLICE_CASES,
]);
const storedCases={'pe-references':peCase,'federal-legislation':federalCase,'state-legislation':stateCase,'stored-intelligence':intelligenceCase,'regulatory-dockets':docketCase,'intelligence-summary':summaryCase,
 'public-web':webCase,'data-search':dataCase,'public-domain-query':queryCase,'facility-representation':facilityCase,'district-nexus':districtCase,'client-registry':registryCase,'federal-market':marketCase,
 'public-data':economicCase,'client-knowledge-search':graphCase,'state-status-votes':statusCase,'tracked-bills':trackedCase,'public-domain-hearings':hearingsCase,'research-legal-legislation':legalCase,'research-legal-news':newsCase,'outreach-query':outreachCase};
export function nativeFamilyCase(family,id,options={}){
 if(Object.hasOwn(storedCases,family))return storedCases[family](id,options);
 const {request=directoryRequests[id]??(id==='get_acquisition_person'?{id:personId}:{}),actorRole='standard_user'}=options;
 if(family==='legislative-directory')return directoryCase(id,{request});
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext=family==='acquisition-personnel'?{actorRole}:{};
 if(contract.binding.group!==family)throw Error('SYNTHETIC_FAMILY_MISMATCH');
 scene.authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 scene.authority.decision.operation=`${id}@0.2.0`;
 const page=family==='public-reports'?nativeResult(id):family==='disclosures'?disclosuresFixture(id,request).page:acquisitionFixture(id,{request,actorRole}).result;
 const {state,now,authority,wire}=scene;
 const transport={...scene.transport,async fetchImpl(url,options){
  const body=JSON.parse(options.body);wire.push({url,options,body});
  const value=state.empty&&id==='search_cbo_cost_estimates'?{tool:id,generatedAt:new Date(now()),estimatesFound:0,estimates:[],note:noEstimate(request.billId?.trim())}:structuredClone(state.page??page);
  state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();
  return state.responseFactory?state.responseFactory(value):Response.json(value);
 }};
 // Echo-only authority fixture. Mounted credential-owner controls replace it with the real CONTROL implementation.
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:normalizationContext,checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 return {...scene,family,operation,contract,arguments:request,normalizationContext,transport,nativeReadContextPorts,page};
}
