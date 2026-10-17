/** Shared CONTROL/adapter admission for the unscoped legal slice; no lookup, citation parser or authority creation. */
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData} from '../source-admission.mjs';

export const legalLegislationContext=Object.freeze({clientResolution:null,citationResolution:null});
export function assertUnscopedLegalRequest(operation,request){
 let contract;try{contract=resolveOperationContract(operation);}catch{deny('GATEWAY_CONFIGURATION');}
 if(contract.binding.group!=='research-legal-legislation')deny('GATEWAY_CONFIGURATION');
 let raw;
 try{raw=frozenData(request);validateShape(contract.binding.input.replace(/Input$/,'Request'),raw);}
 catch{deny('INVALID_ARGUMENTS');}
 if((raw.clientId?.trim().slice(0,80).trim()||null)!==null||raw.folderId||
  operation.id==='get_legal_reference'&&(raw.citation??'')!=='')deny('UNAVAILABLE');
 return raw;
}
