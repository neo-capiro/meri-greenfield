/** Trusted client selection for the existing six-branch Core candidate search; no source lookup or authority here. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {frozenData} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {captureResearchClientSelection} from '../research-legal-legislation/request-context.mjs';

export function assertResearchCandidatesRequest(operation,request){
 let contract,raw;
 try{
  contract=resolveOperationContract(operation);
  if(contract.binding.group!=='research-legal-candidates')deny('GATEWAY_CONFIGURATION');
  raw=frozenData(request);validateShape('ResearchLegalCandidatesRequest',raw);
 }catch(error){if(error?.message==='GATEWAY_CONFIGURATION')throw error;deny('INVALID_ARGUMENTS');}
 return raw;
}

export function researchCandidatesContext(operation,request,resolution){
 const raw=assertResearchCandidatesRequest(operation,request);
 const context=Object.freeze({clientResolution:captureResearchClientSelection(raw,resolution)});
 try{resolveOperationContract(operation).normalizeInput(raw,context);}catch{deny('INVALID_ARGUMENTS');}
 return context;
}
