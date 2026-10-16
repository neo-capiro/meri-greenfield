/** Synthetic current-context/credential receipts and native HTTP JSON only; no Core qualification. */
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../sources/bill-text/test/fixture.mjs';
import {nativeResult,noEstimate} from '../../sources/public-reports/test/fixture.mjs';
import {acquisitionFixture,personId} from '../../sources/acquisition-personnel/test/fixtures.mjs';
import {setup as disclosuresFixture} from '../../sources/disclosures/test/fixture.mjs';

export const DISCLOSURE_FAMILY_CASES=Object.freeze(['search_lda_filings','search_sec_filings','search_fara_registrations'].map(id=>['disclosures',id]));

export const NATIVE_FAMILY_CASES=Object.freeze([
 ['public-reports','search_cbo_cost_estimates'],['public-reports','search_gao_reports'],['public-reports','search_crs_reports'],
 ['acquisition-personnel','search_acquisition_personnel'],['acquisition-personnel','get_acquisition_person'],
]);
export function nativeFamilyCase(family,id,{request=id==='get_acquisition_person'?{id:personId}:{},actorRole='standard_user'}={}){
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
